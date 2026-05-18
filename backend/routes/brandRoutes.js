/**
 * Brand routes — Phase 1 Commit 3.
 *
 *   GET   /api/brands                 — list brands (any authed user, used
 *                                       by frontend BrandsContext to render
 *                                       BrandBadges and theme tokens)
 *   GET   /api/brands/me              — return req.brandScope: the
 *                                       caller's accessibleBrands +
 *                                       defaultBrand + isCrossBrand flag
 *   PATCH /api/admin/brand-override   — super_admin only. Change an
 *                                       entity's brandCode. Writes an
 *                                       AuditLog row capturing old/new +
 *                                       reason. Reason is required (D-5).
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const logger = require('../utils/logger');

const db = require('../models');

// Whitelist of entity types that can be brand-overridden. Matches the set
// of brand-tagged models from Commit 2 (no Customer — brandRelationships
// for customers is array-managed, not single-FK).
const OVERRIDABLE_ENTITY_TYPES = [
  'Lead', 'Deal', 'Quotation', 'Inquiry', 'SalesOrder', 'PurchaseOrder',
  'Invoice', 'ProformaInvoice',
  'Activity', 'OutreachEmail', 'TriageItem', 'ScheduledActivity',
  'Document', 'DocumentApproval',
  // Phase 4.20 (Bug 4a): Product brand on existing rows is moved through
  // the audited override flow rather than a silent update_product patch.
  // Wired to the "Change brand" button on the desktop Product edit form.
  'Product',
];

// GET /api/brands/me — return the caller's brand scope. Used by the
// frontend on app boot to know what to show in the brand picker and which
// surface to render (single vs cross-brand views).
//
// CRITICAL: this MUST be declared before `/brands/:code` below. Express
// matches routes in declaration order; if `/brands/:code` comes first,
// `/brands/me` matches with code='me', then the handler looks up a
// Brand row with code='me', finds none, and returns 404. That
// silently broke BrandsContext on app boot — accessibleBrands stayed
// at ['SH'] default, and the BrandPicker on FW leads couldn't show
// FW as an option. Confirmed 2026-05-18 via pm2 logs:
//   GET /brands/me -> 404
router.get('/brands/me', requireAuth, brandScope, (req, res) => {
  if (!req.brandScope) {
    return res.status(500).json({ error: 'Brand scope not initialised' });
  }
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      accessibleBrands: req.brandScope.accessibleBrands,
      defaultBrand: req.brandScope.defaultBrand,
      viewMode: req.brandScope.viewMode,
      isCrossBrand: req.brandScope.isCrossBrand,
    },
  });
});

// GET /api/brands/:code — single brand (used by brand admin editor).
router.get('/brands/:code', requireAuth, async (req, res) => {
  try {
    const brand = await db.Brand.findOne({ where: { code: req.params.code } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json({ success: true, data: brand });
  } catch (err) {
    logger.error('[brandRoutes] get single failed:', err.message);
    res.status(500).json({ error: 'Failed to load brand' });
  }
});

// PUT /api/brands/:code — super_admin only. Update editable brand fields.
// code and active are not updatable here to prevent accidental breaks.
router.put('/brands/:code',
  requireAuth,
  requireRole('super_admin'),
  async (req, res) => {
    try {
      const brand = await db.Brand.findOne({ where: { code: req.params.code } });
      if (!brand) return res.status(404).json({ error: 'Brand not found' });

      // Phase 4.9.1: add active + commissionRate so the admin UI can
      // deactivate erroneous brands and edit commission per agreement.
      // Validation below: active must be boolean, commissionRate must
      // be a decimal in [0, 1].
      const ALLOWED = ['displayName', 'senderEmail', 'primaryColor', 'accentColor', 'logoUrl', 'signatureHtml', 'signatureText', 'footerLegalText', 'active', 'commissionRate'];
      const updates = {};
      for (const field of ALLOWED) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
      }

      // Phase 4.9.1 validation.
      if (updates.active !== undefined && typeof updates.active !== 'boolean') {
        return res.status(400).json({ error: 'active must be a boolean (true or false)' });
      }
      if (updates.commissionRate !== undefined) {
        const v = parseFloat(updates.commissionRate);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
          return res.status(400).json({ error: 'commissionRate must be a decimal between 0 and 1 (e.g. 0.07 = 7%)' });
        }
        updates.commissionRate = v;
      }

      await brand.update(updates);
      res.json({ success: true, data: brand });
    } catch (err) {
      logger.error('[brandRoutes] update failed:', err.message);
      res.status(500).json({ error: 'Failed to update brand' });
    }
  },
);

// GET /api/brands — list all active brands. No brand-scope filter (the
// brands list itself is org-wide config, not a transactional entity).
//
// 2026-05-18 bugfix: send Cache-Control: no-store. The previous response
// had no cache headers, so Express set an ETag and the browser issued
// conditional requests. The server happily returned 304 Not Modified —
// but axios's default validateStatus rejects 304 as an error, so
// BrandsContext silently failed and left `brands: []`. Symptom: the
// BrandPicker disabled itself (single-brand fallback) and BrandBadge
// showed "UNKNOWN BRAND" on every existing FW lead. no-store stops the
// browser issuing conditional requests so every call gets a fresh 200.
router.get('/brands', requireAuth, async (req, res) => {
  try {
    const brands = await db.Brand.findAll({
      where: { active: true },
      order: [['code', 'ASC']],
    });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: brands });
  } catch (err) {
    logger.error('[brandRoutes] list failed:', err.message);
    res.status(500).json({ error: 'Failed to list brands' });
  }
});

// (Note: GET /brands/me was moved above /brands/:code earlier in this
// file. The Express route table walks declarations in order and a
// `/brands/:code` decl ahead of /brands/me silently captured the
// /me request — root cause of the 2026-05-18 UNKNOWN BRAND incident.)

// PATCH /api/admin/brand-override — super_admin only (L-031 bare-string +
// L-036 super_admin-only). Forces an entity's brandCode to a new value
// and writes an AuditLog row. Reason is required (D-5).
router.patch('/admin/brand-override',
  requireAuth,
  requireRole('super_admin'),
  async (req, res) => {
    try {
      const { entityType, entityId, newBrandCode, reason } = req.body || {};

      if (!entityType || !OVERRIDABLE_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({
          error: `entityType must be one of: ${OVERRIDABLE_ENTITY_TYPES.join(', ')}`,
        });
      }
      if (!entityId) {
        return res.status(400).json({ error: 'entityId is required' });
      }
      if (!newBrandCode || typeof newBrandCode !== 'string') {
        return res.status(400).json({ error: 'newBrandCode is required' });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        return res.status(400).json({
          error: 'reason is required (minimum 3 characters). Brand overrides are audited.',
        });
      }

      // Confirm target brand exists + is active
      const brand = await db.Brand.findOne({ where: { code: newBrandCode } });
      if (!brand) {
        return res.status(400).json({ error: `Unknown brand: ${newBrandCode}` });
      }
      if (!brand.active) {
        return res.status(400).json({ error: `Brand ${newBrandCode} is inactive` });
      }

      const Model = db[entityType];
      if (!Model) {
        return res.status(500).json({ error: `Model ${entityType} not loaded` });
      }

      const entity = await Model.findByPk(entityId);
      if (!entity) {
        return res.status(404).json({ error: `${entityType} not found` });
      }

      const oldBrandCode = entity.brandCode;
      if (oldBrandCode === newBrandCode) {
        return res.status(400).json({
          error: `${entityType} ${entityId} is already on brand ${newBrandCode}`,
        });
      }

      await entity.update({ brandCode: newBrandCode });

      // Audit log — non-blocking but awaited so the response carries the audit id
      const audit = await db.AuditLog.create({
        userId: req.user.id,
        action: 'brand_override',
        entity: entityType,
        entityId: entityId,
        changes: {
          field: 'brandCode',
          oldValue: oldBrandCode,
          newValue: newBrandCode,
          reason: reason.trim(),
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          entityType,
          entityId,
          oldBrandCode,
          newBrandCode,
          reason: reason.trim(),
          auditLogId: audit.id,
        },
      });
    } catch (err) {
      logger.error('[brandRoutes] brand-override failed:', err.message);
      res.status(500).json({ error: 'Brand override failed' });
    }
  },
);

module.exports = router;
