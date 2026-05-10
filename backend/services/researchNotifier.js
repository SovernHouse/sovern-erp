/**
 * Research Notifier — fires the three notification channels when a research
 * task changes to a notable state (completed / failed / cancelled).
 *
 * Mirrors devModeNotifier.js (same channels, same best-effort semantics)
 * with research-specific message formatting. All channels are best-effort:
 * a notification failure must never fail the task itself.
 */

const db = require('../models');
const logger = require('../utils/logger');

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

function statusLine(status, mode) {
  const what = mode === 'clients' ? 'client' : mode === 'suppliers' ? 'supplier' : 'research';
  switch (status) {
    case 'completed': return `New ${what} research finished.`;
    case 'failed':    return `Research run failed.`;
    case 'cancelled': return `Research run cancelled.`;
    default:          return `Research state: ${status}.`;
  }
}

function emoji(status) {
  if (status === 'completed') return '✅';
  if (status === 'failed')    return '❌';
  if (status === 'cancelled') return '🛑';
  return 'ℹ️';
}

async function fireResearchNotifications(task, status) {
  const payload = await buildPayload(task, status);

  const results = await Promise.allSettled([
    sendInAppNotification(task, payload),
    sendPushNotification(task, payload),
    sendEmailSummary(task, payload),
  ]);

  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn(`[research] notifier channel failed: ${r.reason && r.reason.message}`);
    }
  }
}

async function buildPayload(task, status) {
  const title = `${emoji(status)} ${statusLine(status, task.mode)}`;
  const briefShort = (task.brief || '').replace(/\s+/g, ' ').slice(0, 80);
  const bodyLines = [
    `Brief: "${briefShort}"`,
    status === 'completed' && task.draftsCreated != null
      ? `Drafts created: ${task.draftsCreated}` + (task.duplicatesFound ? ` (skipped ${task.duplicatesFound} duplicates)` : '')
      : null,
    status === 'completed' && task.summary
      ? `Summary: ${task.summary.slice(0, 200)}`
      : null,
    task.errorMessage ? `Error: ${task.errorMessage.slice(0, 200)}` : null,
  ].filter(Boolean);

  return {
    title,
    body: bodyLines.join('\n'),
    status,
    taskId: task.id,
    mode: task.mode,
  };
}

// ─── 1. In-app notification + appended chat message ──────────────────────────

async function sendInAppNotification(task, payload) {
  // Append the result as an assistant message in the linked conversation, so it
  // shows up in chat history naturally next time Alex opens the chat. This is
  // the primary way the result is delivered — Notification rows are secondary.
  if (task.conversationId && db.AIConversation) {
    try {
      const conv = await db.AIConversation.findByPk(task.conversationId);
      if (conv) {
        const prior = conv.messages || [];
        const reply = formatChatReply(task, payload);
        await conv.update({
          messages: [
            ...prior,
            { role: 'assistant', content: reply, createdAt: new Date().toISOString() },
          ],
          lastMessageAt: new Date(),
        });
      }
    } catch (e) {
      logger.warn(`[research] could not append result to conversation ${task.conversationId}: ${e.message}`);
    }
  }

  if (!db.Notification) return;
  await db.Notification.create({
    userId: task.userId,
    type: 'system',
    title: payload.title,
    message: payload.body,
    data: {
      kind: 'research',
      taskId: task.id,
      mode: task.mode,
      status: payload.status,
    },
    link: `/ai/research/${task.id}`,
    isRead: false,
  });
}

function formatChatReply(task, payload) {
  if (payload.status !== 'completed') {
    // Failed or cancelled: surface what happened, no draft list.
    return [
      payload.title,
      ``,
      task.errorMessage ? `> ${task.errorMessage}` : `> No further detail available.`,
      ``,
      `Manage tasks: /ai/research/${task.id}`,
    ].join('\n');
  }

  const lines = [];
  lines.push(payload.title);
  lines.push('');
  if (task.summary) lines.push(task.summary);
  lines.push('');
  lines.push(
    `**Drafts created:** ${task.draftsCreated || 0}` +
    (task.duplicatesFound ? ` (skipped ${task.duplicatesFound} duplicates)` : '')
  );

  // Render every created finding inline — company info + draft email body.
  const findings = Array.isArray(task.findings) ? task.findings : [];
  const created = findings.filter(f => f && f.draftId);
  if (created.length > 0) {
    lines.push('');
    lines.push('---');
    created.forEach((f, idx) => {
      const num = idx + 1;
      const country = f.country ? ` — ${f.country}` : '';
      lines.push('');
      lines.push(`### ${num}. ${f.companyName}${country}`);
      if (f.contactName || f.contactPerson) lines.push(`**Contact:** ${f.contactName || f.contactPerson}`);
      if (f.email) lines.push(`**Email:** ${f.email}`);
      if (f.phone) lines.push(`**Phone:** ${f.phone}`);
      if (f.sourceUrl) lines.push(`**Source:** ${f.sourceUrl}`);
      if (f.evidence) lines.push(`**Why:** ${f.evidence}`);
      if (f.draftEmail && f.draftEmail.subject && f.draftEmail.bodyText) {
        lines.push('');
        lines.push(`**Draft email — Subject:** ${f.draftEmail.subject}`);
        lines.push('');
        lines.push('```');
        lines.push(f.draftEmail.bodyText);
        lines.push('```');
      } else {
        lines.push('');
        lines.push('_(No draft email generated for this lead — generate one manually before outreach.)_');
      }
    });
  }

  // Skipped findings (no draft created) — show as a short summary so Alex knows
  // why the AI didn't promote them.
  const skipped = findings.filter(f => f && !f.draftId);
  if (skipped.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`**Skipped (${skipped.length}):**`);
    for (const f of skipped) {
      const reason = f.dedupedAgainst
        ? `already in ERP (${f.dedupedAgainst.type})`
        : f.skipped || 'no reason given';
      lines.push(`- ${f.companyName || '(unnamed)'} — ${reason}`);
    }
  }

  lines.push('');
  lines.push(`Manage drafts: /ai/research/${task.id}`);
  return lines.join('\n');
}

// ─── 2. Expo push ────────────────────────────────────────────────────────────

async function sendPushNotification(task, payload) {
  if (!db.ExpoPushToken) return;
  const tokens = await db.ExpoPushToken.findAll({
    where: { userId: task.userId, isActive: true },
    attributes: ['token'],
  });
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: { taskId: task.id, status: payload.status, mode: task.mode },
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

async function sendEmailSummary(task, payload) {
  if (!process.env.RESEND_API_KEY) return;
  const user = await db.User.findByPk(task.userId, { attributes: ['email', 'name'] });
  if (!user || !user.email) return;

  const fromAddr = process.env.RESEND_FROM_ADDRESS || 'Sovern ERP <noreply@sovernhouse.co>';
  const html = buildEmailHtml(task, payload);

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

function buildEmailHtml(task, payload) {
  const briefHtml = (task.brief || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c]));
  const summaryHtml = (task.summary || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c]));
  const findings = Array.isArray(task.findings) ? task.findings : [];
  const created = findings.filter(f => f && f.draftId);

  const findingsHtml = created.length > 0
    ? `<ul>${created.slice(0, 20).map(f => `<li><strong>${(f.companyName || '').replace(/[<>]/g, '')}</strong>${f.country ? ` — ${f.country}` : ''}${f.sourceUrl ? ` <a href="${f.sourceUrl}">source</a>` : ''}</li>`).join('')}</ul>`
    : '<p><em>No drafts created.</em></p>';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">${payload.title}</h2>
      <p><strong>Mode:</strong> ${task.mode}</p>
      <p><strong>Brief:</strong></p>
      <blockquote style="border-left: 3px solid #ccc; padding-left: 12px; color: #555;">${briefHtml}</blockquote>
      ${summaryHtml ? `<p><strong>Summary:</strong></p><p>${summaryHtml}</p>` : ''}
      <p><strong>Drafts created:</strong> ${task.draftsCreated || 0}${task.duplicatesFound ? ` (skipped ${task.duplicatesFound} duplicates)` : ''}</p>
      ${findingsHtml}
      ${task.errorMessage ? `<p style="color: #b00;"><strong>Error:</strong> ${task.errorMessage}</p>` : ''}
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Sovern ERP research assistant. Drafts are unverified — review before any outreach.</p>
    </div>
  `;
}

module.exports = { fireResearchNotifications };
