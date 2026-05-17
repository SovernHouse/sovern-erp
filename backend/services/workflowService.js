/**
 * workflowService — Phase 4.25 (Order-to-Cash auto-chain).
 *
 * One module per chain trigger. Hooks fire as side-effects of status
 * transitions on upstream entities. Each method is idempotent: re-running
 * the trigger does not create a duplicate downstream record. Each method
 * writes an audit row tagged `auto_create` so the chain is traceable.
 *
 * Failure mode (best-effort): the caller decides whether downstream
 * failure rolls back the upstream status. The default convention is
 * caller-await + caller-try/catch + caller logs the failure to audit
 * with `auto_create_failed`. This module never throws ambiguous errors
 * upward; on a non-fatal failure it returns { ok: false, code, message }.
 *
 * Architecturally shared between REST and MCP per L-045 (service-layer
 * convergence). New chain hops add a method here; callers in
 * controllers/* and mcp/erpToolServer.js delegate to it.
 *
 * Methods (this file, more land in future phases):
 *   - onQuotationAccepted (Phase 4.25a)  Quote.accept -> ProformaInvoice
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const auditService = require('./auditService');
const { generateNumberWithCounter, incrementCounter } = require('./numberGenerator');

/**
 * onQuotationAccepted (Phase 4.25a).
 *
 * Side-effect of Quote.accept: auto-create a draft Pro Forma Invoice
 * tied to the quotation. International-trade-standard chain step:
 * customers need a Pro Forma to open LCs, run internal procurement
 * approvals, or pay deposits.
 *
 * Idempotency: ProformaInvoice.quotationId is the natural key. If a
 * Pro Forma already exists for this quotation, the existing row is
 * returned and no second insert happens. Re-accepting a quotation
 * (which the model allows by going draft -> sent -> accepted multiple
 * times across revisions in theory) does not multiply Pro Formas.
 *
 * Brand-code inheritance: the new Pro Forma inherits brandCode from
 * the upstream quotation (the ProformaInvoice model defaulted to 'SH',
 * which silently mis-branded FW quotations under the previous manual
 * convertToProformaInvoice handler). This is a quiet bug fix that
 * lands as part of the chain hop.
 *
 * @param {object} quotation - Sequelize Quotation instance. Only id
 *   is strictly required; the method re-fetches with items/customer.
 * @param {object} ctx - { userId, ip, source, paymentTerms? }
 * @returns {Promise<{ok: boolean, proformaInvoice?, alreadyExisted?,
 *   code?, message?}>}
 */
async function onQuotationAccepted(quotation, ctx = {}) {
  const { userId, ip, source = 'unknown', paymentTerms } = ctx;

  if (!quotation || !quotation.id) {
    return { ok: false, code: 'invalid_input', message: 'quotation with id is required' };
  }

  // Idempotency: bail early if a Pro Forma exists for this Quote.
  const existing = await db.ProformaInvoice.findOne({
    where: { quotationId: quotation.id },
  });
  if (existing) {
    return { ok: true, proformaInvoice: existing, alreadyExisted: true };
  }

  // Re-fetch with line items + customer so we can copy them.
  const fullQuotation = await db.Quotation.findByPk(quotation.id, {
    include: [
      { association: 'items' },
      { model: db.Customer, as: 'customer' },
    ],
  });
  if (!fullQuotation) {
    return { ok: false, code: 'not_found', message: 'Quotation not found at workflow time' };
  }

  // Sequential PI number (same convention as the manual converter).
  const lastPI = await db.ProformaInvoice.findOne({
    order: [['createdAt', 'DESC']],
  });
  const counter = incrementCounter(lastPI?.piNumber);
  const piNumber = generateNumberWithCounter(
    process.env.DOC_PREFIX_PI || 'PI',
    counter,
  );

  const pi = await db.ProformaInvoice.create({
    id: uuidv4(),
    piNumber,
    quotationId: fullQuotation.id,
    customerId: fullQuotation.customerId,
    brandCode: fullQuotation.brandCode || 'SH',
    status: 'draft',
    subtotal: fullQuotation.subtotal,
    discount: fullQuotation.discount,
    tax: fullQuotation.tax,
    total: fullQuotation.total,
    currency: fullQuotation.currency,
    paymentTerms: paymentTerms || 'Net 30',
    validUntil: fullQuotation.validUntil,
  });

  if (Array.isArray(fullQuotation.items)) {
    for (const item of fullQuotation.items) {
      await db.ProformaInvoiceItem.create({
        id: uuidv4(),
        proformaInvoiceId: pi.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      });
    }
  }

  // Audit the chain hop. Tagged `auto_create` and includes the source
  // entity coordinates so downstream analyses can distinguish auto vs
  // manual Pro Forma creation.
  auditService.logAction(
    userId || null,
    'auto_create',
    'ProformaInvoice',
    pi.id,
    {
      sourceEntity: 'Quotation',
      sourceId: fullQuotation.id,
      sourceQuotationNumber: fullQuotation.quotationNumber,
      trigger: 'quotation.accept',
      phase: '4.25a',
      piNumber,
      source,
    },
    ip || null,
  ).catch(() => {});

  return { ok: true, proformaInvoice: pi, alreadyExisted: false };
}


/**
 * onProformaInvoiceConfirmed (Phase 4.25b).
 *
 * Side-effect of ProformaInvoice.confirm: auto-create a SalesOrder
 * tied to this PI. Second chain hop of the international-trade
 * order-to-cash chain.
 *
 * Idempotency: SalesOrder.proformaInvoiceId is the natural key. If a
 * SO already exists for this PI, the existing row is returned and no
 * second insert happens.
 *
 * factoryId resolution: the SalesOrder model requires factoryId (NOT
 * NULL). Resolution order:
 *   1. ctx.factoryId (caller supplied; preferred when user picked one)
 *   2. The factoryId of the first line item's Product (auto-derive)
 *
 * If neither resolves, returns { ok: false, code: 'factory_unresolved' }.
 * The caller should surface this to the user and let them pick. The
 * upstream PI.status='confirmed' transition is NOT rolled back; the
 * user can re-trigger the chain by hitting confirm again with a
 * factoryId in the body.
 *
 * Brand-code inheritance: SalesOrder inherits from PI (same pattern
 * as 4.25a Proforma inheriting from Quotation).
 *
 * @param {object} proforma - Sequelize ProformaInvoice. Only id required.
 * @param {object} ctx - { userId, ip, source, factoryId?, estimatedDelivery? }
 * @returns {Promise<{ok, salesOrder?, alreadyExisted?, code?, message?}>}
 */
async function onProformaInvoiceConfirmed(proforma, ctx = {}) {
  const { userId, ip, source = 'unknown', factoryId, estimatedDelivery } = ctx;

  if (!proforma || !proforma.id) {
    return { ok: false, code: 'invalid_input', message: 'proforma with id is required' };
  }

  // Idempotency: bail early if a SO exists for this PI.
  const existing = await db.SalesOrder.findOne({
    where: { proformaInvoiceId: proforma.id },
  });
  if (existing) {
    return { ok: true, salesOrder: existing, alreadyExisted: true };
  }

  const fullPI = await db.ProformaInvoice.findByPk(proforma.id, {
    include: [
      {
        association: 'items',
        include: [{ model: db.Product, as: 'product' }],
      },
    ],
  });
  if (!fullPI) {
    return { ok: false, code: 'not_found', message: 'ProformaInvoice not found at workflow time' };
  }

  let resolvedFactoryId = factoryId || null;
  if (!resolvedFactoryId && Array.isArray(fullPI.items) && fullPI.items.length > 0) {
    for (const item of fullPI.items) {
      if (item.product && item.product.factoryId) {
        resolvedFactoryId = item.product.factoryId;
        break;
      }
    }
  }
  if (!resolvedFactoryId) {
    return {
      ok: false,
      code: 'factory_unresolved',
      message: 'Cannot auto-create SalesOrder: no factoryId on ctx or on any line item Product.',
    };
  }

  const { generateDocumentNumber } = require('../utils/helpers');
  const salesOrder = await db.SalesOrder.create({
    id: uuidv4(),
    orderNumber: generateDocumentNumber('SO'),
    proformaInvoiceId: fullPI.id,
    customerId: fullPI.customerId,
    factoryId: resolvedFactoryId,
    brandCode: fullPI.brandCode || 'SH',
    status: 'confirmed',
    subtotal: fullPI.subtotal,
    discount: fullPI.discount,
    tax: fullPI.tax,
    total: fullPI.total,
    currency: fullPI.currency,
    estimatedDelivery: estimatedDelivery || null,
  });

  if (Array.isArray(fullPI.items)) {
    for (const item of fullPI.items) {
      await db.SalesOrderItem.create({
        id: uuidv4(),
        salesOrderId: salesOrder.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      });
    }
  }

  auditService.logAction(
    userId || null,
    'auto_create',
    'SalesOrder',
    salesOrder.id,
    {
      sourceEntity: 'ProformaInvoice',
      sourceId: fullPI.id,
      sourcePiNumber: fullPI.piNumber,
      trigger: 'proforma.confirm',
      phase: '4.25b',
      orderNumber: salesOrder.orderNumber,
      factoryId: resolvedFactoryId,
      factoryIdSource: factoryId ? 'ctx' : 'auto-derived from line item',
      source,
    },
    ip || null,
  ).catch(() => {});

  return { ok: true, salesOrder, alreadyExisted: false };
}

module.exports = {
  onQuotationAccepted,
  onProformaInvoiceConfirmed,
};
