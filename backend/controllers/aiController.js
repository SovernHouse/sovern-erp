/**
 * AI Controller
 * Handles the in-ERP Claude assistant: chat, conversation management,
 * file attachments uploaded to Google Drive.
 * Uses `claude -p` subprocess (Max subscription) with the ERP MCP tool server
 * for Google Calendar, Gmail, leads, contacts, factories, and quotations.
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const { google } = require('googleapis');
const db         = require('../models');
const logger     = require('../utils/logger');
const { buildSystemPrompt } = require('../services/aiContextService');
const { getAuthClientForAccount } = require('./googleAccountController');

// Drive folder names — kept as constants so admin/mobile can show them too.
const DRIVE_ROOT_FOLDER  = 'Sovern ERP';
const DRIVE_AI_SUBFOLDER = 'AI uploads';

// ── MCP config — written once at module load, reused for all requests ─────────
// Points claude -p to the ERP MCP tool server. Path is resolved at runtime so
// it works in any environment without hardcoding the VM path.

const MCP_SERVER_PATH = path.join(__dirname, '..', 'mcp', 'erpToolServer.js');
const MCP_CONFIG_PATH = path.join(os.tmpdir(), 'sovern-erp-mcp-config.json');

try {
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify({
    mcpServers: {
      'sovern-erp': {
        command: 'node',
        args: [MCP_SERVER_PATH],
      },
    },
  }));
  logger.info('[ai] MCP config written to', MCP_CONFIG_PATH);
} catch (err) {
  logger.error('[ai] Failed to write MCP config:', err.message);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatConversationForPrompt(messages) {
  if (!messages || messages.length === 0) return '';
  return messages
    .map(m => (m.role === 'user' ? 'Human' : 'Assistant') + ': ' + m.content)
    .join('\n\n');
}

// Find the user's active Google account that has Drive scope. Returns the
// account record + an authed Drive client, or throws a clear error.
async function getDriveClientForUser(userId) {
  const account = await db.ConnectedGoogleAccount.findOne({
    where: { connectedByUserId: userId, isActive: true },
  });
  if (!account) {
    const err = new Error('No active Google account connected. Connect one in Settings → Connected Accounts.');
    err.statusCode = 412; // precondition failed
    throw err;
  }
  // Phase 4.7 follow-up: write-capable Drive scope required for attachment
  // upload (this controller) and folder setup (admin/drive-setup). The old
  // loose check accepted drive.readonly which silently fails at create-time
  // with "Insufficient Permission". Look for drive.file (per-app) or the
  // broad drive scope.
  const scopes = account.scopes || [];
  const hasDriveWrite = scopes.some(s =>
    s.includes('drive.file') || s === 'https://www.googleapis.com/auth/drive',
  );
  if (!hasDriveWrite) {
    const err = new Error('Connected Google account is missing Drive write scope (drive.file or drive). Reconnect via Settings -> Connected Accounts to grant it.');
    err.statusCode = 412;
    throw err;
  }
  const auth = await getAuthClientForAccount(account);
  return { account, drive: google.drive({ version: 'v3', auth }) };
}

// Find-or-create a folder by name under a parent. Caches results in-process
// for the duration of one HTTP request to avoid repeating the lookup.
async function findOrCreateFolder(drive, name, parentId) {
  const safe = String(name).replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${safe}' and trashed = false` +
            (parentId ? ` and '${parentId}' in parents` : '');
  const list = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 1 });
  if (list.data.files && list.data.files.length > 0) return list.data.files[0].id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    },
    fields: 'id',
  });
  return created.data.id;
}

// Resolve "Sovern ERP / AI uploads / YYYY-MM" (creating segments as needed).
async function getAiUploadsFolderId(drive) {
  const root = await findOrCreateFolder(drive, DRIVE_ROOT_FOLDER, null);
  const sub  = await findOrCreateFolder(drive, DRIVE_AI_SUBFOLDER, root);
  const ym   = new Date().toISOString().slice(0, 7); // YYYY-MM
  const month = await findOrCreateFolder(drive, ym, sub);
  return month;
}

async function runClaudeSubprocess(systemPrompt, userPrompt, userId, withMcp = true) {
  return new Promise((resolve) => {
    let output = '';
    let errOutput = '';
    let settled = false;

    // --system-prompt        replace Claude Code's default identity with our ERP
    //                        system prompt (otherwise it acts as the dev tool)
    // --strict-mcp-config    ignore ~/.claude.json global tools; only use --mcp-config
    // --mcp-config           enable our ERP tool server (calendar, gmail, leads, etc.)
    // --permission-mode      bypassPermissions so MCP tool calls don't stall
    //                        waiting for an approval prompt that no human will
    //                        ever click in a headless subprocess
    // --disallowed-tools     block local file/shell tools for security. WebFetch
    //                        and WebSearch are intentionally allowed so the AI
    //                        can answer travel/quick-lookup asks (hotels,
    //                        restaurants, contacts, news). Heavy multi-step
    //                        sourcing belongs in the Tier 2 background runner,
    //                        not this synchronous chat path.
    const args = ['-p', '--system-prompt', systemPrompt, '--strict-mcp-config',
                  '--permission-mode', 'bypassPermissions'];
    if (withMcp) {
      args.push('--mcp-config', MCP_CONFIG_PATH);
    }
    args.push('--disallowed-tools', 'Bash,Read,Write,Edit,Glob,Grep');

    const child = spawn('claude', args, {
      env: { ...process.env, ERP_USER_ID: String(userId || '') },
    });
    child.stdin.write(userPrompt);
    child.stdin.end();

    // Hard-kill after 240s — shorter than nginx's proxy_read_timeout (270s)
    // so the backend can return a clean error before nginx cuts the connection.
    // Bumped from 120s to give web-research asks (WebSearch/WebFetch enabled
    // above) room to do 1-3 lookups + synthesis without timing out. Heavier
    // multi-minute research belongs in the Tier 2 background runner.
    const killTimer = setTimeout(() => {
      if (!settled) {
        logger.warn('[ai] Claude subprocess timeout — killing');
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 3000);
      }
    }, 240000);

    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { errOutput += d.toString(); });

    child.on('close', (code) => {
      settled = true;
      clearTimeout(killTimer);
      if (code !== 0 && !output.trim()) {
        logger.warn('[ai] Claude subprocess exited with code', code, ':', errOutput.slice(0, 200));
        resolve({ ok: false, text: null, error: errOutput.slice(0, 300) });
      } else {
        resolve({ ok: true, text: output.trim() });
      }
    });

    child.on('error', (err) => {
      settled = true;
      clearTimeout(killTimer);
      logger.error('[ai] Claude subprocess error:', err.message);
      resolve({ ok: false, text: null, error: err.message });
    });
  });
}

// Generate a short title — no MCP tools needed, pass null for userId
async function generateTitle(firstMessage) {
  const sys = 'You generate short conversation titles. Return ONLY the title text — no quotes, no explanation, no preamble.';
  const userPrompt = 'Generate a 5-word-max title for a conversation that starts with:\n"' +
    firstMessage.slice(0, 200) + '"';

  const result = await runClaudeSubprocess(sys, userPrompt, null, false);
  if (result.ok && result.text) {
    return result.text.slice(0, 100).replace(/^["']|["']$/g, '').trim();
  }
  return firstMessage.slice(0, 50).trim();
}

// ── Chat ──────────────────────────────────────────────────────────────────────

exports.chat = async (req, res) => {
  try {
    const { message, conversationId, attachments } = req.body;
    const user = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate attachments shape (kept lean — heavy validation already
    // happened at upload time). Each entry must at least carry a Drive ID.
    const attachmentList = Array.isArray(attachments)
      ? attachments
        .filter(a => a && typeof a === 'object' && typeof a.driveFileId === 'string')
        .slice(0, 5) // cap per message
      : [];

    // Load or create conversation
    let conversation;
    let isNew = false;

    if (conversationId) {
      conversation = await db.AIConversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      isNew = true;
      conversation = await db.AIConversation.create({
        userId: user.id,
        title: 'New conversation',
        messages: [],
      });
    }

    // Build system prompt (with live ERP data for admin/super_admin)
    let systemPrompt = await buildSystemPrompt(user);

    // Cross-conversation memory: append a compact summary of the last 5
    // OTHER conversations so the assistant knows it can recall them and
    // has at-a-glance context. Full content is available via the
    // read_conversation / search_conversations MCP tools.
    try {
      const recent = await db.AIConversation.findAll({
        where: { userId: user.id, id: { [require('sequelize').Op.ne]: conversation.id } },
        order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'lastMessageAt', 'messages'],
      });
      if (recent.length) {
        const lines = recent.map(c => {
          const msgs = c.messages || [];
          const lastUser = [...msgs].reverse().find(m => m.role === 'user');
          const preview = lastUser ? lastUser.content.slice(0, 120).replace(/\s+/g, ' ') : '';
          const when = c.lastMessageAt ? new Date(c.lastMessageAt).toISOString().slice(0, 10) : '';
          return `- [${when}] "${c.title}" (${msgs.length} msgs) — last user msg: "${preview}"`;
        }).join('\n');
        systemPrompt += `\n\n## Recent conversations (you remember these)\n${lines}\n\nThese are summaries; call read_conversation(id) for full content, or search_conversations(query) to find a specific topic across all past chats.`;
      }
    } catch (e) {
      logger.warn('[ai] could not load recent conversations:', e.message);
    }

    // Get last 20 messages for context window
    const history = (conversation.messages || []).slice(-20);

    // User-side prompt: prior conversation + new message.
    // System prompt is passed via --system-prompt (overrides Claude Code's default).
    const historyText = formatConversationForPrompt(history);
    let userPrompt = '';
    if (historyText) {
      userPrompt += '## Conversation so far\n\n' + historyText + '\n\n## New message\n\n';
    }
    userPrompt += message.trim();

    // If the user attached files, append a directive instructing the AI to
    // fetch each via the read_attachment MCP tool. The tool returns the file
    // as MCP image content (or text content for PDFs/text files), which
    // claude -p ingests into the model context.
    if (attachmentList.length > 0) {
      userPrompt += '\n\n## Attached files\nThe user attached ' + attachmentList.length +
        ' file' + (attachmentList.length === 1 ? '' : 's') + '. Call `read_attachment(file_id)` for each ' +
        'to view its contents before responding:\n' +
        attachmentList.map(a => `- ${a.name || '(unnamed)'} (file_id: "${a.driveFileId}")`).join('\n');
    }

    // Run claude -p with ERP MCP tools
    const result = await runClaudeSubprocess(systemPrompt, userPrompt, user.id);

    // If a timeout middleware already closed the response while we were
    // waiting on claude, bail out — trying to res.json() now throws
    // ERR_HTTP_HEADERS_SENT and crashes the request.
    if (res.headersSent) {
      logger.warn('[ai] response already sent (likely upstream timeout) — skipping reply persistence');
      return;
    }

    if (!result.ok) {
      return res.status(502).json({
        error: 'AI assistant is currently unavailable',
        detail: result.error,
      });
    }

    const assistantReply = result.text;

    // Append messages to conversation. User message carries any attachments
    // (so the chat history rendering can show inline thumbnails on reload).
    const updatedMessages = [
      ...history,
      {
        role: 'user',
        content: message.trim(),
        createdAt: new Date().toISOString(),
        ...(attachmentList.length > 0 ? { attachments: attachmentList } : {}),
      },
      { role: 'assistant', content: assistantReply, createdAt: new Date().toISOString() },
    ];

    // If this is a new conversation, generate a title from the first message
    let title = conversation.title;
    if (isNew || title === 'New conversation') {
      try {
        title = await generateTitle(message.trim());
      } catch (e) {
        title = message.trim().slice(0, 60);
      }
    }

    await conversation.update({
      messages: updatedMessages,
      title,
      lastMessageAt: new Date(),
    });

    if (res.headersSent) return;
    return res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        title,
        reply: assistantReply,
        isNew,
      },
    });
  } catch (err) {
    logger.error('[ai] chat error:', err.message, err.stack);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};

// ── Conversation CRUD ─────────────────────────────────────────────────────────

exports.listConversations = async (req, res) => {
  try {
    const conversations = await db.AIConversation.findAll({
      where: { userId: req.user.id },
      order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
    });
    const data = conversations.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: (c.messages || []).length,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[ai] listConversations error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const conversation = await db.AIConversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    const messages = (conversation.messages || []).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
    }));
    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          messageCount: messages.length,
          lastMessageAt: conversation.lastMessageAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        messages,
      },
    });
  } catch (err) {
    logger.error('[ai] getConversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.renameConversation = async (req, res) => {
  try {
    const { title } = req.body;
    const trimmed = (title || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Title is required' });
    if (trimmed.length > 200) {
      return res.status(400).json({ error: 'Title too long (max 200 chars)' });
    }
    const conversation = await db.AIConversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    await conversation.update({ title: trimmed });
    res.json({ ok: true, data: { id: conversation.id, title: trimmed } });
  } catch (err) {
    logger.error('[ai] renameConversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const conversation = await db.AIConversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    await conversation.destroy();
    res.json({ ok: true });
  } catch (err) {
    logger.error('[ai] deleteConversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.clearConversation = async (req, res) => {
  try {
    const conversation = await db.AIConversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    await conversation.update({ messages: [], lastMessageAt: null });
    res.json({ ok: true });
  } catch (err) {
    logger.error('[ai] clearConversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Attachments ───────────────────────────────────────────────────────────────
// POST /api/ai/attachments — upload a file the user wants to share with the
// AI in chat. Stored in their Google Drive at "Sovern ERP/AI uploads/YYYY-MM/"
// (per the spec storage decision). Multer parses multipart/form-data into
// req.file before this handler runs.

exports.uploadAttachment = async (req, res) => {
  let tmpPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Send as multipart/form-data with field name "file".' });
    }
    tmpPath = req.file.path;
    const { drive } = await getDriveClientForUser(req.user.id);
    const folderId = await getAiUploadsFolderId(drive);

    // Upload bytes to Drive
    const fileStream = fs.createReadStream(tmpPath);
    const created = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [folderId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: fileStream,
      },
      fields: 'id,name,mimeType,size,webViewLink,thumbnailLink,createdTime',
    });

    const file = created.data;
    return res.status(201).json({
      success: true,
      data: {
        driveFileId:  file.id,
        name:         file.name,
        mimeType:     file.mimeType,
        sizeBytes:    file.size ? Number(file.size) : (req.file.size || null),
        webViewLink:  file.webViewLink || null,
        thumbnailUrl: file.thumbnailLink || null,
        createdTime:  file.createdTime || null,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;
    logger.error('[ai] uploadAttachment error:', err.message);
    return res.status(code).json({ error: err.message || 'Upload failed' });
  } finally {
    // Always clean up the multer tempfile.
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch (_) { /* file already gone */ }
    }
  }
};
