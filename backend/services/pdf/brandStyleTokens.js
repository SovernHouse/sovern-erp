/**
 * Brand style tokens for PDF rendering (Phase 3, C9 + C10).
 *
 * Two-tier resolution: brand.primaryColor / brand.displayName from the Brand
 * record always win (so the Brand admin UI can re-theme without code edits).
 * These constants are the *fallback* and the *additional* tokens that aren't
 * yet on the Brand model (e.g. footer text variants, sender block, asset
 * paths). When a token here is also on Brand, prefer the Brand value at call
 * sites and fall through to the constant only on null.
 *
 * Asset paths point at frontend/admin-portal/public/brand-assets/florway/.
 * That folder is part of the deployed frontend build and is also reachable
 * from backend code via a relative path because the GCP deploy preserves
 * repo structure. Verified working dir at runtime is the repo root.
 *
 * Fonts (Anton, Inter) are loaded conditionally via registerBrandFonts(doc).
 * If the TTFs are absent from backend/assets/fonts/, the renderer falls back
 * to pdfkit's built-in Helvetica family. The function returns the names to
 * use in doc.font() calls.
 *
 * No em dashes anywhere in user-visible strings (L-015).
 */

const fs = require('fs');
const path = require('path');

const ASSET_ROOT = path.resolve(
  __dirname,
  '..', '..', '..',
  'frontend', 'admin-portal', 'public', 'brand-assets'
);

const FONT_ROOT = path.resolve(__dirname, '..', '..', 'assets', 'fonts');

// ─── FLORWAY (FW) ──────────────────────────────────────────────────────────
const FW = {
  code: 'FW',
  displayName: 'FlorWay',
  primaryColor: '#1F2933',  // iron-deep
  accentColor:  '#F1EEE7',  // cream
  ink:          '#0E0D0C',  // body text
  steel:        '#94A3B8',  // muted dividers + footer text
  bronze:       '#92400E',  // premium accent (use sparingly)
  senderEmail:  'alexflorway@gmail.com',
  senderName:   'Alexander McConnell',
  // Title is a placeholder pending Mr. Lee approval. Surface in PDF as-is;
  // when confirmed, swap this single constant.
  senderTitle:  'Country Manager, USA',
  // U+00B7 middot, no em dash. Renders fine in Helvetica + Inter.
  footerLegal:  'FLORWAY SDN. BHD. · 5 3/4 Miles Matang Jambu, 34750 Matang, Taiping, Perak, Malaysia',
  // Asset filenames under ASSET_ROOT/florway/. Existence is checked at render
  // time; missing assets fall through to text-only header.
  assets: {
    coreTechLight: path.join(ASSET_ROOT, 'florway', 'ironlite-ibeam-core-tech-light-800w.png'),
    coreTechDark:  path.join(ASSET_ROOT, 'florway', 'ironlite-ibeam-core-tech-dark-800w.png'),
    oemBadgeLight: path.join(ASSET_ROOT, 'florway', 'ironlite-ibeam-oem-badge-light-400w.png'),
    oemBadgeDark:  path.join(ASSET_ROOT, 'florway', 'ironlite-ibeam-oem-badge-dark-400w.png'),
    diagram1600:   path.join(ASSET_ROOT, 'florway', 'ironlite-core-construction-diagram-1600w.png'),
    diagram2400:   path.join(ASSET_ROOT, 'florway', 'ironlite-core-construction-diagram-2400w.png'),
  },
};

// ─── SOVERN HOUSE (SH) ─────────────────────────────────────────────────────
// Fleshed out in C10. Premium, conservative trading-house tone. Forest +
// cream from sovernhouse.co, with a clay/bronze accent reserved for the
// totals rule (analogous to FW's bronze). Less aggressive characterSpacing
// than FW so the SH document reads as a buying-house document rather than
// a manufacturing document.
const SH = {
  code: 'SH',
  displayName: 'Sovern House',
  primaryColor: '#1D5A32',  // forest
  accentColor:  '#F1EEE7',  // cream
  ink:          '#0E0D0C',  // body text
  steel:        '#8A8680',  // muted muted-warm (cream-grey) for dividers + footer
  clay:         '#92400E',  // bronze/clay accent for totals rule
  senderEmail:  'alex@sovernhouse.co',
  senderName:   'Alexander McConnell',
  senderTitle:  'Founder',
  footerLegal:  'New Route International Exchange Co., Ltd. · Taiwan',
  assets: {
    logoLight: path.join(ASSET_ROOT, 'sovern-house', 'sovern-house-logo-light.png'),
    logoDark:  path.join(ASSET_ROOT, 'sovern-house', 'sovern-house-logo-dark.png'),
    ruleLight: path.join(ASSET_ROOT, 'sovern-house', 'sovern-house-rule-light.png'),
  },
};

const BY_CODE = { FW, SH };

/**
 * Resolve effective tokens for a brand. Brand record values (primaryColor,
 * displayName, footerLegalText, signatureHtml) override the constants here.
 * Returns a plain object with the final values to use in the renderer.
 */
function resolveTokens(brand) {
  const base = (brand && BY_CODE[brand.code]) || SH;
  return {
    ...base,
    displayName:  brand?.displayName || base.displayName,
    primaryColor: brand?.primaryColor || base.primaryColor,
    accentColor:  brand?.accentColor || base.accentColor,
    footerLegal:  brand?.footerLegalText || base.footerLegal,
  };
}

/**
 * Conditionally register Anton + Inter TTFs onto a pdfkit document. Returns
 * the font name triples to use throughout the renderer.
 *
 * If the TTFs are not present (e.g. Alex hasn't dropped them into
 * backend/assets/fonts/ yet) we fall through to pdfkit's built-in
 * Helvetica-Bold and Helvetica. The renderer code doesn't care — it just
 * uses whatever names this function hands back.
 */
function registerBrandFonts(doc) {
  const antonPath = path.join(FONT_ROOT, 'Anton-Regular.ttf');
  const interRegularPath = path.join(FONT_ROOT, 'Inter-Regular.ttf');
  const interBoldPath = path.join(FONT_ROOT, 'Inter-Bold.ttf');

  const fonts = {
    display: 'Helvetica-Bold',
    body: 'Helvetica',
    bodyBold: 'Helvetica-Bold',
  };

  if (fs.existsSync(antonPath)) {
    doc.registerFont('Anton', antonPath);
    fonts.display = 'Anton';
  }
  if (fs.existsSync(interRegularPath)) {
    doc.registerFont('Inter', interRegularPath);
    fonts.body = 'Inter';
  }
  if (fs.existsSync(interBoldPath)) {
    doc.registerFont('Inter-Bold', interBoldPath);
    fonts.bodyBold = 'Inter-Bold';
  }

  return fonts;
}

/**
 * Pick the FW variant from a customer record. Returns one of:
 *   'ironlite' | 'generic' | 'private_label'
 * null/unknown defaults to 'generic'.
 */
function resolveFlorWayVariant(customer) {
  const mode = customer?.productBrandingMode;
  if (mode === 'ironlite' || mode === 'private_label') return mode;
  return 'generic';
}

/**
 * Heuristic for "is this quotation a WPC product?" — used by the IronLite
 * variant to decide whether to render the construction diagram addendum
 * page. Looks at product.category on each line item; if any item's category
 * contains 'WPC' (case insensitive), the addendum is added.
 */
function isWpcQuotation(items = []) {
  return items.some(it => {
    const cat = it.product?.category?.name || it.product?.category || '';
    return String(cat).toLowerCase().includes('wpc');
  });
}

module.exports = {
  FW,
  SH,
  BY_CODE,
  ASSET_ROOT,
  FONT_ROOT,
  resolveTokens,
  registerBrandFonts,
  resolveFlorWayVariant,
  isWpcQuotation,
};
