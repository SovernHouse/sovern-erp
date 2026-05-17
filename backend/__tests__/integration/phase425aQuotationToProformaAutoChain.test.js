/**
 * Phase 4.25a — Quote.accept -> ProformaInvoice auto-chain.
 *
 * Verifies the workflow side-effect installed in workflowService.js +
 * the accept-handler hook in quotationController.js. Covers:
 *
 *   1. Happy path: accept a quotation, a draft Pro Forma is created
 *      with the right quotationId / customerId / brandCode / totals /
 *      currency / items.
 *
 *   2. Idempotency: re-accept the same quotation (allowed by the route;
 *      it is a status-update only); the side-effect should NOT create
 *      a second Pro Forma. Only one ProformaInvoice row should exist.
 *
 *   3. Brand inheritance: a quotation under brand 'FW' creates a Pro
 *      Forma also under 'FW' (covers the quiet bug in the legacy
 *      convertToProformaInvoice handler that defaulted brandCode to
 *      'SH' regardless of upstream).
 *
 *   4. Audit row: the chain hop writes an AuditLog row with
 *      action='auto_create' and entityType='ProformaInvoice'.
 */

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Phase 4.25a — Quote.accept auto-creates Pro Forma', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 120000);

  afterAll(async () => {
    await cleanup();
  });

  async function createTestQuotation({ brandCode = 'SH' } = {}) {
    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber: `QOT-TEST-${uuidv4().slice(0, 8)}`,
      customerId: testData.customer.id,
      salesPersonId: testData.admin.id,
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
      productId: testData.product.id,
      description: 'Test line item',
      quantity: 10,
      unit: 'sqm',
      unitPrice: 100,
      total: 1000,
    });
    return quotation;
  }

  it('creates a draft Pro Forma when a quotation is accepted', async () => {
    const quotation = await createTestQuotation();

    const response = await request
      .post(`/api/quotations/${quotation.id}/accept`)
      .set('Authorization', `Bearer ${testData.authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('accepted');

    const proforma = await db.ProformaInvoice.findOne({
      where: { quotationId: quotation.id },
    });
    expect(proforma).toBeTruthy();
    expect(proforma.status).toBe('draft');
    expect(proforma.customerId).toBe(testData.customer.id);
    expect(proforma.brandCode).toBe('SH');
    expect(Number(proforma.subtotal)).toBe(1000);
    expect(Number(proforma.total)).toBe(1100);
    expect(proforma.currency).toBe('USD');
    expect(proforma.piNumber).toMatch(/^PI-\d{8}-\d{4}$/);
    expect(proforma.paymentTerms).toBe('Net 30');

    const piItems = await db.ProformaInvoiceItem.findAll({
      where: { proformaInvoiceId: proforma.id },
    });
    expect(piItems.length).toBe(1);
    expect(piItems[0].productId).toBe(testData.product.id);
    expect(Number(piItems[0].quantity)).toBe(10);
    expect(Number(piItems[0].unitPrice)).toBe(100);
    expect(Number(piItems[0].total)).toBe(1000);
  });

  it('does not create a second Pro Forma if the quotation is re-accepted', async () => {
    const quotation = await createTestQuotation();

    const first = await request
      .post(`/api/quotations/${quotation.id}/accept`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(first.status).toBe(200);

    const second = await request
      .post(`/api/quotations/${quotation.id}/accept`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(second.status).toBe(200);

    const proformas = await db.ProformaInvoice.findAll({
      where: { quotationId: quotation.id },
    });
    expect(proformas.length).toBe(1);
  });

  it('inherits brandCode from the quotation (FW quotation -> FW Pro Forma)', async () => {
    const fwBrand = await db.Brand.findOne({ where: { code: 'FW' } });
    if (!fwBrand) {
      await db.Brand.create({
        code: 'FW',
        name: 'FlorWay',
        isActive: true,
      });
    }

    const quotation = await createTestQuotation({ brandCode: 'FW' });

    const response = await request
      .post(`/api/quotations/${quotation.id}/accept`)
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect(response.status).toBe(200);

    const proforma = await db.ProformaInvoice.findOne({
      where: { quotationId: quotation.id },
    });
    expect(proforma).toBeTruthy();
    expect(proforma.brandCode).toBe('FW');
  });

  it('writes an auto_create audit row tagged with the chain coordinates', async () => {
    const quotation = await createTestQuotation();

    await request
      .post(`/api/quotations/${quotation.id}/accept`)
      .set('Authorization', `Bearer ${testData.authToken}`);

    const proforma = await db.ProformaInvoice.findOne({
      where: { quotationId: quotation.id },
    });
    expect(proforma).toBeTruthy();

    // Give the fire-and-forget audit a moment to land (the call uses
    // .catch(()=>{}), but the insert itself is awaited inside
    // auditService). Re-query a few times if needed.
    let audit = null;
    for (let i = 0; i < 5; i++) {
      audit = await db.AuditLog.findOne({
        where: {
          action: 'auto_create',
          entityType: 'ProformaInvoice',
          entityId: proforma.id,
        },
      });
      if (audit) break;
      await new Promise(r => setTimeout(r, 50));
    }
    expect(audit).toBeTruthy();

    // Audit changes blob carries the chain coordinates so the row is
    // self-describing for future audit-pattern tests.
    const changes = typeof audit.changes === 'string'
      ? JSON.parse(audit.changes)
      : audit.changes;
    expect(changes.sourceEntity).toBe('Quotation');
    expect(changes.sourceId).toBe(quotation.id);
    expect(changes.trigger).toBe('quotation.accept');
    expect(changes.phase).toBe('4.25a');
  });
});
