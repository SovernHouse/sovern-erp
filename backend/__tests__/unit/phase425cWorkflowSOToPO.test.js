/**
 * Phase 4.25c — workflowService.onSalesOrderConfirmed unit test.
 *
 * Verifies per-factory PO grouping and idempotency on (salesOrderId,
 * factoryId). Pure unit test pattern.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25c — workflowService.onSalesOrderConfirmed', () => {
  let db;
  let workflowService;
  let customer;
  let factoryA;
  let factoryB;
  let category;
  let productA;
  let productB;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });

    category = await db.ProductCategory.create({ id: uuidv4(), name: 'Cat' });

    factoryA = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Factory A',
      email: 'a@factory.test',
      phone: '+86-21-11111111',
      contactPerson: 'A',
      country: 'CN',
      isActive: true,
    });
    factoryB = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Factory B',
      email: 'b@factory.test',
      phone: '+86-21-22222222',
      contactPerson: 'B',
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

    productA = await db.Product.create({
      id: uuidv4(),
      name: 'Product From A',
      sku: `PA-${Date.now()}`,
      unit: 'sqm',
      basePrice: 25.0,
      isActive: true,
      categoryId: category.id,
      factoryId: factoryA.id,
    });
    productB = await db.Product.create({
      id: uuidv4(),
      name: 'Product From B',
      sku: `PB-${Date.now()}`,
      unit: 'sqm',
      basePrice: 30.0,
      isActive: true,
      categoryId: category.id,
      factoryId: factoryB.id,
    });
  }, 60000);

  afterAll(async () => {
    if (db && db.sequelize) await db.sequelize.close();
  });

  async function createTestSO({
    brandCode = 'SH',
    items = [{ productId: null, qty: 10, unit: 'sqm', unitPrice: 100 }],
    factoryIdForSO = null,
  } = {}) {
    const resolvedItems = items.map(it => ({
      ...it,
      productId: it.productId || productA.id,
    }));
    const subtotal = resolvedItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const so = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: `SO-TEST-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      factoryId: factoryIdForSO || factoryA.id,
      brandCode,
      status: 'confirmed',
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      currency: 'USD',
    });
    for (const it of resolvedItems) {
      await db.SalesOrderItem.create({
        id: uuidv4(),
        salesOrderId: so.id,
        productId: it.productId,
        description: 'Test',
        quantity: it.qty,
        unit: it.unit,
        unitPrice: it.unitPrice,
        total: it.qty * it.unitPrice,
      });
    }
    return so;
  }

  it('creates one PO per unique factory referenced by line items', async () => {
    const so = await createTestSO({
      items: [
        { productId: productA.id, qty: 10, unit: 'sqm', unitPrice: 100 },
        { productId: productB.id, qty: 5, unit: 'sqm', unitPrice: 200 },
      ],
    });

    const result = await workflowService.onSalesOrderConfirmed(so, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.created.length).toBe(2);
    expect(result.alreadyExisted.length).toBe(0);
    expect(result.skipped.length).toBe(0);

    const factoryIds = result.created.map(po => po.factoryId).sort();
    const expected = [factoryA.id, factoryB.id].sort();
    expect(factoryIds).toEqual(expected);

    for (const po of result.created) {
      expect(po.salesOrderId).toBe(so.id);
      expect(po.status).toBe('draft');
      expect(po.brandCode).toBe('SH');
    }

    const poA = result.created.find(po => po.factoryId === factoryA.id);
    const poB = result.created.find(po => po.factoryId === factoryB.id);
    const itemsA = await db.PurchaseOrderItem.findAll({ where: { purchaseOrderId: poA.id } });
    const itemsB = await db.PurchaseOrderItem.findAll({ where: { purchaseOrderId: poB.id } });
    expect(itemsA.length).toBe(1);
    expect(itemsA[0].productId).toBe(productA.id);
    expect(itemsB.length).toBe(1);
    expect(itemsB[0].productId).toBe(productB.id);
  });

  it('bundles multiple line items from the same factory into one PO', async () => {
    const so = await createTestSO({
      items: [
        { productId: productA.id, qty: 10, unit: 'sqm', unitPrice: 100 },
        { productId: productA.id, qty: 5, unit: 'sqm', unitPrice: 100 },
      ],
    });

    const result = await workflowService.onSalesOrderConfirmed(so, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.created.length).toBe(1);
    const po = result.created[0];
    expect(po.factoryId).toBe(factoryA.id);
    expect(Number(po.subtotal)).toBe(1500);

    const items = await db.PurchaseOrderItem.findAll({ where: { purchaseOrderId: po.id } });
    expect(items.length).toBe(2);
  });

  it('is idempotent: second call returns alreadyExisted, no duplicate POs', async () => {
    const so = await createTestSO();

    const first = await workflowService.onSalesOrderConfirmed(so, { source: 'unit-test' });
    expect(first.created.length).toBe(1);
    expect(first.alreadyExisted.length).toBe(0);

    const second = await workflowService.onSalesOrderConfirmed(so, { source: 'unit-test' });
    expect(second.created.length).toBe(0);
    expect(second.alreadyExisted.length).toBe(1);
    expect(second.alreadyExisted[0].id).toBe(first.created[0].id);

    const all = await db.PurchaseOrder.findAll({ where: { salesOrderId: so.id } });
    expect(all.length).toBe(1);
  });

  it('inherits brandCode from the SO (FW -> FW)', async () => {
    const so = await createTestSO({ brandCode: 'FW' });
    const result = await workflowService.onSalesOrderConfirmed(so, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.created[0].brandCode).toBe('FW');
  });

  it('handles missing SO id gracefully', async () => {
    const result = await workflowService.onSalesOrderConfirmed({}, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_input');
  });

  it('handles a phantom SO id', async () => {
    const result = await workflowService.onSalesOrderConfirmed({ id: uuidv4() }, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
  });
});
