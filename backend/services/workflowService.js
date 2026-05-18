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
 * Phase 4.26: shared notifier for auto-chain creates.
 *
 * Fires a persistent Notification + Socket.IO event so list views and
 * the bell can update without a manual refresh. Best-effort: silently
 * swallows errors (the upstream chain hop already succeeded; a missed
 * notification must not roll back business state).
 */
async function notifyAutoChain(userId, entityType, entityId, data, link) {
  if (!userId) return;
  const message = data && data.message ? data.message : `${entityType} auto-created`;

  // notificationService.createNotification persists the Notification row,
  // emits Socket.IO, AND fires Expo push to every active device token
  // via expoPushService (Phase 4.26d). Single call covers all three
  // notification channels; nothing else to fan out here.
  // Pass `kind: 'auto_chain'` in data so the mobile push-tap handler
  // routes to the right entity tab (useDevModePushNotifications.ts).
  try {
    const notificationService = require('./notificationService');
    await notificationService.createNotification(
      userId,
      'auto_chain',
      'Workflow update',
      message,
      { kind: 'auto_chain', entityType, entityId, ...(data || {}) },
      link || null,
    );
  } catch (_) { /* best-effort */ }
}

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

  await notifyAutoChain(userId, 'ProformaInvoice', pi.id, { message: `Pro Forma ${piNumber} auto-created from accepted quotation ${fullQuotation.quotationNumber}.`, phase: '4.25a' }, `/proforma-invoices/${pi.id}`);

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

  await notifyAutoChain(userId, 'SalesOrder', salesOrder.id, { message: `Sales Order ${salesOrder.orderNumber} auto-created from confirmed Pro Forma ${fullPI.piNumber}.`, phase: '4.25b' }, `/sales-orders/${salesOrder.id}`);

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

  if (created.length > 0) {
    await notifyAutoChain(userId, 'PurchaseOrder', fullSO.id, { message: `${created.length} Purchase Order(s) auto-created from confirmed Sales Order ${fullSO.orderNumber}.`, phase: '4.25c', poIds: created.map(po => po.id), poNumbers: created.map(po => po.poNumber) }, `/sales-orders/${fullSO.id}`);
  }

  return { ok: true, created, alreadyExisted, skipped };
}


/**
 * onPurchaseOrderConfirmed (Phase 4.25d).
 *
 * Side-effect of PurchaseOrder.confirm: auto-create a pending GRN
 * (expected receipt) with items copied from the PO. Fourth chain hop:
 * Quote -> Proforma -> SO -> PO -> GRN.
 *
 * Idempotency: GoodsReceivedNote.poId is the natural key. If a GRN
 * already exists for this PO, the existing row is returned.
 *
 * The GRN stores items as a JSON array (not a separate Item table)
 * matching the existing GoodsReceivedNote model shape. Each entry:
 * { productId, description, quantity, quantityReceived: 0, unit,
 *   unitPrice, total }.
 *
 * @param {object} purchaseOrder - Sequelize PurchaseOrder instance.
 * @param {object} ctx - { userId, ip, source, receivedDate? }
 * @returns {Promise<{ok, grn?, alreadyExisted?, code?, message?}>}
 */
async function onPurchaseOrderConfirmed(purchaseOrder, ctx = {}) {
  const { userId, ip, source = 'unknown', receivedDate } = ctx;

  if (!purchaseOrder || !purchaseOrder.id) {
    return { ok: false, code: 'invalid_input', message: 'purchaseOrder with id is required' };
  }

  const existing = await db.GoodsReceivedNote.findOne({
    where: { poId: purchaseOrder.id },
  });
  if (existing) {
    return { ok: true, grn: existing, alreadyExisted: true };
  }

  const fullPO = await db.PurchaseOrder.findByPk(purchaseOrder.id, {
    include: [{ association: 'items' }],
  });
  if (!fullPO) {
    return { ok: false, code: 'not_found', message: 'PurchaseOrder not found at workflow time' };
  }

  // GRN items are a JSON array of objects mirroring the PO line items.
  // quantityReceived starts at 0 because this is an expected-receipt
  // record. The actual receive flow will update quantityReceived when
  // the goods physically arrive.
  const items = (fullPO.items || []).map(it => ({
    productId: it.productId,
    description: it.description,
    quantity: Number(it.quantity),
    quantityReceived: 0,
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    total: Number(it.total),
  }));

  const grn = await db.GoodsReceivedNote.create({
    id: uuidv4(),
    grnNumber: `GRN-${Date.now()}`,
    poId: fullPO.id,
    receivedDate: receivedDate || new Date(),
    receivedBy: userId || null,
    items,
    status: 'pending',
    inspectionStatus: 'pending',
  });

  auditService.logAction(
    userId || null,
    'auto_create',
    'GoodsReceivedNote',
    grn.id,
    {
      sourceEntity: 'PurchaseOrder',
      sourceId: fullPO.id,
      sourcePoNumber: fullPO.poNumber,
      trigger: 'purchase_order.confirm',
      phase: '4.25d',
      grnNumber: grn.grnNumber,
      itemCount: items.length,
      source,
    },
    ip || null,
  ).catch(() => {});

  await notifyAutoChain(userId, 'GoodsReceivedNote', grn.id, { message: `Expected GRN ${grn.grnNumber} auto-created from confirmed PO ${fullPO.poNumber}.`, phase: '4.25d' }, `/grns/${grn.id}`);

  return { ok: true, grn, alreadyExisted: false };
}


/**
 * onGoodsReceivedNoteAccepted (Phase 4.25e).
 *
 * Side-effect of GRN.accept: auto-create a draft sales Invoice tied
 * to the upstream SalesOrder. Fifth chain hop:
 * Quote -> Proforma -> SO -> PO -> GRN -> Invoice.
 *
 * Idempotency: Invoice does not have a sourceGrnId column. Pending a
 * future migration, we store the source GRN id inside Invoice.notes
 * as the marker `[auto-from-grn:<grnId>]` and check for it via LIKE.
 * This is a transitional pattern; a clean column comes with Phase
 * 4.25.1 (the migration cleanup pass).
 *
 * Relationship chain: GRN -> PurchaseOrder -> SalesOrder -> Customer.
 * If the upstream SO cannot be resolved (e.g. a free-standing PO with
 * no salesOrderId), the workflow returns { ok: false,
 * code: 'so_unresolved' }.
 *
 * @param {object} grn - Sequelize GoodsReceivedNote instance.
 * @param {object} ctx - { userId, ip, source, dueDate? }
 * @returns {Promise<{ok, invoice?, alreadyExisted?, code?, message?}>}
 */
async function onGoodsReceivedNoteAccepted(grn, ctx = {}) {
  const { userId, ip, source = 'unknown', dueDate } = ctx;

  if (!grn || !grn.id) {
    return { ok: false, code: 'invalid_input', message: 'grn with id is required' };
  }

  // Re-fetch with PO so we can resolve the SO.
  const fullGRN = await db.GoodsReceivedNote.findByPk(grn.id, {
    include: [{ model: db.PurchaseOrder, as: 'purchaseOrder' }],
  });
  if (!fullGRN) {
    return { ok: false, code: 'not_found', message: 'GRN not found at workflow time' };
  }

  const po = fullGRN.purchaseOrder;
  if (!po || !po.salesOrderId) {
    return {
      ok: false,
      code: 'so_unresolved',
      message: 'Cannot auto-create Invoice: GRN PO has no salesOrderId.',
    };
  }

  // Idempotency via notes marker.
  const marker = `[auto-from-grn:${fullGRN.id}]`;
  const existing = await db.Invoice.findOne({
    where: {
      salesOrderId: po.salesOrderId,
      notes: { [db.Sequelize.Op.like]: `%${marker}%` },
    },
  });
  if (existing) {
    return { ok: true, invoice: existing, alreadyExisted: true };
  }

  const so = await db.SalesOrder.findByPk(po.salesOrderId);
  if (!so) {
    return { ok: false, code: 'so_unresolved', message: 'SalesOrder referenced by PO was not found.' };
  }

  // Items come from the GRN JSON. Use quantityReceived if set (post-receive
  // accept) else fall back to the expected quantity from the PO.
  const grnItems = Array.isArray(fullGRN.items) ? fullGRN.items
    : (typeof fullGRN.items === 'string' ? JSON.parse(fullGRN.items) : []);
  const subtotal = grnItems.reduce((s, it) => {
    const qty = Number(it.quantityReceived != null ? it.quantityReceived : it.quantity) || 0;
    const unitPrice = Number(it.unitPrice) || 0;
    return s + qty * unitPrice;
  }, 0);

  const invoiceNumber = `INV-${Date.now()}`;
  const dueDateResolved = dueDate || (so.estimatedDelivery
    ? new Date(new Date(so.estimatedDelivery).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  const invoice = await db.Invoice.create({
    id: uuidv4(),
    invoiceNumber,
    salesOrderId: so.id,
    customerId: so.customerId,
    brandCode: so.brandCode || 'SH',
    type: 'sales',
    status: 'draft',
    subtotal,
    total: subtotal,
    balance: subtotal,
    paidAmount: 0,
    currency: so.currency,
    dueDate: dueDateResolved,
    paymentTerms: 'Net 30',
    notes: marker,
  });

  for (const it of grnItems) {
    const qty = Number(it.quantityReceived != null ? it.quantityReceived : it.quantity) || 0;
    const unitPrice = Number(it.unitPrice) || 0;
    await db.InvoiceItem.create({
      id: uuidv4(),
      invoiceId: invoice.id,
      productId: it.productId,
      description: it.description || '',
      quantity: qty,
      unit: it.unit || 'sqm',
      unitPrice,
      total: qty * unitPrice,
    });
  }

  auditService.logAction(
    userId || null,
    'auto_create',
    'Invoice',
    invoice.id,
    {
      sourceEntity: 'GoodsReceivedNote',
      sourceId: fullGRN.id,
      sourceGrnNumber: fullGRN.grnNumber,
      relatedSalesOrderId: so.id,
      trigger: 'grn.accept',
      phase: '4.25e',
      invoiceNumber,
      source,
    },
    ip || null,
  ).catch(() => {});

  await notifyAutoChain(userId, 'Invoice', invoice.id, { message: `Draft Invoice ${invoiceNumber} auto-created from accepted GRN ${fullGRN.grnNumber}.`, phase: '4.25e' }, `/invoices/${invoice.id}`);

  return { ok: true, invoice, alreadyExisted: false };
}


/**
 * onPaymentConfirmed (Phase 4.25f).
 *
 * Side-effect of Payment.confirm: sum every confirmed Payment for the
 * referenced Invoice and transition the Invoice status accordingly.
 * Sixth chain hop. Unlike earlier hops this does NOT create a new
 * entity; it updates Invoice.paidAmount, Invoice.balance, and
 * Invoice.status based on the sum.
 *
 * Idempotency: the calculation re-sums ALL confirmed Payments for
 * the Invoice from scratch every time. Re-running yields the same
 * paidAmount and balance. Fixes a latent double-counting bug in the
 * previous inline route handler logic (which incremented
 * paidAmount with each call regardless of prior state).
 *
 * Status rules:
 *   - sum >= total            -> paid
 *   - 0 < sum < total         -> partially_paid
 *   - sum == 0 (no confirmed) -> sent (or unchanged if draft)
 *
 * @param {object} payment - Sequelize Payment instance (status already set to confirmed).
 * @param {object} ctx - { userId, ip, source }
 * @returns {Promise<{ok, invoice?, paidAmount?, balance?,
 *   statusBefore?, statusAfter?, code?, message?}>}
 */
async function onPaymentConfirmed(payment, ctx = {}) {
  const { userId, ip, source = 'unknown' } = ctx;

  if (!payment || !payment.id || !payment.invoiceId) {
    return { ok: false, code: 'invalid_input', message: 'payment with id and invoiceId is required' };
  }

  const invoice = await db.Invoice.findByPk(payment.invoiceId);
  if (!invoice) {
    return { ok: false, code: 'not_found', message: 'Invoice not found at workflow time' };
  }

  // Sum every confirmed Payment against this Invoice.
  const confirmed = await db.Payment.findAll({
    where: { invoiceId: invoice.id, status: 'confirmed' },
  });
  const paidAmount = confirmed.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.total);
  const balance = Math.max(0, total - paidAmount);

  let newStatus;
  if (paidAmount >= total && total > 0) {
    newStatus = 'paid';
  } else if (paidAmount > 0) {
    newStatus = 'partially_paid';
  } else {
    newStatus = invoice.status === 'draft' ? 'draft' : 'sent';
  }

  const statusBefore = invoice.status;
  await invoice.update({
    paidAmount,
    balance,
    status: newStatus,
  });

  auditService.logAction(
    userId || null,
    'auto_update',
    'Invoice',
    invoice.id,
    {
      sourceEntity: 'Payment',
      sourceId: payment.id,
      trigger: 'payment.confirm',
      phase: '4.25f',
      statusBefore,
      statusAfter: newStatus,
      paidAmountBefore: Number(invoice.paidAmount),
      paidAmountAfter: paidAmount,
      balance,
      confirmedPaymentCount: confirmed.length,
      source,
    },
    ip || null,
  ).catch(() => {});

  if (statusBefore !== newStatus) {
    await notifyAutoChain(userId, 'Invoice', invoice.id, { message: `Invoice ${invoice.invoiceNumber} status: ${statusBefore} -> ${newStatus}.`, phase: '4.25f', statusBefore, statusAfter: newStatus, paidAmount, balance }, `/invoices/${invoice.id}`);
  }

  return {
    ok: true,
    invoice,
    paidAmount,
    balance,
    statusBefore,
    statusAfter: newStatus,
  };
}


/**
 * onSalesOrderShipped (Phase 4.25g).
 *
 * Side-effect of SalesOrder.status -> 'shipped': auto-create a draft
 * PackingList tied to the SO if none exists. Seventh chain hop.
 *
 * Idempotency: PackingList.salesOrderId is the natural key (one PL
 * per SO; future enhancement may allow split packing for partial
 * shipments).
 */
async function onSalesOrderShipped(salesOrder, ctx = {}) {
  const { userId, ip, source = 'unknown' } = ctx;

  if (!salesOrder || !salesOrder.id) {
    return { ok: false, code: 'invalid_input', message: 'salesOrder with id is required' };
  }

  const existing = await db.PackingList.findOne({
    where: { salesOrderId: salesOrder.id },
  });
  if (existing) {
    return { ok: true, packingList: existing, alreadyExisted: true };
  }

  const pl = await db.PackingList.create({
    id: uuidv4(),
    packingListNumber: `PL-${Date.now()}`,
    salesOrderId: salesOrder.id,
    status: 'draft',
    totalPackages: 0,
    totalGrossWeight: 0,
    totalNetWeight: 0,
    totalVolume: 0,
  });

  auditService.logAction(
    userId || null,
    'auto_create',
    'PackingList',
    pl.id,
    {
      sourceEntity: 'SalesOrder',
      sourceId: salesOrder.id,
      sourceOrderNumber: salesOrder.orderNumber,
      trigger: 'sales_order.shipped',
      phase: '4.25g',
      packingListNumber: pl.packingListNumber,
      source,
    },
    ip || null,
  ).catch(() => {});

  await notifyAutoChain(userId, 'PackingList', pl.id, { message: `Draft Packing List ${pl.packingListNumber} auto-created for shipped SO.`, phase: '4.25g' }, `/packing-lists/${pl.id}`);

  return { ok: true, packingList: pl, alreadyExisted: false };
}

/**
 * onShipmentDelivered (Phase 4.25g).
 *
 * Side-effect of Shipment.status -> 'delivered': auto-transition the
 * related SalesOrder to 'delivered' if it is currently in_transit or
 * shipped. Eighth chain hop. Closes the visible operational loop:
 * once the carrier confirms physical delivery, the SO list reflects
 * it without any manual user action.
 *
 * Idempotency: if SO is already 'delivered' or 'completed', no-op.
 */
async function onShipmentDelivered(shipment, ctx = {}) {
  const { userId, ip, source = 'unknown' } = ctx;

  if (!shipment || !shipment.id) {
    return { ok: false, code: 'invalid_input', message: 'shipment with id is required' };
  }
  if (!shipment.salesOrderId) {
    return { ok: false, code: 'so_unresolved', message: 'Shipment has no salesOrderId' };
  }

  const so = await db.SalesOrder.findByPk(shipment.salesOrderId);
  if (!so) {
    return { ok: false, code: 'not_found', message: 'SalesOrder not found at workflow time' };
  }

  if (so.status === 'delivered' || so.status === 'completed') {
    return { ok: true, salesOrder: so, alreadyExisted: true, statusBefore: so.status, statusAfter: so.status };
  }

  if (so.status !== 'in_transit') {
    return {
      ok: false,
      code: 'status_transition_invalid',
      message: `Cannot auto-transition SO from ${so.status} to delivered. Model hook requires in_transit as prior status. Promote SO through shipped -> in_transit first.`,
    };
  }

  const statusBefore = so.status;
  await so.update({ status: 'delivered', actualDelivery: new Date() });

  auditService.logAction(
    userId || null,
    'auto_update',
    'SalesOrder',
    so.id,
    {
      sourceEntity: 'Shipment',
      sourceId: shipment.id,
      sourceShipmentNumber: shipment.shipmentNumber,
      trigger: 'shipment.delivered',
      phase: '4.25g',
      statusBefore,
      statusAfter: 'delivered',
      source,
    },
    ip || null,
  ).catch(() => {});

  await notifyAutoChain(userId, 'SalesOrder', so.id, { message: `SO ${so.orderNumber} auto-transitioned to delivered (shipment delivered).`, phase: '4.25g', statusBefore, statusAfter: 'delivered' }, `/sales-orders/${so.id}`);

  return { ok: true, salesOrder: so, alreadyExisted: false, statusBefore, statusAfter: 'delivered' };
}

module.exports = {
  onQuotationAccepted,
  onProformaInvoiceConfirmed,
  onSalesOrderConfirmed,
  onPurchaseOrderConfirmed,
  onGoodsReceivedNoteAccepted,
  onPaymentConfirmed,
  onSalesOrderShipped,
  onShipmentDelivered,
};
