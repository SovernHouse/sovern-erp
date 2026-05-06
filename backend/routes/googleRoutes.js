const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/googleAccountController');

// OAuth flow — callback must be PUBLIC (Google redirects here, no Bearer token)
router.get('/oauth/init', requireAuth, asyncHandler(ctrl.initiateOAuth));
router.get('/oauth/callback', asyncHandler(ctrl.handleCallback)); // no auth — Google redirect

// Account management — admin only
router.get('/accounts', requireAuth, requireRole('admin'), asyncHandler(ctrl.listAccounts));
router.delete('/accounts/:id', requireAuth, requireRole('admin'), asyncHandler(ctrl.disconnectAccount));
router.patch('/accounts/:id/toggle', requireAuth, requireRole('admin'), asyncHandler(ctrl.toggleAccount));

module.exports = router;
