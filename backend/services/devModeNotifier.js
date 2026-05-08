/**
 * Dev Mode Notifier — fires the three notification channels when a run
 * changes to a notable state (completed / wip / failed / aborted /
 * awaiting_clarification).
 *
 * Channels:
 *   1. In-chat: a row in the Notification table targeting the user, with
 *      a deep link to /dev-runs/<id>. The mobile chat will surface this
 *      when the user opens the AI chat.
 *   2. Mobile push: Expo push notification to all the user's registered
 *      device tokens (table: ExpoPushToken). Best-effort — silently no-ops
 *      if no tokens are registered or EXPO_ACCESS_TOKEN is unset.
 *   3. Email: a summary email via Resend (best-effort).
 *
 * All channels are best-effort: a notification failure must never fail
 * the run itself.
 */

// Node 20+ provides global fetch; no library import needed.
const db = require('../models');
const logger = require('../utils/logger');

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

function statusLine(status) {
  switch (status) {
    case 'completed':              return 'Dev-mode run finished. PR ready for review.';
    case 'wip':                    return 'Dev-mode run finished as WIP. Partial PR opened.';
    case 'failed':                 return 'Dev-mode run failed.';
    case 'aborted':                return 'Dev-mode run aborted.';
    case 'awaiting_clarification': return 'Dev-mode run is asking for clarification.';
    default:                       return `Dev-mode run state: ${status}.`;
  }
}

function emoji(status) {
  if (status === 'completed') return '✅';
  if (status === 'wip')       return '⚠️';
  if (status === 'failed')    return '❌';
  if (status === 'aborted')   return '🛑';
  if (status === 'awaiting_clarification') return '❓';
  return 'ℹ️';
}

async function fireDevModeNotifications(run, status) {
  const payload = await buildPayload(run, status);

  // Run all three in parallel; never throw.
  const results = await Promise.allSettled([
    sendInAppNotification(run, payload),
    sendPushNotification(run, payload),
    sendEmailSummary(run, payload),
  ]);

  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn(`[dev-mode] notifier channel failed: ${r.reason && r.reason.message}`);
    }
  }
}

async function buildPayload(run, status) {
  const title = `${emoji(status)} ${statusLine(status)}`;
  const promptShort = (run.prompt || '').replace(/\s+/g, ' ').slice(0, 80);
  const bodyLines = [
    `Prompt: "${promptShort}"`,
    run.prUrl ? `PR: ${run.prUrl}` : null,
    run.linesAdded || run.linesDeleted
      ? `Diff: +${run.linesAdded}/-${run.linesDeleted}`
      : null,
    run.errorMessage ? `Error: ${run.errorMessage.slice(0, 200)}` : null,
    status === 'awaiting_clarification' && run.clarificationQuestion
      ? `Question: ${run.clarificationQuestion.slice(0, 200)}`
      : null,
  ].filter(Boolean);

  return { title, body: bodyLines.join('\n'), status, runId: run.id };
}

// ─── 1. In-app notification (Notification row) ───────────────────────────────

async function sendInAppNotification(run, payload) {
  if (!db.Notification) return;
  // Notification.type ENUM doesn't include 'dev_mode' and SQLite ENUMs can't
  // be altered without recreating the table. Use 'system' and disambiguate
  // via the data.kind field, which the frontend can branch on.
  await db.Notification.create({
    userId: run.userId,
    type: 'system',
    title: payload.title,
    message: payload.body,
    data: {
      kind: 'dev_mode',
      runId: run.id,
      status: payload.status,
      prUrl: run.prUrl || null,
    },
    link: run.prUrl || `/dev-runs/${run.id}`,
    isRead: false,
  });
}

// ─── 2. Expo push ────────────────────────────────────────────────────────────

async function sendPushNotification(run, payload) {
  if (!db.ExpoPushToken) return;  // model exists only after Session 3 lands; gracefully skip otherwise
  const tokens = await db.ExpoPushToken.findAll({
    where: { userId: run.userId, isActive: true },
    attributes: ['token'],
  });
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: { runId: run.id, status: payload.status, prUrl: run.prUrl || null },
    priority: 'high',
  }));

  const res = await fetch(EXPO_PUSH_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Expo push HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
}

// ─── 3. Email summary (Resend) ───────────────────────────────────────────────

async function sendEmailSummary(run, payload) {
  if (!process.env.RESEND_API_KEY) return;
  const user = await db.User.findByPk(run.userId, { attributes: ['email', 'name'] });
  if (!user || !user.email) return;

  const fromAddr = process.env.RESEND_FROM_ADDRESS || 'Sovern ERP <noreply@sovernhouse.co>';
  const html = buildEmailHtml(run, payload);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromAddr,
      to: user.email,
      subject: payload.title,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Resend HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
}

function buildEmailHtml(run, payload) {
  const promptHtml = (run.prompt || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c]));
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">${payload.title}</h2>
      <p><strong>Run ID:</strong> <code>${run.id}</code></p>
      <p><strong>Prompt:</strong></p>
      <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; color: #555;">${promptHtml}</blockquote>
      ${run.prUrl ? `<p><a href="${run.prUrl}" style="background: #0e1b16; color: #f5efe1; padding: 10px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">Review PR</a></p>` : ''}
      ${run.errorMessage ? `<p style="color: #b00;"><strong>Error:</strong> ${run.errorMessage}</p>` : ''}
      ${run.clarificationQuestion ? `<p><strong>Clarification needed:</strong></p><pre style="white-space: pre-wrap; background: #f8f5ec; padding: 12px;">${run.clarificationQuestion}</pre>` : ''}
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Sovern ERP dev-mode AI assistant. Reply to this email is not monitored.</p>
    </div>
  `;
}

module.exports = { fireDevModeNotifications };
