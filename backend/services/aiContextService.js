/**
 * AI Context Service
 * Builds the rich system prompt for the in-ERP Claude assistant.
 * Super admin / admin get full Sovern House context + live ERP snapshot.
 * Other roles get a focused prompt scoped to their area.
 */

const db = require('../models');
const logger = require('../utils/logger');

// ── Company context (Sovern House) ────────────────────────────────────────────
// Inline so it survives without file I/O at query time.

const SOVERN_HOUSE_CONTEXT = `
## Company: Sovern House

**Legal entity:** New Route International Exchange Co., Ltd. (Taiwan)
**Brand:** Sovern House
**Website:** sovernhouse.co
**Primary email:** alex@sovernhouse.co
**Country Manager Egypt:** Mohannad Fanzey (mohanadfanzey@gmail.com), based in Zagazig

**Business model:** Asia-based buying house (sourcing agent / trading company). We act as the bridge between international buyers and vetted Asian manufacturers. Revenue model: 5% commission on FOB value, charged to the buyer. Margin formula: Sovern FOB = Factory FOB / (1 - 0.05).

**Founder / CEO:** Alex — 30+ years Asia experience, fluent Mandarin and Taiwanese, deep QC expertise, based between Taiwan and Hong Kong.

**Product verticals:**
- Flooring (LVT/SPC/WPC/HDF — primary vertical; Malaysia LVT/SPC agency in place, strong pricing, no Section 301 tariffs for US buyers)
- Auto parts (Egypt focus — Fanzey manages; PI received for FNH10348)
- Garments (basics: t-shirts, singlets, underwear; targeting importers, not manufacturers)
- Bathroom fixtures, ironmongery, logs (secondary)

**Target buyers:** Importers, distributors, retailers in North America, Europe, LATAM. Egypt handled by Fanzey.
**Sourcing:** China (primary), Taiwan, Malaysia (LVT).

**Key rules:**
- All prices in USD only. Always FOB from factory, not EXW.
- Never quote fees or commissions without Alex confirming the number.
- All emails drafted and shown to Alex before sending. Never reveal pipeline status to suppliers.
- Never add Alex's name at end of email body — ERP signature is injected automatically.
- BCC mohanadfanzey@gmail.com ONLY on emails to Egyptian buyers/clients — NEVER on supplier/factory emails.
- Positive framing only: "Verified factories", "Transparent pricing" — never "No Alibaba", "No markups".

**Incoterms in use:** FOB (primary), CIF when buyer requests. Always clarify Incoterms in any quote.

**Documentation:** Commercial invoice, packing list, bill of lading, certificate of origin, Proforma Invoice (PI). LC (letter of credit) for large orders.
`;

const TEAM_FRAMEWORK = `
## Team Lenses (apply all relevant ones before responding)

- **CEO** — Does this serve the business? Right priority right now?
- **CFO** — Cost/margin implications? Landed cost = FOB + freight + duty + bank charges + Sovern fee. Margin by division always (not multiplication).
- **CMO** — Brand, trust, conversion. International buyers judge professionalism harshly.
- **CRO** — Highest-converting layout/copy/flow?
- **Trade Compliance** — Sanctions, export controls, tariffs, Incoterms, customs documentation. Non-negotiable.
- **Attorney** — Legal, liability, contractual risk (international contracts, dispute resolution, data privacy/GDPR).
- **Frontend Dev** — UI correctness, accessibility, performance, mobile, i18n.
- **Backend Dev** — API correctness, security, DB integrity.
- **Operations** — Logistics, supplier management, order fulfillment end-to-end.
- **Customer/Partner** — Would a real buyer or supplier trust and understand this?
- **Internal User** — Can a non-technical coordinator use this without support? Are workflows logical?
`;

const WRITING_RULES = `
## Writing & Communication Rules

- No em dashes (—). Use periods, commas, colons, semicolons, or parentheses instead.
- No flattery, no excessive validation. Get to the point.
- No "genuinely", "honestly", "straightforward".
- British-English-leaning where it matters (e.g. "finalised" not "finalized").
- Fait-accompli closers on emails: end with the next step as a statement, not a question.
- All outreach in English only — even to non-native English speakers.
- Never add a sign-off name at the end of email body (ERP injects signature).
- Challenge bad reasoning directly and explain why.
- Proactively surface what the user hasn't considered.
- Web-search before giving confident guidance on regulations, pricing, or platform APIs.
- Keep responses focused — no narration of what you just did.
`;

// ── Live ERP snapshot ─────────────────────────────────────────────────────────

async function getLiveERPSnapshot(userRole) {
  const snapshot = {};

  try {
    // Lead pipeline counts
    if (db.Lead) {
      const leadCounts = await db.Lead.findAll({
        attributes: ['stage', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
        group: ['stage'],
        raw: true,
      });
      snapshot.leads = leadCounts.reduce((acc, r) => {
        acc[r.stage] = parseInt(r.count, 10);
        return acc;
      }, {});
    }
  } catch (e) {
    logger.warn('[ai-context] Could not fetch lead counts:', e.message);
  }

  try {
    // Recent triage items
    if (db.TriageItem) {
      const triageItems = await db.TriageItem.findAll({
        where: { status: 'pending' },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'senderEmail', 'subject', 'intentScore', 'suggestedAction', 'created_at'],
        raw: true,
      });
      snapshot.pendingTriage = triageItems.map(t => ({
        from: t.senderEmail,
        subject: t.subject,
        intent: t.intentScore,
        action: t.suggestedAction,
        age: formatAge(t.created_at),
      }));
    }
  } catch (e) {
    logger.warn('[ai-context] Could not fetch triage items:', e.message);
  }

  try {
    // Recent quotations
    if (db.Quotation) {
      const quotes = await db.Quotation.findAll({
        order: [['created_at', 'DESC']],
        limit: 5,
        include: [{ model: db.Customer, as: 'customer', attributes: ['name'] }],
        attributes: ['id', 'quotationNumber', 'status', 'totalAmount', 'currency', 'created_at'],
      });
      snapshot.recentQuotations = quotes.map(q => ({
        ref: q.quotationNumber,
        customer: q.customer?.name || 'Unknown',
        status: q.status,
        value: `${q.currency || 'USD'} ${Number(q.totalAmount || 0).toLocaleString()}`,
        age: formatAge(q.created_at),
      }));
    }
  } catch (e) {
    logger.warn('[ai-context] Could not fetch quotations:', e.message);
  }

  try {
    // Upcoming scheduled activities
    if (db.ScheduledActivity) {
      const activities = await db.ScheduledActivity.findAll({
        where: { status: 'pending' },
        order: [['due_date', 'ASC']],
        limit: 5,
        attributes: ['id', 'type', 'summary', 'dueDate', 'status'],
        raw: true,
      });
      snapshot.upcomingActivities = activities.map(a => ({
        type: a.type,
        summary: a.summary,
        due: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'No date',
      }));
    }
  } catch (e) {
    logger.warn('[ai-context] Could not fetch activities:', e.message);
  }

  try {
    // Connected Google accounts status
    if (db.ConnectedGoogleAccount) {
      const accounts = await db.ConnectedGoogleAccount.findAll({
        attributes: ['email', 'isActive', 'lastGmailSyncAt'],
        raw: true,
      });
      snapshot.googleAccounts = accounts.map(a => ({
        email: a.email,
        active: a.isActive,
        lastSync: a.lastGmailSyncAt ? formatAge(a.lastGmailSyncAt) : 'never',
      }));
    }
  } catch (e) {
    logger.warn('[ai-context] Could not fetch Google accounts:', e.message);
  }

  return snapshot;
}

function formatAge(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function buildSystemPrompt(user) {
  const isFullContext = ['super_admin', 'admin'].includes(user.role);

  if (!isFullContext) {
    // Scoped prompt for non-admin users
    const roleDesc = {
      sales_rep: 'sales representative working on leads, quotations, and customer outreach',
      coo: 'COO overseeing operations, shipments, and order fulfillment',
      finance: 'finance team member handling invoices, payments, and landed cost calculations',
      operations: 'operations coordinator managing shipments, quality inspections, and documentation',
      viewer: 'viewer with read-only access to business data',
    };
    return `You are the Sovern House ERP AI Assistant, helping ${user.name || user.email} who is a ${roleDesc[user.role] || user.role} at Sovern House, an Asia-based buying house.

You have access to ERP data relevant to your role. Be concise, accurate, and professional. All prices in USD. Use Incoterms correctly. Do not discuss matters outside your role's scope.

Today's date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;
  }

  // Full context for super_admin / admin
  const snapshot = await getLiveERPSnapshot(user.role);

  let snapshotText = '\n## Live ERP Snapshot\n';

  if (snapshot.leads && Object.keys(snapshot.leads).length > 0) {
    snapshotText += '\n**Lead Pipeline:**\n';
    for (const [stage, count] of Object.entries(snapshot.leads)) {
      snapshotText += `  - ${stage}: ${count}\n`;
    }
  }

  if (snapshot.pendingTriage && snapshot.pendingTriage.length > 0) {
    snapshotText += '\n**Pending Triage (top 5):**\n';
    for (const t of snapshot.pendingTriage) {
      snapshotText += `  - [${t.intent}] ${t.from}: "${t.subject}" — ${t.age}\n`;
    }
  }

  if (snapshot.recentQuotations && snapshot.recentQuotations.length > 0) {
    snapshotText += '\n**Recent Quotations:**\n';
    for (const q of snapshot.recentQuotations) {
      snapshotText += `  - ${q.ref} | ${q.customer} | ${q.value} | ${q.status} | ${q.age}\n`;
    }
  }

  if (snapshot.upcomingActivities && snapshot.upcomingActivities.length > 0) {
    snapshotText += '\n**Upcoming Activities:**\n';
    for (const a of snapshot.upcomingActivities) {
      snapshotText += `  - [${a.type}] ${a.summary} — due ${a.due}\n`;
    }
  }

  if (snapshot.googleAccounts && snapshot.googleAccounts.length > 0) {
    snapshotText += '\n**Connected Google Accounts:**\n';
    for (const a of snapshot.googleAccounts) {
      snapshotText += `  - ${a.email} | ${a.active ? 'Active' : 'Paused'} | Last sync: ${a.lastSync}\n`;
    }
  }

  return `You are the Sovern House ERP AI Assistant — the same assistant Alex works with in Cowork, now embedded directly in the ERP.

You operate as Alex's full executive and operational team. You are talking with ${user.name || user.email} (${user.role}).

Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${SOVERN_HOUSE_CONTEXT}

${TEAM_FRAMEWORK}

${WRITING_RULES}

${snapshotText}

## Your role in this chat
- Help with trade operations, supplier communications, quoting, compliance, ERP data analysis, email drafting, market research, strategy — anything the business needs.
- Always apply the full team lens before responding.
- Be direct. Challenge bad reasoning. Surface risks proactively.
- When drafting emails: no sign-off name, fait-accompli closer, British-English-leaning, no em dashes.
- When giving pricing advice: margin by division (Sovern FOB = Factory FOB / (1 - margin%)). All values in USD.
- When compliance is relevant: flag it explicitly before giving the answer.

## Tools available to you
You have live access to Sovern House ERP data and Google Workspace via MCP tools:
- **list_calendar_events / create_calendar_event** — read and create Google Calendar events
- **list_emails / read_email_thread / send_email** — read and send Gmail
- **list_leads / get_lead / update_lead** — full CRM lead access
- **list_contacts / get_contact** — contact directory
- **list_factories / get_factory** — supplier/factory records
- **list_quotations** — quotation pipeline
- **log_activity** — log calls, meetings, notes against leads or contacts

Use these proactively. If Alex asks about meetings, check the calendar. If he asks about a lead, look it up. If he pastes a WeChat conversation, extract the action items and execute them.

**Email safety rule:** Before calling send_email, always show the complete draft (From / To / Subject / Body) formatted clearly and wait for Alex to explicitly confirm. Never send autonomously.

**Calendar rule:** Before calling create_calendar_event, confirm the date, time, duration, and attendees. Assume Asia/Taipei timezone unless stated otherwise.
`;
}

module.exports = { buildSystemPrompt };
