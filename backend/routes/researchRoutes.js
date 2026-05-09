const express = require('express');
const router = express.Router();
const researchController = require('../controllers/researchController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

// Tier 2 background sourcing: /new-clients and /new-suppliers slash commands.
// requireRole short-circuits for super_admin (per backend/middleware/auth.js).
// Bare strings — never arrays (L-031).
router.use(requireAuth);
router.use(requireRole('admin', 'super_admin'));

// ─── Lifecycle ───────────────────────────────────────────────────────────────
router.post('/tasks', asyncHandler(researchController.startTask));
router.get('/tasks', asyncHandler(researchController.listTasks));
router.get('/tasks/:id', asyncHandler(researchController.getTask));
router.post('/tasks/:id/cancel', asyncHandler(researchController.cancelTask));

module.exports = router;
