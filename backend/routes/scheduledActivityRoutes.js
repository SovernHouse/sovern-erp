/**
 * Scheduled Activity Routes
 * Odoo-style task assignment on any ERP record.
 *
 * GET  /api/scheduled-activities/my                          — my pending tasks (dashboard banner)
 * GET  /api/scheduled-activities/entity/:entityType/:entityId — tasks on a record
 * POST /api/scheduled-activities                             — create task
 * PUT  /api/scheduled-activities/:id/done                   — mark done
 * PUT  /api/scheduled-activities/:id/reschedule             — change due date
 * DELETE /api/scheduled-activities/:id                      — cancel
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const ctrl = require('../controllers/scheduledActivityController');

// Phase 1 Commit 3b-B: brand-scope every scheduled-activity request.
router.use(requireAuth, brandScope);

router.get('/my',                              requireAuth, ctrl.getMyActivities);
router.get('/entity/:entityType/:entityId',    requireAuth, ctrl.getEntityActivities);
router.post('/',                               requireAuth, ctrl.createActivity);
router.put('/:id/done',                        requireAuth, ctrl.markDone);
router.put('/:id/reschedule',                  requireAuth, ctrl.reschedule);
router.delete('/:id',                          requireAuth, ctrl.cancelActivity);

module.exports = router;
