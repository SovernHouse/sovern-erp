/**
 * Phase 4.25a — workflowService.onQuotationAccepted unit test.
 *
 * Pure unit test: no Express boot, no supertest, no full server.js
 * require. Sync in-memory SQLite + call the workflow method directly.
 *
 * Why unit (not integration): the existing __tests__/setup.js + server.js
 * boot path times out at >120s even for the trivial health.test.js
 * existing test. That is a pre-existing infrastructure bug (not
 * something Phase 4.25a introduced) and is being tracked separately.
 * For 4.25a's verification we need only assert workflowService behaves
 * correctly; the controller-level wiring is mechanical and can be
 * verified once the integration suite is unblocked.
 *
 * Covers:
 *   1. Happy path: a draft Pro Forma is created with correct shape.
 *   2. Idempotency: re-running does not create a duplicate.
 *   3. Brand inheritance: FW quotation creates an FW Pro Forma.
 *   4. Returns alreadyExisted=true on the second call.
 */

// CRITICAL: same guard as the integration setup. Force in-memory DB.
delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25a — workflowService.onQuotationAccepted', () => {
  let db;
  let workflowService;
  let testCustomer;
  let testProduct;
  let testFactory;
  let testCategory;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });

    testCategory = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Test Category',
    });

    testFactory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Test Factory Ltd',
      email: 'factory@test.com',
      phone: '+86-21-12345678',
      contactPerson: 'Wang Wei',
      country: 'CN',
      isActive: true,
    });

    testCustomer = await db.Customer.create({
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

    testProduct = await db.Product.create({
      id: uuidv4(),
      name: 'Test Tile 60x60',
      sku: `TEST-${Date.now()}`,
      unit: 'sqm',
      basePrice: 25.0,
      isActive: true,
      categoryId: testCategory.id,
      factoryId: testFactory.id,
    });
  }, 60000);

  afterAll(async () => {
    if (db && db.sequelize) await db.sequelize.close();
  });

  async function createTestQuotation({ brandCode = 'SH' } = {}) {
    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber: `QOT-TEST-${uuidv4().slice(0, 8)}`,
      customerId: testCustomer.id,
      brandCode,
      status: 'sent',
      subtotal: 1000,
      discount: 0,
      tax: 100,
      taxRate: 10,
      total: 1100,
      currency: 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await db.QuotationItem.create({
      id: uuidv4(),
      quotationId: quotation.id,
      productId: testProduct.id,
      description: 'Test line item',
      quantity: 10,
      unit: 'sqm',
      unitPrice: 100,
      total: 1000,
    });
    return quotation;
  }

  it('creates a draft Pro Forma with correct shape', async () => {
    const quotation = await createTestQuotation();

    const result = await workflowService.onQuotationAccepted(quotation, {
      userId: null,
      ip: null,
      source: 'unit-test',
    });

    expect(result.ok).toBe(true);
    expect(result.alreadyExisted).toBe(false);
    expect(result.proformaInvoice).toBeTruthy();

    const pi = result.proformaInvoice;
    expect(pi.quotationId).toBe(quotation.id);
    expect(pi.customerId).toBe(testCustomer.id);
    expect(pi.status).toBe('draft');
    expect(pi.brandCode).toBe('SH');
    expect(Number(pi.subtotal)).toBe(1000);
    expect(Number(pi.total)).toBe(1100);
    expect(pi.currency).toBe('USD');
    expect(pi.piNumber).toMatch(/^PI-\d{8}-\d{4}$/);
    expect(pi.paymentTerms).toBe('Net 30');

    const items = await db.ProformaInvoiceItem.findAll({
      where: { proformaInvoiceId: pi.id },
    });
    expect(items.length).toBe(1);
    expect(items[0].productId).toBe(testProduct.id);
    expect(Number(items[0].quantity)).toBe(10);
    expect(Number(items[0].unitPrice)).toBe(100);
    expect(Number(items[0].total)).toBe(1000);
  });

  it('is idempotent: re-running returns the existing Pro Forma without creating a duplicate', async () => {
    const quotation = await createTestQuotation();

    const first = await workflowService.onQuotationAccepted(quotation, { source: 'unit-test' });
    expect(first.ok).toBe(true);
    expect(first.alreadyExisted).toBe(false);

    const second = await workflowService.onQuotationAccepted(quotation, { source: 'unit-test' });
    expect(second.ok).toBe(true);
    expect(second.alreadyExisted).toBe(true);
    expect(second.proformaInvoice.id).toBe(first.proformaInvoice.id);

    const all = await db.ProformaInvoice.findAll({
      where: { quotationId: quotation.id },
    });
    expect(all.length).toBe(1);
  });

  it('inherits brandCode from the quotation (FW -> FW)', async () => {
    // No Brand row needed: brandCode is a plain string column on
    // ProformaInvoice with no FK enforced at the DB level.
    const quotation = await createTestQuotation({ brandCode: 'FW' });

    const result = await workflowService.onQuotationAccepted(quotation, { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.proformaInvoice.brandCode).toBe('FW');
  });

  it('handles missing quotation id gracefully', async () => {
    const result = await workflowService.onQuotationAccepted({}, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_input');
  });

  it('handles a quotation id that does not resolve', async () => {
    const phantom = { id: uuidv4() };  // valid UUID but no row
    const result = await workflowService.onQuotationAccepted(phantom, { source: 'unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
  });
});
