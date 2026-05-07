const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/googleAccountController');

// OAuth flow — callback must be PUBLIC (Google redirects here, no Bearer token)
router.get('/oauth/init', requireAuth, asyncHandler(ctrl.initiateOAuth));
router.get('/oauth/callback', asyncHandler(ctrl.handleCallback)); // no auth — Google redirect

// Account management — admin and super_admin
// /accounts (full list with sync telemetry) and the mutation endpoints stay
// admin-only. /accounts/available is a minimal read for feature pages
// (Drive/Calendar/Gmail account pickers) and is open to any authenticated
// user. Must be registered before /:id to avoid 'available' being treated
// as an account ID.
router.get('/accounts/available', requireAuth, asyncHandler(ctrl.listAvailableAccounts));
router.get('/accounts', requireAuth, requireRole('admin', 'super_admin'), asyncHandler(ctrl.listAccounts));
router.delete('/accounts/:id', requireAuth, requireRole('admin', 'super_admin'), asyncHandler(ctrl.disconnectAccount));
router.patch('/accounts/:id/toggle', requireAuth, requireRole('admin', 'super_admin'), asyncHandler(ctrl.toggleAccount));

module.exports = router;
