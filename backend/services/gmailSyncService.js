/**
 * Gmail Sync Service
 * Polls connected Google accounts for new emails and creates TriageItems.
 * Runs as a node-cron background job every 5 minutes.
 *
 * Flow per account:
 *   1. Refresh OAuth token if needed
 *   2. Use Gmail History API (incremental) if we have a historyId, else full fetch
 *   3. For each new message: fetch full body, run AI extraction, upsert TriageItem
 *   4. Save updated historyId cursor so next run is incremental
 */

const { google } = require('googleapis');
const { spawn } = require('child_process');
const db = require('../models');
const logger = require('../utils/logger');
const { getAuthClientForAccount } = require('../controllers/googleAccountController');

// ── AI extraction via claude -p subprocess ────────────────────────────────────

async function extractEmailIntelligence(emailData) {
  const prompt = `You are an email triage assistant for Sovern House, an Asia-based buying office (flooring, auto parts, garments).

Analyze this inbound email and extract structured data. Return ONLY valid JSON, no explanation.

Email details:
From: ${emailData.from}
Subject: ${emailData.subject}
Body (first 1000 chars): ${emailData.body?.slice(0, 1000) || '(empty)'}

Return this exact JSON structure:
{
  "senderName": "full name from signature or From field, or null",
  "senderCompany": "company name from signature, email domain, or body, or null",
  "country": "2-letter ISO country code inferred from domain/phone/body, or null",
  "productInterest": "exact description of what they want, or null",
  "intentScore": "high|medium|low|spam",
  "suggestedAction": "create_lead|request_info|forward_fanzey|mark_spam|dismiss",
  "detectedLanguage": "ISO 639-1 code e.g. en|ar|fr|es|zh",
  "isRelevant": true or false
}

Rules:
- intentScore "high": clear buying signal with quantities/timeline
- intentScore "medium": general inquiry, vague interest
- intentScore "low": just browsing or unclear
- intentScore "spam": promotional, automated, newsletters, Sentry/Vercel alerts, delivery receipts
- suggestedAction "forward_fanzey": mentions Egypt, Cairo, Egyptian market, or African territory
- suggestedAction "create_lead": high intent, clear buyer, outside Egypt
- suggestedAction "request_info": medium intent, needs clarification
- suggestedAction "mark_spam": obvious spam or automated message
- suggestedAction "dismiss": not actionable but not spam
- isRelevant: false if this is from a known internal system (Sentry, Vercel, GitHub, Alibaba promos, bank notifications)`;

  return new Promise((resolve) => {
    let output = '';
    let errOutput = '';

    const child = spawn('claude', ['-p', prompt], {
      timeout: 30000,
      env: { ...process.env },
    });

    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { errOutput += d.toString(); });

    child.on('close', (code) => {
      try {
        // Extract JSON from output (claude -p may include surrounding text)
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resolve(JSON.parse(jsonMatch[0]));
        } else {
          logger.warn('[gmail-sync] Claude returned no JSON:', output.slice(0, 200));
          resolve(null);
        }
      } catch (parseErr) {
        logger.warn('[gmail-sync] Failed to parse Claude output:', parseErr.message);
        resolve(null);
      }
    });

    child.on('error', (err) => {
      logger.warn('[gmail-sync] Claude subprocess error:', err.message);
      resolve(null);
    });
  });
}

// ── Gmail message helpers ─────────────────────────────────────────────────────

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function decodeBase64(data) {
  if (!data) return '';
  // Gmail uses URL-safe base64
  const buf = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return buf.toString('utf-8');
}

function extractTextBody(payload) {
  if (!payload) return '';

  // Direct text/plain part
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Multipart: recurse through parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  // Fallback: decode whatever body data exists
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  return '';
}

// ── Sync a single message ─────────────────────────────────────────────────────

async function processMessage(gmail, messageId, accountEmail) {
  // Idempotent — skip if already in DB
  const existing = await db.TriageItem.findOne({ where: { gmailMessageId: messageId } });
  if (existing) return { skipped: true };

  // Fetch full message
  const { data: msg } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = msg.payload?.headers || [];
  const from = getHeader(headers, 'From') || '';
  const subject = getHeader(headers, 'Subject') || '(no subject)';
  const inReplyTo = getHeader(headers, 'In-Reply-To') || null;
  const to = getHeader(headers, 'To') || '';
  const body = extractTextBody(msg.payload);

  // Skip emails FROM our own account (sent items appear in inbox too with some labels)
  if (from.includes(accountEmail)) return { skipped: true, reason: 'own-email' };

  // Skip if no meaningful body (e.g. calendar invites with no text)
  if (!from) return { skipped: true, reason: 'no-from' };

  // Run AI extraction
  const intel = await extractEmailIntelligence({ from, subject, body });

  // Skip irrelevant automated messages
  if (intel && intel.isRelevant === false) {
    return { skipped: true, reason: 'not-relevant' };
  }

  // Check if this is a reply to one of our outreach emails
  let isReplyToOutreach = false;
  let matchedOutreachEmailId = null;
  if (inReplyTo) {
    const matched = await db.OutreachEmail.findOne({
      where: { smtpMessageId: inReplyTo },
    }).catch(() => null);
    if (matched) {
      isReplyToOutreach = true;
      matchedOutreachEmailId = matched.id;
    }
  }

  // Auto-archive date: 7 days from now
  const autoArchiveAt = new Date();
  autoArchiveAt.setDate(autoArchiveAt.getDate() + 7);

  const item = await db.TriageItem.create({
    gmailMessageId: messageId,
    inReplyToMessageId: inReplyTo,
    senderEmail: from.match(/<(.+)>/)?.[1] || from,
    senderName: intel?.senderName || from.replace(/<.+>/, '').trim() || null,
    senderCompany: intel?.senderCompany || null,
    country: intel?.country || null,
    productInterest: intel?.productInterest || null,
    intentScore: intel?.intentScore || 'low',
    suggestedAction: intel?.suggestedAction || 'dismiss',
    detectedLanguage: intel?.detectedLanguage || 'en',
    subject,
    bodySnippet: body.slice(0, 500) || msg.snippet?.slice(0, 500) || null,
    rawEmailData: { gmailThreadId: msg.threadId, to, labels: msg.labelIds },
    isReplyToOutreach,
    matchedOutreachEmailId,
    status: 'pending',
    autoArchiveAt,
  });

  // Notify admins
  await _notifyAdmins(item, intel);

  return { created: true, id: item.id, intentScore: intel?.intentScore };
}

// ── Notify admin users ────────────────────────────────────────────────────────

async function _notifyAdmins(item, intel) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const admins = await db.User.findAll({
      where: { role: ['admin', 'super_admin'] },
      attributes: ['id'],
    });
    const notifications = admins.map(admin => ({
      id: uuidv4(),
      userId: admin.id,
      type: 'triage',
      title: `New inbound email from ${item.senderCompany || item.senderEmail}`,
      message: `${intel?.intentScore ? `[${intel.intentScore.toUpperCase()}] ` : ''}${item.subject} — ${item.senderEmail}`,
      data: { triageItemId: item.id },
      link: '/crm/inbox',
      isRead: false,
    }));
    if (notifications.length > 0) await db.Notification.bulkCreate(notifications);
  } catch (err) {
    logger.warn('[gmail-sync] Notification error:', err.message);
  }
}

// ── Sync a single connected account ──────────────────────────────────────────

async function syncAccount(account) {
  logger.info(`[gmail-sync] Syncing ${account.email}...`);

  let authClient;
  try {
    authClient = await getAuthClientForAccount(account);
  } catch (authErr) {
    logger.error(`[gmail-sync] Auth failed for ${account.email}:`, authErr.message);
    return { account: account.email, error: 'auth-failed' };
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  let messageIds = [];

  if (account.gmailHistoryId) {
    // Incremental sync via History API — only messages since last sync
    try {
      const { data: history } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: account.gmailHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      if (history.history) {
        for (const record of history.history) {
          for (const added of (record.messagesAdded || [])) {
            messageIds.push(added.message.id);
          }
        }
      }

      // Update cursor — use the latest historyId from the response
      if (history.historyId) {
        await account.update({ gmailHistoryId: history.historyId, lastGmailSyncAt: new Date() });
      }
    } catch (histErr) {
      // historyId expired (can happen if >7 days or account was reconnected) — fall back to full fetch
      logger.warn(`[gmail-sync] historyId expired for ${account.email}, falling back to 24h fetch`);
      account.gmailHistoryId = null;
    }
  }

  if (!account.gmailHistoryId) {
    // Full fetch: get INBOX messages from the last 24 hours
    const after = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // Unix timestamp
    const { data: list } = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox after:${after}`,
      maxResults: 50,
    });

    messageIds = (list.messages || []).map(m => m.id);

    // Grab current historyId for future incremental syncs
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
    await account.update({
      gmailHistoryId: profile.historyId,
      lastGmailSyncAt: new Date(),
    });
  }

  // Process each message
  let created = 0;
  let skipped = 0;
  for (const messageId of messageIds) {
    try {
      const result = await processMessage(gmail, messageId, account.email);
      if (result.created) created++;
      else skipped++;
    } catch (msgErr) {
      logger.error(`[gmail-sync] Error processing message ${messageId}:`, msgErr.message);
    }
  }

  logger.info(`[gmail-sync] ${account.email}: ${created} created, ${skipped} skipped`);
  return { account: account.email, created, skipped };
}

// ── Main sync runner — called by cron job ─────────────────────────────────────

async function runGmailSync() {
  const accounts = await db.ConnectedGoogleAccount.findAll({
    where: { isActive: true },
  });

  if (accounts.length === 0) return;

  logger.info(`[gmail-sync] Starting sync for ${accounts.length} account(s)`);

  const results = [];
  for (const account of accounts) {
    try {
      const result = await syncAccount(account);
      results.push(result);
    } catch (err) {
      logger.error(`[gmail-sync] Unhandled error for ${account.email}:`, err.message);
    }
  }

  return results;
}

module.exports = { runGmailSync, syncAccount };
