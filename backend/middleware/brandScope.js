/**
 * brandScope — Phase 1 multi-brand access control (Commit 3, D-2 / D-3).
 *
 * Runs after `requireAuth`. Loads the user's `accessibleBrands` +
 * `defaultBrand` from the DB so values are always current (no stale JWT),
 * then attaches:
 *
 *   req.brandScope = {
 *     accessibleBrands: ['SH', 'FW'],   // what this user can see
 *     defaultBrand:     'SH',           // pre-fill for new entities
 *     viewMode:         'single' | 'cross-brand',
 *     isCrossBrand:     boolean,        // only true when super_admin
 *                                         requested ?viewMode=cross-brand
 *     where:            { brandCode: { [Op.in]: [...] } } | {},
 *   }
 *
 * Controllers consume `req.brandScope.where` in list/get queries to enforce
 * the isolation between SH and FW. Cross-brand reads (super_admin opening
 * the "All Brands" view) get an empty WHERE — visibility to everything —
 * and write an AuditLog row per request.
 *
 * Helpers exported alongside:
 *   - assertSingleBrandMode(req, res) — D-3, refuses mutations when the
 *     request is in cross-brand mode (returns false + sends 403; controllers
 *     should `if (!assertSingleBrandMode(req,res)) return;` and bail).
 *   - assertBrandWritable(req, res, brandCode) — refuses if brandCode is
 *     not in the user's accessibleBrands. Use before insert/patch.
 */

const { Op } = require('sequelize');
const logger = require('../utils/logger');

const SUPER_ADMIN = 'super_admin';

let _db = null;
function db() {
  if (!_db) _db = require('../models');
  return _db;
}

async function brandScope(req, res, next) {
  // No auth context → nothing to scope. Route's own requireAuth handles 401.
  if (!req.user || !req.user.id) return next();

  try {
    const user = await db().User.findByPk(req.user.id, {
      attributes: ['id', 'role', 'accessibleBrands', 'defaultBrand'],
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Phase 4.20.1 — L-047: Sequelize on SQLite returns DataTypes.JSON
    // columns as raw strings on some query paths. Array.isArray(string)
    // is false, so prior to this patch every multi-brand user (incl.
    // alex@sovernhouse.co) was silently scoped to the ['SH'] fallback,
    // hiding all FW data on every brand-scoped page. Parse-on-read so
    // both forms work.
    let rawBrands = user.accessibleBrands;
    if (typeof rawBrands === 'string') {
      try { rawBrands = JSON.parse(rawBrands); } catch (_) { rawBrands = null; }
    }
    const accessibleBrands =
      Array.isArray(rawBrands) && rawBrands.length
        ? rawBrands
        : ['SH'];
    const defaultBrand = user.defaultBrand || accessibleBrands[0] || 'SH';

    // Cross-brand: explicit opt-in via ?viewMode=cross-brand AND user must be
    // super_admin. Anything else falls back to single-brand isolation.
    const requestedCrossBrand = req.query.viewMode === 'cross-brand';
    const isCrossBrand = requestedCrossBrand && user.role === SUPER_ADMIN;
    const viewMode = isCrossBrand ? 'cross-brand' : 'single';

    req.brandScope = {
      accessibleBrands,
      defaultBrand,
      viewMode,
      isCrossBrand,
      where: isCrossBrand ? {} : { brandCode: { [Op.in]: accessibleBrands } },
    };

    // Audit every cross-brand request (D-3). One row per request, written
    // async so it doesn't block the response. Failures are logged but not
    // surfaced.
    if (isCrossBrand) {
      db().AuditLog.create({
        userId: user.id,
        action: 'cross_brand_view',
        entity: 'request',
        entityId: null,
        changes: {
          url: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.ip,
      }).catch((e) =>
        logger.warn('[brandScope] cross-brand audit write failed:', e.message),
      );
    }

    next();
  } catch (err) {
    logger.error('[brandScope] failed:', err.message);
    return res.status(500).json({ error: 'Failed to load brand scope' });
  }
}

/**
 * Refuse mutations in cross-brand mode. Call at the top of every POST/PATCH
 * /DELETE controller for a brand-tagged entity. Returns true if OK, false
 * if a 403 was sent (controller should return immediately).
 */
function assertSingleBrandMode(req, res) {
  if (req.brandScope && req.brandScope.isCrossBrand) {
    res.status(403).json({
      error:
        'All Brands view is read-only. Switch to SH or FW to make changes.',
    });
    return false;
  }
  return true;
}

/**
 * Refuse if brandCode is not in the user's accessibleBrands. Use before
 * INSERTing a new entity or PATCHing an existing entity's brandCode.
 * Returns true if OK, false if a 4xx was sent.
 */
function assertBrandWritable(req, res, brandCode) {
  if (!req.brandScope) {
    res.status(500).json({ error: 'Brand scope not initialised' });
    return false;
  }
  if (!brandCode) {
    res.status(400).json({ error: 'brand is required' });
    return false;
  }
  if (!req.brandScope.accessibleBrands.includes(brandCode)) {
    res.status(403).json({
      error: `Your account does not have access to brand '${brandCode}'.`,
    });
    return false;
  }
  return true;
}

module.exports = {
  brandScope,
  assertSingleBrandMode,
  assertBrandWritable,
};
