// ─── priceListBrandResolver — Phase 4.28d ───────────────────────────────────
//
// CRITICAL SECURITY HELPER. Prevents brand-context leaks on PriceList
// rendering + emailing. Codifies the business rule Alex set after the
// 2026-05-17 incident:
//
//   "Any Resilient flooring product (LVT, SPC, Engineered SPC, WPC,
//    Vinyl Sheet, or anything under the Resilient subtree) is FlorWay
//    (FW). It MUST NOT carry Sovern House branding."
//
// resolveBrand(priceList, opts) → { brand, requiredBrand, source, items }
//   brand          string|null    The brand the renderer should use
//   requiredBrand  string|null    The brand the items demand (null = no signal)
//   source         string         Where `brand` came from ('items.resilient',
//                                  'priceList', 'factory', 'customer', 'opts')
//   items          array          Per-item brand audit
//
// assertBrandSafe(priceList, brand) → void
//   Throws BrandLeakError if any item conflicts with `brand`. Renderer
//   + email helper + MCP write tools call this before producing output.

const RESILIENT_PRODUCT_TYPES = new Set([
  'lvt', 'spc', 'wpc', 'engineered_spc', 'vinyl_sheet',
]);

// Slugs under the Resilient subtree per the 2026-05-15 taxonomy snapshot.
// Matches the set Phase 4.20 seeded with ProductCategory.default_brand='FW'.
const RESILIENT_CATEGORY_SLUGS = new Set([
  'resilient', 'lvt', 'spc', 'engineered-spc', 'wpc', 'vinyl-sheet',
]);

// The brands Resilient flooring is allowed to carry. Single source of truth.
//   FW (FlorWay) = Malaysia origin
//   HH (HanHua)  = China   origin
// Resilient is NEVER SH. Per Alex 2026-05-17 incident + non-negotiable #9.
const RESILIENT_ALLOWED_BRANDS = new Set(['FW', 'HH']);

// Sister-brand co-mention is allowed in the declared-conflict check.
// Per brand-safety.md (L-070): "FW <-> HH co-mention is ALLOWED (sister
// factories under the Resilient family, both factories listed in each
// other's seeded signatures)." A single SKU may ship from either origin
// (IronLite Core: FlorWay Malaysia OR Anhui HanHua China), so a
// Product.brand_code of FW must not block an HH price list, and vice
// versa. SH <-> FW/HH is still refused in either direction.
const SISTER_BRAND_PAIR = new Set(['FW', 'HH']);

// Default brand to assume when the caller doesn't specify and items don't
// disambiguate. The resolver refuses to render at this point — but the
// constant is preserved for tests that probe the legacy single-brand
// behaviour.
const RESILIENT_DEFAULT_BRAND = 'FW';

class BrandLeakError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = 'BrandLeakError';
    this.code = 'brand_leak';
    this.info = info;
  }
}

function isResilientItem(item) {
  // item is a PriceListItem with optional .Product include containing
  // .product_type / .productType and .ProductCategory / .category.
  const p = item.Product || item.product;
  if (!p) return false;
  const type = String(p.productType || p.product_type || '').toLowerCase();
  if (RESILIENT_PRODUCT_TYPES.has(type)) return true;
  const cat = p.ProductCategory || p.category;
  if (cat) {
    if (String(cat.default_brand || cat.defaultBrand || '').toUpperCase() === 'FW') return true;
    const slug = String(cat.slug || '').toLowerCase();
    if (RESILIENT_CATEGORY_SLUGS.has(slug)) return true;
  }
  return false;
}

function itemDeclaredBrand(item) {
  const p = item.Product || item.product;
  if (!p) return null;
  const bc = p.brand_code || p.brandCode;
  return bc ? String(bc).toUpperCase() : null;
}

function resolveBrand(priceList, opts = {}) {
  const items = Array.isArray(priceList.items) ? priceList.items : [];
  const audit = items.map((it) => ({
    sku:         it.sku || it.Product?.sku || it.product?.sku || null,
    productId:   it.productId || it.product_id || null,
    declared:    itemDeclaredBrand(it),
    isResilient: isResilientItem(it),
  }));

  // Step 1 — Resilient rule. Resilient is FW (Malaysia origin) OR HH
  // (China origin), never SH. If the PriceList already declares brand_code
  // and it's in the allowed set, use it. Otherwise refuse to silently pick
  // — the operator must declare FW or HH because the origin determines
  // the brand and the renderer can't infer origin from item rows today.
  const resilientItems = audit.filter((a) => a.isResilient);
  if (resilientItems.length > 0) {
    const declared = String(
      opts.brandCode || priceList.brandCode || priceList.brand_code || '',
    ).toUpperCase();
    if (declared && RESILIENT_ALLOWED_BRANDS.has(declared)) {
      return {
        brand: declared,
        requiredBrand: declared,
        source: 'items.resilient+declared',
        items: audit,
      };
    }
    // Item-declared consensus across all items (e.g. all Product.brand_code=HH)
    const declaredItemBrands = new Set(audit.map((a) => a.declared).filter(Boolean));
    if (declaredItemBrands.size === 1) {
      const single = Array.from(declaredItemBrands)[0];
      if (RESILIENT_ALLOWED_BRANDS.has(single)) {
        return {
          brand: single,
          requiredBrand: single,
          source: 'items.resilient+item-declared',
          items: audit,
        };
      }
    }
    // Factory.brand_code disambiguates (FlorWay → FW, HanHua → HH)
    const fac = priceList.Factory || priceList.factory;
    if (fac && (fac.brandCode || fac.brand_code)) {
      const fb = String(fac.brandCode || fac.brand_code).toUpperCase();
      if (RESILIENT_ALLOWED_BRANDS.has(fb)) {
        return {
          brand: fb,
          requiredBrand: fb,
          source: 'items.resilient+factory',
          items: audit,
        };
      }
    }
    // No safe inference — refuse and let assertBrandSafe surface a clear
    // error to the operator / AI.
    return {
      brand: null,
      requiredBrand: 'FW or HH',
      source: 'items.resilient.unresolved',
      items: audit,
    };
  }

  // Step 2 — explicit opts override (e.g. AI assistant preview)
  if (opts.brandCode) {
    return {
      brand: String(opts.brandCode).toUpperCase(),
      requiredBrand: null,
      source: 'opts',
      items: audit,
    };
  }

  // Step 3 — PriceList.brand_code (explicit declaration)
  if (priceList.brandCode || priceList.brand_code) {
    return {
      brand: String(priceList.brandCode || priceList.brand_code).toUpperCase(),
      requiredBrand: null,
      source: 'priceList',
      items: audit,
    };
  }

  // Step 4 — declared item brand consensus
  const declaredBrands = new Set(audit.map((a) => a.declared).filter(Boolean));
  if (declaredBrands.size === 1) {
    return {
      brand: Array.from(declaredBrands)[0],
      requiredBrand: Array.from(declaredBrands)[0],
      source: 'items.declared',
      items: audit,
    };
  }

  // Step 5 — Factory.brand_code (the supplier's brand)
  const fac = priceList.Factory || priceList.factory;
  if (fac && (fac.brandCode || fac.brand_code)) {
    return {
      brand: String(fac.brandCode || fac.brand_code).toUpperCase(),
      requiredBrand: null,
      source: 'factory',
      items: audit,
    };
  }

  // Step 6 — Customer single-brand fallback. Skipped if multi-brand.
  const cust = priceList.Customer || priceList.customer;
  if (cust) {
    let rels = cust.brandRelationships || cust.brand_relationships;
    // L-047 / L-053 — parse on read.
    if (typeof rels === 'string') {
      try { rels = JSON.parse(rels); } catch (_) { rels = null; }
    }
    if (Array.isArray(rels) && rels.length === 1) {
      return {
        brand: String(rels[0]).toUpperCase(),
        requiredBrand: null,
        source: 'customer',
        items: audit,
      };
    }
  }

  // Nothing matched. Render must refuse rather than default to SH.
  return {
    brand: null,
    requiredBrand: declaredBrands.size > 1 ? null : null,
    source: 'none',
    items: audit,
  };
}

/**
 * Throw if `brand` is missing or any item disagrees with `brand`.
 * Caller catches BrandLeakError and surfaces a 422 / clear AI error.
 */
function assertBrandSafe(priceList, brand) {
  if (!brand) {
    throw new BrandLeakError(
      'PriceList has no resolvable brand context — refusing to render. Set brand_code on the PriceList or include items with a declared Product.brand_code.',
      { priceListId: priceList.id, name: priceList.name },
    );
  }
  const items = Array.isArray(priceList.items) ? priceList.items : [];
  const upperBrand = String(brand).toUpperCase();

  // 1) Resilient items must be FW (Malaysia) or HH (China). Never SH.
  const resilientConflicts = items
    .filter((it) => isResilientItem(it) && !RESILIENT_ALLOWED_BRANDS.has(upperBrand))
    .map((it) => ({ sku: it.sku || it.Product?.sku, productId: it.productId }));
  if (resilientConflicts.length > 0) {
    throw new BrandLeakError(
      `Resilient flooring items cannot be rendered under brand ${upperBrand}. Resilient is FW (FlorWay, Malaysia) or HH (HanHua, China) only — never SH.`,
      { priceListId: priceList.id, brand: upperBrand, conflicts: resilientConflicts },
    );
  }

  // 2) Items with a declared Product.brand_code that disagrees with the
  //    chosen brand are a brand-bleed in waiting. Refuse.
  //
  // Exception: FW <-> HH sister-brand co-mention is allowed per
  // brand-safety.md (L-070). The same engineered-SPC SKU ships from
  // both FlorWay (Malaysia) and Anhui HanHua (China) production lines;
  // a Product tagged brand_code='FW' must not block an HH price list
  // (and vice versa). SH <-> FW/HH is still refused in either direction.
  const declaredConflicts = items
    .filter((it) => {
      const d = itemDeclaredBrand(it);
      if (!d || d === upperBrand) return false;
      if (SISTER_BRAND_PAIR.has(d) && SISTER_BRAND_PAIR.has(upperBrand)) return false;
      return true;
    })
    .map((it) => ({
      sku: it.sku || it.Product?.sku,
      productId: it.productId,
      declared: itemDeclaredBrand(it),
    }));
  if (declaredConflicts.length > 0) {
    throw new BrandLeakError(
      `PriceList brand ${upperBrand} conflicts with items that declare a different Product.brand_code. Split the list or correct the items first.`,
      { priceListId: priceList.id, brand: upperBrand, conflicts: declaredConflicts },
    );
  }
}

/**
 * Include shape consumers should pass to PriceList.findByPk so the
 * resolver has the data it needs. Single source of truth.
 */
function priceListIncludeForBrand(db) {
  return [
    { model: db.Customer, attributes: ['id', 'companyName', 'email', 'brandRelationships'] },
    { model: db.Factory,  attributes: ['id', 'companyName', 'email', 'brandCode'] },
    {
      model: db.PriceListItem,
      as: 'items',
      include: [{
        model: db.Product,
        // Phase 4.28v (2026-05-19): include specifications + certifications
        // so the price-list PDF can render the common product details
        // block (construction / click system / surface finish / AC rating /
        // certifications) above the items table. Without these the PDF
        // shows only the items grid even though Alice's WeChat-confirmed
        // specs are sitting on the row.
        attributes: ['id', 'name', 'sku', 'brandCode', 'productType', 'categoryId', 'specifications', 'certifications', 'hsCode', 'originCountry'],
        include: [{
          model: db.ProductCategory,
          as: 'category',
          attributes: ['id', 'slug', 'defaultBrand'],
        }],
      }],
    },
  ];
}

module.exports = {
  resolveBrand,
  assertBrandSafe,
  isResilientItem,
  itemDeclaredBrand,
  priceListIncludeForBrand,
  BrandLeakError,
  RESILIENT_ALLOWED_BRANDS,
  RESILIENT_DEFAULT_BRAND,
  RESILIENT_PRODUCT_TYPES,
  RESILIENT_CATEGORY_SLUGS,
};
