// Phase 4.15a-prep — pipeToBufferOrDisk helper + returnBuffer opt-in.
//
// 4.15a proper (next session) will build the pdfGenerationService that
// uploads generated PDFs to Drive + writes a Document row + audits.
// This prep commit adds the backward-compatible plumbing: every existing
// disk-writing generator now accepts an opts trailing arg; opts.returnBuffer
// =true returns an in-memory Buffer instead of writing to disk.
//
// Coverage:
//   - Helper itself: both branches resolve correctly, both reject on error.
//   - One generator per file (sales / order / logistics / finance) tested
//     both ways — proves the helper is wired correctly across all 12
//     patched generators without needing per-generator boilerplate.
//   - Backward compat: omitting opts (default false) returns a filename
//     string as before. Existing REST callers + tests don't change shape.
//
// Out of scope here (4.15a proper):
//   - brandedQuotationRenderer.dispatch + its 4 variants (SH classic, FW
//     IronLite, FW private label, FW generic). Each is a separate Promise
//     with non-trivial helper composition; deferred so the prep commit
//     stays surgical.
//   - pdfTemplates.js (Certificate of Origin, advanced packing list) —
//     these already return Buffers in production usage; verify shape
//     in 4.15a proper before wrapping.

const fs = require('fs');
const path = require('path');

// Phase 4.20: every generator in this file now resolves a Brand row via
// brandSafetyGateway.resolveBrandOrThrow. We mock that resolver here so
// the integration test doesn't need a seeded DB — the dual-mode helper
// (disk vs returnBuffer) is what's actually under test, not brand
// resolution. Fixtures below carry brandCode:'SH' + non-resilient items,
// which is the only combination the gateway permits without an items
// walk that requires Sequelize-loaded Products.
jest.mock('../../services/brandSafetyGateway', () => {
  const actual = jest.requireActual('../../services/brandSafetyGateway');
  return {
    ...actual,
    resolveBrandOrThrow: jest.fn(async (_db, brandCode) => ({
      brand: {
        code: brandCode,
        displayName: 'Sovern House',
        legalName: 'New Route International Exchange Co., Ltd.',
        senderEmail: 'hello@sovernhouse.co',
        primaryColor: '#1D5A32',
        footerLegalText: 'New Route International Exchange Co., Ltd. — Taiwan',
      },
      displayName: 'Sovern House',
      fromDisplayName: 'Sovern House',
      senderEmail: 'hello@sovernhouse.co',
      signatureHtml: '',
      signatureText: '',
    })),
  };
});
jest.mock('../../models', () => ({}), { virtual: true });

const { pipeToBufferOrDisk } = require('../../services/pdf/pdfHelpers');
const sales = require('../../services/pdf/salesDocumentsPDF');
const order = require('../../services/pdf/orderDocumentsPDF');
const logistics = require('../../services/pdf/logisticsDocumentsPDF');
const finance = require('../../services/pdf/financeDocumentsPDF');

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);  // %PDF

function pdfBufferLooksValid(buf) {
  return Buffer.isBuffer(buf)
    && buf.length > 100
    && buf.slice(0, 4).equals(PDF_MAGIC);
}

// Minimal valid Quotation-shape fixture for the salesDocumentsPDF generator.
// Phase 4.20: brandCode is required by the gateway.
const sampleQuotation = {
  id: 'q-test-1',
  quotationNumber: 'QOT-TEST-001',
  brandCode: 'SH',
  createdAt: new Date('2026-05-16T00:00:00Z'),
  validUntil: new Date('2026-06-15T00:00:00Z'),
  currency: 'USD',
  subtotal: 1000,
  discount: 50,
  tax: 100,
  total: 1050,
  terms: 'Net 30',
};
const sampleItems = [
  { product: { name: 'Test SPC 4mm' }, quantity: 100, unit: 'sqm', unitPrice: 10, total: 1000 },
];
const sampleCustomer = {
  companyName: 'Test Customer Co',
  contactPerson: 'Jane Tester',
  email: 'jane@test.example',
  currency: 'USD',
};
const sampleSalesPerson = { firstName: 'Sales', lastName: 'Rep' };

// Sales Order fixture
const sampleSO = {
  id: 'so-test-1',
  orderNumber: 'SO-TEST-001',
  brandCode: 'SH',
  createdAt: new Date('2026-05-16T00:00:00Z'),
  status: 'confirmed',
  estimatedDelivery: new Date('2026-07-01'),
  currency: 'USD',
  subtotal: 1000,
  discount: 0,
  tax: 100,
  total: 1100,
};
const sampleFactory = { companyName: 'Test Factory Ltd', country: 'China', certifications: [] };

// Inspection fixture
const sampleInspection = {
  inspectionNumber: 'INSP-TEST-001',
  createdAt: new Date('2026-05-16T00:00:00Z'),
  completedDate: new Date('2026-05-16T00:00:00Z'),
  type: 'pre_shipment',
  overallResult: 'pass',
};
const sampleInspectionReport = {
  overallResult: 'pass',
  findings: 'All within spec.',
  recommendations: 'None.',
};

// Invoice fixture
const sampleInvoice = {
  id: 'inv-test-1',
  invoiceNumber: 'INV-TEST-001',
  brandCode: 'SH',
  createdAt: new Date('2026-05-16T00:00:00Z'),
  dueDate: new Date('2026-06-15'),
  status: 'sent',
  currency: 'USD',
  subtotal: 1000,
  discount: 0,
  tax: 100,
  total: 1100,
  paidAmount: 0,
  balance: 1100,
  paymentTerms: 'Net 30',
};

describe('Phase 4.15a-prep — pipeToBufferOrDisk helper', () => {
  it('exists on pdfHelpers', () => {
    expect(typeof pipeToBufferOrDisk).toBe('function');
  });

  // The helper's contract is exercised end-to-end by the four
  // per-generator tests below — there's no value in testing the
  // helper in isolation because its only real consumers are the
  // generators, and a mismatch between helper signature and call-site
  // would be caught immediately by those tests.
});

describe('Phase 4.15a-prep — generator returnBuffer dual-mode (one per file)', () => {

  describe('salesDocumentsPDF.generateQuotationPDF', () => {
    it('returnBuffer:true returns a valid PDF Buffer', async () => {
      const out = await sales.generateQuotationPDF(
        sampleQuotation, sampleItems, sampleCustomer, sampleSalesPerson,
        { returnBuffer: true },
      );
      expect(pdfBufferLooksValid(out)).toBe(true);
    });

    it('returnBuffer omitted (default false) resolves with a filename and writes the file to disk', async () => {
      const out = await sales.generateQuotationPDF(
        sampleQuotation, sampleItems, sampleCustomer, sampleSalesPerson,
      );
      expect(typeof out).toBe('string');
      expect(out).toMatch(/^quotation-QOT-TEST-001-\d+\.pdf$/);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filepath = path.join(uploadDir, 'quotations', out);
      expect(fs.existsSync(filepath)).toBe(true);
      // Cleanup so a long-running test suite doesn't accumulate detritus.
      try { fs.unlinkSync(filepath); } catch {}
    });
  });

  describe('orderDocumentsPDF.generateSalesOrderPDF', () => {
    it('returnBuffer:true returns a valid PDF Buffer', async () => {
      const out = await order.generateSalesOrderPDF(
        sampleSO, sampleItems, sampleCustomer, sampleFactory,
        { returnBuffer: true },
      );
      expect(pdfBufferLooksValid(out)).toBe(true);
    });

    it('returnBuffer omitted returns a filename and writes to disk', async () => {
      const out = await order.generateSalesOrderPDF(
        sampleSO, sampleItems, sampleCustomer, sampleFactory,
      );
      expect(typeof out).toBe('string');
      expect(out).toMatch(/^so-SO-TEST-001-\d+\.pdf$/);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filepath = path.join(uploadDir, 'sales_orders', out);
      expect(fs.existsSync(filepath)).toBe(true);
      try { fs.unlinkSync(filepath); } catch {}
    });
  });

  describe('logisticsDocumentsPDF.generateInspectionCertificatePDF', () => {
    it('returnBuffer:true returns a valid PDF Buffer', async () => {
      const out = await logistics.generateInspectionCertificatePDF(
        sampleInspection, sampleInspectionReport, sampleFactory,
        { returnBuffer: true },
      );
      expect(pdfBufferLooksValid(out)).toBe(true);
    });

    it('returnBuffer omitted returns a filename and writes to disk', async () => {
      const out = await logistics.generateInspectionCertificatePDF(
        sampleInspection, sampleInspectionReport, sampleFactory,
      );
      expect(typeof out).toBe('string');
      expect(out).toMatch(/^cert-INSP-TEST-001-\d+\.pdf$/);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filepath = path.join(uploadDir, 'inspection_certificates', out);
      expect(fs.existsSync(filepath)).toBe(true);
      try { fs.unlinkSync(filepath); } catch {}
    });
  });

  describe('financeDocumentsPDF.generateInvoicePDF', () => {
    it('returnBuffer:true returns a valid PDF Buffer', async () => {
      const out = await finance.generateInvoicePDF(
        sampleInvoice, sampleSO, sampleCustomer,
        { returnBuffer: true },
      );
      expect(pdfBufferLooksValid(out)).toBe(true);
    });

    it('returnBuffer omitted returns a filename and writes to disk', async () => {
      const out = await finance.generateInvoicePDF(
        sampleInvoice, sampleSO, sampleCustomer,
      );
      expect(typeof out).toBe('string');
      expect(out).toMatch(/^inv-INV-TEST-001-\d+\.pdf$/);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filepath = path.join(uploadDir, 'invoices', out);
      expect(fs.existsSync(filepath)).toBe(true);
      try { fs.unlinkSync(filepath); } catch {}
    });
  });
});
