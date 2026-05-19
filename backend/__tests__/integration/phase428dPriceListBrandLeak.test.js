// Phase 4.28d — PriceList brand-leak regression test.
//
// Locks in the non-negotiable #9 rule: Resilient flooring (LVT, SPC,
// Engineered SPC, WPC, Vinyl Sheet, or anything under the Resilient
// ProductCategory subtree) is FW (Malaysia origin) OR HH (China
// origin), NEVER SH. The renderer + email helper MUST refuse rather
// than fall back to SH.
//
// What this test asserts:
//   1. resolveBrand on a Resilient PriceList with no brand_code +
//      no factory_id returns { brand: null, source: 'items.resilient.unresolved' }
//   2. assertBrandSafe throws if the resolved brand is 'SH' and any
//      item is Resilient
//   3. resolveBrand uses PriceList.brand_code when set and items don't
//      block (FW + Malaysia origin: pass)
//   4. assertBrandSafe throws when items declare a brand that
//      conflicts with the chosen brand
//   5. renderPriceListPdf surfaces BrandLeakError (does not produce
//      a buffer)

const {
  resolveBrand,
  assertBrandSafe,
  BrandLeakError,
  RESILIENT_ALLOWED_BRANDS,
} = require('../../services/priceListBrandResolver');
const { renderPriceListPdf } = require('../../services/pdf/priceListRenderer');

describe('Phase 4.28d — PriceList brand-leak guard', () => {
  // Helpers — synthesize PriceList shapes the resolver consumes.
  function resilientItem({ sku = 'IL-180x1220-9.0mm', brand = 'FW', type = 'engineered_spc' } = {}) {
    return {
      id: 'item-' + sku,
      sku,
      productId: 'p-' + sku,
      Product: {
        id: 'p-' + sku,
        sku,
        name: `IronLite ${sku}`,
        brandCode: brand,
        productType: type,
        category: { id: 'cat', slug: 'engineered-spc', defaultBrand: 'FW' },
      },
    };
  }
  function genericItem({ sku = 'ALF-001', brand = 'SH', type = 'hardwood' } = {}) {
    return {
      id: 'item-' + sku,
      sku,
      productId: 'p-' + sku,
      Product: {
        id: 'p-' + sku,
        sku,
        name: `Generic ${sku}`,
        brandCode: brand,
        productType: type,
        category: { id: 'cat-generic', slug: 'engineered-wood', defaultBrand: null },
      },
    };
  }

  test('Resilient items + missing brand_code + no factory + items have no declared brand → unresolved (does not silently default to SH)', () => {
    const pl = {
      id: 'pl-1',
      name: 'IronLite Q3 (orphan)',
      brandCode: null,
      // Items without a declared Product.brand_code — the resolver has
      // no signal to disambiguate FW vs HH and MUST refuse rather than
      // pick SH.
      items: [
        resilientItem({ brand: null }),
        resilientItem({ sku: 'IL-180x1220-10.0mm', brand: null }),
      ],
    };
    const out = resolveBrand(pl);
    expect(out.brand).toBeNull();
    expect(out.source).toBe('items.resilient.unresolved');
  });

  test('Resilient items + brand_code=FW → FW (Malaysia origin path)', () => {
    const pl = {
      id: 'pl-2',
      name: 'IronLite Malaysia',
      brandCode: 'FW',
      items: [resilientItem({ brand: 'FW' })],
    };
    const out = resolveBrand(pl);
    expect(out.brand).toBe('FW');
    expect(['items.resilient+declared', 'items.resilient+item-declared']).toContain(out.source);
  });

  test('Resilient items + brand_code=HH → HH (China origin path)', () => {
    const pl = {
      id: 'pl-3',
      name: 'IronLite China',
      brandCode: 'HH',
      items: [resilientItem({ brand: 'HH' })],
    };
    const out = resolveBrand(pl);
    expect(out.brand).toBe('HH');
  });

  test('Resilient items + brand_code=SH → assertBrandSafe throws BrandLeakError', () => {
    const pl = {
      id: 'pl-4',
      name: 'IronLite mis-tagged',
      brandCode: 'SH', // mistake the operator might make
      items: [resilientItem()],
    };
    // resolveBrand for resilient ignores SH (returns unresolved); but if
    // a caller bypasses resolveBrand and passes SH to assertBrandSafe,
    // the safety net must still catch it.
    expect(() => assertBrandSafe(pl, 'SH')).toThrow(BrandLeakError);
    try {
      assertBrandSafe(pl, 'SH');
    } catch (e) {
      expect(e.code).toBe('brand_leak');
      expect(e.info.brand).toBe('SH');
      expect(e.info.conflicts.length).toBeGreaterThan(0);
    }
  });

  test('Sister-brand exemption: FW list with HH-tagged items passes (and vice versa)', () => {
    // Per brand-safety.md L-070, FW <-> HH co-mention is allowed because
    // the same engineered-SPC SKU ships from both FlorWay (Malaysia) and
    // Anhui HanHua (China). This exemption was added 2026-05-19 after
    // the HH IronLite PDF refused to render (Alex incident).
    const plFW = {
      id: 'pl-5a',
      name: 'FW list with HH-tagged items',
      brandCode: 'FW',
      items: [resilientItem({ brand: 'HH' })],
    };
    expect(() => assertBrandSafe(plFW, 'FW')).not.toThrow();

    const plHH = {
      id: 'pl-5b',
      name: 'HH list with FW-tagged items',
      brandCode: 'HH',
      items: [resilientItem({ brand: 'FW' })],
    };
    expect(() => assertBrandSafe(plHH, 'HH')).not.toThrow();
  });

  test('SH <-> FW/HH cross-brand items still refused (exemption is FW<->HH only)', () => {
    // SH on an FW list = brand-bleed; refuse regardless of Resilient
    // status. The sister-brand exemption applies only to the {FW, HH}
    // pair.
    const plFWwithSH = {
      id: 'pl-5c',
      name: 'FW list with SH-tagged items',
      brandCode: 'FW',
      items: [
        // SH item with a non-resilient product type so the Resilient
        // refusal at line 1 doesn't fire first; this isolates the
        // declared-conflict path.
        genericItem({ brand: 'SH', type: 'hardwood' }),
      ],
    };
    expect(() => assertBrandSafe(plFWwithSH, 'FW')).toThrow(BrandLeakError);
  });

  test('renderPriceListPdf surfaces BrandLeakError (no PDF buffer produced) when brand cannot be resolved', async () => {
    const pl = {
      id: 'pl-6',
      name: 'no-brand IronLite',
      brandCode: null,
      items: [resilientItem({ brand: null })],
    };
    await expect(renderPriceListPdf(pl)).rejects.toBeInstanceOf(BrandLeakError);
  });

  test('renderPriceListPdf succeeds when brand is correctly tagged FW with FW items', async () => {
    const pl = {
      id: 'pl-7',
      name: 'IronLite Malaysia',
      brandCode: 'FW',
      currencyCode: 'USD',
      validFrom: '2026-05-17',
      validTo: '2026-06-17',
      Factory: { id: 'fac-1', companyName: 'FlorWay SDN. BHD.', brandCode: 'FW' },
      items: [resilientItem({ brand: 'FW' })],
    };
    const buf = await renderPriceListPdf(pl);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
  });

  test('Resilient ALLOWED_BRANDS set is {FW, HH} (sanity check on the constant)', () => {
    expect(RESILIENT_ALLOWED_BRANDS.has('FW')).toBe(true);
    expect(RESILIENT_ALLOWED_BRANDS.has('HH')).toBe(true);
    expect(RESILIENT_ALLOWED_BRANDS.has('SH')).toBe(false);
  });

  test('Generic non-resilient items respect declared item brand consensus', () => {
    const pl = {
      id: 'pl-8',
      name: 'SH hardwood',
      brandCode: null,
      items: [genericItem({ brand: 'SH' })],
    };
    const out = resolveBrand(pl);
    expect(out.brand).toBe('SH');
  });
});
