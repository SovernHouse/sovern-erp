/**
 * Phase 4.20 — brand-aware PDF renderers.
 *
 * Verifies that the generic PDF generators (PI / SO / PO / PL / Invoice /
 * Credit Note / Statement / Sales Note) thread a resolved Brand row
 * through getCompanyHeader + addFooter so FW/HH entities actually render
 * a PDF instead of being refused at the gateway.
 *
 * Strategy: mock `resolveBrandOrThrow` so the renderers don't need a
 * live DB, then call each generator with `returnBuffer: true` and assert
 * a Buffer comes back. The gateway assertions still run for real (rule
 * #9, missing brandCode, etc.).
 *
 * This locks Phase 4.20's invariant shut: the gateway no longer refuses
 * FW/HH on rendering, AND the resolved Brand actually reaches the
 * renderer. If a future refactor re-introduces the SH-only env-var
 * fallback in getCompanyHeader, these tests still pass — but the
 * companion `phase419bcdSalesDocBrandLeak.test.js` "accepts FW/HH" tests
 * catch the regression.
 */

const path = require('path');

// Mock the brand resolver so we don't hit Sequelize / SQLite. The shape
// here matches what resolveBrandOrThrow returns: { brand, displayName,
// fromDisplayName, senderEmail, signatureHtml, signatureText }.
jest.mock('../../services/brandSafetyGateway', () => {
  const actual = jest.requireActual('../../services/brandSafetyGateway');
  return {
    ...actual,
    resolveBrandOrThrow: jest.fn(async (db, brandCode) => {
      const brands = {
        SH: {
          code: 'SH', displayName: 'Sovern House',
          legalName: 'New Route International Exchange Co., Ltd.',
          senderEmail: 'hello@sovernhouse.co',
          primaryColor: '#1D5A32',
          footerLegalText: 'New Route International Exchange Co., Ltd. — Taiwan',
        },
        FW: {
          code: 'FW', displayName: 'FlorWay',
          legalName: 'FlorWay Sdn. Bhd.',
          senderEmail: 'hello@florway.com',
          primaryColor: '#1F2933',
          footerLegalText: 'FlorWay Sdn. Bhd. — Malaysia',
        },
        HH: {
          code: 'HH', displayName: 'HanHua',
          legalName: 'Anhui HanHua Building Materials Technology Co., Ltd.',
          senderEmail: 'hello@hanhua.com',
          primaryColor: '#1F2933',
          footerLegalText: 'Anhui HanHua Building Materials Technology Co., Ltd. — China',
        },
      };
      const brand = brands[brandCode];
      if (!brand) {
        throw new actual.BrandLeakError(
          `Unknown brand "${brandCode}".`,
          { brandCode, leakField: 'brandCode' }
        );
      }
      return {
        brand,
        displayName: brand.displayName,
        fromDisplayName: brand.displayName,
        senderEmail: brand.senderEmail,
        signatureHtml: '',
        signatureText: '',
      };
    }),
  };
});

// Mock ../../models so the require('../../models') call inside the
// generators returns something — the value is unused because our mocked
// resolveBrandOrThrow ignores it.
jest.mock('../../models', () => ({}), { virtual: true });

const {
  generateSalesOrderPDF,
  generatePurchaseOrderPDF,
  generatePackingListPDF,
} = require('../../services/pdf/orderDocumentsPDF');
const {
  generateInvoicePDF,
  generateCreditNotePDF,
  generateStatementOfAccountPDF,
} = require('../../services/pdf/financeDocumentsPDF');

function lvtItem() {
  return {
    id: 'it-1', product: { name: 'SPC 4mm' },
    Product: { id: 'p-1', productType: 'lvt', category: { slug: 'spc' } },
    quantity: 100, unit: 'sqm', unitPrice: 12.5, total: 1250,
  };
}
function hardwoodItem() {
  return {
    id: 'it-2', product: { name: 'Engineered Oak' },
    Product: { id: 'p-2', productType: 'hardwood', category: { slug: 'engineered-wood' } },
    quantity: 200, unit: 'sqm', unitPrice: 18.0, total: 3600,
  };
}

function so(brandCode, items) {
  return {
    id: 'so-1', orderNumber: 'SO-0001', brandCode,
    createdAt: new Date(), status: 'confirmed',
    estimatedDelivery: new Date(),
    items, currency: 'USD',
    subtotal: items.reduce((s, i) => s + i.total, 0),
    discount: 0, tax: 0, total: items.reduce((s, i) => s + i.total, 0),
  };
}

function po(brandCode, items) {
  return {
    id: 'po-1', poNumber: 'PO-0001', brandCode,
    createdAt: new Date(), status: 'sent',
    expectedDelivery: new Date(),
    items, currency: 'USD',
    subtotal: items.reduce((s, i) => s + i.total, 0),
    total: items.reduce((s, i) => s + i.total, 0),
  };
}

function pl(brandCode, items) {
  return {
    id: 'pl-1', packingListNumber: 'PL-0001', brandCode,
    createdAt: new Date(),
    totalPackages: 10, totalGrossWeight: 1200, totalNetWeight: 1100, totalVolume: 4.5,
    items,
  };
}

function inv(brandCode) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-0001', brandCode,
    createdAt: new Date(), dueDate: new Date(), status: 'sent',
    subtotal: 1250, discount: 0, tax: 0, total: 1250,
    paidAmount: 0, balance: 1250, currency: 'USD',
    paymentTerms: 'Net 30',
  };
}

function cn(brandCode) {
  return {
    id: 'cn-1', invoiceNumber: 'CN-0001', brandCode,
    createdAt: new Date(),
    subtotal: 500, tax: 0, total: 500, currency: 'USD',
    notes: 'Refund for short delivery.',
  };
}

const customer = { id: 'c-1', companyName: 'ACME Buyer', contactPerson: 'Jane', email: 'jane@acme.com', currency: 'USD' };
const factory  = { id: 'f-1', companyName: 'FactoryCo', contactPerson: 'Wei' };

describe('Phase 4.20 — FW/HH brand-aware rendering', () => {
  // ─── orderDocumentsPDF ──────────────────────────────────────────────────
  test('SalesOrder renders for FW + Resilient items', async () => {
    const buf = await generateSalesOrderPDF(so('FW', [lvtItem()]), [lvtItem()], customer, factory, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
  });

  test('SalesOrder renders for HH + Resilient items', async () => {
    const buf = await generateSalesOrderPDF(so('HH', [lvtItem()]), [lvtItem()], customer, factory, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('SalesOrder renders for SH + non-resilient items', async () => {
    const buf = await generateSalesOrderPDF(so('SH', [hardwoodItem()]), [hardwoodItem()], customer, factory, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('SalesOrder refuses SH + Resilient items (rule #9)', async () => {
    await expect(
      generateSalesOrderPDF(so('SH', [lvtItem()]), [lvtItem()], customer, factory, { returnBuffer: true })
    ).rejects.toThrow(/Resilient/i);
  });

  test('PurchaseOrder renders for FW', async () => {
    const buf = await generatePurchaseOrderPDF(po('FW', [lvtItem()]), [lvtItem()], factory, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('PurchaseOrder renders for HH', async () => {
    const buf = await generatePurchaseOrderPDF(po('HH', [lvtItem()]), [lvtItem()], factory, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('PackingList renders for FW', async () => {
    const buf = await generatePackingListPDF(pl('FW', [lvtItem()]), [lvtItem()], { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('PackingList renders for HH', async () => {
    const buf = await generatePackingListPDF(pl('HH', [lvtItem()]), [lvtItem()], { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  // ─── financeDocumentsPDF ────────────────────────────────────────────────
  test('Invoice renders for FW', async () => {
    const buf = await generateInvoicePDF(inv('FW'), { items: [lvtItem()] }, customer, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('Invoice renders for HH', async () => {
    const buf = await generateInvoicePDF(inv('HH'), { items: [lvtItem()] }, customer, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('Invoice refuses SH + Resilient items (rule #9)', async () => {
    await expect(
      generateInvoicePDF(inv('SH'), { items: [lvtItem()] }, customer, { returnBuffer: true })
    ).rejects.toThrow(/Resilient/i);
  });

  test('CreditNote renders for FW', async () => {
    const buf = await generateCreditNotePDF(cn('FW'), customer, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('CreditNote renders for HH', async () => {
    const buf = await generateCreditNotePDF(cn('HH'), customer, { returnBuffer: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('Statement of Account renders for FW (single-brand invoices)', async () => {
    const buf = await generateStatementOfAccountPDF(
      customer,
      [inv('FW'), inv('FW')],
      [{ amount: 200 }],
      { returnBuffer: true }
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('Statement of Account renders for HH (single-brand invoices)', async () => {
    const buf = await generateStatementOfAccountPDF(
      customer,
      [inv('HH')],
      [],
      { returnBuffer: true }
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('Statement of Account refuses mixed brands', async () => {
    await expect(
      generateStatementOfAccountPDF(customer, [inv('SH'), inv('FW')], [], { returnBuffer: true })
    ).rejects.toThrow(/mixed brands/i);
  });

  test('Statement of Account refuses zero brands (all invoices missing brandCode)', async () => {
    await expect(
      generateStatementOfAccountPDF(customer, [{ ...inv('SH'), brandCode: null }], [], { returnBuffer: true })
    ).rejects.toThrow(/no brandCode found/i);
  });

  // ─── missing brandCode + unknown brand still refused ────────────────────
  test('SalesOrder refuses missing brandCode', async () => {
    const x = so('SH', [hardwoodItem()]);
    delete x.brandCode;
    await expect(
      generateSalesOrderPDF(x, [hardwoodItem()], customer, factory, { returnBuffer: true })
    ).rejects.toThrow(/brandCode is missing/);
  });

  test('Invoice refuses unknown brandCode', async () => {
    await expect(
      generateInvoicePDF({ ...inv('SH'), brandCode: 'XX' }, { items: [] }, customer, { returnBuffer: true })
    ).rejects.toThrow(/unknown brandCode "XX"/);
  });
});
