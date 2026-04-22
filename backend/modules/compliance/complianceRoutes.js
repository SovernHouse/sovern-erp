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

module.exports = router;
