/**
 * Phase 4.19b/c/d/e/g — Sales document PDF brand-leak gateway.
 *
 * Locks the shared `assertSalesDocBrandSafe` helper from pdfHelpers.js
 * that gates ProformaInvoice, SalesOrder, PurchaseOrder, PackingList,
 * Invoice, CreditNote, and Sales Note PDFs. These renderers all share
 * `getCompanyHeader` which reads PDF_COMPANY_NAME (SH-only env var) —
 * they cannot safely render FW/HH branded output until Phase 4.20.
 *
 * Pure-function tests against the helper itself; the individual PDF
 * generators each call this helper at their entry point so the lock
 * propagates to every renderer in the set.
 */

const { assertSalesDocBrandSafe } = require('../../services/pdf/pdfHelpers');
const { BrandLeakError } = require('../../services/brandSafetyGateway');

function lvtItem() {
  return { id: 'it-1', Product: { id: 'p-1', productType: 'lvt', category: { slug: 'spc' } } };
}
function wpcItem() {
  return { id: 'it-2', Product: { id: 'p-2', productType: 'wpc', category: { slug: 'wpc' } } };
}
function hardwoodItem() {
  return { id: 'it-3', Product: { id: 'p-3', productType: 'hardwood', category: { slug: 'engineered-wood' } } };
}

describe('assertSalesDocBrandSafe — Phase 4.19b/c/d/e/g shared lock', () => {
  test('refuses missing brandCode', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'pi-1' }, [hardwoodItem()], 'Proforma Invoice'))
      .toThrow(BrandLeakError);
    expect(() => assertSalesDocBrandSafe({ id: 'pi-1' }, [hardwoodItem()], 'Proforma Invoice'))
      .toThrow(/brandCode is missing/);
  });

  test('refuses unknown brandCode', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'so-1', brandCode: 'XX' }, [], 'Sales Order'))
      .toThrow(/unknown brandCode "XX"/);
  });

  test('refuses FW brand (renderer not brand-aware until Phase 4.20)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'pi-1', brandCode: 'FW' }, [lvtItem()], 'Proforma Invoice'))
      .toThrow(/renderer is SH-only.*Phase 4\.20/);
  });

  test('refuses HH brand (same reason)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'so-1', brandCode: 'HH' }, [lvtItem()], 'Sales Order'))
      .toThrow(/renderer is SH-only/);
  });

  test('refuses SH brand + Resilient items (rule #9)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'inv-1', brandCode: 'SH' }, [lvtItem()], 'Invoice'))
      .toThrow(/Resilient flooring.*never SH/i);
  });

  test('refuses SH brand + WPC items (rule #9, different resilient slug)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'inv-2', brandCode: 'SH' }, [wpcItem()], 'Invoice'))
      .toThrow(/Resilient/i);
  });

  test('refuses SH brand + mixed items where ANY is Resilient', () => {
    expect(() => assertSalesDocBrandSafe(
      { id: 'so-2', brandCode: 'SH' },
      [hardwoodItem(), lvtItem()],
      'Sales Order'
    )).toThrow(/Resilient/i);
  });

  test('accepts SH brand + non-resilient items', () => {
    expect(() => assertSalesDocBrandSafe(
      { id: 'so-3', brandCode: 'SH' },
      [hardwoodItem()],
      'Sales Order'
    )).not.toThrow();
  });

  test('accepts SH brand + no items (e.g. credit note signature)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'cn-1', brandCode: 'SH' }, [], 'Credit Note'))
      .not.toThrow();
  });

  test('error carries leakField + entityId for downstream surfacing', () => {
    try {
      assertSalesDocBrandSafe({ id: 'inv-x', brandCode: 'FW' }, [], 'Invoice');
    } catch (e) {
      expect(e).toBeInstanceOf(BrandLeakError);
      expect(e.entityId).toBe('inv-x');
      expect(e.brandCode).toBe('FW');
      expect(e.leakField).toBe('renderer_not_brand_aware');
    }
  });
});
