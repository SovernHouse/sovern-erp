/**
 * brandSafetyGateway — single chokepoint for rule #9 enforcement.
 *
 * Two incidents in 36 hours proved that scattered brand checks weren't
 * enough:
 *   2026-05-17 (L-068): PriceList PDF rendered with SH branding for an
 *     FW IronLite price list. Sequelize include omitted brandCode.
 *   2026-05-18 BPI: 17 FW outreach emails went out with SH From display
 *     name + SH signature. MCP send_outreach_email omitted
 *     fromDisplayName + loaded a brand-agnostic EmailSignature default.
 *
 * Both surfaces now have local gateways. This module centralises the
 * primitives so the next render path (Quotation PDF, Invoice PDF, etc.)
 * imports a single tested function instead of reimplementing the
 * marker regex from memory.
 *
 * Reference: Instructions & Skills/brand-safety.md.
 */

// Identity markers — kept in sync with brand-safety.md "Identity Markers"
// section. Add a marker the first time a brand artifact gets coined
// (URL, image filename, legal name, tagline, sender email) — don't
// wait for a leak to discover what should have been there.
const SH_MARKERS = /(\bSovern\s*House\b|sovernhouse\.co|Your\s+buying\s+office\s+in\s+Asia|New\s+Route\s+International\s+Exchange|alex@sovernhouse\.co|alex-signature@2x\.png|sovern-wordmark-email-light\.png)/i;
const FW_MARKERS = /(\bFlorWay\b|FlorWay\s+Sdn\.\s*Bhd\.|Country\s+Manager,\s*U\.S\.A\/Canada)/i;
const HH_MARKERS = /(\bHanHua\b|Anhui\s+HanHua\s+Building)/i;

// "alexflorway@gmail.com" is shared between FW and HH so it is NOT in
// either marker set; instead it appears with the brand-specific legal
// name when used. If we ever split FW/HH to different senders, add
// the new sender to the brand-specific marker set.

class BrandLeakError extends Error {
  constructor(message, { entityId, brandCode, leakField, foreignBrand } = {}) {
    super(message);
    this.name = 'BrandLeakError';
    this.entityId = entityId;
    this.brandCode = brandCode;
    this.leakField = leakField;
    this.foreignBrand = foreignBrand;
  }
}

/**
 * Assert that a content string does not contain identity markers for
 * a brand other than `brandCode`. Throws BrandLeakError on leak.
 *
 * @param {string} content - the rendered HTML, body text, signature, etc.
 * @param {string} brandCode - 'SH' | 'FW' | 'HH'
 * @param {string} fieldName - human-readable label for the error msg
 * @param {string|null} entityId - the artifact's id, for the audit row
 */
// 2026-05-18: directionally-asymmetric rule. FW and HH are sister
// factories under the Resilient family — their seeded signatures
// intentionally co-mention each other ("FlorWay Sdn. Bhd. (Malaysia)"
// + "Anhui HanHua Building Materials Technology (China)"). The
// asymmetry that matters for rule #9:
//
//   SH content MUST NOT contain FW or HH markers (operator separation)
//   FW content MUST NOT contain SH markers (no buying-house framing)
//   HH content MUST NOT contain SH markers (no buying-house framing)
//   FW <-> HH co-mention is ALLOWED (Resilient family disclosure)
//
// This is rule #9 properly: SH is separate; FW + HH are a family.
const FORBIDDEN_FOREIGN_MARKERS = {
  SH: [
    { regex: FW_MARKERS, name: 'FlorWay', code: 'FW' },
    { regex: HH_MARKERS, name: 'HanHua', code: 'HH' },
  ],
  FW: [
    { regex: SH_MARKERS, name: 'Sovern House', code: 'SH' },
  ],
  HH: [
    { regex: SH_MARKERS, name: 'Sovern House', code: 'SH' },
  ],
};

function assertNoForeignMarkers(content, brandCode, fieldName, entityId = null) {
  if (!content) return;
  if (typeof content !== 'string') return;

  const forbidden = FORBIDDEN_FOREIGN_MARKERS[brandCode] || [];
  for (const { regex, name, code } of forbidden) {
    if (regex.test(content)) {
      throw new BrandLeakError(
        `Brand-leak refused: ${fieldName} for brand "${brandCode}" contains ${name} identity markers (rule #9 / L-068).`,
        { brandCode, leakField: fieldName, foreignBrand: code, entityId }
      );
    }
  }
}

/**
 * Assert that an entity is safe to render for the given brand. Use at
 * the top of every brand-bearing render or send function.
 *
 * @param {object} args
 * @param {string} args.brandCode - 'SH' | 'FW' | 'HH'
 * @param {string|null} args.expectedFromDisplayName - e.g. "FlorWay | Alex"
 * @param {string|null} args.actualFromDisplayName - what the caller is about to send
 * @param {object} [args.contentFields] - { fieldName: stringContent, ... }
 * @param {string|null} [args.entityId]
 */
function assertBrandSafe({
  brandCode,
  expectedFromDisplayName = null,
  actualFromDisplayName = null,
  contentFields = {},
  entityId = null,
}) {
  if (!brandCode) {
    throw new BrandLeakError(
      `Brand-leak refused: brandCode is required and was not provided. Resolve the brand at the entity level and pass it through.`,
      { leakField: 'brandCode', entityId }
    );
  }
  if (!['SH', 'FW', 'HH'].includes(brandCode)) {
    throw new BrandLeakError(
      `Brand-leak refused: unknown brandCode "${brandCode}". Expected one of SH, FW, HH.`,
      { brandCode, leakField: 'brandCode', entityId }
    );
  }

  // From display name must agree
  if (actualFromDisplayName && expectedFromDisplayName && actualFromDisplayName !== expectedFromDisplayName) {
    throw new BrandLeakError(
      `Brand-leak refused: fromDisplayName="${actualFromDisplayName}" does not match brand "${brandCode}" (expected "${expectedFromDisplayName}"). Rule #9.`,
      { brandCode, leakField: 'fromDisplayName', entityId }
    );
  }

  // Each content field must be free of foreign markers
  for (const [fieldName, content] of Object.entries(contentFields)) {
    assertNoForeignMarkers(content, brandCode, fieldName, entityId);
  }
}

/**
 * Resolve a Brand row + verify it's active + return canonical display
 * tokens. Use at the top of a renderer to get the brand context once,
 * then pass into assertBrandSafe and downstream rendering.
 *
 * @param {object} db - the models module
 * @param {string} brandCode
 * @returns {Promise<{ brand, displayName, fromDisplayName, senderEmail, signatureHtml, signatureText }>}
 */
async function resolveBrandOrThrow(db, brandCode) {
  if (!brandCode) {
    throw new BrandLeakError(
      `Brand-leak refused: brandCode is required. Set it at entity creation.`,
      { leakField: 'brandCode' }
    );
  }
  const brand = await db.Brand.findOne({ where: { code: brandCode, active: true } });
  if (!brand) {
    throw new BrandLeakError(
      `Brand-leak refused: Brand "${brandCode}" not found or inactive.`,
      { brandCode, leakField: 'brand' }
    );
  }
  return {
    brand,
    displayName: brand.displayName,
    fromDisplayName: `${brand.displayName} | Alex`,
    senderEmail: brand.senderEmail,
    signatureHtml: brand.signatureHtml || null,
    signatureText: brand.signatureText || null,
  };
}

/**
 * Check whether a product slug or category set indicates Resilient
 * flooring (rule #9 lock: Resilient is never SH).
 */
const RESILIENT_PRODUCT_SLUGS = new Set([
  'lvt', 'spc', 'wpc', 'engineered-spc', 'engineered_spc',
  'vinyl-sheet', 'vinyl_sheet', 'rigid-core-vinyl', 'rigid_core_vinyl',
  'rigid-core', 'rigid_core',
]);

function isResilient(slugOrTokenList) {
  if (!slugOrTokenList) return false;
  if (typeof slugOrTokenList === 'string') {
    return RESILIENT_PRODUCT_SLUGS.has(slugOrTokenList.toLowerCase());
  }
  if (Array.isArray(slugOrTokenList)) {
    return slugOrTokenList.some(s => typeof s === 'string' && RESILIENT_PRODUCT_SLUGS.has(s.toLowerCase()));
  }
  return false;
}

/**
 * Rule #9 special case: throw if attempting to render a Resilient
 * artifact under SH branding. Call this in addition to assertBrandSafe
 * when the artifact's items include any Resilient product.
 */
function assertResilientNotSH({ brandCode, productSlugs = [], entityId = null }) {
  if (brandCode !== 'SH') return;
  if (isResilient(productSlugs)) {
    throw new BrandLeakError(
      `Brand-leak refused: Resilient flooring (LVT/SPC/WPC/...) cannot be SH-branded. Use FW or HH (rule #9).`,
      { brandCode: 'SH', leakField: 'product_resilient_under_sh', entityId }
    );
  }
}

module.exports = {
  assertBrandSafe,
  assertNoForeignMarkers,
  resolveBrandOrThrow,
  assertResilientNotSH,
  isResilient,
  BrandLeakError,
  // Exported for unit testing
  SH_MARKERS,
  FW_MARKERS,
  HH_MARKERS,
  RESILIENT_PRODUCT_SLUGS,
};
