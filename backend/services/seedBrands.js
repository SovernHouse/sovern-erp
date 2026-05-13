/**
 * Brand seed — Phase 1 (Multi-Brand Data Model).
 *
 * Inserts the SH (Sovern House) and FW (FlorWay) rows idempotently. Called
 * once per boot after the Brand table is synced. Safe to re-run: if a row
 * with a given code already exists, that row's content is preserved
 * unchanged. Adding a new brand later is done by editing this file (or by
 * inserting via the Brand admin UI in a future phase).
 *
 * Per D-8: BrandBadge + brand-aware theming reads colors from this table at
 * runtime, so changing palette values here is the supported way to retheme
 * a brand without code edits.
 */

const logger = require('../utils/logger');

const SEEDS = [
  {
    code: 'SH',
    displayName: 'Sovern House',
    senderEmail: 'alex@sovernhouse.co',
    primaryColor: '#1D5A32', // forest
    accentColor:  '#F1EEE7', // cream
    footerLegalText:
      'Sovern House is a brand of New Route International Exchange Co., Ltd., Taiwan.',
    signatureHtml: null,           // populated by EmailSignature flow (existing)
    logoUrl: null,                 // populated when brand asset CDN is wired
    quotationTemplateId: null,     // Phase 3
    documentTemplateIds: null,     // Phase 3
    acceptedProductCategories: null, // null = no constraint (Phase 3 enforces)
    active: true,
  },
  {
    code: 'FW',
    displayName: 'FlorWay',
    senderEmail: 'alexflorway@gmail.com',
    primaryColor: '#1F2933', // iron-deep (Q1)
    accentColor:  '#F1EEE7', // cream (Q1)
    footerLegalText:
      'FlorWay is a trading division of FLORWAY SDN. BHD., 5 3/4 Miles Matang Jambu, 34750 Matang, Taiping, Perak, Malaysia.',
    signatureHtml: null,
    logoUrl: null,
    quotationTemplateId: null,
    documentTemplateIds: null,
    // FW only sources for LVT / SPC / WPC / IronLite (Q7).
    acceptedProductCategories: ['LVT', 'SPC', 'WPC', 'IronLite'],
    active: true,
  },
];

/**
 * Idempotent: inserts any seed row whose code is not already present.
 * Does NOT overwrite existing rows; admins may have edited colors / signature
 * via a future Brand admin UI and we don't want to clobber that.
 */
async function seedBrandsIfEmpty(db) {
  if (!db || !db.Brand) {
    logger.warn('[seedBrands] db.Brand not registered; skipping seed');
    return;
  }
  let inserted = 0;
  for (const row of SEEDS) {
    const existing = await db.Brand.findOne({ where: { code: row.code } });
    if (existing) continue;
    await db.Brand.create(row);
    inserted++;
  }
  if (inserted > 0) {
    logger.info(`[seedBrands] Inserted ${inserted} brand row(s)`);
  }
}

module.exports = { seedBrandsIfEmpty, SEEDS };
