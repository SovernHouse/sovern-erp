/**
 * Phase 4.19b/c/d/e/g + Phase 4.20 — Sales document PDF brand-safety gate.
 *
 * Locks the shared `assertSalesDocBrandSafe` helper from pdfHelpers.js
 * that gates ProformaInvoice, SalesOrder, PurchaseOrder, PackingList,
 * Invoice, CreditNote, and Sales Note PDFs.
 *
 * Phase 4.19 refused FW/HH brands outright because `getCompanyHeader`
 * was SH-only. Phase 4.20 made `getCompanyHeader` + `addFooter`
 * brand-aware (they resolve a Brand row through brandStyleTokens), so
 * the gateway now PERMITS FW/HH while still refusing:
 *   - missing brandCode
 *   - unknown brandCode
 *   - SH brand + Resilient items (rule #9)
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

describe('assertSalesDocBrandSafe — Phase 4.19/4.20 shared lock', () => {
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

  test('refuses SH brand + Resilient (LVT) items (rule #9)', () => {
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

  // ─── Phase 4.20: FW/HH renderers now brand-aware ──────────────────────────
  test('Phase 4.20: accepts FW brand + Resilient items (FW is the correct brand for Resilient)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'pi-1', brandCode: 'FW' }, [lvtItem()], 'Proforma Invoice'))
      .not.toThrow();
  });

  test('Phase 4.20: accepts HH brand + Resilient items (HH is the correct brand for Resilient)', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'so-1', brandCode: 'HH' }, [lvtItem()], 'Sales Order'))
      .not.toThrow();
  });

  test('Phase 4.20: accepts FW brand + no items', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'inv-1', brandCode: 'FW' }, [], 'Invoice'))
      .not.toThrow();
  });

  test('Phase 4.20: accepts HH brand + non-resilient items', () => {
    expect(() => assertSalesDocBrandSafe({ id: 'so-2', brandCode: 'HH' }, [hardwoodItem()], 'Sales Order'))
      .not.toThrow();
  });

  test('error on missing brandCode carries leakField + entityId for downstream surfacing', () => {
    try {
      assertSalesDocBrandSafe({ id: 'inv-x' }, [], 'Invoice');
    } catch (e) {
      expect(e).toBeInstanceOf(BrandLeakError);
      expect(e.entityId).toBe('inv-x');
      expect(e.leakField).toBe('brandCode');
    }
  });

  test('error on unknown brandCode carries brandCode + entityId', () => {
    try {
      assertSalesDocBrandSafe({ id: 'inv-y', brandCode: 'ZZ' }, [], 'Invoice');
    } catch (e) {
      expect(e).toBeInstanceOf(BrandLeakError);
      expect(e.entityId).toBe('inv-y');
      expect(e.brandCode).toBe('ZZ');
      expect(e.leakField).toBe('brandCode');
    }
  });

  test('error on SH + Resilient carries items_resilient_under_sh leakField', () => {
    try {
      assertSalesDocBrandSafe({ id: 'so-9', brandCode: 'SH' }, [lvtItem()], 'Sales Order');
    } catch (e) {
      expect(e).toBeInstanceOf(BrandLeakError);
      expect(e.entityId).toBe('so-9');
      expect(e.brandCode).toBe('SH');
      expect(e.leakField).toBe('items_resilient_under_sh');
    }
  });
});
