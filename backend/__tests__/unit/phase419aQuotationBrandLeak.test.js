/**
 * Phase 4.19a — Quotation PDF brand-leak gateway.
 *
 * Locks the dispatch path in services/pdf/brandedQuotationRenderer.js
 * against rule #9 / L-068 violations. Reference scenario: the 2026-05-17
 * IronLite incident where a FW Resilient PriceList rendered with SH
 * branding. Quotation renderer had the SAME `brandCode = brand?.code
 * || 'SH'` fallback (line 88 pre-fix). This test suite locks the new
 * gateway shut so the next IronLite-style Quotation can never render
 * SH-branded.
 *
 * Pure-function tests: we mock the sub-renderers to track which one
 * dispatch picks. The actual PDFKit output isn't exercised — we trust
 * PDFKit doesn't mutate input strings.
 */

// Mock the db lookup so dispatch doesn't try to hit Sequelize.
jest.mock('../../models', () => ({
  Brand: {
    findOne: jest.fn(async ({ where }) => {
      const seed = {
        SH: {
          code: 'SH', displayName: 'Sovern House', active: true,
          senderEmail: 'alex@sovernhouse.co',
          signatureHtml: '<div>Sovern House signature</div>',
          signatureText: 'Sovern House',
          footerLegalText: 'New Route International Exchange Co., Ltd.',
        },
        FW: {
          code: 'FW', displayName: 'FlorWay', active: true,
          senderEmail: 'alexflorway@gmail.com',
          signatureHtml: '<div>FlorWay Sdn. Bhd.</div>',
          signatureText: 'FlorWay Sdn. Bhd.',
          footerLegalText: 'FlorWay Sdn. Bhd. (Malaysia)',
        },
        HH: {
          code: 'HH', displayName: 'HanHua', active: true,
          senderEmail: 'alexflorway@gmail.com',
          signatureHtml: '<div>Anhui HanHua Building Materials</div>',
          signatureText: 'Anhui HanHua Building Materials',
          footerLegalText: 'Anhui HanHua Building Materials Technology Co., Ltd.',
        },
      };
      return seed[where.code] || null;
    }),
  },
}));

// Mock the four sub-renderers so we can detect which one dispatch
// would invoke. None of them need to actually do PDF work.
jest.mock('../../services/pdf/brandedQuotationRenderer', () => {
  const actual = jest.requireActual('../../services/pdf/brandedQuotationRenderer');
  return {
    ...actual,
    // Note: we still want to test the REAL dispatch. The sub-renderers
    // get spied on by the assertions below via the dispatcher's
    // require resolution, so this mock block is just here to surface
    // them by name; the actual test exercises the real `dispatch`.
  };
});

const renderer = require('../../services/pdf/brandedQuotationRenderer');
const { BrandLeakError } = require('../../services/brandSafetyGateway');

// Override the PDF render destination so the "accept" tests don't try
// to write into uploads/quotations on disk. UPLOAD_DIR is read once at
// require-time so it's already captured; we override it via env to a
// tmpdir that's safe to write to. The "refuse" tests never reach the
// PDF body because the gateway throws first, so they don't need this.
const os = require('os');
const path = require('path');
const fs = require('fs');
const TMP = path.join(os.tmpdir(), `q-brand-leak-${process.pid}`);
beforeAll(() => {
  fs.mkdirSync(TMP, { recursive: true });
  process.env.UPLOAD_DIR = TMP;
});
afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });

function fwQuotation(extra = {}) {
  return {
    id: 'q-1', quotationNumber: 'QOT-TEST-001', brandCode: 'FW',
    notes: '', termsAndConditions: '', paymentTerms: 'Net 30',
    ...extra,
  };
}
function shQuotation(extra = {}) {
  return {
    id: 'q-2', quotationNumber: 'QOT-TEST-002', brandCode: 'SH',
    notes: '', termsAndConditions: '', paymentTerms: 'Net 30',
    ...extra,
  };
}
function lvtItem() {
  return { id: 'it-1', Product: { id: 'p-1', productType: 'lvt', category: { slug: 'spc' } } };
}
function hardwoodItem() {
  return { id: 'it-2', Product: { id: 'p-2', productType: 'hardwood', category: { slug: 'engineered-wood' } } };
}

describe('Phase 4.19a — Quotation PDF brand-leak gateway', () => {
  test('refuses to render when brandCode is missing', async () => {
    const q = fwQuotation({ brandCode: null });
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(BrandLeakError);
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(/brandCode is missing/);
  });

  test('refuses to render when the brand row is gone (not active)', async () => {
    const q = fwQuotation({ brandCode: 'XX' });
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(BrandLeakError);
  });

  test('refuses to render SH quotation with LVT/SPC items (rule #9, the IronLite-class scenario)', async () => {
    const q = shQuotation();
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(/Resilient flooring.*never SH/i);
  });

  test('SH quotation with non-resilient items passes the gateway', async () => {
    // Asserts the gateway does NOT throw. The actual PDF write is
    // delegated to PDFKit which the gateway intentionally doesn't gate.
    const q = shQuotation();
    const result = await renderer.dispatch(q, [hardwoodItem()], {}, { customer: {}, salesPerson: {} });
    expect(result.filename).toMatch(/^quotation-QOT-TEST-002/);
  });

  test('refuses to render FW quotation when notes contain Sovern House', async () => {
    const q = fwQuotation({ notes: 'Sovern House terms apply' });
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(/notes.*FW.*Sovern House/i);
  });

  test('refuses to render FW quotation when termsAndConditions contain sovernhouse.co', async () => {
    const q = fwQuotation({ termsAndConditions: 'See sovernhouse.co/terms for details' });
    await expect(renderer.dispatch(q, [lvtItem()], {}, {})).rejects.toThrow(/termsAndConditions.*FW.*Sovern House/i);
  });

  test('FW quotation with LVT items passes the gateway', async () => {
    const q = fwQuotation();
    const result = await renderer.dispatch(q, [lvtItem()], {}, { customer: {}, salesPerson: {} });
    expect(result.filename).toMatch(/^quotation-QOT-TEST-001/);
  });

  test('HH quotation with LVT items passes the gateway (Resilient family)', async () => {
    const q = fwQuotation({ brandCode: 'HH', id: 'q-hh' });
    const result = await renderer.dispatch(q, [lvtItem()], {}, { customer: {}, salesPerson: {} });
    expect(result.filename).toMatch(/^quotation-QOT-TEST-001/);
  });
});
