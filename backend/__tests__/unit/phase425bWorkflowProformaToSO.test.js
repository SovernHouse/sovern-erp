/**
 * Phase 4.25b — workflowService.onProformaInvoiceConfirmed unit test.
 *
 * Mirrors the 4.25a unit-test pattern: no Express boot, just sync
 * in-memory SQLite + direct workflowService call. The route hook
 * (POST /:id/confirm on proformaInvoiceRoutes) is verified separately
 * via integration once L-058 is unblocked.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25b — workflowService.onProformaInvoiceConfirmed', () => {
  let db;
  let workflowService;
  let customer;
  let factory;
  let alternativeFactory;
  let category;
  let product;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });

    category = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Test Category',
    });

    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Primary Factory',
      email: 'primary@factory.test',
      phone: '+86-21-11111111',
      contactPerson: 'Wang Wei',
      country: 'CN',
      isActive: true,
    });

    alternativeFactory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Alternative Factory',
      email: 'alt@factory.test',
      phone: '+86-21-22222222',
      contactPerson: 'Li Min',
      country: 'CN',
      isActive: true,
    });

    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Test Customer Corp',
      email: 'customer@test.com',
      phone: '+1-555-1234',
      contactPerson: 'Jane Smith',
      country: 'US',
      currency: 'USD',
      paymentTerms: 'Net 30',
      isActive: true,
    });

    product = await db.Product.create({
      id: uuidv4(),
      name: 'Test Tile 60x60',
      sku: `TEST-${Date.now()}`,
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

  async function createTestProforma({
    brandCode = 'SH',
    withItems = true,
    itemProductId = null,
  } = {}) {
    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber: `QOT-PIB-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      brandCode,
      status: 'accepted',
      subtotal: 1000,
      discount: 0,
      tax: 100,
      taxRate: 10,
      total: 1100,
      currency: 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const pi = await db.ProformaInvoice.create({
      id: uuidv4(),
      piNumber: `PI-TEST-${uuidv4().slice(0, 8)}`,
      quotationId: quotation.id,
      customerId: customer.id,
      brandCode,
      status: 'sent',
      subtotal: 1000,
      discount: 0,
      tax: 100,
      total: 1100,
      currency: 'USD',
      paymentTerms: 'Net 30',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    if (withItems) {
      await db.ProformaInvoiceItem.create({
        id: uuidv4(),
        proformaInvoiceId: pi.id,
        productId: itemProductId || product.id,
        description: 'Test item',
        quantity: 10,
        unit: 'sqm',
        unitPrice: 100,
        total: 1000,
      });
    }
    return pi;
  }

  it('creates a SalesOrder with correct shape when the PI is confirmed', async () => {
    const pi = await createTestProforma();

    const result = await workflowService.onProformaInvoiceConfirmed(pi, {
      source: 'unit-test',
    });

    expect(result.ok).toBe(true);
    expect(result.alreadyExisted).toBe(false);
    const so = result.salesOrder;
    expect(so).toBeTruthy();
    expect(so.proformaInvoiceId).toBe(pi.id);
    expect(so.customerId).toBe(customer.id);
    expect(so.factoryId).toBe(factory.id);
    expect(so.brandCode).toBe('SH');
    expect(so.status).toBe('confirmed');
    expect(Number(so.subtotal)).toBe(1000);
    expect(Number(so.total)).toBe(1100);
    expect(so.currency).toBe('USD');
    expect(so.orderNumber).toBeTruthy();

    const items = await db.SalesOrderItem.findAll({
      where: { salesOrderId: so.id },
    });
    expect(items.length).toBe(1);
    expect(items[0].productId).toBe(product.id);
    expect(Number(items[0].quantity)).toBe(10);
    expect(Number(items[0].unitPrice)).toBe(100);
    expect(Number(items[0].total)).toBe(1000);
  });

  it('is idempotent: second confirm returns the existing SO', async () => {
    const pi = await createTestProforma();

    const first = await workflowService.onProformaInvoiceConfirmed(pi, { source: 'unit-test' });
    expect(first.ok).toBe(true);
    expect(first.alreadyExisted).toBe(false);

    const second = await workflowService.onProformaInvoiceConfirmed(pi, { source: 'unit-test' });
    expect(second.ok).toBe(true);
    expect(second.alreadyExisted).toBe(true);
    expect(second.salesOrder.id).toBe(first.salesOrder.id);

    const all = await db.SalesOrder.findAll({
      where: { proformaInvoiceId: pi.id },
    });
    expect(all.length).toBe(1);
  });

  it('uses ctx.factoryId when supplied (takes precedence over auto-derive)', async () => {
    const pi = await createTestProforma();

    const result = await workflowService.onProformaInvoiceConfirmed(pi, {
      source: 'unit-test',
      factoryId: alternativeFactory.id,
    });
    expect(result.ok).toBe(true);
    expect(result.salesOrder.factoryId).toBe(alternativeFactory.id);
  });

  it('auto-derives factoryId from the first line item product when ctx omits it', async () => {
    const pi = await createTestProforma();

    const result = await workflowService.onProformaInvoiceConfirmed(pi, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.salesOrder.factoryId).toBe(factory.id);
  });

  it('returns factory_unresolved when there is no factoryId and no items', async () => {
    const pi = await createTestProforma({ withItems: false });

    const result = await workflowService.onProformaInvoiceConfirmed(pi, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('factory_unresolved');
  });

  it('inherits brandCode from the PI (FW -> FW)', async () => {
    const pi = await createTestProforma({ brandCode: 'FW' });

    const result = await workflowService.onProformaInvoiceConfirmed(pi, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.salesOrder.brandCode).toBe('FW');
  });

  it('handles missing PI id gracefully', async () => {
    const result = await workflowService.onProformaInvoiceConfirmed({}, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_input');
  });

  it('handles a PI id that does not resolve', async () => {
    const phantom = { id: uuidv4() };
    const result = await workflowService.onProformaInvoiceConfirmed(phantom, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
  });
});
