/**
 * AI Controller
 * Handles the in-ERP Claude assistant: chat, conversation management.
 * Uses `claude -p` subprocess (Max subscription) with the ERP MCP tool server
 * for Google Calendar, Gmail, leads, contacts, factories, and quotations.
 */

const { spawn }  = require('child_process');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const db         = require('../models');
const logger     = require('../utils/logger');
const { buildSystemPrompt } = require('../services/aiContextService');

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

async function runClaudeSubprocess(fullPrompt, userId) {
  return new Promise((resolve) => {
    let output = '';
    let errOutput = '';
    let settled = false;

    // --tools ''      disables built-in Bash/file/web tools (security)
    // --mcp-config    enables our ERP tool server (calendar, gmail, leads, etc.)
    // Prompt via stdin — --tools is variadic so a positional arg would be
    // consumed as a tool name, not a prompt.
    const child = spawn('claude', [
      '-p',
      '--tools', '',
      '--mcp-config', MCP_CONFIG_PATH,
    ], {
      env: { ...process.env, ERP_USER_ID: String(userId || '') },
    });
    child.stdin.write(fullPrompt);
    child.stdin.end();

    // Hard-kill after 120s — shorter than nginx's proxy_read_timeout (150s)
    // so the backend can return a clean error before nginx cuts the connection.
    // Increased from 90s to allow for multi-step tool call chains.
    const killTimer = setTimeout(() => {
      if (!settled) {
        logger.warn('[ai] Claude subprocess timeout — killing');
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 3000);
      }
    }, 120000);

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
  const prompt = 'Generate a short (5 words max) title for a conversation that starts with:\n"' +
    firstMessage.slice(0, 200) + '"\n\nReturn ONLY the title, no quotes, no explanation.';

  const result = await runClaudeSubprocess(prompt, null);
  if (result.ok && result.text) {
    return result.text.slice(0, 100).replace(/^["']|["']$/g, '').trim();
  }
  return firstMessage.slice(0, 50).trim();
}

// ── Chat ──────────────────────────────────────────────────────────────────────

exports.chat = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const user = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

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
    const systemPrompt = await buildSystemPrompt(user);

    // Get last 20 messages for context window
    const history = (conversation.messages || []).slice(-20);

    // Assemble full prompt
    const historyText = formatConversationForPrompt(history);
    let fullPrompt = systemPrompt;
    if (historyText) {
      fullPrompt += '\n\n## Conversation so far\n\n' + historyText + '\n\n';
    }
    fullPrompt += 'Human: ' + message.trim() + '\n\nAssistant:';

    // Run claude -p with ERP MCP tools
    const result = await runClaudeSubprocess(fullPrompt, user.id);

    if (!result.ok) {
      return res.status(502).json({
        error: 'AI assistant is currently unavailable',
        detail: result.error,
      });
    }

    const assistantReply = result.text;

    // Append messages to conversation
    const updatedMessages = [
      ...history,
      { role: 'user', content: message.trim(), createdAt: new Date().toISOString() },
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
