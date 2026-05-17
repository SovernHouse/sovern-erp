// Phase 4.15a — pdfGenerationService + quotation CRUD convergence tests.
//
// Synthetic strategy:
//   - persistGeneratedPdf is exercised directly with a mock uploader so
//     CI doesn't need Drive auth. The mock returns synthetic fileId +
//     webViewLink; the test then asserts the Document row landed with
//     the expected entityType/entityId/brandCode/category mapping and
//     that an ai_assistant_generate_<category>_pdf AuditLog row exists.
//   - generateAndPersist (the higher-level dispatcher) is NOT exercised
//     end-to-end here because that requires synthetic Quotation + items
//     + customer + Brand fixtures plus the disk PDF generator working
//     in the test sandbox. The dispatcher's per-category handlers are
//     covered via CATEGORY_HANDLERS shape assertions; the underlying
//     generators are covered by phase415aPrepReturnBuffer.test.js.
//   - Quotation update + archive (via quotationWriteService) tested
//     directly: brand-scope rejection, non-draft rejection, happy path.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const pdfService = require('../../services/aiWriteServices/pdfGenerationService');
const quotationWriteService = require('../../services/aiWriteServices/quotationWriteService');

const restScope = { accessibleBrands: ['SH', 'FW'], defaultBrand: 'SH', viewMode: 'single', isCrossBrand: false };
const crossBrandScope = { accessibleBrands: ['SH', 'FW'], defaultBrand: 'SH', viewMode: 'cross-brand', isCrossBrand: true };

describe('Phase 4.15a — pdfGenerationService + quotation CRUD', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();

    // Brand fixtures for SH + FW (Phase 4.12 pattern).
    for (const code of ['SH', 'FW']) {
      const existing = await db.Brand.findOne({ where: { code } });
      if (!existing) {
        await db.Brand.create({
          code,
          displayName: code === 'SH' ? 'Sovern House' : 'FlorWay',
          senderEmail: code === 'SH' ? 'alex@sovernhouse.co' : 'alexflorway@gmail.com',
          primaryColor: '#000000',
          accentColor: '#ffffff',
          active: true,
          commissionRate: 0.05,
        });
      }
    }
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── CATEGORY_HANDLERS shape ─────────────────────────────────────────

  describe('CATEGORY_HANDLERS — coverage matches MCP tool list', () => {
    it('exposes exactly 13 categories (one per Phase 4.15a generator MCP tool)', () => {
      expect(Object.keys(pdfService.CATEGORY_HANDLERS).length).toBe(13);
    });

    it.each([
      'quotation', 'invoice', 'proforma_invoice', 'purchase_order',
      'packing_list', 'certificate_of_origin', 'credit_note',
      'inspection_certificate', 'product_spec_sheet', 'sales_note',
      'sales_order', 'shipment_document', 'statement_of_account',
    ])('handles category "%s" with fetch + generate + fileName', (category) => {
      const handler = pdfService.CATEGORY_HANDLERS[category];
      expect(handler).toBeTruthy();
      expect(typeof handler.fetch).toBe('function');
      expect(typeof handler.generate).toBe('function');
      expect(typeof handler.fileName).toBe('function');
      expect(typeof handler.entityType).toBe('string');
    });
  });

  // ── persistGeneratedPdf with mock uploader ──────────────────────────

  describe('persistGeneratedPdf', () => {
    function makeMockUploader() {
      const calls = [];
      const uploader = async (args) => {
        calls.push(args);
        return {
          fileId: `mock-drive-id-${uuidv4()}`,
          webViewLink: `https://drive.google.com/file/d/mock-${uuidv4()}/view`,
        };
      };
      uploader.calls = calls;
      return uploader;
    }

    it('happy path — uploads buffer, creates Document row, writes audit log, returns metadata', async () => {
      const uploader = makeMockUploader();
      const buffer = Buffer.from('%PDF-1.4 stub bytes for testing');
      const result = await pdfService.persistGeneratedPdf({
        category: 'quotation',
        entityType: 'Quotation',
        entityId: uuidv4(),
        brandCode: 'SH',
        buffer,
        fileName: 'test-quotation-001.pdf',
      }, {
        userId: testData.admin.id,
        ip: '127.0.0.1',
        source: 'mcp',
        uploader,
      });

      expect(result.ok).toBe(true);
      expect(result.driveFileId).toMatch(/^mock-drive-id-/);
      expect(result.driveUrl).toMatch(/^https:\/\/drive.google.com/);
      expect(result.documentRowId).toBeTruthy();
      expect(result.sizeKB).toBe(0);  // 30 bytes rounds to 0KB
      expect(result.brandCode).toBe('SH');
      expect(result.mimeType).toBe('application/pdf');
      expect(uploader.calls.length).toBe(1);
      expect(uploader.calls[0].brandCode).toBe('SH');
      expect(uploader.calls[0].category).toBe('quotation');

      // Document row landed with correct linkage.
      const docRow = await db.Document.findByPk(result.documentRowId);
      expect(docRow).toBeTruthy();
      expect(docRow.entityType).toBe('Quotation');
      expect(docRow.brandCode).toBe('SH');
      expect(docRow.category).toBe('quotation');
      expect(docRow.type).toBe('generated');
      expect(docRow.mimeType).toBe('application/pdf');
      expect(docRow.fileSize).toBe(buffer.length);

      // AuditLog row landed with the Phase 4.12 ai_assistant_<action> shape.
      await new Promise(r => setTimeout(r, 50));
      const auditRow = await db.AuditLog.findOne({
        where: { action: 'ai_assistant_generate_quotation_pdf', entityId: docRow.entityId },
        order: [['createdAt', 'DESC']],
      });
      expect(auditRow).toBeTruthy();
      const changes = typeof auditRow.changes === 'string'
        ? JSON.parse(auditRow.changes) : auditRow.changes;
      expect(changes.documentRowId).toBe(result.documentRowId);
      expect(changes.driveFileId).toMatch(/^mock-drive-id-/);
      expect(changes.source).toBe('mcp');
      expect(changes.brandCode).toBe('SH');
    });

    it('routes FW brandCode through the FW path (uploader receives FW)', async () => {
      const uploader = makeMockUploader();
      await pdfService.persistGeneratedPdf({
        category: 'invoice',
        entityType: 'Invoice',
        entityId: uuidv4(),
        brandCode: 'FW',
        buffer: Buffer.from('%PDF-1.4 fw stub'),
        fileName: 'inv-fw-001.pdf',
      }, { userId: testData.admin.id, ip: null, source: 'mcp', uploader });

      expect(uploader.calls[0].brandCode).toBe('FW');
      expect(uploader.calls[0].category).toBe('invoice');
    });

    it('rejects unknown category with a clear validation error', async () => {
      const uploader = makeMockUploader();
      const result = await pdfService.persistGeneratedPdf({
        category: 'made_up_category',
        entityType: 'X', entityId: uuidv4(), brandCode: 'SH',
        buffer: Buffer.from('a'), fileName: 'x.pdf',
      }, { userId: testData.admin.id, ip: null, source: 'mcp', uploader });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/Unknown PDF category/);
      expect(uploader.calls.length).toBe(0);  // never reached
    });

    it('rejects empty buffer with a clear validation error', async () => {
      const uploader = makeMockUploader();
      const result = await pdfService.persistGeneratedPdf({
        category: 'quotation', entityType: 'Quotation',
        entityId: uuidv4(), brandCode: 'SH',
        buffer: Buffer.alloc(0), fileName: 'empty.pdf',
      }, { userId: testData.admin.id, ip: null, source: 'mcp', uploader });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/non-empty Buffer/);
    });

    it('rejects missing fileName with a clear validation error', async () => {
      const uploader = makeMockUploader();
      const result = await pdfService.persistGeneratedPdf({
        category: 'quotation', entityType: 'Quotation',
        entityId: uuidv4(), brandCode: 'SH',
        buffer: Buffer.from('a'), fileName: null,
      }, { userId: testData.admin.id, ip: null, source: 'mcp', uploader });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/fileName is required/);
    });

    it('surfaces upload errors as drive_upload_failed (does NOT crash the call)', async () => {
      const failingUploader = async () => { throw new Error('OAuth refresh expired'); };
      const result = await pdfService.persistGeneratedPdf({
        category: 'quotation', entityType: 'Quotation',
        entityId: uuidv4(), brandCode: 'SH',
        buffer: Buffer.from('%PDF-1.4'), fileName: 't.pdf',
      }, { userId: testData.admin.id, ip: null, source: 'mcp', uploader: failingUploader });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('drive_upload_failed');
      expect(result.httpStatus).toBe(502);
      expect(result.message).toMatch(/OAuth refresh expired/);
    });
  });

  // ── quotationWriteService.updateQuotation + archiveQuotation ────────

  describe('quotationWriteService — update + archive (Phase 4.15a CRUD completion)', () => {
    async function seedDraftQuotation(brandCode = 'SH') {
      return db.Quotation.create({
        id: uuidv4(),
        quotationNumber: `QOT-CRUD-${uuidv4().slice(0, 8)}`,
        customerId: testData.customer.id,
        status: 'draft',
        brandCode,
        subtotal: 100,
        discount: 0,
        discountType: 'fixed',
        tax: 10,
        taxRate: 10,
        total: 110,
        currency: 'USD',
        validUntil: new Date(Date.now() + 30 * 86400000),
        terms: 'Net 30',
      });
    }

    it('updateQuotation patches an editable draft', async () => {
      const q = await seedDraftQuotation();
      const result = await quotationWriteService.updateQuotation(q.id, {
        terms: 'Updated terms: Net 45.',
        taxRate: 12,
      }, { userId: testData.admin.id, brandScope: restScope, ip: null, source: 'mcp' });

      expect(result.ok).toBe(true);
      expect(result.after.terms).toBe('Updated terms: Net 45.');
      expect(Number(result.after.taxRate)).toBe(12);
    });

    it('updateQuotation refuses to edit a sent quotation', async () => {
      const q = await seedDraftQuotation();
      await q.update({ status: 'sent' });
      const result = await quotationWriteService.updateQuotation(q.id, {
        terms: 'attempting to edit after send',
      }, { userId: testData.admin.id, brandScope: restScope, ip: null, source: 'mcp' });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/draft quotations are editable/);
    });

    it('updateQuotation refuses cross-brand mode', async () => {
      const q = await seedDraftQuotation();
      const result = await quotationWriteService.updateQuotation(q.id, { terms: 'X' }, {
        userId: testData.admin.id, brandScope: crossBrandScope, ip: null, source: 'mcp',
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('cross_brand_mode');
    });

    it('updateQuotation strips brandCode (immutable on standard update path)', async () => {
      const q = await seedDraftQuotation('SH');
      const result = await quotationWriteService.updateQuotation(q.id, {
        brandCode: 'FW',
        terms: 'Tried to flip brand',
      }, { userId: testData.admin.id, brandScope: restScope, ip: null, source: 'mcp' });

      expect(result.ok).toBe(true);
      expect(result.after.brandCode).toBe('SH');  // unchanged
      expect(result.after.terms).toBe('Tried to flip brand');
    });

    it('archiveQuotation removes the row from default queries', async () => {
      const q = await seedDraftQuotation();
      const result = await quotationWriteService.archiveQuotation(q.id, {
        userId: testData.admin.id, brandScope: restScope, ip: null, source: 'mcp',
      });
      expect(result.ok).toBe(true);
      expect(result.deleted.quotationNumber).toMatch(/^QOT-CRUD-/);

      // Whether paranoid (soft) or hard delete, the row no longer
      // appears in the default scope — that's the user-facing contract.
      const visible = await db.Quotation.findByPk(q.id);
      expect(visible).toBe(null);
    });

    it('archiveQuotation refuses cross-brand mode', async () => {
      const q = await seedDraftQuotation();
      const result = await quotationWriteService.archiveQuotation(q.id, {
        userId: testData.admin.id, brandScope: crossBrandScope, ip: null, source: 'mcp',
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('cross_brand_mode');
    });
  });
});
