/**
 * Phase 4.25e — workflowService.onGoodsReceivedNoteAccepted unit test.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25e — workflowService.onGoodsReceivedNoteAccepted', () => {
  let db, workflowService;
  let customer, factory, category, product;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });
    category = await db.ProductCategory.create({ id: uuidv4(), name: 'Cat' });
    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'F',
      email: 'f@test.com',
      phone: '+1',
      contactPerson: 'F',
      country: 'CN',
      isActive: true,
    });
    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Customer Co',
      email: 'c@test.com',
      phone: '+1',
      contactPerson: 'C',
      country: 'US',
      currency: 'USD',
      paymentTerms: 'Net 30',
      isActive: true,
    });
    product = await db.Product.create({
      id: uuidv4(),
      name: 'P',
      sku: `P-${Date.now()}`,
      unit: 'sqm',
      basePrice: 25,
      isActive: true,
      categoryId: category.id,
      factoryId: factory.id,
    });
  }, 60000);

  afterAll(async () => {
    if (db && db.sequelize) await db.sequelize.close();
  });

  async function createSOPOGRN({ items = [{ qty: 10, unitPrice: 100 }] } = {}) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const so = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: `SO-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      factoryId: factory.id,
      brandCode: 'SH',
      status: 'confirmed',
      subtotal,
      total: subtotal,
      currency: 'USD',
    });
    const po = await db.PurchaseOrder.create({
      id: uuidv4(),
      poNumber: `PO-${uuidv4().slice(0, 8)}`,
      salesOrderId: so.id,
      factoryId: factory.id,
      brandCode: 'SH',
      status: 'confirmed',
      subtotal,
      total: subtotal,
      currency: 'USD',
    });
    const grnItems = items.map(it => ({
      productId: product.id,
      description: 'Test item',
      quantity: it.qty,
      quantityReceived: it.qty,
      unit: 'sqm',
      unitPrice: it.unitPrice,
      total: it.qty * it.unitPrice,
    }));
    const grn = await db.GoodsReceivedNote.create({
      id: uuidv4(),
      grnNumber: `GRN-${Date.now()}`,
      poId: po.id,
      receivedDate: new Date(),
      receivedBy: null,
      items: grnItems,
      status: 'pending',
      inspectionStatus: 'pending',
    });
    return { so, po, grn };
  }

  it('creates a draft Invoice with totals from GRN line items', async () => {
    const { so, grn } = await createSOPOGRN({ items: [{ qty: 10, unitPrice: 100 }, { qty: 5, unitPrice: 200 }] });

    const result = await workflowService.onGoodsReceivedNoteAccepted(grn, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.alreadyExisted).toBe(false);
    const inv = result.invoice;
    expect(inv.salesOrderId).toBe(so.id);
    expect(inv.customerId).toBe(customer.id);
    expect(inv.status).toBe('draft');
    expect(inv.type).toBe('sales');
    expect(Number(inv.subtotal)).toBe(2000);
    expect(Number(inv.total)).toBe(2000);
    expect(Number(inv.balance)).toBe(2000);
    expect(inv.notes).toContain(`auto-from-grn:${grn.id}`);

    const items = await db.InvoiceItem.findAll({ where: { invoiceId: inv.id } });
    expect(items.length).toBe(2);
  });

  it('is idempotent: re-accept returns existing invoice', async () => {
    const { grn } = await createSOPOGRN();
    const first = await workflowService.onGoodsReceivedNoteAccepted(grn, { source: 'unit-test' });
    expect(first.alreadyExisted).toBe(false);
    const second = await workflowService.onGoodsReceivedNoteAccepted(grn, { source: 'unit-test' });
    expect(second.alreadyExisted).toBe(true);
    expect(second.invoice.id).toBe(first.invoice.id);
  });

  it('returns so_unresolved when PO has no salesOrderId', async () => {
    const po = await db.PurchaseOrder.create({
      id: uuidv4(),
      poNumber: `PO-LONE-${uuidv4().slice(0, 8)}`,
      factoryId: factory.id,
      brandCode: 'SH',
      status: 'confirmed',
      subtotal: 0,
      total: 0,
      currency: 'USD',
    });
    const grn = await db.GoodsReceivedNote.create({
      id: uuidv4(),
      grnNumber: `GRN-LONE-${Date.now()}`,
      poId: po.id,
      receivedDate: new Date(),
      items: [],
      status: 'pending',
    });
    const result = await workflowService.onGoodsReceivedNoteAccepted(grn, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('so_unresolved');
  });

  it('inherits brandCode from the SO', async () => {
    const so = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: `SO-FW-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      factoryId: factory.id,
      brandCode: 'FW',
      status: 'confirmed',
      subtotal: 1000,
      total: 1000,
      currency: 'USD',
    });
    const po = await db.PurchaseOrder.create({
      id: uuidv4(),
      poNumber: `PO-FW-${uuidv4().slice(0, 8)}`,
      salesOrderId: so.id,
      factoryId: factory.id,
      brandCode: 'FW',
      status: 'confirmed',
      subtotal: 1000,
      total: 1000,
      currency: 'USD',
    });
    const grn = await db.GoodsReceivedNote.create({
      id: uuidv4(),
      grnNumber: `GRN-FW-${Date.now()}`,
      poId: po.id,
      receivedDate: new Date(),
      items: [{ productId: product.id, description: 'i', quantity: 10, quantityReceived: 10, unit: 'sqm', unitPrice: 100, total: 1000 }],
      status: 'pending',
    });
    const result = await workflowService.onGoodsReceivedNoteAccepted(grn, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.invoice.brandCode).toBe('FW');
  });

  it('handles invalid input and phantom id', async () => {
    const r1 = await workflowService.onGoodsReceivedNoteAccepted({}, { source: 'unit-test' });
    expect(r1.ok).toBe(false);
    expect(r1.code).toBe('invalid_input');
    const r2 = await workflowService.onGoodsReceivedNoteAccepted({ id: uuidv4() }, { source: 'unit-test' });
    expect(r2.ok).toBe(false);
    expect(r2.code).toBe('not_found');
  });
});
