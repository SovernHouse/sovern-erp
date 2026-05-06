/**
 * Chat Routes
 * Internal chat + omnichannel inbox system.
 *
 * All routes require authentication. Membership checks are enforced inside
 * the controller (assertMember / assertRoomAdmin helpers).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

// ── Utility ───────────────────────────────────────────────────────────────────
router.get('/users', requireAuth, ctrl.listUsers);

// ── Rooms ─────────────────────────────────────────────────────────────────────
router.get('/rooms',          requireAuth, ctrl.listRooms);
router.post('/rooms',         requireAuth, ctrl.createRoom);
router.post('/rooms/dm',      requireAuth, ctrl.getOrCreateDM);    // must be before /rooms/:id
router.get('/rooms/:id',      requireAuth, ctrl.getRoom);
router.patch('/rooms/:id',    requireAuth, ctrl.updateRoom);
router.delete('/rooms/:id',   requireAuth, ctrl.deleteRoom);

// ── Members ───────────────────────────────────────────────────────────────────
router.get('/rooms/:id/members',           requireAuth, ctrl.listMembers);
router.post('/rooms/:id/members',          requireAuth, ctrl.addMembers);
router.delete('/rooms/:id/members/:uid',   requireAuth, ctrl.removeMember);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get('/rooms/:id/messages',                requireAuth, ctrl.listMessages);
router.post('/rooms/:id/messages',               requireAuth, ctrl.sendMessage);
router.patch('/rooms/:id/messages/:mid',         requireAuth, ctrl.editMessage);
router.delete('/rooms/:id/messages/:mid',        requireAuth, ctrl.deleteMessage);
router.post('/rooms/:id/messages/:mid/react',    requireAuth, ctrl.toggleReaction);

// ── Read receipts ─────────────────────────────────────────────────────────────
router.post('/rooms/:id/read', requireAuth, ctrl.markRead);

module.exports = router;
