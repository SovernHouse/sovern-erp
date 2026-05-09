/**
 * AI Assistant Routes
 * POST   /api/ai/chat                    — send a message, get a reply
 * GET    /api/ai/conversations           — list user's conversations
 * GET    /api/ai/conversations/:id       — get conversation with full message history
 * PATCH  /api/ai/conversations/:id       — rename a conversation (body: { title })
 * DELETE /api/ai/conversations/:id       — delete a conversation
 * POST   /api/ai/conversations/:id/clear — clear messages but keep conversation
 * POST   /api/ai/attachments             — upload a file (image/PDF) to attach to a chat
 */

const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ai = require('../controllers/aiController');

// Multer for attachment uploads — disk storage to OS tempdir; controller
// streams it to Drive and unlinks. 25MB hard cap (above it is too much for
// vision context anyway). Whitelist images + PDFs.
const ATTACHMENT_TMP_DIR = path.join(os.tmpdir(), 'sovern-ai-attachments');
require('fs').mkdirSync(ATTACHMENT_TMP_DIR, { recursive: true });
const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: ATTACHMENT_TMP_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept images (vision), PDFs, Office docs (Word/Excel), and plain text.
    // Anything else is rejected at the boundary.
    const allowed = [
      /^image\/(jpeg|png|webp|heic|heif|gif)$/i,
      /^application\/pdf$/i,
      /^application\/msword$/i,                                                          // .doc (legacy)
      /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/i,  // .docx
      /^application\/vnd\.ms-excel$/i,                                                   // .xls (legacy)
      /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/i,        // .xlsx
      /^text\/(plain|csv|tab-separated-values)$/i,
    ];
    const ok = allowed.some(re => re.test(file.mimetype));
    cb(ok ? null : new Error(`Unsupported file type: ${file.mimetype}`), ok);
  },
});

router.use(requireAuth);
router.use(requireRole('super_admin'));

router.post('/chat',                        ai.chat);
router.get('/conversations',                ai.listConversations);
router.get('/conversations/:id',            ai.getConversation);
router.patch('/conversations/:id',          ai.renameConversation);
router.delete('/conversations/:id',         ai.deleteConversation);
router.post('/conversations/:id/clear',     ai.clearConversation);
router.post('/attachments', attachmentUpload.single('file'), ai.uploadAttachment);

module.exports = router;
