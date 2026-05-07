const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/driveController');

// All Drive routes require authentication. Admin or manager role.
router.get('/files',         requireAuth, requireRole('admin', 'manager'), asyncHandler(ctrl.listFiles));
router.get('/files/:fileId', requireAuth, requireRole('admin', 'manager'), asyncHandler(ctrl.getFile));
router.get('/search',        requireAuth, requireRole('admin', 'manager'), asyncHandler(ctrl.searchFiles));
router.get('/breadcrumb',    requireAuth, requireRole('admin', 'manager'), asyncHandler(ctrl.getBreadcrumb));

module.exports = router;
