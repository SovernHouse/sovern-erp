const express = require('express');
const router = express.Router();
const triageController = require('../controllers/triageController');
const { requireAuth } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const asyncHandler = require('../middleware/asyncHandler');

// All triage routes require authentication + brand scope (P1 C3b-B).
router.use(requireAuth, brandScope);

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

// ─── Generic update (AI escape hatch — status flips only) ────────────────────
// Must come AFTER the specific /:id/<action> routes so they take precedence.
router.patch('/:id', asyncHandler(triageController.updateTriageItem));

// ─── Send email (reply / forward / compose) ───────────────────────────────────
router.post('/send-email', asyncHandler(triageController.sendEmail));

// ─── Sync-now mechanism ───────────────────────────────────────────────────────
router.post('/sync-requested', asyncHandler(triageController.requestSync));
router.delete('/sync-requested', asyncHandler(triageController.clearSyncRequest));

module.exports = router;
