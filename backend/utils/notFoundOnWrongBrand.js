/**
 * 404-on-wrong-brand helpers (Phase 3, C13).
 *
 * Pattern from leadController.getById (D-3): when a single-brand user
 * GETs an entity outside their accessible brands, return 404 (not 403)
 * so the existence of the record isn't leaked.
 *
 * Two helpers:
 *   - isAccessibleByBrandCode(req, brandCode) — for transactional models
 *     with a single brandCode field (Quotation, Deal, SO, PO, Invoice,
 *     ProformaInvoice, Activity, OutreachEmail, TriageItem, Document).
 *   - isAccessibleByBrandRelationships(req, brandRelationships) — for
 *     Customer, which stores a JSON array of brand codes.
 *
 * Both return true for super_admin in cross-brand mode and for any case
 * where req.brandScope isn't populated (defensive — middleware should
 * always populate it on these routes, but don't lock down accidentally
 * if it's missing).
 *
 * Writes (update/delete) stay 403 via the existing assertBrandWritable
 * in brandScope.js — the user already saw the entity in their list
 * response if it was accessible, so there's nothing to hide on a write
 * boundary.
 */

function isAccessibleByBrandCode(req, brandCode) {
  const scope = req.brandScope;
  if (!scope) return true; // defensive
  if (scope.isCrossBrand) return true;
  const accessible = scope.accessibleBrands || [];
  return accessible.includes(brandCode);
}

function isAccessibleByBrandRelationships(req, brandRelationships) {
  const scope = req.brandScope;
  if (!scope) return true;
  if (scope.isCrossBrand) return true;
  const accessible = new Set(scope.accessibleBrands || ['SH']);
  const rels = Array.isArray(brandRelationships) ? brandRelationships : ['SH'];
  return rels.some(r => accessible.has(r));
}

module.exports = {
  isAccessibleByBrandCode,
  isAccessibleByBrandRelationships,
};
