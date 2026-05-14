/**
 * Compliance & Regulatory Routes
 * Endpoints for compliance checks, HS codes, certificates of origin, and duties
 */

const express = require('express');
const router = express.Router();
const complianceController = require('../../controllers/complianceController');
const { requireAuth, requireRole, requireAny } = require('../../middleware/auth');

/**
 * Compliance Checks
 */

/**
 * POST /api/compliance/check
 * Check compliance requirements for a shipment/product
 */
router.post('/check', requireAuth, requireAny('compliance'), complianceController.checkCompliance);

/**
 * POST /api/compliance/anti-dumping/check
 * Specifically check anti-dumping applicability
 */
router.post('/anti-dumping/check', requireAuth, requireAny('compliance'), complianceController.checkAntiDumping);

/**
 * Compliance Records Management
 */

/**
 * POST /api/compliance/records
 * Create a compliance record
 */
router.post('/records', requireAuth, requireAny('compliance'), complianceController.createComplianceRecord);

/**
 * GET /api/compliance/records
 * List compliance records with filters
 */
router.get('/records', requireAuth, requireAny('compliance'), complianceController.listComplianceRecords);

/**
 * GET /api/compliance/records/:id
 * Get a specific compliance record
 */
router.get('/records/:id', requireAuth, requireAny('compliance'), complianceController.getComplianceRecord);

/**
 * PUT /api/compliance/records/:id
 * Update a compliance record
 */
router.put('/records/:id', requireAuth, requireAny('compliance'), complianceController.updateComplianceRecord);

/**
 * HS Code (Harmonized Tariff Code) Management
 */

/**
 * GET /api/compliance/hs-codes
 * Get or search HS codes
 */
router.get('/hs-codes', requireAuth, requireAny('compliance'), complianceController.getHSCodes);

/**
 * POST /api/compliance/hs-codes
 * Create a new HS code entry
 */
router.post('/hs-codes', requireAuth, requireRole('ADMIN'), complianceController.createHSCode);

/**
 * POST /api/compliance/duties/calculate
 * Calculate duties for given HS code, origin, and destination
 */
router.post('/duties/calculate', requireAuth, requireAny('compliance'), complianceController.calculateDuties);

/**
 * Certificate of Origin Management
 */

/**
 * POST /api/compliance/certificates
 * Generate a Certificate of Origin
 */
router.post('/certificates', requireAuth, requireAny('compliance'), complianceController.generateCertificateOfOrigin);

/**
 * GET /api/compliance/certificates
 * List Certificates of Origin
 */
router.get('/certificates', requireAuth, requireAny('compliance'), complianceController.listCertificates);

/**
 * GET /api/compliance/certificates/:id
 * Get a specific Certificate of Origin
 */
router.get('/certificates/:id', requireAuth, requireAny('compliance'), complianceController.getCertificateOfOrigin);

/**
 * Dashboard & Reporting
 */

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard with key metrics
 */
router.get('/dashboard', requireAuth, requireAny('compliance'), complianceController.getComplianceDashboard);

/**
 * Health check endpoint
 */
router.get('/status', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      module: 'Compliance & Regulatory',
      version: '1.0.0'
    }
  });
});

/**
 * ─── Phase 4, C18: Sanctions screening endpoints ──────────────────────────
 *
 * Sources: OFAC SDN + Consolidated, EU Consolidated, UN SC Consolidated.
 * Implementation in backend/services/sanctionsService.js. Daily refresh
 * + 90d rescreen cron lives in schedulerService.js.
 */

const db = require('../../models');
const sanctionsService = require('../../services/sanctionsService');
const auditService = require('../../services/auditService');
const { NotFoundError, ValidationError } = require('../../middleware/errorHandler');

/**
 * POST /api/compliance/screen
 * Stateless screen of a (name, country) pair. Does not persist.
 * Body: { name, country }
 */
router.post('/screen', requireAuth, async (req, res, next) => {
  try {
    const { name, country } = req.body || {};
    if (!name) throw new ValidationError('name is required');
    const result = sanctionsService.screenName(name, country || null);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * POST /api/compliance/screen/:customerId
 * Re-screen a customer and persist the result. Audited.
 */
router.post('/screen/:customerId', requireAuth, async (req, res, next) => {
  try {
    const cust = await db.Customer.findByPk(req.params.customerId);
    if (!cust) throw new NotFoundError('Customer not found');
    const result = sanctionsService.screenName(cust.companyName, cust.country);
    const updates = {
      screeningStatus: cust.screeningStatus === 'override' ? 'override' : result.status,
      sanctionsScreenDetails: result.hits,
      lastScreenedAt: new Date(),
    };
    if (result.status === 'flagged' && cust.screeningStatus !== 'override') {
      updates.sanctionBlockReason = `Matched on ${result.hits.map((h) => h.list).join(', ')}`;
    }
    await cust.update(updates);
    auditService.logAction(
      req.user?.id,
      'sanctions_screen',
      'Customer',
      cust.id,
      { manualBy: req.user?.email || req.user?.id, result },
      req.ip,
    ).catch(() => {});
    res.json({ success: true, data: { customer: cust, result } });
  } catch (err) { next(err); }
});

/**
 * POST /api/compliance/customers/:id/override
 * Super-admin attestation to bypass a sanctions flag.
 * Body: { reason } where reason.length >= 10.
 */
router.post('/customers/:id/override', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const reason = (req.body && req.body.reason ? String(req.body.reason) : '').trim();
    if (reason.length < 10) {
      throw new ValidationError('reason must be at least 10 characters');
    }
    const cust = await db.Customer.findByPk(req.params.id);
    if (!cust) throw new NotFoundError('Customer not found');
    const priorStatus = cust.screeningStatus;
    const priorHits = cust.sanctionsScreenDetails;
    await cust.update({
      screeningStatus: 'override',
      sanctionOverrideReason: reason,
      sanctionOverrideAt: new Date(),
      sanctionOverrideBy: req.user.id,
      isActive: true, // un-block downstream actions
    });
    auditService.logAction(
      req.user.id,
      'sanctions_override',
      'Customer',
      cust.id,
      {
        priorStatus,
        priorHits,
        reason,
        overriddenBy: req.user.email || req.user.id,
        overriddenAt: new Date().toISOString(),
      },
      req.ip,
    ).catch(() => {});
    res.json({ success: true, data: cust });
  } catch (err) { next(err); }
});

/**
 * GET /api/compliance/sanctions/status
 * Returns last refresh timestamp, source-by-source byte counts, and
 * whether the refresh / rescreen cron jobs are enabled.
 */
router.get('/sanctions/status', requireAuth, (req, res) => {
  res.json({ success: true, data: sanctionsService.getSanctionsStatus() });
});

/**
 * POST /api/compliance/sanctions/refresh
 * Manual refresh trigger. super-admin only.
 */
router.post('/sanctions/refresh', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const results = await sanctionsService.refreshSanctionsData();
    auditService.logAction(
      req.user.id,
      'sanctions_refresh',
      'System',
      '00000000-0000-0000-0000-000000000000',
      { results, manualBy: req.user.email || req.user.id, ranAt: new Date().toISOString() },
      req.ip,
    ).catch(() => {});
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

module.exports = router;
