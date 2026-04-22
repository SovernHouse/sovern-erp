const express = require('express');
const router = express.Router();
const dataExportService = require('../services/dataExportService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');

// All export endpoints are admin-only
const adminOnly = [requireAuth, requireRole('admin')];

/**
 * GET /api/exports/entities
 * List all exportable entities
 */
router.get('/entities', adminOnly, (req, res) => {
  try {
    const entities = dataExportService.getExportableEntities();
    res.json(getSuccessResponse(entities, 'Exportable entities retrieved'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exports/:entity/csv
 * Export entity as CSV
 * Query params: status, startDate, endDate, customerId, factoryId, limit, offset
 */
router.get('/:entity/csv', adminOnly, async (req, res) => {
  try {
    const { entity } = req.params;
    const filters = req.query;

    // Validate entity
    const validEntities = [
      'salesOrders', 'purchaseOrders', 'invoices', 'payments',
      'customers', 'factories', 'products', 'shipments', 'inspections'
    ];

    if (!validEntities.includes(entity)) {
      return res.status(400).json({
        error: `Invalid entity: ${entity}. Must be one of: ${validEntities.join(', ')}`
      });
    }

    const result = await dataExportService.exportToCSV(entity, filters);

    if (result.count === 0) {
      return res.json(getSuccessResponse(result, 'No data to export'));
    }

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}-${Date.now()}.csv"`);

    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exports/:entity/json
 * Export entity as JSON Lines format
 * Query params: status, startDate, endDate, customerId, factoryId, limit, offset
 */
router.get('/:entity/json', adminOnly, async (req, res) => {
  try {
    const { entity } = req.params;
    const filters = req.query;

    // Validate entity
    const validEntities = [
      'salesOrders', 'purchaseOrders', 'invoices', 'payments',
      'customers', 'factories', 'products', 'shipments', 'inspections'
    ];

    if (!validEntities.includes(entity)) {
      return res.status(400).json({
        error: `Invalid entity: ${entity}. Must be one of: ${validEntities.join(', ')}`
      });
    }

    const result = await dataExportService.exportToJSON(entity, filters);

    if (result.count === 0) {
      return res.json(getSuccessResponse(result, 'No data to export'));
    }

    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}-${Date.now()}.jsonl"`);

    res.send(result.jsonl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exports/analytics/snapshot
 * Get full analytics snapshot with summary and details
 */
router.get('/analytics/snapshot', adminOnly, async (req, res) => {
  try {
    const result = await dataExportService.generateAnalyticsSnapshot();
    res.json(getSuccessResponse(result.snapshot, 'Analytics snapshot generated'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exports/analytics/kpis
 * Get KPIs for BI tools
 */
router.get('/analytics/kpis', adminOnly, async (req, res) => {
  try {
    const result = await dataExportService.generateKPIs();
    res.json(getSuccessResponse(result.kpis, 'KPIs generated'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
