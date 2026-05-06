/**
 * Chatter Routes
 * Polymorphic message thread for any ERP record.
 *
 * GET  /api/chatter/:entityType/:entityId            — list messages
 * POST /api/chatter/:entityType/:entityId            — post comment
 * DELETE /api/chatter/:entityType/:entityId/:msgId  — delete comment
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const chatterController = require('../controllers/chatterController');

router.get('/:entityType/:entityId', requireAuth, asyncHandler(chatterController.getMessages));
router.post('/:entityType/:entityId', requireAuth, asyncHandler(chatterController.postMessage));
router.delete('/:entityType/:entityId/:messageId', requireAuth, asyncHandler(chatterController.deleteMessage));

module.exports = router;
