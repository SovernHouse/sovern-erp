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
    signatureHtml: `<div style="margin-top:36px;font-family:Arial,sans-serif;color:#0E0D0C;line-height:1.5;"><div style="height:2px;background-color:#1F2933;margin-bottom:24px;"></div><div style="font-size:15px;font-weight:700;color:#0E0D0C;margin-bottom:3px;">Alexander McConnell</div><div style="font-size:12px;color:#5A5855;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;">Founder</div><div style="font-size:13px;margin-bottom:24px;"><span style="font-weight:600;color:#1F2933;">FlorWay</span><span style="color:#C8C4BC;margin:0 8px;">&middot;</span><a href="mailto:alexflorway@gmail.com" style="color:#1F2933;text-decoration:none;">alexflorway@gmail.com</a></div><div style="font-size:10px;color:#B0ABA4;border-top:1px solid #EBEBEB;padding-top:10px;">FlorWay is a trading division of FLORWAY SDN. BHD., 5 3/4 Miles Matang Jambu, 34750 Matang, Taiping, Perak, Malaysia.</div></div>`,
    signatureText: '--\nAlexander McConnell\nFounder | FlorWay\nalexflorway@gmail.com\n\nFlorWay is a trading division of FLORWAY SDN. BHD., 5 3/4 Miles Matang Jambu, 34750 Matang, Taiping, Perak, Malaysia.',
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
