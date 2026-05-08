const express = require('express');
const router = express.Router();
const devModeController = require('../controllers/devModeController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

// All dev-mode routes are super_admin only. requireRole short-circuits
// for super_admin (per backend/middleware/auth.js), so non-super_admin
// users get a 403 even on routes that "would" allow admin elsewhere.
router.use(requireAuth);
router.use(requireRole('super_admin'));

// ─── Lifecycle ───────────────────────────────────────────────────────────────
router.post('/runs', asyncHandler(devModeController.startRun));
router.get('/runs', asyncHandler(devModeController.listRuns));
router.get('/runs/:id', asyncHandler(devModeController.getRun));

// ─── Mid-run Q&A ─────────────────────────────────────────────────────────────
router.post('/runs/:id/answer', asyncHandler(devModeController.answerClarification));

// ─── Abort ───────────────────────────────────────────────────────────────────
router.post('/runs/:id/abort', asyncHandler(devModeController.abortRun));

module.exports = router;
