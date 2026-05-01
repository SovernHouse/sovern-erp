const express = require('express');
const router = express.Router();
const triageController = require('../controllers/triageController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

// All triage routes require authentication
router.use(requireAuth);

// ─── List & read ─────────────────────────────────────────────────────────────
router.get('/', asyncHandler(triageController.listTriageItems));
router.get('/pending-count', asyncHandler(triageController.getPendingCount));
router.get('/sync-status', asyncHandler(triageController.getSyncStatus));
router.get('/:id', asyncHandler(triageController.getTriageItem));

// ─── Create (Cowork task POSTs here) ─────────────────────────────────────────
router.post('/', asyncHandler(triageController.createTriageItem));

// ─── Actions ─────────────────────────────────────────────────────────────────
router.patch('/:id/promote', asyncHandler(triageController.promoteToLead));
router.patch('/:id/forward-fanzey', asyncHandler(triageController.forwardToFanzey));
router.patch('/:id/spam', asyncHandler(triageController.markSpam));
router.patch('/:id/dismiss', asyncHandler(triageController.dismissItem));
router.patch('/:id/archive', asyncHandler(triageController.archiveItem));

// ─── Sync-now mechanism ───────────────────────────────────────────────────────
router.post('/sync-requested', asyncHandler(triageController.requestSync));
router.delete('/sync-requested', asyncHandler(triageController.clearSyncRequest));

module.exports = router;
