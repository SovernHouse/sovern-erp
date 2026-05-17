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


/**
 * onSalesOrderConfirmed (Phase 4.25c).
 *
 * Side-effect of SalesOrder.confirm: auto-create one draft PurchaseOrder
 * for each unique factory referenced by the SO line items. Third chain
 * hop of the international-trade order-to-cash chain. Factories are
 * grouped by Product.factoryId; line items for the same factory are
 * bundled into the same PO.
 *
 * Idempotency: (PurchaseOrder.salesOrderId, factoryId) is the natural
 * compound key. The method first lists existing POs for this SO; for
 * each factory already represented, skip the create and reuse the
 * existing PO. The return shape includes both created and alreadyExisted
 * lists so the caller can report exactly what happened.
 *
 * Brand-code inheritance: each PO inherits brandCode from the SO.
 *
 * Line-item grouping: each SO item carries productId; the workflow
 * looks up Product.factoryId for grouping. If an item is sourced from
 * a product without a factoryId, it is skipped with a warning entry
 * in the audit row. Future Phase 4.25 work may allow per-item factory
 * override (i.e. line-level factoryId on SalesOrderItem).
 *
 * @param {object} salesOrder - Sequelize SalesOrder instance.
 * @param {object} ctx - { userId, ip, source }
 * @returns {Promise<{ok, created: PO[], alreadyExisted: PO[],
 *   skipped: SOItem[], code?, message?}>}
 */
async function onSalesOrderConfirmed(salesOrder, ctx = {}) {
  const { userId, ip, source = 'unknown' } = ctx;

  if (!salesOrder || !salesOrder.id) {
    return { ok: false, code: 'invalid_input', message: 'salesOrder with id is required' };
  }

  // Re-fetch with items + product so we know each line factoryId.
  const fullSO = await db.SalesOrder.findByPk(salesOrder.id, {
    include: [
      {
        association: 'items',
        include: [{ model: db.Product, as: 'product' }],
      },
    ],
  });
  if (!fullSO) {
    return { ok: false, code: 'not_found', message: 'SalesOrder not found at workflow time' };
  }

  // Group items by factoryId. Items without product.factoryId are skipped.
  const groups = new Map();   // factoryId -> [items]
  const skipped = [];
  for (const item of (fullSO.items || [])) {
    const fid = item.product && item.product.factoryId;
    if (!fid) {
      skipped.push({ itemId: item.id, productId: item.productId, reason: 'no factoryId on product' });
      continue;
    }
    if (!groups.has(fid)) groups.set(fid, []);
    groups.get(fid).push(item);
  }

  // Idempotency: existing POs for this SO.
  const existingPOs = await db.PurchaseOrder.findAll({
    where: { salesOrderId: fullSO.id },
  });
  const existingByFactory = new Map();
  for (const po of existingPOs) existingByFactory.set(po.factoryId, po);

  const created = [];
  const alreadyExisted = [];

  for (const [factoryId, items] of groups.entries()) {
    if (existingByFactory.has(factoryId)) {
      alreadyExisted.push(existingByFactory.get(factoryId));
      continue;
    }
    const subtotal = items.reduce((s, it) => s + Number(it.total), 0);
    const { generateDocumentNumber } = require('../utils/helpers');
    const po = await db.PurchaseOrder.create({
      id: uuidv4(),
      poNumber: generateDocumentNumber('PO'),
      salesOrderId: fullSO.id,
      factoryId,
      brandCode: fullSO.brandCode || 'SH',
      status: 'draft',
      subtotal,
      total: subtotal,
      currency: fullSO.currency,
    });
    for (const item of items) {
      await db.PurchaseOrderItem.create({
        id: uuidv4(),
        purchaseOrderId: po.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      });
    }
    created.push(po);
  }

  auditService.logAction(
    userId || null,
    'auto_create',
    'PurchaseOrder',
    fullSO.id,   // anchor the audit on the SO (multiple POs created from one SO)
    {
      sourceEntity: 'SalesOrder',
      sourceId: fullSO.id,
      sourceOrderNumber: fullSO.orderNumber,
      trigger: 'sales_order.confirm',
      phase: '4.25c',
      createdCount: created.length,
      alreadyExistedCount: alreadyExisted.length,
      skippedCount: skipped.length,
      createdPOIds: created.map(po => po.id),
      createdPONumbers: created.map(po => po.poNumber),
      skippedItems: skipped,
      source,
    },
    ip || null,
  ).catch(() => {});

  return { ok: true, created, alreadyExisted, skipped };
}

module.exports = {
  onQuotationAccepted,
  onProformaInvoiceConfirmed,
  onSalesOrderConfirmed,
};
