/**
 * AI Assistant Routes
 * POST   /api/ai/chat                  — send a message, get a reply
 * GET    /api/ai/conversations         — list user's conversations
 * GET    /api/ai/conversations/:id     — get conversation with full message history
 * PATCH  /api/ai/conversations/:id     — rename a conversation (body: { title })
 * DELETE /api/ai/conversations/:id     — delete a conversation
 * POST   /api/ai/conversations/:id/clear — clear messages but keep conversation
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ai = require('../controllers/aiController');

router.use(requireAuth);
router.use(requireRole('super_admin'));

router.post('/chat',                        ai.chat);
router.get('/conversations',                ai.listConversations);
router.get('/conversations/:id',            ai.getConversation);
router.patch('/conversations/:id',          ai.renameConversation);
router.delete('/conversations/:id',         ai.deleteConversation);
router.post('/conversations/:id/clear',     ai.clearConversation);

module.exports = router;
