/**
 * Cross-brand auto-add (Phase 3, C13).
 *
 * When a new Lead / Quotation / Deal is created against an existing
 * customer under a brand that is not yet in customer.brandRelationships,
 * automatically extend the relationships array and audit the change.
 *
 * Returns the new brand code if it was added (or null if the customer
 * already had that brand). Controllers surface that flag in the response
 * so the frontend can show a toast: "Customer X is now also a [BRAND]
 * relationship."
 *
 * Dedup-safe: uses Array.from(new Set([...existing, brandCode])) so
 * duplicates can't be introduced even under a race.
 *
 * Fire-and-forget at the call site is fine — failures here should never
 * block the create. Each controller wraps the call in try/catch.
 */

const logger = require('../utils/logger');

async function addBrandIfMissing(db, customerId, brandCode, triggeredBy = {}) {
  if (!db || !customerId || !brandCode) return null;

  try {
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) return null;

    const existing = Array.isArray(customer.brandRelationships)
      ? customer.brandRelationships
      : ['SH'];
    if (existing.includes(brandCode)) return null;

    const next = Array.from(new Set([...existing, brandCode]));
    await customer.update({ brandRelationships: next });

    // Audit. Pattern matches the brand-override and lock-related entries.
    if (db.AuditLog) {
      await db.AuditLog.create({
        userId: triggeredBy.userId || null,
        action: 'cross_brand_relationship_added',
        entity: 'Customer',
        entityId: customerId,
        changes: {
          oldBrands: existing,
          newBrands: next,
          addedBrand: brandCode,
          triggeredByEntity: triggeredBy.entity || null,
          triggeredByEntityId: triggeredBy.entityId || null,
        },
        ipAddress: triggeredBy.ip || null,
      });
    }

    return brandCode;
  } catch (err) {
    logger.error('[crossBrandAutoAdd] Failed for customer', customerId, err.message);
    return null;
  }
}

module.exports = { addBrandIfMissing };
