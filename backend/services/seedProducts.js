/**
 * Product seed — Phase 4, C14.
 *
 * Idempotent: inserts the seed rows only if they don't already exist by
 * (brandCode, sku). Same pattern as seedBrands.js.
 *
 * SEED PRICES ARE PLACEHOLDERS. Alex replaces with confirmed factory FOB
 * before live use. The numbers below are reasonable industry placeholders
 * just so the catalog isn't empty at launch.
 *
 * NO-MARKUP INVARIANT: baseFobPrice is what the factory provides AND what
 * the buyer pays. The ERP NEVER multiplies by (1 + commissionRate). Alex's
 * commission is a separate ledger row (CommissionTracking), tracked
 * downstream when an SO confirms.
 *
 * Products require a categoryId (FK) and factoryId (FK). The seed looks
 * them up by name; if not found it logs and skips (no-op rather than
 * crash). Real product data Alex manages via the /settings/products admin
 * UI.
 */

const logger = require('../utils/logger');

/**
 * Find-or-create a ProductCategory by name. Idempotent.
 */
async function ensureCategory(db, name) {
  const existing = await db.ProductCategory.findOne({ where: { name } });
  if (existing) return existing;
  return db.ProductCategory.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    isActive: true,
  });
}

/**
 * Find a factory by company name (for seeding only). Returns null if not
 * found — seeder will skip products tied to unknown factories.
 */
async function findFactory(db, companyName) {
  return db.Factory.findOne({ where: { companyName } });
}

const SEED_PRODUCTS = [
  // ── FlorWay (FW) placeholders ────────────────────────────────────────────
  // SKUs use FW- prefix per the brand-prefix convention; global SKU
  // uniqueness is preserved at the column level.
  {
    brandCode: 'FW',
    sku: 'FW-SPC-65',
    name: 'IronLite 6.5mm SPC Hybrid LVT',
    productType: 'spc',
    description: 'IronLite Core 6.5mm SPC plank. 22mil wear layer. IXPE underlay pre-attached.',
    salesDescription: 'Premium IronLite Core 6.5mm SPC hybrid plank with 22mil commercial wear layer and pre-attached IXPE acoustic underlay.',
    baseFobPrice: 5.80,  // PLACEHOLDER — replace with confirmed factory FOB
    currency: 'USD',
    minOrderQty: 1000,
    moqUnit: 'sqm',
    leadTimeDays: 45,
    certifications: [
      { name: 'FloorScore', issuer: 'SCS Global Services', expiresAt: null },
      { name: 'CARB2', issuer: 'California Air Resources Board', expiresAt: null },
    ],
    originCountry: 'MY',
    categoryName: 'SPC',
    factoryCompanyName: 'FlorWay Manufacturing',
  },
  {
    brandCode: 'FW',
    sku: 'FW-SPC-85',
    name: 'IronLite 8.5mm SPC Hybrid LVT',
    productType: 'spc',
    description: 'IronLite Core 8.5mm SPC plank. 22mil wear layer. IXPE underlay pre-attached.',
    salesDescription: 'IronLite Core 8.5mm SPC hybrid plank. Thicker rigid core for commercial-grade installations.',
    baseFobPrice: 7.20,  // PLACEHOLDER — replace with confirmed factory FOB
    currency: 'USD',
    minOrderQty: 1000,
    moqUnit: 'sqm',
    leadTimeDays: 45,
    certifications: [
      { name: 'FloorScore', issuer: 'SCS Global Services', expiresAt: null },
      { name: 'CARB2', issuer: 'California Air Resources Board', expiresAt: null },
    ],
    originCountry: 'MY',
    categoryName: 'SPC',
    factoryCompanyName: 'FlorWay Manufacturing',
  },
  {
    brandCode: 'FW',
    sku: 'FW-WPC-65',
    name: 'Generic WPC 6.5mm',
    productType: 'wpc',
    description: 'WPC Hybrid Construction 6.5mm plank. 12mil wear layer.',
    salesDescription: 'WPC Hybrid Construction 6.5mm plank. Suitable for residential and light commercial.',
    baseFobPrice: 6.40,  // PLACEHOLDER — replace with confirmed factory FOB
    currency: 'USD',
    minOrderQty: 1000,
    moqUnit: 'sqm',
    leadTimeDays: 45,
    certifications: [
      { name: 'FloorScore', issuer: 'SCS Global Services', expiresAt: null },
    ],
    originCountry: 'MY',
    categoryName: 'WPC',
    factoryCompanyName: 'FlorWay Manufacturing',
  },

  // ── Sovern House (SH) placeholders ──────────────────────────────────────
  {
    brandCode: 'SH',
    sku: 'SH-HW-14',
    name: 'Engineered Oak 14mm',
    productType: 'hardwood',
    description: 'European Oak engineered hardwood. 14mm overall, 3mm wear layer. Brushed and matte lacquered.',
    salesDescription: 'European Oak engineered hardwood plank. 14mm total thickness with 3mm sliced face. Brushed surface, matte lacquer finish.',
    baseFobPrice: 24.00,  // PLACEHOLDER — replace with confirmed factory FOB
    currency: 'USD',
    minOrderQty: 500,
    moqUnit: 'sqm',
    leadTimeDays: 60,
    certifications: [
      { name: 'FSC', issuer: 'Forest Stewardship Council', expiresAt: null },
    ],
    originCountry: 'CN',
    categoryName: 'Hardwood',
    factoryCompanyName: null,  // resolve at seed time; first available
  },
  {
    brandCode: 'SH',
    sku: 'SH-LAM-8',
    name: 'Laminate 8mm AC4',
    productType: 'laminate',
    description: 'AC4 commercial-grade laminate plank. 8mm thickness with 4-sided V-groove.',
    salesDescription: 'AC4 commercial-grade laminate plank. 8mm thickness with 4-sided V-groove for premium visual.',
    baseFobPrice: 6.80,  // PLACEHOLDER — replace with confirmed factory FOB
    currency: 'USD',
    minOrderQty: 1000,
    moqUnit: 'sqm',
    leadTimeDays: 45,
    certifications: [
      { name: 'CE', issuer: 'European Conformity', expiresAt: null },
    ],
    originCountry: 'CN',
    categoryName: 'Laminate',
    factoryCompanyName: null,
  },
];

async function seedProductsIfEmpty(db) {
  if (!db || !db.Product || !db.ProductCategory || !db.Factory) {
    logger.warn('[seedProducts] db models not registered; skipping seed');
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of SEED_PRODUCTS) {
    // Idempotency: skip if (brandCode, sku) already exists.
    const existing = await db.Product.findOne({
      where: { brandCode: row.brandCode, sku: row.sku },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Resolve category and factory (FK requirements).
    const category = await ensureCategory(db, row.categoryName);

    let factory;
    if (row.factoryCompanyName) {
      factory = await findFactory(db, row.factoryCompanyName);
    }
    if (!factory) {
      // SH placeholders fall back to the first available factory.
      factory = await db.Factory.findOne({ order: [['createdAt', 'ASC']] });
    }
    if (!factory) {
      logger.warn(`[seedProducts] No factory available for seed ${row.sku}; skipping`);
      continue;
    }

    await db.Product.create({
      brandCode: row.brandCode,
      sku: row.sku,
      name: row.name,
      description: row.description,
      salesDescription: row.salesDescription,
      categoryId: category.id,
      factoryId: factory.id,
      unit: 'sqm',
      specifications: {},
      images: [],
      productType: row.productType,
      baseFobPrice: row.baseFobPrice,
      currency: row.currency,
      minOrderQty: row.minOrderQty,
      moqUnit: row.moqUnit,
      leadTimeDays: row.leadTimeDays,
      certifications: row.certifications,
      originCountry: row.originCountry,
      isActive: true,
    });
    inserted++;
  }

  if (inserted > 0) {
    logger.info(`[seedProducts] Inserted ${inserted} placeholder product(s); skipped ${skipped} existing`);
  }
}

module.exports = { seedProductsIfEmpty, SEED_PRODUCTS };
