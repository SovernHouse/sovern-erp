/**
 * Internal Approval Routes
 *
 * GET  /api/internal-approvals                        — list all
 * GET  /api/internal-approvals/pending-count          — count for dashboard badge
 * GET  /api/internal-approvals/entity/:type/:id       — all for a specific record
 * GET  /api/internal-approvals/:id                    — single
 * POST /api/internal-approvals                        — request approval
 * POST /api/internal-approvals/:id/approve            — approve
 * POST /api/internal-approvals/:id/reject             — reject
 * POST /api/internal-approvals/:id/cancel             — cancel
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAny } = require('../middleware/auth');
const ctrl = require('../controllers/internalApprovalController');

router.get('/pending-count',              requireAuth, ctrl.getPendingCount);
router.get('/entity/:entityType/:entityId', requireAuth, ctrl.getForEntity);
router.get('/:id',                        requireAuth, ctrl.getById);
router.get('/',                           requireAuth, ctrl.getAll);

router.post('/',                          requireAuth, ctrl.request);
router.post('/:id/approve',               requireAuth, ctrl.approve);
router.post('/:id/reject',                requireAuth, ctrl.reject);
router.post('/:id/cancel',                requireAuth, ctrl.cancel);

module.exports = router;
