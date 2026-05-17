/**
 * Phase 4.25d — workflowService.onPurchaseOrderConfirmed unit test.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25d — workflowService.onPurchaseOrderConfirmed', () => {
  let db;
  let workflowService;
  let customer;
  let factory;
  let category;
  let product;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });

    category = await db.ProductCategory.create({ id: uuidv4(), name: 'Cat' });
    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Factory A',
      email: 'a@factory.test',
      phone: '+86-21-11111111',
      contactPerson: 'A',
      country: 'CN',
      isActive: true,
    });
    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Customer Co',
      email: 'cust@test.com',
      phone: '+1-555-1234',
      contactPerson: 'C',
      country: 'US',
      currency: 'USD',
      paymentTerms: 'Net 30',
      isActive: true,
    });
    product = await db.Product.create({
      id: uuidv4(),
      name: 'Test Product',
      sku: `P-${Date.now()}`,
      unit: 'sqm',
      basePrice: 25.0,
      isActive: true,
      categoryId: category.id,
      factoryId: factory.id,
    });
  }, 60000);

  afterAll(async () => {
    if (db && db.sequelize) await db.sequelize.close();
  });

  async function createTestPO({ items = [{ qty: 10, unitPrice: 100 }] } = {}) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const po = await db.PurchaseOrder.create({
      id: uuidv4(),
      poNumber: `PO-TEST-${uuidv4().slice(0, 8)}`,
      factoryId: factory.id,
      brandCode: 'SH',
      status: 'confirmed',
      subtotal,
      total: subtotal,
      currency: 'USD',
    });
    for (const it of items) {
      await db.PurchaseOrderItem.create({
        id: uuidv4(),
        purchaseOrderId: po.id,
        productId: product.id,
        description: 'Test',
        quantity: it.qty,
        unit: 'sqm',
        unitPrice: it.unitPrice,
        total: it.qty * it.unitPrice,
      });
    }
    return po;
  }

  it('creates a pending GRN with items copied from the PO', async () => {
    const po = await createTestPO({ items: [{ qty: 10, unitPrice: 100 }, { qty: 5, unitPrice: 200 }] });

    const result = await workflowService.onPurchaseOrderConfirmed(po, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.alreadyExisted).toBe(false);
    const grn = result.grn;
    expect(grn.poId).toBe(po.id);
    expect(grn.status).toBe('pending');
    expect(grn.inspectionStatus).toBe('pending');
    expect(grn.grnNumber).toMatch(/^GRN-\d+$/);

    const items = Array.isArray(grn.items) ? grn.items : JSON.parse(grn.items);
    expect(items.length).toBe(2);
    expect(items[0].productId).toBe(product.id);
    expect(items[0].quantity).toBe(10);
    expect(items[0].quantityReceived).toBe(0);
    expect(items[0].unitPrice).toBe(100);
    expect(items[1].quantity).toBe(5);
    expect(items[1].unitPrice).toBe(200);
  });

  it('is idempotent: second confirm returns existing GRN', async () => {
    const po = await createTestPO();
    const first = await workflowService.onPurchaseOrderConfirmed(po, { source: 'unit-test' });
    expect(first.alreadyExisted).toBe(false);
    const second = await workflowService.onPurchaseOrderConfirmed(po, { source: 'unit-test' });
    expect(second.alreadyExisted).toBe(true);
    expect(second.grn.id).toBe(first.grn.id);

    const all = await db.GoodsReceivedNote.findAll({ where: { poId: po.id } });
    expect(all.length).toBe(1);
  });

  it('handles missing PO id gracefully', async () => {
    const result = await workflowService.onPurchaseOrderConfirmed({}, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_input');
  });

  it('handles a phantom PO id', async () => {
    const result = await workflowService.onPurchaseOrderConfirmed({ id: uuidv4() }, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
  });
});
