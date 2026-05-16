#!/usr/bin/env node
'use strict';
/**
 * Sovern ERP MCP Tool Server
 *
 * Exposes ERP data and Google Workspace actions to claude -p via the MCP
 * stdio transport (JSON-RPC 2.0, newline-delimited).
 *
 * Started by claude -p as a subprocess via --mcp-config.
 * Reads ERP_USER_ID from the environment to scope all Google API calls and
 * DB lookups to the correct user.
 *
 * stdout  → MCP JSON-RPC messages only
 * stderr  → diagnostic output (never read by claude)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Phase 4.11: lazy-load googleapis. The eager require hangs inside
// jest worker subprocesses on Linux (some interaction between
// google-gax fetch setup and jest's fork stdio). It is also slow
// (~600ms) — defer until the first Google-touching tool actually
// runs. Tools that need it use `getGoogle()` instead.
let _googleClient = null;
function getGoogle() {
  if (_googleClient) return _googleClient;
  _googleClient = require('googleapis').google;
  return _googleClient;
}
const { v4: uuidv4 } = require('uuid');

// Phase 4.9.1: shared slug helper — matches the convention in
// services/migrate491TaxonomyAndBrand.js so AI-created rows and
// migration-created rows are indistinguishable.
function slugifyMcp(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

const USER_ID = process.env.ERP_USER_ID;

// Lazy-load DB and Google auth — loading all 93 models takes ~4s and would
// block the MCP initialize handshake if done at startup.
let _db = null;
let _getAuthClientForAccount = null;
function getDb() {
  if (!_db) _db = require('../models');
  return _db;
}
function getGoogleAccountController() {
  if (!_getAuthClientForAccount) {
    _getAuthClientForAccount = require('../controllers/googleAccountController').getAuthClientForAccount;
  }
  return _getAuthClientForAccount;
}

// ── Generic ERP query helpers ────────────────────────────────────────────────
// Models the AI must NEVER read (auth/secret data). Anything else loaded by
// Sequelize is queryable via erp_query.
const ENTITY_DENYLIST = new Set([
  'User', 'UserSession', 'PasswordResetToken', 'ConnectedGoogleAccount',
  'AuditLog', 'ApiKey', 'Webhook',
]);

// Fields stripped from every returned row regardless of model. Defense in
// depth in case a denylisted model name slips through (e.g. via include).
const SENSITIVE_FIELD_RE = /^(password|passwordHash|salt|token|accessToken|refreshToken|secret|apiKey|webhookSecret)$/i;

function listQueryableEntities() {
  const db = getDb();
  return Object.keys(db)
    .filter(k => k !== 'sequelize' && k !== 'Sequelize' && db[k] && db[k].rawAttributes)
    .filter(k => !ENTITY_DENYLIST.has(k))
    .sort();
}

function getEntityModel(name) {
  if (ENTITY_DENYLIST.has(name)) {
    throw new Error(`Entity "${name}" is not readable via erp_query.`);
  }
  const db = getDb();
  const Model = db[name];
  if (!Model || !Model.rawAttributes) {
    throw new Error(`Unknown entity "${name}". Use erp_list_entities to see what's available.`);
  }
  return Model;
}

function safeAttributesFor(Model) {
  return Object.keys(Model.rawAttributes).filter(k => !SENSITIVE_FIELD_RE.test(k));
}

function stringFieldsFor(Model) {
  return Object.entries(Model.rawAttributes)
    .filter(([k, attr]) => {
      if (SENSITIVE_FIELD_RE.test(k)) return false;
      const t = attr.type && attr.type.constructor && attr.type.constructor.name;
      return t === 'STRING' || t === 'TEXT' || t === 'CITEXT';
    })
    .map(([k]) => k);
}

// ── MCP stdio transport ───────────────────────────────────────────────────────

let _buf = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  _buf += chunk;
  let idx;
  while ((idx = _buf.indexOf('\n')) !== -1) {
    const line = _buf.slice(0, idx).trim();
    _buf = _buf.slice(idx + 1);
    if (line) handleLine(line);
  }
});
process.stdin.on('end', () => process.exit(0));

function mcpSend(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function handleLine(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      mcpSend({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'sovern-erp', version: '1.0.0' },
      }});
    } else if (method === 'notifications/initialized') {
      // Notification — no response required
    } else if (method === 'ping') {
      mcpSend({ jsonrpc: '2.0', id, result: {} });
    } else if (method === 'tools/list') {
      mcpSend({ jsonrpc: '2.0', id, result: { tools: TOOL_DEFS } });
    } else if (method === 'tools/call') {
      // Phase 4.11: when MCP_FORCE_SYNC=true (test harness only), wait
      // for the startup sync promise before dispatching so PRAGMA-backed
      // tools see populated tables. No-op in production.
      if (global.__MCP_READY) await global.__MCP_READY;
      const result = await callTool(params.name, params.arguments || {});
      // A tool can return raw MCP content (e.g. image type for vision) by
      // returning `{ __mcpContent: [{type, data, mimeType}, ...] }`. Anything
      // else is wrapped as a single text content item.
      let content;
      if (result && typeof result === 'object' && Array.isArray(result.__mcpContent)) {
        content = result.__mcpContent;
      } else {
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        content = [{ type: 'text', text }];
      }
      mcpSend({ jsonrpc: '2.0', id, result: { content } });
    } else if (id !== undefined) {
      mcpSend({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
    }
  } catch (err) {
    process.stderr.write(`[erp-mcp] Error handling ${method}: ${err.message}\n`);
    if (id !== undefined) {
      mcpSend({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
  }
}

// ── Phase 4.9.3b: Drive account routing ──────────────────────────────────────
//
// Two Google accounts are connected: alex@sovernhouse.co (SH brand
// context) and alexflorway@gmail.com (FW brand context — HanHua /
// FlorWay / IronLite). Drive tools accept an accountKey param
// ('sh' or 'fw'); resolveDriveAccount(brandCode) does the brand →
// accountKey mapping so callers operating in a brand context don't
// have to remember it.

const DRIVE_ACCOUNT_EMAILS = {
  sh: 'alex@sovernhouse.co',
  fw: 'alexflorway@gmail.com',
};

function resolveDriveAccount(brandCode) {
  if (!brandCode) return 'sh';
  return String(brandCode).toUpperCase() === 'FW' ? 'fw' : 'sh';
}

function emailForAccountKey(accountKey) {
  const key = String(accountKey || 'sh').toLowerCase();
  return DRIVE_ACCOUNT_EMAILS[key] || DRIVE_ACCOUNT_EMAILS.sh;
}

// ── Google auth helper ────────────────────────────────────────────────────────

async function getGoogleAuth(targetEmail) {
  if (!USER_ID) throw new Error('ERP_USER_ID not set. cannot access Google services');
  // Phase 4.7, C-1 gap-closer: when targetEmail is supplied (e.g. the AI wants
  // to send from alexflorway@gmail.com specifically because the conversation
  // is in an FW context), look up that account explicitly. Falls back to the
  // first active account when no targetEmail is given so existing behavior is
  // unchanged for callers that don't care which account is used.
  const where = { connectedByUserId: USER_ID, isActive: true };
  if (targetEmail) where.email = String(targetEmail).toLowerCase();
  const account = await getDb().ConnectedGoogleAccount.findOne({ where });
  if (!account) {
    if (targetEmail) {
      throw new Error(`No active Google account matches "${targetEmail}". Available accounts can be listed via /api/google/accounts.`);
    }
    throw new Error('No active Google account connected. Go to ERP Settings > Connected Accounts to connect your Google account.');
  }
  const auth = await getGoogleAccountController()(account);
  return { auth, account };
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {

    // ── Generic ERP query ───────────────────────────────────────────────────
    // These three tools let the AI read ANY ERP entity (within a denylist of
    // auth/secret models) without us hand-wrapping each one.

    case 'erp_list_entities': {
      const names = listQueryableEntities();
      return { entities: names, count: names.length };
    }

    case 'erp_describe_entity': {
      // Reads Model.rawAttributes at call time. CAVEAT: the MCP server
      // is a subprocess loaded once at startup; a code-side model
      // change (e.g. adding a new column to a model file) only takes
      // effect after the subprocess restarts. If results look stale,
      // use erp_describe_entity_db for PRAGMA-based ground truth.
      const Model = getEntityModel(args.entity);
      const attrs = safeAttributesFor(Model);
      const searchable = stringFieldsFor(Model);
      const associations = Object.entries(Model.associations || {}).map(([k, a]) => ({
        as: k, type: a.associationType, target: a.target.name,
      }));
      return {
        entity: args.entity,
        tableName: Model.tableName,
        attributes: attrs,
        searchableFields: searchable,
        associations,
        _note: 'Source: in-process Sequelize model registry. If you suspect staleness (e.g. a new column should exist but is missing), call erp_describe_entity_db to query the live DB via PRAGMA.',
      };
    }

    case 'erp_describe_entity_db': {
      // Phase 4.9.3 Part F: PRAGMA-based ground truth. Reads the live
      // SQLite schema directly, bypassing the in-process Sequelize
      // model registry. Use this to confirm DB state when the
      // Sequelize-side view (erp_describe_entity) looks ambiguous,
      // OR to surface DB columns that the model definition forgot,
      // OR to surface model attributes that didn't make it to the DB.
      const Model = getEntityModel(args.entity);
      const tableName = Model.tableName || args.entity;
      const [cols] = await getDb().sequelize.query(`PRAGMA table_info(${tableName})`);
      const [idxs] = await getDb().sequelize.query(`PRAGMA index_list(${tableName})`);
      const indexes = [];
      for (const idx of idxs) {
        const [details] = await getDb().sequelize.query(`PRAGMA index_info(${idx.name})`);
        indexes.push({
          name: idx.name,
          unique: !!idx.unique,
          columns: details.map(d => d.name),
        });
      }
      // Mismatch detection — for caller convenience.
      const modelAttrFields = new Set(Object.values(Model.rawAttributes).map(a => a.field || a.fieldName));
      const dbColNames = new Set(cols.map(c => c.name));
      const inModelMissingFromDb = [...modelAttrFields].filter(f => !dbColNames.has(f));
      const inDbMissingFromModel = [...dbColNames].filter(c => !modelAttrFields.has(c));
      return {
        entity: args.entity,
        tableName,
        columns: cols.map(c => ({
          cid: c.cid,
          name: c.name,
          type: c.type,
          notnull: !!c.notnull,
          defaultValue: c.dflt_value,
          primaryKey: !!c.pk,
        })),
        indexes,
        mismatch: {
          modelAttributesMissingFromDb: inModelMissingFromDb,
          dbColumnsMissingFromModel: inDbMissingFromModel,
        },
      };
    }

    // ── Cross-conversation memory ───────────────────────────────────────────
    // Lets the assistant recall what was said in past conversations with this
    // same user. The current thread's history is already injected by the
    // controller; these tools cover everything older.

    case 'list_recent_conversations': {
      if (!USER_ID) return 'ERP_USER_ID not set.';
      const convos = await getDb().AIConversation.findAll({
        where: { userId: USER_ID },
        order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
        limit: Math.min(args.limit || 20, 50),
        attributes: ['id', 'title', 'lastMessageAt', 'createdAt', 'messages'],
      });
      return convos.map(c => {
        const msgs = c.messages || [];
        const lastUser = [...msgs].reverse().find(m => m.role === 'user');
        return {
          id: c.id,
          title: c.title,
          messageCount: msgs.length,
          lastMessageAt: c.lastMessageAt,
          lastUserMessagePreview: lastUser ? lastUser.content.slice(0, 200) : null,
        };
      });
    }

    case 'read_conversation': {
      if (!USER_ID) return 'ERP_USER_ID not set.';
      const convo = await getDb().AIConversation.findOne({
        where: { id: args.id, userId: USER_ID },
      });
      if (!convo) return `Conversation ${args.id} not found.`;
      return {
        id: convo.id,
        title: convo.title,
        lastMessageAt: convo.lastMessageAt,
        messages: convo.messages || [],
      };
    }

    case 'search_conversations': {
      if (!USER_ID) return 'ERP_USER_ID not set.';
      if (!args.query) return 'query is required.';
      const all = await getDb().AIConversation.findAll({
        where: { userId: USER_ID },
        order: [['lastMessageAt', 'DESC']],
        attributes: ['id', 'title', 'lastMessageAt', 'messages'],
      });
      const q = args.query.toLowerCase();
      const matches = [];
      for (const convo of all) {
        const msgs = convo.messages || [];
        const titleHit = (convo.title || '').toLowerCase().includes(q);
        const hits = msgs.filter(m => (m.content || '').toLowerCase().includes(q));
        if (titleHit || hits.length) {
          matches.push({
            id: convo.id,
            title: convo.title,
            lastMessageAt: convo.lastMessageAt,
            matchCount: hits.length + (titleHit ? 1 : 0),
            // First 2 matching message snippets so the AI can decide whether
            // to read_conversation for the full context.
            snippets: hits.slice(0, 2).map(m => ({
              role: m.role,
              excerpt: (m.content || '').slice(
                Math.max(0, (m.content || '').toLowerCase().indexOf(q) - 60),
                (m.content || '').toLowerCase().indexOf(q) + 200
              ),
            })),
          });
        }
        if (matches.length >= (args.limit || 10)) break;
      }
      return matches.length ? matches : 'No matches across past conversations.';
    }

    case 'erp_query': {
      const { Op } = require('sequelize');
      const Model = getEntityModel(args.entity);
      const attrs = safeAttributesFor(Model);
      const where = {};

      // Equality filters: { fieldName: value }
      if (args.where && typeof args.where === 'object') {
        for (const [k, v] of Object.entries(args.where)) {
          if (attrs.includes(k)) where[k] = v;
        }
      }

      // Free-text search across STRING/TEXT fields
      if (args.search) {
        const fields = stringFieldsFor(Model);
        if (fields.length) {
          where[Op.or] = fields.map(f => ({ [f]: { [Op.like]: `%${args.search}%` } }));
        }
      }

      const rows = await Model.findAll({
        where,
        attributes: attrs,
        limit: Math.min(args.limit || 20, 100),
        offset: args.offset || 0,
        order: args.order_by && attrs.includes(args.order_by)
          ? [[args.order_by, args.order_dir === 'DESC' ? 'DESC' : 'ASC']]
          : undefined,
      });
      const total = await Model.count({ where });
      return {
        entity: args.entity,
        count: rows.length,
        total,
        rows: rows.map(r => r.toJSON()),
      };
    }

    // ── Google Calendar ─────────────────────────────────────────────────────

    case 'list_calendar_events': {
      const { auth } = await getGoogleAuth();
      const cal = getGoogle().calendar({ version: 'v3', auth });
      const timeMin = args.days_ago
        ? new Date(Date.now() - args.days_ago * 86400000).toISOString()
        : new Date().toISOString();
      const timeMax = new Date(Date.now() + (args.days_ahead || 14) * 86400000).toISOString();

      const resp = await cal.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults: Math.min(args.limit || 20, 50),
        singleEvents: true,
        orderBy: 'startTime',
        q: args.query || undefined,
      });

      const events = (resp.data.items || []).map(e => ({
        id: e.id,
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location || null,
        description: e.description ? e.description.slice(0, 300) : null,
        attendees: (e.attendees || []).map(a => a.email),
        meetLink: e.hangoutLink || null,
        status: e.status,
      }));

      return events.length ? events : 'No events found in the requested time range.';
    }

    case 'create_calendar_event': {
      const { auth } = await getGoogleAuth();
      const cal = getGoogle().calendar({ version: 'v3', auth });

      // Default duration: 45 min if end_time not given (and not all-day).
      let endTime = args.end_time;
      if (!args.all_day && !endTime && args.start_time) {
        const start = new Date(args.start_time);
        if (!isNaN(start.getTime())) {
          endTime = new Date(start.getTime() + 45 * 60 * 1000).toISOString();
        }
      }

      const resource = {
        summary: args.title,
        description: args.description || '',
        location: args.location || '',
        start: args.all_day
          ? { date: args.start_date }
          : { dateTime: args.start_time, timeZone: args.timezone || 'Asia/Taipei' },
        end: args.all_day
          ? { date: args.end_date || args.start_date }
          : { dateTime: endTime, timeZone: args.timezone || 'Asia/Taipei' },
        attendees: (args.attendees || []).map(email => ({ email })),
      };

      // Custom reminders: pass minutes-before-event as an array, e.g. [30, 15]
      // → two popup reminders, 30 and 15 min before. Falls back to calendar
      // defaults if the array is empty/missing.
      if (Array.isArray(args.reminders_minutes) && args.reminders_minutes.length) {
        resource.reminders = {
          useDefault: false,
          overrides: args.reminders_minutes
            .filter(m => Number.isFinite(m) && m >= 0 && m <= 40320) // <= 4 weeks
            .map(m => ({ method: 'popup', minutes: Math.round(m) })),
        };
      }
      if (args.add_meet_link) {
        resource.conferenceData = { createRequest: { requestId: `erp-${Date.now()}` } };
      }

      const resp = await cal.events.insert({
        calendarId: 'primary',
        resource,
        conferenceDataVersion: args.add_meet_link ? 1 : 0,
      });

      return {
        success: true,
        eventId: resp.data.id,
        title: resp.data.summary,
        start: resp.data.start?.dateTime || resp.data.start?.date,
        htmlLink: resp.data.htmlLink,
        meetLink: resp.data.hangoutLink || null,
      };
    }

    case 'delete_calendar_event': {
      const { auth } = await getGoogleAuth();
      const cal = getGoogle().calendar({ version: 'v3', auth });
      await cal.events.delete({
        calendarId: 'primary',
        eventId: args.event_id,
        sendUpdates: args.notify_attendees ? 'all' : 'none',
      });
      return { success: true, deletedEventId: args.event_id };
    }

    // ── Gmail ───────────────────────────────────────────────────────────────

    case 'list_emails': {
      const { auth } = await getGoogleAuth();
      const gmail = getGoogle().gmail({ version: 'v1', auth });

      const resp = await gmail.users.messages.list({
        userId: 'me',
        maxResults: Math.min(args.limit || 10, 25),
        q: args.query || 'is:inbox',
      });

      if (!resp.data.messages?.length) return 'No emails found matching the query.';

      const emails = await Promise.all(
        resp.data.messages.map(async m => {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: m.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });
          const headers = Object.fromEntries(
            (msg.data.payload?.headers || []).map(h => [h.name, h.value])
          );
          return {
            id: m.id,
            threadId: m.threadId,
            from: headers.From,
            to: headers.To,
            subject: headers.Subject,
            date: headers.Date,
            snippet: msg.data.snippet,
          };
        })
      );
      return emails;
    }

    case 'read_email_thread': {
      const { auth } = await getGoogleAuth();
      const gmail = getGoogle().gmail({ version: 'v1', auth });

      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: args.thread_id,
        format: 'full',
      });

      const messages = (thread.data.messages || []).map(msg => {
        const headers = Object.fromEntries(
          (msg.payload?.headers || []).map(h => [h.name, h.value])
        );
        let body = '';
        const extractBody = part => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString('utf8');
          }
          (part.parts || []).forEach(extractBody);
        };
        extractBody(msg.payload || {});

        return {
          id: msg.id,
          from: headers.From,
          to: headers.To,
          subject: headers.Subject,
          date: headers.Date,
          body: body.slice(0, 3000),
        };
      });

      return messages.length ? messages : 'Thread not found or empty.';
    }

    case 'send_email': {
      const requester = await getCurrentUserOrThrow();
      // Phase 4.7, C-1: route via the brand-appropriate account when the
      // model passes from_email. Phase 4.12: also verify the resolved
      // account is one the AI is permitted to use — refuse to send via
      // an account whose brandCode is outside the requester's accessible
      // brands (mirrors triageController.brand_account_mismatch_block).
      const { auth, account } = await getGoogleAuth(args.from_email);
      const brandScope = await brandScopeForMcp(requester);
      if (account.brandCode && !brandScope.accessibleBrands.includes(account.brandCode)) {
        await auditAiWrite('send_email_blocked', 'ConnectedGoogleAccount', account.id, {
          reason: 'brand_account_mismatch',
          accountEmail: account.email,
          accountBrand: account.brandCode,
          requesterBrands: brandScope.accessibleBrands,
          attemptedTo: args.to,
          attemptedSubject: args.subject,
        }, requester.id);
        return formatMcpWriteError({
          ok: false,
          code: 'brand_not_writable',
          message: `Cannot send from ${account.email}: that account is tied to brand ${account.brandCode}, which is outside your accessible brands.`,
        });
      }
      const gmail = getGoogle().gmail({ version: 'v1', auth });

      const to = Array.isArray(args.to) ? args.to.join(', ') : args.to;
      const headers = [
        `From: ${account.displayName} <${account.email}>`,
        `To: ${to}`,
        `Subject: ${args.subject}`,
        'Content-Type: text/plain; charset=utf-8',
      ].join('\r\n');

      const raw = Buffer.from(`${headers}\r\n\r\n${args.body}`).toString('base64url');

      const resp = await gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw,
          threadId: args.reply_to_thread_id || undefined,
        },
      });

      await auditAiWrite('send_email', 'ConnectedGoogleAccount', account.id, {
        from: account.email,
        brandCode: account.brandCode || null,
        to,
        subject: args.subject,
        threadId: resp.data.threadId,
        messageId: resp.data.id,
      }, requester.id);

      return {
        success: true,
        messageId: resp.data.id,
        threadId: resp.data.threadId,
        from: account.email,
        to,
        subject: args.subject,
      };
    }

    // ── Leads ───────────────────────────────────────────────────────────────

    case 'list_leads': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.status) where.status = args.status;
      if (args.search) {
        where[Op.or] = [
          { companyName: { [Op.like]: `%${args.search}%` } },
          { contactName: { [Op.like]: `%${args.search}%` } },
          { email:       { [Op.like]: `%${args.search}%` } },
        ];
      }
      const leads = await getDb().Lead.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'companyName', 'contactName', 'email', 'phone',
          'status', 'stage', 'source', 'country', 'productInterest',
          'estimatedValue', 'priority', 'createdAt'],
      });
      return leads.length ? leads.map(l => l.toJSON()) : 'No leads found.';
    }

    case 'get_lead': {
      const lead = await getDb().Lead.findByPk(args.id);
      if (!lead) return `Lead ${args.id} not found.`;
      let activities = [];
      try {
        activities = await getDb().Activity.findAll({
          where: { leadId: args.id },
          limit: 10,
          order: [['createdAt', 'DESC']],
        });
      } catch (_) { /* Activity association may not exist */ }
      return { ...lead.toJSON(), recentActivities: activities.map(a => a.toJSON()) };
    }

    case 'update_lead': {
      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);
      // Phase 4.12: 'notes' in the tool schema maps to Lead.description on
      // the model; the pre-4.12 handler accepted 'notes' but Sequelize
      // silently dropped it because the column doesn't exist. Translate
      // here so AI-set notes actually persist.
      const allowed = ['status', 'stage', 'description', 'productInterest',
        'estimatedValue', 'priority', 'nextFollowUp',
        'industry', 'address', 'city', 'state', 'country', 'website', 'vertical',
        'draftEmailSubject', 'draftEmailBody',
        'assignedToId', 'responsibleUserIds'];
      const aliasMap = { notes: 'description' };
      const updates = {};
      for (const [k, v] of Object.entries(args)) {
        const field = aliasMap[k] || k;
        if (allowed.includes(field)) updates[field] = v;
      }
      if (updates.responsibleUserIds !== undefined) {
        if (!Array.isArray(updates.responsibleUserIds)) {
          return `responsibleUserIds must be an array of user IDs.`;
        }
        updates.responsibleUserIds = updates.responsibleUserIds
          .filter(x => typeof x === 'string' && x.length > 0);
      }
      const leadWriteService = require('../services/aiWriteServices/leadWriteService');
      const result = await leadWriteService.updateLead(args.id, updates, {
        userId: requester.id,
        brandScope,
        ip: null,
        source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('update_lead', 'Lead', result.lead.id, {
        before: result.before,
        after: result.after,
        appliedKeys: Object.keys(updates),
      }, requester.id);
      return { success: true, updated: Object.keys(updates), lead: result.lead.toJSON() };
    }

    case 'list_users': {
      const { Op } = require('sequelize');
      const where = { isActive: true };
      if (args.search) {
        const q = String(args.search);
        where[Op.or] = [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName:  { [Op.like]: `%${q}%` } },
          { email:     { [Op.like]: `%${q}%` } },
        ];
      }
      if (args.role) where.role = args.role;
      const users = await getDb().User.findAll({
        where,
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        order: [['firstName', 'ASC'], ['lastName', 'ASC']],
        limit: Math.min(args.limit || 50, 100),
      });
      return { success: true, users: users.map(u => u.toJSON()) };
    }

    case 'add_lead_activity': {
      const lead = await getDb().Lead.findByPk(args.lead_id);
      if (!lead) return `Lead ${args.lead_id} not found.`;
      const type = args.type || 'note';
      const subject = String(args.subject || '').trim();
      if (!subject) return `subject is required for an activity.`;
      const allowedTypes = ['call', 'email', 'meeting', 'note', 'task', 'follow_up'];
      if (!allowedTypes.includes(type)) {
        return `type must be one of: ${allowedTypes.join(', ')}.`;
      }
      // userId is required by the model. Default to the lead's createdById
      // if the AI didn't pass an explicit user_id (the AI is acting on behalf
      // of the user; the system prompt tells it the current user's ID).
      const userId = args.user_id || lead.createdById || lead.assignedToId;
      if (!userId) {
        return `user_id is required (or the lead must have a createdById/assignedToId for default attribution).`;
      }
      const activity = await getDb().Activity.create({
        type,
        subject: subject.slice(0, 255),
        description: args.description ? String(args.description).slice(0, 5000) : null,
        leadId: args.lead_id,
        userId,
        priority: args.priority || 'medium',
        isCompleted: type === 'note' ? true : !!args.is_completed,
        completedAt: type === 'note' ? new Date() : (args.is_completed ? new Date() : null),
      });
      return { success: true, activity: activity.toJSON() };
    }

    // ── Contacts ────────────────────────────────────────────────────────────

    case 'list_contacts': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.search) {
        where[Op.or] = [
          { firstName: { [Op.like]: `%${args.search}%` } },
          { lastName:  { [Op.like]: `%${args.search}%` } },
          { email:     { [Op.like]: `%${args.search}%` } },
          { jobTitle:  { [Op.like]: `%${args.search}%` } },
        ];
      }
      // Filter by side: 'supplier' = contacts attached to a Factory,
      // 'customer' = contacts attached to a Customer.
      if (args.side === 'supplier') where.factoryId = { [Op.ne]: null };
      if (args.side === 'customer') where.customerId = { [Op.ne]: null };
      if (args.factory_id)  where.factoryId  = args.factory_id;
      if (args.customer_id) where.customerId = args.customer_id;
      if (args.is_active !== undefined) where.isActive = !!args.is_active;

      const contacts = await getDb().Contact.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'mobile',
          'jobTitle', 'department', 'customerId', 'factoryId', 'isPrimary',
          'website', 'linkedinUrl', 'notes', 'isActive'],
        include: [
          { model: getDb().Factory,  attributes: ['id', 'companyName', 'country', 'city'] },
          { model: getDb().Customer, attributes: ['id', 'companyName', 'country'] },
        ],
      });
      return contacts.length ? contacts.map(c => c.toJSON()) : 'No contacts found.';
    }

    case 'get_contact': {
      const contact = await getDb().Contact.findByPk(args.id, {
        include: [
          { model: getDb().Factory,  attributes: ['id', 'companyName', 'country', 'city'] },
          { model: getDb().Customer, attributes: ['id', 'companyName', 'country'] },
        ],
      });
      if (!contact) return `Contact ${args.id} not found.`;
      return contact.toJSON();
    }

    // ── Factories ───────────────────────────────────────────────────────────

    case 'list_factories': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.search) {
        where[Op.or] = [
          { companyName: { [Op.like]: `%${args.search}%` } },
          { country:     { [Op.like]: `%${args.search}%` } },
          { city:        { [Op.like]: `%${args.search}%` } },
        ];
      }
      if (args.country) where.country = args.country;
      if (args.is_active !== undefined) where.isActive = !!args.is_active;

      const factories = await getDb().Factory.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['companyName', 'ASC']],
        attributes: ['id', 'companyName', 'country', 'city', 'address',
          'contactPerson', 'email', 'phone', 'rating', 'leadTimeDays',
          'paymentTerms', 'currency', 'certifications', 'specializations',
          'notes', 'isActive'],
      });
      return factories.length ? factories.map(f => f.toJSON()) : 'No factories found.';
    }

    case 'get_factory': {
      const factory = await getDb().Factory.findByPk(args.id);
      if (!factory) return `Factory ${args.id} not found.`;
      return factory.toJSON();
    }

    case 'create_factory': {
      if (!args.company_name) return 'company_name is required.';
      const requester = await getCurrentUserOrThrow();
      const factoryWriteService = require('../services/aiWriteServices/factoryWriteService');
      const result = await factoryWriteService.createFactory({
        companyName: args.company_name,
        contactPerson: args.contact_person || null,
        email: args.email || null,
        phone: args.phone || null,
        address: args.address || null,
        city: args.city || null,
        country: args.country || null,
        currency: args.currency || null,
        paymentTerms: args.payment_terms || null,
        leadTimeDays: args.lead_time_days,
        rating: args.rating,
        certifications: args.certifications,
        specializations: args.specializations,
        notes: args.notes || null,
        brandCode: args.brand_code || args.brandCode || null,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('create_factory', 'Factory', result.factory.id, {
        companyName: result.factory.companyName,
        country: result.factory.country,
        brandCode: result.factory.brandCode,
      }, requester.id);

      return {
        success: true,
        factoryId: result.factory.id,
        companyName: result.factory.companyName,
        message: `Factory "${result.factory.companyName}" created. Edit at /factories/${result.factory.id}.`,
      };
    }

    case 'update_factory': {
      const requester = await getCurrentUserOrThrow();
      const allowed = ['companyName', 'contactPerson', 'email', 'phone',
        'address', 'city', 'country', 'currency', 'paymentTerms',
        'leadTimeDays', 'rating', 'certifications', 'specializations', 'notes',
        'brandCode'];
      const aliasMap = {
        company_name: 'companyName',
        contact_person: 'contactPerson',
        payment_terms: 'paymentTerms',
        lead_time_days: 'leadTimeDays',
        brand_code: 'brandCode',
      };
      const updates = {};
      for (const [k, v] of Object.entries(args)) {
        if (k === 'id') continue;
        const field = aliasMap[k] || k;
        if (allowed.includes(field)) updates[field] = v;
      }
      const factoryWriteService = require('../services/aiWriteServices/factoryWriteService');
      const result = await factoryWriteService.updateFactory(args.id, updates, {
        userId: requester.id, ip: null, source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('update_factory', 'Factory', result.factory.id, {
        before: result.before,
        after: result.after,
        appliedKeys: Object.keys(updates),
      }, requester.id);

      return { success: true, updated: Object.keys(updates), factory: result.factory.toJSON() };
    }

    case 'create_contact': {
      const requester = await getCurrentUserOrThrow();
      const contactWriteService = require('../services/aiWriteServices/contactWriteService');
      const result = await contactWriteService.createContact({
        firstName: args.first_name || '',
        lastName: args.last_name || '',
        email: args.email,
        phone: args.phone || null,
        mobile: args.mobile || null,
        jobTitle: args.job_title || null,
        department: args.department || null,
        customerId: args.customer_id || null,
        factoryId: args.factory_id || null,
        isPrimary: args.is_primary === true,
        website: args.website || null,
        linkedinUrl: args.linkedin_url || null,
        notes: args.notes || null,
        isActive: args.is_active !== false,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('create_contact', 'Contact', result.contact.id, {
        firstName: result.contact.firstName,
        lastName: result.contact.lastName,
        email: result.contact.email,
        factoryId: result.contact.factoryId,
        customerId: result.contact.customerId,
      }, requester.id);

      return {
        success: true,
        contactId: result.contact.id,
        message: `Contact "${result.contact.firstName} ${result.contact.lastName}" created.`,
        contact: result.contact.toJSON(),
      };
    }

    case 'delete_contact': {
      const requester = await getCurrentUserOrThrow();
      const contactWriteService = require('../services/aiWriteServices/contactWriteService');
      const result = await contactWriteService.deleteContact(args.id, {
        userId: requester.id, ip: null, source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);

      const name = `${result.deleted.firstName} ${result.deleted.lastName}`.trim();
      await auditAiWrite('delete_contact', 'Contact', args.id, {
        firstName: result.deleted.firstName,
        lastName: result.deleted.lastName,
        email: result.deleted.email,
      }, requester.id);

      return { success: true, deletedContactId: args.id, name };
    }

    case 'delete_factory': {
      const requester = await getCurrentUserOrThrow();
      const factoryWriteService = require('../services/aiWriteServices/factoryWriteService');
      const result = await factoryWriteService.deleteFactory(args.id, {
        userId: requester.id, ip: null, source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('delete_factory', 'Factory', args.id, {
        companyName: result.deleted.companyName,
        country: result.deleted.country,
      }, requester.id);

      return { success: true, deletedFactoryId: args.id, name: result.deleted.companyName };
    }

    case 'update_contact': {
      const requester = await getCurrentUserOrThrow();
      const allowed = ['firstName', 'lastName', 'email', 'phone', 'mobile',
        'jobTitle', 'department', 'customerId', 'factoryId', 'isPrimary',
        'website', 'linkedinUrl', 'notes', 'isActive'];
      const aliasMap = {
        first_name: 'firstName',
        last_name: 'lastName',
        job_title: 'jobTitle',
        customer_id: 'customerId',
        factory_id: 'factoryId',
        is_primary: 'isPrimary',
        is_active: 'isActive',
        linkedin_url: 'linkedinUrl',
      };
      const updates = {};
      for (const [k, v] of Object.entries(args)) {
        if (k === 'id') continue;
        const field = aliasMap[k] || k;
        if (allowed.includes(field)) updates[field] = v;
      }
      const contactWriteService = require('../services/aiWriteServices/contactWriteService');
      const result = await contactWriteService.updateContact(args.id, updates, {
        userId: requester.id, ip: null, source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('update_contact', 'Contact', result.contact.id, {
        before: result.before,
        after: result.after,
        appliedKeys: Object.keys(updates),
      }, requester.id);

      return { success: true, updated: Object.keys(updates), contact: result.contact.toJSON() };
    }

    // ── Quotations ──────────────────────────────────────────────────────────

    case 'list_quotations': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.status) where.status = args.status;

      const quotations = await getDb().Quotation.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'quotationNumber', 'status', 'totalAmount',
          'currency', 'validUntil', 'createdAt'],
        include: [{ model: getDb().Customer, as: 'customer', attributes: ['id', 'name'] }],
      });
      return quotations.length ? quotations.map(q => q.toJSON()) : 'No quotations found.';
    }

    // ── Brands ──────────────────────────────────────────────────────────────

    case 'list_brands': {
      const brands = await getDb().Brand.findAll({
        attributes: ['id', 'code', 'displayName', 'senderEmail', 'primaryColor', 'accentColor', 'active', 'commissionRate'],
        order: [['code', 'ASC']],
      });
      return brands.length
        ? brands.map(b => b.toJSON())
        : 'No brands found. Use create_brand to provision one.';
    }



    case 'log_activity': {
      const data = {
        type:      args.type || 'note',
        subject:   args.subject,
        notes:     args.notes || null,
        dueDate:   args.due_date || null,
      };
      if (args.lead_id)    data.leadId    = args.lead_id;
      if (args.contact_id) data.contactId = args.contact_id;
      if (USER_ID)         data.userId    = USER_ID;

      try {
        const activity = await getDb().Activity.create(data);
        return { success: true, activityId: activity.id };
      } catch (err) {
        // Fall back to ScheduledActivity if Activity model differs
        const activity = await getDb().ScheduledActivity.create({
          type:    data.type,
          summary: data.subject,
          notes:   data.notes,
          dueDate: data.dueDate,
          status:  'pending',
        });
        return { success: true, activityId: activity.id, model: 'ScheduledActivity' };
      }
    }

    // ── Triage / inbox ──────────────────────────────────────────────────────

    case 'list_triage_items': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.status) where.status = args.status;
      else where.status = 'pending';
      if (args.search) {
        where[Op.or] = [
          { subject:     { [Op.like]: `%${args.search}%` } },
          { senderEmail: { [Op.like]: `%${args.search}%` } },
          { senderName:  { [Op.like]: `%${args.search}%` } },
        ];
      }
      const items = await getDb().TriageItem.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: Math.min(args.limit || 20, 50),
        attributes: ['id', 'senderEmail', 'senderName', 'subject', 'intentScore',
          'suggestedAction', 'status', 'created_at'],
      });
      return items.length ? items.map(i => i.toJSON()) : 'No triage items found.';
    }

    case 'get_triage_item': {
      const item = await getDb().TriageItem.findByPk(args.id);
      if (!item) return `Triage item ${args.id} not found.`;
      return item.toJSON();
    }

    case 'sync_inbox_now': {
      // Fires an in-process gmail-sync run. Returns immediately; new
      // TriageItem rows land within seconds. Use this when Alex asks
      // "any new emails?" / "check the inbox" / "did anyone reply?"
      // since the cron interval is hourly by default.
      try {
        const { runGmailSync } = require('../services/gmailSyncService');
        setImmediate(() => {
          runGmailSync().catch(err => {
            // log to stderr so it shows in pm2 logs
            console.error('[gmail-sync] sync_inbox_now error:', err.message);
          });
        });
        return {
          success: true,
          message: 'Gmail sync started in the background. Wait ~10-30 seconds, then call list_triage_items({ status: "pending" }) to see new arrivals.',
          startedAt: new Date().toISOString(),
        };
      } catch (e) {
        return `Could not start sync: ${e.message}`;
      }
    }

    case 'update_triage_item': {
      const item = await getDb().TriageItem.findByPk(args.id);
      if (!item) return `Triage item ${args.id} not found.`;
      const allowed = ['pending', 'promoted', 'forwarded', 'spam', 'dismissed', 'archived'];
      const updates = {};
      if (args.status !== undefined) {
        if (!allowed.includes(args.status)) {
          return `Invalid status: ${args.status}. Allowed: ${allowed.join(', ')}`;
        }
        updates.status = args.status;
      }
      if (!Object.keys(updates).length) {
        return 'No updatable fields provided. Send { status: "..." }.';
      }
      await item.update(updates);
      return { success: true, updated: Object.keys(updates), item: item.toJSON() };
    }

    // ── Outbound prospecting & outreach ─────────────────────────────────────

    case 'create_lead': {
      const { company_name, contact_name, email } = args;
      if (!company_name || !contact_name || !email) {
        return 'Missing required fields. Need: company_name, contact_name, email.';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return `Invalid email: ${email}`;
      }
      // Idempotency: if a lead with this email already exists, return it
      // rather than creating a duplicate. Use existing record, signal no-op.
      const existing = await getDb().Lead.findOne({ where: { email } });
      if (existing) {
        return {
          success: true,
          duplicate: true,
          lead: existing.toJSON(),
          message: `Lead already exists for ${email} (id=${existing.id}). Returning existing record.`,
        };
      }

      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);
      const payload = {
        companyName: company_name,
        contactName: contact_name,
        email,
        phone: args.phone || null,
        country: args.country || null,
        city: args.city || null,
        website: args.website || null,
        linkedinUrl: args.linkedin_url || null,
        industry: args.industry || null,
        vertical: args.vertical || null,
        productInterests: Array.isArray(args.product_interests) ? args.product_interests : [],
        estimatedValue: args.estimated_value || null,
        source: args.source || 'other',
        status: 'new',
        leadType: args.lead_type || 'outbound_prospect',
        description: args.notes || null,
        tags: Array.isArray(args.tags) ? args.tags : [],
        assignedToId: requester.id,
        brandCode: args.brand_code || args.brandCode || null,
      };

      const leadWriteService = require('../services/aiWriteServices/leadWriteService');
      const result = await leadWriteService.createLead(payload, {
        userId: requester.id,
        brandScope,
        ip: null,
        source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('create_lead', 'Lead', result.lead.id, {
        companyName: result.lead.companyName,
        email: result.lead.email,
        brandCode: result.lead.brandCode,
        leadNumber: result.lead.leadNumber,
        screeningStatus: result.lead.screeningStatus,
        autoAddedBrand: result.autoAddedBrand,
      }, requester.id);

      return {
        success: true,
        lead: result.lead.toJSON(),
        autoAddedBrand: result.autoAddedBrand,
      };
    }

    case 'send_outreach_email': {
      const { lead_id, subject, body_text } = args;
      if (!lead_id || !subject || !body_text) {
        return 'Missing required fields. Need: lead_id, subject, body_text.';
      }
      const lead = await getDb().Lead.findByPk(lead_id);
      if (!lead) return `Lead ${lead_id} not found.`;

      const { sendOutreachEmail } = require('../services/emailService');

      // Phase 4.9.3.1 hotfix (2026-05-15): brand-aware fromAddress resolution.
      // Previously hardcoded to process.env.SMTP_USER which was undefined →
      // notNull violation on OutreachEmail.fromAddress. Now mirrors
      // outreachController.sendOutreachEmail: lead.brandCode → Brand.senderEmail,
      // with explicit override + final fallback.
      const _brandForFrom = lead.brandCode
        ? await getDb().Brand.findOne({ where: { code: lead.brandCode, active: true } })
        : null;
      const fromAddress =
        args.fromAddress ||
        args.from_address ||
        (_brandForFrom && _brandForFrom.senderEmail) ||
        process.env.SMTP_USER ||
        'alex@sovernhouse.co';

      // Resolve user's default signature, if any (mirrors triageController.sendEmail).
      let signatureHtml = null;
      let signatureText = null;
      try {
        const { generateSignatureHtml, generateSignatureText } =
          require('../controllers/emailSignatureController');
        const sig = USER_ID
          ? await getDb().EmailSignature.findOne({ where: { userId: USER_ID, isDefault: true } })
            || await getDb().EmailSignature.findOne({ where: { isDefault: true } })
          : await getDb().EmailSignature.findOne({ where: { isDefault: true } });
        if (sig) {
          signatureHtml = generateSignatureHtml(sig);
          signatureText = generateSignatureText(sig);
        }
      } catch (_) { /* signature is non-critical */ }

      // Phase 4.9.3b PART C: draft-only mode. When draftOnly=true,
      // skip the SMTP call entirely; the OutreachEmail row is created
      // with status='draft' so it appears in the outreach UI for review
      // before send. The AI assistant should pass draftOnly=true any
      // time the user asks to "stage" / "draft" / "queue for review"
      // an outreach email, and only call without draftOnly when the
      // user has explicitly approved the content.
      const draftOnly = args.draftOnly === true || args.draft_only === true;

      let smtpResult = null;
      let sendError = null;
      if (!draftOnly) {
        try {
          smtpResult = await sendOutreachEmail({
            fromAddress,
            toAddress: lead.email,
            toName: lead.contactName,
            subject,
            bodyText: body_text,
            cc: args.cc || null,
            bcc: args.bcc || null,
            signatureHtml,
            signatureText,
          });
        } catch (e) {
          sendError = e.message || String(e);
        }
      }

      // Always create the OutreachEmail row — for drafts (status=draft),
      // successful sends (status=sent), or send failures (status=failed)
      // so we have an audit trail and can retry.
      const touchNumber = args.touch_number || 1;
      const followUpDays = args.follow_up_days || (touchNumber === 1 ? 3 : touchNumber === 2 ? 5 : 7);
      const followUpDueAt = new Date(Date.now() + followUpDays * 86400000);

      const status = draftOnly ? 'draft' : (sendError ? 'failed' : 'sent');
      const row = await getDb().OutreachEmail.create({
        leadId: lead.id,
        sentByUserId: USER_ID || null,
        fromAddress,
        toAddress: lead.email,
        toName: lead.contactName,
        subject,
        bodyText: body_text,
        touchNumber,
        status,
        sentAt: status === 'sent' ? new Date() : null,
        smtpMessageId: smtpResult?.messageId || null,
        followUpDueAt,
        errorMessage: sendError || null,
      });

      if (draftOnly) {
        return {
          success: true,
          outreachEmail: row.toJSON(),
          message: `Drafted (not sent) for ${lead.email}. Review and send from the outreach UI at /crm/leads/${lead.id}.`,
        };
      }

      // Lead status: bump 'new' → 'contacted' on first successful send
      if (!sendError && lead.status === 'new') {
        await lead.update({ status: 'contacted' });
      }

      if (sendError) {
        return {
          success: false,
          error: `Email send failed: ${sendError}. OutreachEmail row created (id=${row.id}) for retry.`,
          outreachEmail: row.toJSON(),
        };
      }
      return {
        success: true,
        outreachEmail: row.toJSON(),
        followUpDueAt: followUpDueAt.toISOString(),
        message: `Sent to ${lead.email}. Follow-up due ${followUpDueAt.toISOString().slice(0, 10)} (touch ${touchNumber}).`,
      };
    }

    case 'list_outreach_emails': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.lead_id) where.leadId = args.lead_id;
      if (args.status) where.status = args.status;
      if (args.touch_number) where.touchNumber = args.touch_number;
      if (args.follow_up_due) {
        where.followUpDueAt = { [Op.lte]: new Date() };
        where.followUpCompleted = false;
        where.status = 'sent';  // only completed sends are followup-eligible
      }
      const rows = await getDb().OutreachEmail.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: Math.min(args.limit || 20, 100),
        include: [{
          model: getDb().Lead, as: 'lead',
          attributes: ['id', 'companyName', 'contactName', 'email', 'country', 'status'],
        }],
      });
      if (!rows.length) {
        return args.follow_up_due
          ? 'No outreach emails are due for follow-up right now.'
          : 'No outreach emails matching those filters.';
      }
      return rows.map(r => r.toJSON());
    }

    case 'schedule_follow_up': {
      const requester = await getCurrentUserOrThrow();
      const { outreach_email_id, lead_id, follow_up_at, note } = args;
      if (!follow_up_at) return 'Missing follow_up_at (ISO date string).';
      const date = new Date(follow_up_at);
      if (isNaN(date.getTime())) return `Invalid follow_up_at: ${follow_up_at}`;

      if (outreach_email_id) {
        const oe = await getDb().OutreachEmail.findByPk(outreach_email_id);
        if (!oe) return `Outreach email ${outreach_email_id} not found.`;
        const before = { followUpDueAt: oe.followUpDueAt, followUpNote: oe.followUpNote, followUpCompleted: oe.followUpCompleted };
        await oe.update({ followUpDueAt: date, followUpNote: note || oe.followUpNote, followUpCompleted: false });
        await auditAiWrite('schedule_follow_up', 'OutreachEmail', oe.id, {
          before, after: { followUpDueAt: date.toISOString(), followUpNote: note || oe.followUpNote, followUpCompleted: false },
        }, requester.id);
        return { success: true, scope: 'outreach_email', id: oe.id, followUpDueAt: date.toISOString() };
      }
      if (lead_id) {
        const lead = await getDb().Lead.findByPk(lead_id);
        if (!lead) return `Lead ${lead_id} not found.`;
        const beforeExpected = lead.expectedCloseDate;
        await lead.update({ expectedCloseDate: lead.expectedCloseDate || date });
        let activityId = null;
        if (getDb().Activity) {
          const activity = await getDb().Activity.create({
            type: 'follow_up',
            subject: 'Follow-up scheduled',
            description: note || `Follow-up scheduled for ${date.toISOString().slice(0, 10)}`,
            scheduledAt: date,
            leadId: lead.id,
            userId: requester.id,
            isCompleted: false,
            priority: 'medium',
          });
          activityId = activity.id;
        }
        await auditAiWrite('schedule_follow_up', 'Lead', lead.id, {
          scheduledAt: date.toISOString(),
          note: note || null,
          activityId,
          expectedCloseDateBefore: beforeExpected,
          expectedCloseDateAfter: lead.expectedCloseDate,
        }, requester.id);
        return { success: true, scope: 'lead', id: lead.id, scheduledAt: date.toISOString() };
      }
      return 'Provide either outreach_email_id or lead_id.';
    }

    case 'get_lead_thread': {
      // Full single-call lead profile: lead + recent activities + outreach
      // emails + matched triage items. Saves the AI from making 4-5
      // separate tool calls when it needs full context on a lead.
      const lead = await getDb().Lead.findByPk(args.lead_id, {
        include: [
          { model: getDb().User, as: 'assignedTo', attributes: ['id', 'name', 'email'], required: false },
          { model: getDb().Customer, as: 'convertedCustomer', attributes: ['id', 'companyName'], required: false },
        ],
      });
      if (!lead) return `Lead ${args.lead_id} not found.`;

      const [activities, outreach, triageItems] = await Promise.all([
        getDb().Activity ? getDb().Activity.findAll({
          where: { leadId: lead.id },
          order: [['createdAt', 'DESC']],
          limit: 20,
        }) : Promise.resolve([]),
        getDb().OutreachEmail.findAll({
          where: { leadId: lead.id },
          order: [['createdAt', 'DESC']],
          limit: 20,
        }),
        getDb().TriageItem ? getDb().TriageItem.findAll({
          where: { promotedLeadId: lead.id },
          order: [['createdAt', 'DESC']],
          limit: 10,
        }) : Promise.resolve([]),
      ]);

      // Find any unmatched but related triage items by sender email
      const moreTriage = lead.email && getDb().TriageItem
        ? await getDb().TriageItem.findAll({
            where: { senderEmail: lead.email, promotedLeadId: { [require('sequelize').Op.is]: null } },
            order: [['createdAt', 'DESC']],
            limit: 5,
          })
        : [];

      return {
        lead: lead.toJSON(),
        activities: activities.map(a => a.toJSON ? a.toJSON() : a),
        outreachEmails: outreach.map(o => o.toJSON()),
        promotedTriageItems: triageItems.map(t => t.toJSON ? t.toJSON() : t),
        unprocessedTriageItemsFromSameSender: moreTriage.map(t => t.toJSON ? t.toJSON() : t),
        summary: {
          activityCount: activities.length,
          outreachCount: outreach.length,
          lastOutreachAt: outreach[0]?.sentAt || null,
          lastOutreachTouch: outreach[0]?.touchNumber || 0,
          nextFollowUpDue: outreach.find(o => !o.followUpCompleted)?.followUpDueAt || null,
        },
      };
    }

    case 'match_factories_for_product': {
      // Suggest factories that look like a fit based on country, product
      // taxonomy/specialization, certifications, and past sourcing history
      // (factory appears on existing Quotations / PurchaseOrders for similar
      // products). Returns a ranked list with reasons.
      // Phase 4.9.2a: when both the product's brand AND a candidate
      // factory's brand are set, prefer the matching brand. We don't
      // filter out non-matching factories (cross-brand sourcing is
      // legitimate) — we score the match as a tiebreaker reason.
      const { Op } = require('sequelize');
      const { product_description, vertical, country, hs_code,
              required_certifications = [], min_quantity, target_lead_time_days,
              brand_code } = args;

      const allFactories = await getDb().Factory.findAll({
        where: { isActive: { [Op.ne]: false } },
        include: [{
          model: getDb().Product, as: 'products', required: false,
          attributes: ['id', 'name', 'sku', 'categoryId'],
        }],
        limit: 200,
      });

      const desc = (product_description || '').toLowerCase();
      const verticalLc = (vertical || '').toLowerCase();
      const candidates = [];

      for (const f of allFactories) {
        const reasons = [];
        let score = 0;

        // Country match
        if (country && f.country && f.country.toLowerCase() === country.toLowerCase()) {
          score += 30; reasons.push(`country match (${f.country})`);
        }

        // Phase 4.9.2a: brand match. When both sides have a brand and
        // they line up, score it; when they disagree, mildly penalise
        // (cross-brand sourcing is allowed but the same-brand path is
        // operationally simpler).
        if (brand_code && f.brandCode) {
          if (f.brandCode === brand_code) {
            score += 15; reasons.push(`brand match (${brand_code})`);
          } else {
            score -= 5; reasons.push(`brand mismatch (factory ${f.brandCode}, product ${brand_code})`);
          }
        }

        // Specialization / vertical fit
        const specs = Array.isArray(f.specializations) ? f.specializations : [];
        const specsText = specs.map(s => String(s).toLowerCase()).join(' ');
        if (verticalLc && specsText.includes(verticalLc)) {
          score += 25; reasons.push(`specialization includes "${vertical}"`);
        }
        if (desc) {
          const descTokens = desc.split(/\s+/).filter(t => t.length > 3);
          const hits = descTokens.filter(t => specsText.includes(t));
          if (hits.length) {
            score += Math.min(20, hits.length * 5);
            reasons.push(`spec keyword hits: ${hits.slice(0, 3).join(', ')}`);
          }
        }

        // Existing product catalog overlap
        if (f.products && f.products.length > 0 && desc) {
          const productHit = f.products.find(p =>
            p.name && desc.split(/\s+/).some(t => t.length > 3 && p.name.toLowerCase().includes(t))
          );
          if (productHit) {
            score += 20; reasons.push(`existing SKU match: ${productHit.sku || productHit.name}`);
          }
        }

        // Certification overlap
        const certs = Array.isArray(f.certifications) ? f.certifications.map(c => String(c).toUpperCase()) : [];
        const reqCerts = required_certifications.map(c => String(c).toUpperCase());
        const certHits = reqCerts.filter(c => certs.some(fc => fc.includes(c)));
        if (reqCerts.length && certHits.length === reqCerts.length) {
          score += 20; reasons.push(`all required certs present (${certHits.join(', ')})`);
        } else if (certHits.length) {
          score += 10; reasons.push(`partial cert match (${certHits.join(', ')})`);
        }

        // Lead time fit
        if (target_lead_time_days && f.leadTimeDays) {
          if (f.leadTimeDays <= target_lead_time_days) {
            score += 10; reasons.push(`lead time ${f.leadTimeDays}d ≤ target ${target_lead_time_days}d`);
          }
        }

        // Rating bump
        if (f.rating) {
          score += Math.round((f.rating / 5) * 5);  // 0-5 bump
          if (f.rating >= 4.5) reasons.push(`rated ${f.rating}/5`);
        }

        if (score > 0) {
          candidates.push({
            factoryId: f.id,
            companyName: f.companyName,
            country: f.country,
            leadTimeDays: f.leadTimeDays,
            paymentTerms: f.paymentTerms,
            rating: f.rating,
            certifications: certs,
            specializations: specs,
            score,
            reasons,
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      const topN = candidates.slice(0, args.limit || 10);

      if (topN.length === 0) {
        return 'No factory candidates matched. Consider relaxing the criteria (country, certifications) or check if the supplier database is populated for this product category.';
      }
      return {
        candidatesCount: candidates.length,
        returned: topN.length,
        searchedAcross: allFactories.length,
        topCandidates: topN,
        criteria: { product_description, vertical, country, hs_code, required_certifications, min_quantity, target_lead_time_days },
      };
    }

    case 'create_quotation': {
      const { customer_id, lead_id, items, currency, valid_days, terms,
              factory_id, discount, discount_type, tax_rate, payment_terms,
              brand_code } = args;

      if (!Array.isArray(items) || items.length === 0) {
        return 'Missing items array. Each item needs: product_id, quantity, unit_price.';
      }
      for (const it of items) {
        if (!it.product_id || it.quantity === undefined || it.unit_price === undefined) {
          return 'Each item must have product_id, quantity, unit_price.';
        }
      }

      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);

      // MCP-only lead→customer auto-conversion. REST callers always pass
      // customerId directly; the MCP tool is convenience layer for "quote
      // this prospect" workflows where the Lead hasn't been converted yet.
      let resolvedCustomerId = customer_id;
      let resolvedLeadId = lead_id || null;
      let leadAutoConverted = false;
      if (lead_id) {
        const lead = await getDb().Lead.findByPk(lead_id);
        if (!lead) return `Lead ${lead_id} not found.`;
        if (lead.convertedCustomerId) {
          resolvedCustomerId = lead.convertedCustomerId;
        } else if (!resolvedCustomerId) {
          const newCustomer = await getDb().Customer.create({
            companyName: lead.companyName,
            contactPerson: lead.contactName,
            email: lead.email,
            phone: lead.phone || '',
            country: lead.country || null,
            city: lead.city || null,
            currency: lead.currency || currency || 'USD',
            paymentTerms: payment_terms || 'Net 30',
          });
          resolvedCustomerId = newCustomer.id;
          await lead.update({ convertedCustomerId: newCustomer.id, status: 'won', wonDate: new Date() });
          leadAutoConverted = true;
        }
      }
      if (!resolvedCustomerId) {
        return 'Need either customer_id, or lead_id (will auto-convert lead to customer).';
      }

      // Shape items into the camelCase payload the service expects.
      const camelItems = items.map(it => ({
        productId: it.product_id,
        quantity: parseFloat(it.quantity),
        unitPrice: parseFloat(it.unit_price),
        unit: it.unit,
        description: it.description,
        discount: it.discount,
        notes: it.notes,
        originCountry: it.origin_country || it.originCountry || null,
      }));

      const quotationWriteService = require('../services/aiWriteServices/quotationWriteService');
      const result = await quotationWriteService.createQuotation({
        customerId: resolvedCustomerId,
        leadId: resolvedLeadId,
        factoryId: factory_id || null,
        salesPersonId: requester.id,
        items: camelItems,
        currency: currency || 'USD',
        validDays: valid_days,
        terms: terms || null,
        discount: discount,
        discountType: discount_type,
        taxRate: tax_rate,
        brandCode: brand_code || args.brandCode || null,
      }, {
        userId: requester.id,
        role: requester.role,
        brandScope,
        ip: null,
        source: 'mcp',
      });

      if (!result.ok) return formatMcpWriteError(result);

      await auditAiWrite('create_quotation', 'Quotation', result.quotation.id, {
        quotationNumber: result.quotation.quotationNumber,
        customerId: resolvedCustomerId,
        brandCode: result.quotation.brandCode,
        itemCount: camelItems.length,
        total: result.quotation.total,
        leadAutoConverted,
        autoAddedBrand: result.autoAddedBrand,
      }, requester.id);

      const full = result.quotation;
      return {
        success: true,
        quotation: full.toJSON(),
        autoAddedBrand: result.autoAddedBrand,
        message: `Created ${full.status} quotation ${full.quotationNumber} with ${camelItems.length} item(s). Total: ${full.currency} ${Number(full.total).toFixed(2)}.${leadAutoConverted ? ' (Auto-converted lead to customer.)' : ''}`,
      };
    }

    // ── Phase 4.15a: Document generation (13 tools) ─────────────────────
    case 'erp_generate_quotation_pdf':
    case 'erp_generate_invoice_pdf':
    case 'erp_generate_proforma_invoice_pdf':
    case 'erp_generate_purchase_order_pdf':
    case 'erp_generate_packing_list_pdf':
    case 'erp_generate_certificate_of_origin_pdf':
    case 'erp_generate_credit_note_pdf':
    case 'erp_generate_inspection_certificate_pdf':
    case 'erp_generate_product_spec_sheet_pdf':
    case 'erp_generate_sales_note_pdf':
    case 'erp_generate_sales_order_pdf':
    case 'erp_generate_shipment_document_pdf':
    case 'erp_generate_statement_of_account_pdf': {
      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);
      // Tool name → category (strip 'erp_generate_' prefix + '_pdf' suffix).
      const category = name.replace(/^erp_generate_/, '').replace(/_pdf$/, '');
      const pdfService = require('../services/aiWriteServices/pdfGenerationService');
      const generatorOpts = {};
      if (category === 'packing_list' && args.advanced === true) {
        generatorOpts.advanced = true;
      }
      const result = await pdfService.generateAndPersist({
        category,
        entityId: args.id,
        generatorOpts,
      }, {
        userId: requester.id,
        brandScope,
        ip: null,
        source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);
      return {
        success: true,
        category,
        fileName: result.fileName,
        driveFileId: result.driveFileId,
        driveUrl: result.driveUrl,
        documentRowId: result.documentRowId,
        sizeKB: result.sizeKB,
        brandCode: result.brandCode,
        message: `Generated ${category.replace(/_/g, ' ')} PDF: ${result.fileName} (${result.sizeKB}KB). View: ${result.driveUrl}`,
      };
    }

    // ── Phase 4.15a: Quotation CRUD completion (4 new tools) ────────────
    // erp_create_quotation already exists (create_quotation, Phase 4.12).
    case 'erp_update_quotation': {
      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);
      const allowed = ['status', 'currency', 'validUntil', 'terms', 'discount',
        'discountType', 'taxRate', 'displayAreaUnit', 'displayDimensionUnit',
        'salesPersonId', 'factoryId'];
      const patch = {};
      for (const k of allowed) {
        if (args[k] !== undefined) patch[k] = args[k];
      }
      const quotationWriteService = require('../services/aiWriteServices/quotationWriteService');
      const result = await quotationWriteService.updateQuotation(args.id, patch, {
        userId: requester.id,
        brandScope,
        ip: null,
        source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('update_quotation', 'Quotation', result.quotation.id, {
        before: result.before,
        after: result.after,
        appliedKeys: Object.keys(patch),
      }, requester.id);
      return { success: true, updated: Object.keys(patch), quotation: result.quotation.toJSON() };
    }

    case 'erp_get_quotation': {
      const quotation = await getDb().Quotation.findByPk(args.id, {
        include: [
          { association: 'items', include: [{ model: getDb().Product, as: 'product' }] },
          { model: getDb().Customer, as: 'customer' },
          { model: getDb().User, as: 'salesPerson' },
          { model: getDb().Factory, as: 'factory' },
          { model: getDb().Lead, as: 'lead' },
        ],
      });
      if (!quotation) return `Quotation ${args.id} not found.`;
      return { success: true, quotation: quotation.toJSON() };
    }

    case 'erp_list_quotations': {
      const { Op } = require('sequelize');
      const where = { deletedAt: null };
      if (args.status) where.status = args.status;
      if (args.brand_code) where.brandCode = String(args.brand_code).toUpperCase();
      if (args.customer_id) where.customerId = args.customer_id;
      if (args.date_from || args.date_to) {
        where.createdAt = {};
        if (args.date_from) where.createdAt[Op.gte] = new Date(args.date_from);
        if (args.date_to) where.createdAt[Op.lte] = new Date(args.date_to);
      }
      const rows = await getDb().Quotation.findAll({
        where,
        limit: Math.min(args.limit || 25, 100),
        order: [['createdAt', 'DESC']],
        include: [
          { model: getDb().Customer, as: 'customer', attributes: ['id', 'companyName'] },
        ],
        attributes: ['id', 'quotationNumber', 'status', 'brandCode',
          'subtotal', 'total', 'currency', 'validUntil', 'createdAt'],
      });
      return rows.length ? rows.map(r => r.toJSON()) : 'No quotations match those filters.';
    }

    case 'erp_archive_quotation': {
      const requester = await getCurrentUserOrThrow();
      const brandScope = await brandScopeForMcp(requester);
      const quotationWriteService = require('../services/aiWriteServices/quotationWriteService');
      const result = await quotationWriteService.archiveQuotation(args.id, {
        userId: requester.id,
        brandScope,
        ip: null,
        source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('archive_quotation', 'Quotation', args.id, {
        quotationNumber: result.deleted.quotationNumber,
        status: result.deleted.status,
        total: result.deleted.total,
      }, requester.id);
      return {
        success: true,
        archivedQuotationId: args.id,
        quotationNumber: result.deleted.quotationNumber,
      };
    }

    // ── Phase 4.15d-1: Internal Approvals (5 tools) ─────────────────────
    case 'erp_submit_approval': {
      const requester = await getCurrentUserOrThrow();
      const approvalService = require('../services/aiWriteServices/internalApprovalWriteService');
      const result = await approvalService.submitApproval({
        approvalType: args.approval_type,
        entityType: args.entity_type,
        entityId: args.entity_id,
        assignedToUserId: args.assigned_to_user_id || null,
        requestNote: args.request_note || null,
        priority: args.priority,
        dueDate: args.due_date || null,
      }, { userId: requester.id, role: requester.role, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('submit_approval', 'InternalApproval', result.approval.id, {
        approvalType: result.approval.approvalType,
        entityType: result.approval.entityType,
        entityId: result.approval.entityId,
        priority: result.approval.priority,
        assignedToUserId: result.approval.assignedToUserId,
      }, requester.id);
      return { success: true, approval: result.approval.toJSON() };
    }

    case 'erp_list_approvals': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.status) where.status = args.status;
      if (args.approval_type) where.approvalType = args.approval_type;
      if (args.requested_by_user_id) where.requestedByUserId = args.requested_by_user_id;
      if (args.assigned_to_user_id) where.assignedToUserId = args.assigned_to_user_id;
      if (args.entity_type) where.entityType = args.entity_type;
      if (args.entity_id) where.entityId = String(args.entity_id);
      const rows = await getDb().InternalApproval.findAll({
        where,
        limit: Math.min(args.limit || 25, 100),
        order: [['createdAt', 'DESC']],
        include: [
          { model: getDb().User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: getDb().User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: getDb().User, as: 'decidedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
        ],
      });
      return rows.length ? rows.map(r => r.toJSON()) : 'No approvals match those filters.';
    }

    case 'erp_get_approval': {
      const approval = await getDb().InternalApproval.findByPk(args.id, {
        include: [
          { model: getDb().User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: getDb().User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: getDb().User, as: 'decidedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
        ],
      });
      if (!approval) return `Approval ${args.id} not found.`;
      return { success: true, approval: approval.toJSON() };
    }

    case 'erp_approve_request': {
      const requester = await getCurrentUserOrThrow();
      const approvalService = require('../services/aiWriteServices/internalApprovalWriteService');
      const result = await approvalService.decideApproval(args.id, {
        status: 'approved',
        note: args.note || null,
      }, { userId: requester.id, role: requester.role, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('approve_request', 'InternalApproval', result.approval.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, approval: result.approval.toJSON() };
    }

    case 'erp_reject_request': {
      const requester = await getCurrentUserOrThrow();
      if (!args.reason || String(args.reason).trim().length < 5) {
        return 'reject_request requires a reason (at least 5 characters).';
      }
      const approvalService = require('../services/aiWriteServices/internalApprovalWriteService');
      const result = await approvalService.decideApproval(args.id, {
        status: 'rejected',
        note: args.reason,
      }, { userId: requester.id, role: requester.role, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('reject_request', 'InternalApproval', result.approval.id, {
        before: result.before,
        after: result.after,
        reason: args.reason,
      }, requester.id);
      return { success: true, approval: result.approval.toJSON() };
    }

    // ── Phase 4.15d-2a: Product Specifications (6 tools) ────────────────
    case 'erp_upsert_product_spec': {
      const requester = await getCurrentUserOrThrow();
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const { product_id, product_sku, ...rest } = args;
      const result = await specService.upsertProductSpec({
        productId: product_id,
        productSku: product_sku,
        ...rest,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite(result.created ? 'create_product_spec' : 'update_product_spec',
        'ProductSpecification', result.spec.id, {
          productId: result.product.id,
          productSku: result.product.sku,
          before: result.before || null,
          after: result.after || result.spec.toJSON(),
          created: !!result.created,
        }, requester.id);
      return {
        success: true,
        created: !!result.created,
        product: { id: result.product.id, sku: result.product.sku, name: result.product.name },
        spec: result.spec.toJSON(),
      };
    }

    case 'erp_get_product_spec': {
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const result = await specService.getProductSpec(args.product_id || args.product_sku);
      if (!result.ok) return formatMcpWriteError(result);
      return {
        success: true,
        product: { id: result.product.id, sku: result.product.sku, name: result.product.name, brandCode: result.product.brandCode },
        spec: result.spec.toJSON(),
      };
    }

    case 'erp_list_product_specs': {
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const result = await specService.listProductSpecs({
        flooringType: args.flooring_type,
        coreType: args.core_type,
        waterproof: args.waterproof,
        acRating: args.ac_rating,
        fireRating: args.fire_rating,
        origin: args.origin,
        format: args.format,
        brandCode: args.brand_code,
        hasValue: args.has_value,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.specs.length
        ? result.specs.map(s => s.toJSON())
        : 'No product specifications match those filters.';
    }

    case 'erp_search_product_specs': {
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const result = await specService.searchProductSpecs(args.query);
      if (!result.ok) return formatMcpWriteError(result);
      return {
        success: true,
        query: result.query,
        resultCount: result.results.length,
        results: result.results.map(r => ({
          product: { id: r.spec.product?.id, sku: r.spec.product?.sku, name: r.spec.product?.name, brandCode: r.spec.product?.brandCode },
          spec: r.spec.toJSON(),
          matchedFields: r.matchedFields,
        })),
      };
    }

    case 'erp_lookup_spec_qa': {
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const result = await specService.lookupSpecQa({
        product: args.product_id || args.product_sku || args.product,
        attribute: args.attribute,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result;
    }

    case 'erp_archive_product_spec': {
      const requester = await getCurrentUserOrThrow();
      const specService = require('../services/aiWriteServices/productSpecWriteService');
      const result = await specService.archiveProductSpec(args.product_id || args.product_sku, {
        userId: requester.id, ip: null, source: 'mcp',
      });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('archive_product_spec', 'ProductSpecification', result.deleted.id, {
        productId: result.product.id,
        productSku: result.product.sku,
        before: result.deleted,
      }, requester.id);
      return {
        success: true,
        archivedSpecId: result.deleted.id,
        product: { id: result.product.id, sku: result.product.sku, name: result.product.name },
      };
    }

    // ── Phase 4.15b-1: Landed Cost (5 tools) ────────────────────────────
    case 'erp_create_landed_cost_template': {
      const requester = await getCurrentUserOrThrow();
      const lcService = require('../services/aiWriteServices/landedCostWriteService');
      const result = await lcService.createTemplate({
        name: args.name,
        description: args.description,
        supplierId: args.supplier_id,
        countryOfOrigin: args.country_of_origin,
        destinationCountry: args.destination_country,
        components: args.components,
        defaultPercentages: args.default_percentages,
        currency: args.currency,
        isActive: args.is_active,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_landed_cost_template', 'LandedCostTemplate', result.template.id, {
        name: result.template.name,
        supplierId: result.template.supplierId,
        countryOfOrigin: result.template.countryOfOrigin,
        destinationCountry: result.template.destinationCountry,
      }, requester.id);
      return { success: true, template: result.template.toJSON() };
    }

    case 'erp_list_landed_cost_templates': {
      const lcService = require('../services/aiWriteServices/landedCostWriteService');
      const result = await lcService.listTemplates({
        name: args.name,
        supplierId: args.supplier_id,
        countryOfOrigin: args.country_of_origin,
        destinationCountry: args.destination_country,
        activeOnly: args.active_only !== false,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.templates.length
        ? result.templates.map(t => t.toJSON())
        : 'No landed-cost templates match those filters.';
    }

    case 'erp_persist_landed_cost_calculation': {
      const requester = await getCurrentUserOrThrow();
      const lcService = require('../services/aiWriteServices/landedCostWriteService');
      const result = await lcService.persistCalculation({
        productId: args.product_id,
        supplierId: args.supplier_id,
        quantity: args.quantity,
        productCost: args.product_cost,
        freight: args.freight,
        insurance: args.insurance,
        customsDuty: args.customs_duty,
        handlingCharges: args.handling_charges,
        localDelivery: args.local_delivery,
        currency: args.currency,
        exchangeRate: args.exchange_rate,
        purchaseOrderId: args.purchase_order_id,
        templateId: args.template_id,
        origin: args.origin,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('persist_landed_cost_calculation', 'LandedCostCalculation', result.calculation.id, {
        referenceNumber: result.calculation.referenceNumber,
        productId: result.product.id,
        productSku: result.product.sku,
        supplierId: result.supplier.id,
        supplierName: result.supplier.companyName,
        quantity: result.calculation.quantity,
        totalLandedCost: result.calculation.totalLandedCost,
        costPerUnit: result.calculation.costPerUnit,
        currency: result.calculation.currency,
      }, requester.id);
      return { success: true, calculation: result.calculation.toJSON() };
    }

    case 'erp_list_landed_cost_calculations': {
      const lcService = require('../services/aiWriteServices/landedCostWriteService');
      const result = await lcService.listCalculations({
        productId: args.product_id,
        supplierId: args.supplier_id,
        purchaseOrderId: args.purchase_order_id,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        search: args.search,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.calculations.length
        ? result.calculations.map(c => c.toJSON())
        : 'No landed-cost calculations match those filters.';
    }

    case 'erp_get_landed_cost_calculation': {
      const lcService = require('../services/aiWriteServices/landedCostWriteService');
      const result = await lcService.getCalculation(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, calculation: result.calculation.toJSON() };
    }

    // ── Phase 4.15d-2b-1: Compliance audit-and-expose (8 read/calc tools) ──
    case 'erp_compliance_check': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.checkCompliance({
        shipmentId: args.shipment_id,
        productId: args.product_id,
        countryOrigin: args.country_origin,
        countryDestination: args.country_destination,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, ...result.check };
    }

    case 'erp_lookup_hs_codes': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.lookupHsCodes({
        search: args.search,
        chapter: args.chapter,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.hsCodes.length
        ? result.hsCodes.map(c => c.toJSON())
        : 'No HS codes match those filters.';
    }

    case 'erp_calculate_duties': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.calculateDuties({
        hsCode: args.hs_code,
        countryOrigin: args.country_origin,
        countryDestination: args.country_destination,
        unitPrice: args.unit_price,
        quantity: args.quantity,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, ...result.calculation };
    }

    case 'erp_list_compliance_records': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.listComplianceRecords({
        shipmentId: args.shipment_id,
        productId: args.product_id,
        type: args.type,
        status: args.status,
        countryOrigin: args.country_origin,
        countryDestination: args.country_destination,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.records.length
        ? result.records.map(r => r.toJSON())
        : 'No compliance records match those filters.';
    }

    case 'erp_get_compliance_record': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.getComplianceRecord(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, record: result.record.toJSON() };
    }

    case 'erp_list_certificates_of_origin': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.listCertificatesOfOrigin({
        status: args.status,
        shipmentId: args.shipment_id,
        countryOfOrigin: args.country_of_origin,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.certificates.length
        ? result.certificates.map(c => c.toJSON())
        : 'No certificates of origin match those filters.';
    }

    case 'erp_get_certificate_of_origin': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.getCertificateOfOrigin(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, certificate: result.certificate.toJSON() };
    }

    // ── Phase 4.15d-2b-2: Compliance write tools (6) ────────────────────
    case 'erp_create_compliance_record': {
      const requester = await getCurrentUserOrThrow();
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.createComplianceRecord({
        shipmentId: args.shipment_id,
        productId: args.product_id,
        type: args.type,
        countryOrigin: args.country_origin,
        countryDestination: args.country_destination,
        hsCode: args.hs_code,
        dutyRate: args.duty_rate,
        antiDumpingRate: args.anti_dumping_rate,
        certificateNumber: args.certificate_number,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_compliance_record', 'ComplianceRecord', result.record.id, {
        type: result.record.type,
        countryOrigin: result.record.countryOrigin,
        countryDestination: result.record.countryDestination,
        status: result.record.status,
      }, requester.id);
      return { success: true, record: result.record.toJSON() };
    }

    case 'erp_update_compliance_record': {
      const requester = await getCurrentUserOrThrow();
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.updateComplianceRecord(args.id, {
        status: args.status,
        expiryDate: args.expiry_date,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('update_compliance_record', 'ComplianceRecord', result.record.id, {
        before: result.before, after: result.after,
      }, requester.id);
      return { success: true, record: result.record.toJSON() };
    }

    case 'erp_create_hs_code': {
      const requester = await requireSuperAdmin();
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.createHsCode({
        code: args.code,
        description: args.description,
        chapter: args.chapter,
        heading: args.heading,
        subheading: args.subheading,
        dutyRate: args.duty_rate,
        antiDumpingRate: args.anti_dumping_rate,
        countrySpecific: args.country_specific,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_hs_code', 'HarmonizedCode', result.hsCode.id, {
        code: result.hsCode.code,
        description: result.hsCode.description,
        dutyRate: result.hsCode.dutyRate,
      }, requester.id);
      return { success: true, hsCode: result.hsCode.toJSON() };
    }

    case 'erp_create_certificate_of_origin': {
      const requester = await getCurrentUserOrThrow();
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.createCertificateOfOriginRow({
        shipmentId: args.shipment_id,
        exporterName: args.exporter_name,
        exporterAddress: args.exporter_address,
        importerName: args.importer_name,
        countryOfOrigin: args.country_of_origin,
        countryOfDestination: args.country_of_destination,
        items: args.items,
        chamberOfCommerce: args.chamber_of_commerce,
        notes: args.notes,
      }, { userId: requester.id, ip: null, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_certificate_of_origin', 'CertificateOfOrigin', result.certificate.id, {
        certNumber: result.certificate.certNumber,
        shipmentId: result.certificate.shipmentId,
        countryOfOrigin: result.certificate.countryOfOrigin,
      }, requester.id);
      return { success: true, certificate: result.certificate.toJSON() };
    }

    case 'erp_get_compliance_dashboard': {
      const cs = require('../services/aiWriteServices/complianceWriteService');
      const result = await cs.getComplianceDashboard();
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, dashboard: result.dashboard };
    }

    // ── Phase 4.15c-1: Container loading (5 tools) ──────────────────────
    case 'erp_create_container_load': {
      const requester = await getCurrentUserOrThrow();
      const cl = require('../services/aiWriteServices/containerLoadingWriteService');
      const result = await cl.createContainerLoad({
        containerType: args.container_type,
        containerNumber: args.container_number,
        shipmentId: args.shipment_id,
        purchaseOrderId: args.purchase_order_id,
        destinationPort: args.destination_port,
        etd: args.etd,
        eta: args.eta,
        notes: args.notes,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_container_load', 'Container', result.container.id, {
        containerNumber: result.container.containerNumber,
        containerType: result.container.containerType,
        shipmentId: result.container.shipmentId,
        purchaseOrderId: result.container.purchaseOrderId,
      }, requester.id);
      return { success: true, container: result.container.toJSON() };
    }

    case 'erp_optimize_container_load': {
      const cl = require('../services/aiWriteServices/containerLoadingWriteService');
      const result = await cl.optimizeContainerLoad({
        containerType: args.container_type,
        items: args.items,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, ...result.plan };
    }

    case 'erp_list_container_loads': {
      const cl = require('../services/aiWriteServices/containerLoadingWriteService');
      const result = await cl.listContainerLoads({
        containerType: args.container_type,
        containerStatus: args.container_status,
        shipmentId: args.shipment_id,
        purchaseOrderId: args.purchase_order_id,
        search: args.search,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.containers.length
        ? result.containers.map(c => c.toJSON())
        : 'No container loads match those filters.';
    }

    case 'erp_get_container_load': {
      const cl = require('../services/aiWriteServices/containerLoadingWriteService');
      const result = await cl.getContainerLoad(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, container: result.container.toJSON() };
    }

    case 'erp_update_container_load': {
      const requester = await getCurrentUserOrThrow();
      const cl = require('../services/aiWriteServices/containerLoadingWriteService');
      const result = await cl.updateContainerLoad(args.id, {
        containerStatus: args.container_status,
        destinationPort: args.destination_port,
        etd: args.etd,
        eta: args.eta,
        cargoWeight: args.cargo_weight,
        usedCapacity: args.used_capacity,
        palletCount: args.pallet_count,
        boxCount: args.box_count,
        loadingDate: args.loading_date,
        departureDate: args.departure_date,
        notes: args.notes,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('update_container_load', 'Container', result.container.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, container: result.container.toJSON() };
    }

    // ── Phase 4.15c-2: Quality / inspection (9 tools) ───────────────────
    case 'erp_schedule_inspection': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.scheduleInspection({
        type: args.type,
        factoryId: args.factory_id,
        inspectorId: args.inspector_id,
        salesOrderId: args.sales_order_id,
        purchaseOrderId: args.purchase_order_id,
        scheduledDate: args.scheduled_date,
        notes: args.notes,
        inspectionNumber: args.inspection_number,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('schedule_inspection', 'Inspection', result.inspection.id, {
        inspectionNumber: result.inspection.inspectionNumber,
        type: result.inspection.type,
        factoryId: result.inspection.factoryId,
        salesOrderId: result.inspection.salesOrderId,
        purchaseOrderId: result.inspection.purchaseOrderId,
      }, requester.id);
      return { success: true, inspection: result.inspection.toJSON() };
    }

    case 'erp_start_inspection': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.startInspection(args.id, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('start_inspection', 'Inspection', result.inspection.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, inspection: result.inspection.toJSON() };
    }

    case 'erp_complete_inspection': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.completeInspection(args.id, {
        overallResult: args.overall_result,
        notes: args.notes,
        completedDate: args.completed_date,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('complete_inspection', 'Inspection', result.inspection.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, inspection: result.inspection.toJSON() };
    }

    case 'erp_add_inspection_item': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.addInspectionItem({
        inspectionId: args.inspection_id,
        productId: args.product_id,
        checkPoint: args.check_point,
        criteria: args.criteria,
        result: args.result,
        value: args.value,
        notes: args.notes,
        images: args.images,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('add_inspection_item', 'InspectionItem', result.item.id, {
        inspectionId: result.item.inspectionId,
        productId: result.item.productId,
        checkPoint: result.item.checkPoint,
        result: result.item.result,
      }, requester.id);
      return { success: true, item: result.item.toJSON() };
    }

    case 'erp_update_inspection_item': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.updateInspectionItem(args.item_id, {
        result: args.result,
        value: args.value,
        notes: args.notes,
        checkPoint: args.check_point,
        criteria: args.criteria,
        images: args.images,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('update_inspection_item', 'InspectionItem', result.item.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, item: result.item.toJSON() };
    }

    case 'erp_list_inspections': {
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.listInspections({
        status: args.status,
        type: args.type,
        factoryId: args.factory_id,
        inspectorId: args.inspector_id,
        salesOrderId: args.sales_order_id,
        purchaseOrderId: args.purchase_order_id,
        scheduledFrom: args.scheduled_from,
        scheduledTo: args.scheduled_to,
        search: args.search,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.inspections.length
        ? result.inspections.map(i => i.toJSON())
        : 'No inspections match those filters.';
    }

    case 'erp_get_inspection': {
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.getInspection(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, inspection: result.inspection.toJSON() };
    }

    case 'erp_generate_inspection_report': {
      const requester = await getCurrentUserOrThrow();
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.generateInspectionReport({
        inspectionId: args.inspection_id,
        summary: args.summary,
        recommendations: args.recommendations,
        fileUrl: args.file_url,
        extraFindings: args.extra_findings,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('generate_inspection_report', 'InspectionReport', result.report.id, {
        inspectionId: result.report.inspectionId,
        reportNumber: result.report.reportNumber,
      }, requester.id);
      return { success: true, report: result.report.toJSON() };
    }

    case 'erp_get_inspection_report': {
      const ins = require('../services/aiWriteServices/inspectionWriteService');
      const result = await ins.getInspectionReport({
        reportId: args.report_id,
        reportNumber: args.report_number,
        inspectionId: args.inspection_id,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, report: result.report.toJSON() };
    }

    // ── Phase 4.15c-3: Sample management (6 tools) ──────────────────────
    case 'erp_create_sample_request': {
      const requester = await getCurrentUserOrThrow();
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.createSampleRequest({
        customerId: args.customer_id,
        products: args.products,
        priority: args.priority,
        requiredByDate: args.required_by_date,
        specialRequirements: args.special_requirements,
        notes: args.notes,
        requestNumber: args.request_number,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_sample_request', 'SampleRequest', result.request.id, {
        requestNumber: result.request.requestNumber,
        customerId: result.request.customerId,
        priority: result.request.priority,
        totalQuantity: Number(result.request.totalQuantity),
      }, requester.id);
      return { success: true, request: result.request.toJSON() };
    }

    case 'erp_approve_sample_request': {
      const requester = await getCurrentUserOrThrow();
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.approveSampleRequest(args.id, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('approve_sample_request', 'SampleRequest', result.request.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, request: result.request.toJSON() };
    }

    case 'erp_create_sample_shipment': {
      const requester = await getCurrentUserOrThrow();
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.createSampleShipment({
        sampleRequestId: args.sample_request_id,
        quantity: args.quantity,
        shippingMethod: args.shipping_method,
        carrier: args.carrier,
        trackingNumber: args.tracking_number,
        shippedDate: args.shipped_date,
        expectedDeliveryDate: args.expected_delivery_date,
        weight: args.weight,
        weightUnit: args.weight_unit,
        shippingCost: args.shipping_cost,
        currency: args.currency,
        notes: args.notes,
        shipmentNumber: args.shipment_number,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_sample_shipment', 'SampleShipment', result.shipment.id, {
        shipmentNumber: result.shipment.shipmentNumber,
        sampleRequestId: result.shipment.sampleRequestId,
        carrier: result.shipment.carrier,
        trackingNumber: result.shipment.trackingNumber,
        requestStatusBefore: result.requestBefore?.status,
        requestStatusAfter: result.requestAfter?.status,
      }, requester.id);
      return { success: true, shipment: result.shipment.toJSON() };
    }

    case 'erp_record_sample_feedback': {
      const requester = await getCurrentUserOrThrow();
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.recordSampleFeedback({
        sampleRequestId: args.sample_request_id,
        rating: args.rating,
        quality: args.quality,
        packaging: args.packaging,
        delivery: args.delivery,
        comments: args.comments,
        issues: args.issues,
        recommendations: args.recommendations,
        sentByContactId: args.sent_by_contact_id,
        followUpDate: args.follow_up_date,
        internalNotes: args.internal_notes,
        status: args.status,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('record_sample_feedback', 'SampleFeedback', result.feedback.id, {
        sampleRequestId: result.feedback.sampleRequestId,
        rating: result.feedback.rating,
        status: result.feedback.status,
      }, requester.id);
      return { success: true, feedback: result.feedback.toJSON() };
    }

    case 'erp_list_sample_requests': {
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.listSampleRequests({
        customerId: args.customer_id,
        status: args.status,
        priority: args.priority,
        requestFrom: args.request_from,
        requestTo: args.request_to,
        search: args.search,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.requests.length
        ? result.requests.map(r => r.toJSON())
        : 'No sample requests match those filters.';
    }

    case 'erp_get_sample_request': {
      const sm = require('../services/aiWriteServices/sampleWriteService');
      const result = await sm.getSampleRequest(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, request: result.request.toJSON() };
    }

    // ── Phase 4.15b-2: Letter of Credit (7 tools) ───────────────────────
    case 'erp_create_letter_of_credit': {
      const requester = await getCurrentUserOrThrow();
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.createLetterOfCredit({
        lcNumber: args.lc_number,
        supplierId: args.supplier_id,
        customerId: args.customer_id,
        issuingBank: args.issuing_bank,
        advisingBank: args.advising_bank,
        beneficiary: args.beneficiary,
        amount: args.amount,
        currency: args.currency,
        issueDate: args.issue_date,
        expiryDate: args.expiry_date,
        type: args.type,
        terms: args.terms,
        paymentTerms: args.payment_terms,
        tolerance: args.tolerance,
        toleranceType: args.tolerance_type,
        partialShipment: args.partial_shipment,
        transhipmentAllowed: args.transhipment_allowed,
        incoterm: args.incoterm,
        notes: args.notes,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('create_letter_of_credit', 'LetterOfCredit', result.lc.id, {
        lcNumber: result.lc.lcNumber,
        amount: Number(result.lc.amount),
        currency: result.lc.currency,
        supplierId: result.lc.supplierId,
        customerId: result.lc.customerId,
        issuingBank: result.lc.issuingBank,
      }, requester.id);
      return { success: true, lc: result.lc.toJSON() };
    }

    case 'erp_submit_letter_of_credit': {
      const requester = await getCurrentUserOrThrow();
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.submitLetterOfCredit(args.id, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('submit_letter_of_credit', 'LetterOfCredit', result.lc.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, lc: result.lc.toJSON() };
    }

    case 'erp_approve_letter_of_credit': {
      const requester = await getCurrentUserOrThrow();
      // Super-admin gate: LC approval is a high-stakes financial decision.
      if (requester.role !== 'super_admin') {
        return formatMcpWriteError({
          ok: false, code: 'forbidden', httpStatus: 403,
          message: `Only super_admin can approve a Letter of Credit (current role: ${requester.role}). LC approval is a high-stakes financial commitment.`,
        });
      }
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.approveLetterOfCredit(args.id, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('approve_letter_of_credit', 'LetterOfCredit', result.lc.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, lc: result.lc.toJSON() };
    }

    case 'erp_attach_lc_document': {
      const requester = await getCurrentUserOrThrow();
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.attachLcDocument({
        letterOfCreditId: args.letter_of_credit_id,
        documentType: args.document_type,
        documentNumber: args.document_number,
        fileName: args.file_name,
        fileUrl: args.file_url,
        status: args.status,
        remarks: args.remarks,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('attach_lc_document', 'LetterOfCreditDocument', result.document.id, {
        letterOfCreditId: result.document.letterOfCreditId,
        documentType: result.document.documentType,
        fileName: result.document.fileName,
      }, requester.id);
      return { success: true, document: result.document.toJSON() };
    }

    case 'erp_record_lc_payment': {
      const requester = await getCurrentUserOrThrow();
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.recordLcPayment(args.id, {
        presentedAmount: args.presented_amount,
        presentedDate: args.presented_date,
        paidAmount: args.paid_amount,
        paidDate: args.paid_date,
      }, { userId: requester.id, source: 'mcp' });
      if (!result.ok) return formatMcpWriteError(result);
      await auditAiWrite('record_lc_payment', 'LetterOfCredit', result.lc.id, {
        before: result.before,
        after: result.after,
      }, requester.id);
      return { success: true, lc: result.lc.toJSON() };
    }

    case 'erp_list_letters_of_credit': {
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.listLettersOfCredit({
        status: args.status,
        supplierId: args.supplier_id,
        customerId: args.customer_id,
        type: args.type,
        issuingBank: args.issuing_bank,
        expiringBefore: args.expiring_before,
        search: args.search,
        limit: args.limit,
      });
      if (!result.ok) return formatMcpWriteError(result);
      return result.letters.length
        ? result.letters.map(l => l.toJSON())
        : 'No letters of credit match those filters.';
    }

    case 'erp_get_letter_of_credit': {
      const lcSvc = require('../services/aiWriteServices/letterOfCreditWriteService');
      const result = await lcSvc.getLetterOfCredit(args.id);
      if (!result.ok) return formatMcpWriteError(result);
      return { success: true, lc: result.lc.toJSON() };
    }

    case 'calculate_landed_cost': {
      const { product_cost, quantity = 1, freight = 0, insurance = 0,
              customs_duty = 0, handling = 0, local_delivery = 0,
              currency = 'USD', margin_percent } = args;
      if (product_cost === undefined || product_cost === null) {
        return 'Missing product_cost (FOB price per unit).';
      }
      const fobPerUnit = parseFloat(product_cost);
      const qty = parseFloat(quantity);
      const totalProductCost = fobPerUnit * qty;
      const f = parseFloat(freight);
      const ins = parseFloat(insurance);
      const duty = parseFloat(customs_duty);
      const h = parseFloat(handling);
      const ld = parseFloat(local_delivery);
      const totalLandedCost = totalProductCost + f + ins + duty + h + ld;
      const costPerUnit = qty > 0 ? totalLandedCost / qty : totalLandedCost;
      const breakdown = {
        product: totalProductCost,
        freight: f,
        insurance: ins,
        customsDuty: duty,
        handling: h,
        localDelivery: ld,
        totalLandedCost,
        costPerUnit,
        currency,
      };
      // Optional margin / sell-price suggestion for the 4-min on-phone case
      if (margin_percent !== undefined && margin_percent !== null) {
        const m = parseFloat(margin_percent);
        if (m >= 0 && m < 100) {
          breakdown.marginPercent = m;
          breakdown.sellPricePerUnit = costPerUnit / (1 - m / 100);
          breakdown.sellPriceTotal = breakdown.sellPricePerUnit * qty;
          breakdown.profitTotal = breakdown.sellPriceTotal - totalLandedCost;
        }
      }
      return breakdown;
    }

    // ── Google Drive ────────────────────────────────────────────────────────

    case 'search_drive_files': {
      // Phase 4.9.3b: accountKey routing. accountKey='fw' targets
      // alexflorway@gmail.com (FW brand context); 'sh' or omitted
      // targets alex@sovernhouse.co. brandCode alias also accepted
      // for callers that already carry a brand context.
      const accountKey = args.accountKey || (args.brandCode ? resolveDriveAccount(args.brandCode) : 'sh');
      const targetEmail = emailForAccountKey(accountKey);
      const { auth } = await getGoogleAuth(targetEmail);
      const drive = getGoogle().drive({ version: 'v3', auth });

      const query = [
        args.query ? `fullText contains '${args.query.replace(/'/g, "\\'")}'` : null,
        args.name  ? `name contains '${args.name.replace(/'/g, "\\'")}'`      : null,
        "trashed = false",
      ].filter(Boolean).join(' and ');

      const resp = await drive.files.list({
        q: query || "trashed = false",
        pageSize: Math.min(args.limit || 10, 20),
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
      });

      const files = resp.data.files || [];
      const account = `${accountKey} (${targetEmail})`;
      return files.length ? { account, files } : `No Drive files matching that query under account ${account}.`;
    }

    case 'read_drive_file': {
      // Phase 4.9.3b: accountKey routing — same rules as search_drive_files.
      // Phase 4.14: xlsx / xls / docx / pdf / rtf parsers + per-format
      // narrowing params (sheet_name, row_range, column_range,
      // raw_formulas, page_range, max_pages) + 10-min LRU cache.
      const accountKey = args.accountKey || (args.brandCode ? resolveDriveAccount(args.brandCode) : 'sh');
      const targetEmail = emailForAccountKey(accountKey);
      const { auth } = await getGoogleAuth(targetEmail);
      const drive = getGoogle().drive({ version: 'v3', auth });

      const parsers = require('../services/driveDocumentParsers');
      const cache = getDriveReadCache();

      // Cache key includes every parameter that affects output. accountKey
      // is part of the key because the same fileId can map to different
      // OAuth contexts (SH Drive vs FW Drive) with different access.
      const cacheKey = JSON.stringify({
        fileId: args.file_id,
        accountKey,
        sheet_name: args.sheet_name || null,
        row_range: args.row_range || null,
        column_range: args.column_range || null,
        raw_formulas: !!args.raw_formulas,
        page_range: args.page_range || null,
        max_pages: args.max_pages || null,
      });
      const cached = cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      const meta = await drive.files.get({
        fileId: args.file_id,
        fields: 'id, name, mimeType, size',
      });
      const { mimeType, name } = meta.data;

      try {
        let payload;

        if (parsers.isSupported(mimeType) || mimeType === parsers.LEGACY_DOC_MIME) {
          // Phase 4.14: download the bytes and dispatch to the right parser.
          const resp = await drive.files.get(
            { fileId: args.file_id, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          const buffer = Buffer.from(resp.data);
          const content = await parsers.parseByMime(buffer, mimeType, {
            name,
            sheet_name: args.sheet_name,
            row_range: args.row_range,
            column_range: args.column_range,
            raw_formulas: args.raw_formulas,
            page_range: args.page_range,
            max_pages: args.max_pages,
          });
          payload = { name, mimeType, content };
        } else if (mimeType === 'application/vnd.google-apps.document') {
          const resp = await drive.files.export(
            { fileId: args.file_id, mimeType: 'text/plain' },
            { responseType: 'arraybuffer' }
          );
          const raw = Buffer.from(resp.data).toString('utf8');
          payload = { name, mimeType, content: applyDriveReadOutputCap(raw) };
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          const resp = await drive.files.export(
            { fileId: args.file_id, mimeType: 'text/csv' },
            { responseType: 'arraybuffer' }
          );
          const raw = Buffer.from(resp.data).toString('utf8');
          payload = { name, mimeType, content: applyDriveReadOutputCap(raw) };
        } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
          const resp = await drive.files.get(
            { fileId: args.file_id, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          const raw = Buffer.from(resp.data).toString('utf8');
          payload = { name, mimeType, content: applyDriveReadOutputCap(raw) };
        } else {
          payload = {
            name, mimeType,
            note: `File type ${mimeType} is not supported by Phase 4.14 parsers. Supported: Google Docs/Sheets, plain text, CSV, xlsx, xls, docx, pdf, rtf. For pptx, image PDFs, or other formats, share the webViewLink and have the user describe the content.`,
          };
        }

        cache.set(cacheKey, payload);
        return payload;
      } catch (err) {
        if (err && err.code && err.code.startsWith && typeof err.userMessage === 'string') {
          // ParserError from driveDocumentParsers — surface the user-friendly
          // message rather than the raw exception. Don't cache errors.
          return { name, mimeType, error: err.userMessage, errorCode: err.code };
        }
        return { name, mimeType, error: `read_drive_file failed: ${err.message}` };
      }
    }

    case 'read_attachment': {
      // Returns the file contents in a form claude -p can ingest:
      //  - images  → MCP image content (base64) so vision works directly
      //  - PDF     → extracted text (pdf-parse), truncated to 16KB
      //  - DOCX    → extracted text (mammoth)
      //  - XLSX/XLS → extracted as a list of sheets, each as CSV-style text (exceljs)
      //  - text/CSV → direct text
      //  - Google Docs/Sheets → exported via Drive export API
      //  - .doc (legacy Word) → not supported, ask to re-save as .docx
      // Files live under "Sovern ERP/AI uploads/YYYY-MM/" (uploaded via
      // POST /api/ai/attachments) but read_attachment also works on any
      // arbitrary Drive file the user has access to.
      const TEXT_CAP = 16000;
      const { auth } = await getGoogleAuth();
      const drive = getGoogle().drive({ version: 'v3', auth });

      const meta = await drive.files.get({
        fileId: args.file_id,
        fields: 'id,name,mimeType,size,webViewLink',
      });
      const { mimeType, name, webViewLink } = meta.data;

      async function downloadBytes() {
        const resp = await drive.files.get(
          { fileId: args.file_id, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        return Buffer.from(resp.data);
      }

      // Image → vision content
      if (/^image\//i.test(mimeType)) {
        const buf = await downloadBytes();
        return {
          __mcpContent: [
            { type: 'text', text: `Attachment: ${name} (${mimeType})` },
            { type: 'image', data: buf.toString('base64'), mimeType },
          ],
        };
      }

      // PDF → shared parsePdfRaw helper from driveDocumentParsers (4.15-followup).
      // Phase 4.14 + the L-048 hotfix lived in two places (read_drive_file's
      // parsePdf and this read_attachment branch). Both wrapped the Buffer
      // as Uint8Array to work around pdf-parse 1.1.4 + Node 22's xref bug.
      // The shared helper centralises that fix — any future caller inherits
      // it automatically. read_attachment composes the helper's
      // { numpages, fullText, rawPages } into its existing TEXT_CAP-truncated
      // response shape (different from parsePdf's === Page N === markers).
      if (mimeType === 'application/pdf') {
        try {
          const { parsePdfRaw } = require('../services/driveDocumentParsers');
          const buf = await downloadBytes();
          const parsed = await parsePdfRaw(buf, { name });
          const text = parsed.fullText;
          return {
            name, mimeType,
            pageCount: parsed.numpages || null,
            content: text.length > TEXT_CAP
              ? text.slice(0, TEXT_CAP) + `\n\n... (truncated; full file ${parsed.numpages || '?'} pages, view at ${webViewLink || '(no link)'})`
              : text,
          };
        } catch (e) {
          // parsePdfRaw throws ParserError with user-friendly messages
          // for encrypted / image-only PDFs. Surface those rather than
          // burying them in a generic "parse failed" string.
          if (e && e.code && typeof e.userMessage === 'string') {
            return { name, mimeType, error: e.userMessage, errorCode: e.code, webViewLink };
          }
          return { name, mimeType, error: `PDF parse failed: ${e.message}`, webViewLink };
        }
      }

      // DOCX → mammoth text
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const mammoth = require('mammoth');
          const buf = await downloadBytes();
          const result = await mammoth.extractRawText({ buffer: buf });
          const text = (result.value || '').trim();
          return {
            name, mimeType,
            content: text.length > TEXT_CAP ? text.slice(0, TEXT_CAP) + '\n\n... (truncated)' : text,
          };
        } catch (e) {
          return { name, mimeType, error: `DOCX parse failed: ${e.message}`, webViewLink };
        }
      }

      // XLSX / XLS → exceljs (already a backend dep). Returns each sheet as
      // tab-separated rows so the AI sees structure without needing to parse.
      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          || mimeType === 'application/vnd.ms-excel') {
        try {
          const ExcelJS = require('exceljs');
          const buf = await downloadBytes();
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buf);
          const sheets = [];
          let totalChars = 0;
          for (const ws of wb.worksheets) {
            const lines = [];
            ws.eachRow({ includeEmpty: false }, (row) => {
              const cells = [];
              row.eachCell({ includeEmpty: true }, (c) => {
                const v = c.value == null ? '' : (typeof c.value === 'object' && c.value.text ? c.value.text : String(c.value));
                cells.push(v.replace(/\t/g, ' ').replace(/\n/g, ' '));
              });
              lines.push(cells.join('\t'));
            });
            const sheetText = lines.join('\n');
            sheets.push({ name: ws.name, rows: lines.length, content: sheetText.slice(0, TEXT_CAP) });
            totalChars += sheetText.length;
            if (totalChars > TEXT_CAP * 3) break; // hard cap across all sheets
          }
          return { name, mimeType, sheetCount: wb.worksheets.length, sheets };
        } catch (e) {
          return { name, mimeType, error: `XLSX parse failed: ${e.message}`, webViewLink };
        }
      }

      // Legacy Word .doc — no good Node lib. Ask user to convert.
      if (mimeType === 'application/msword') {
        return {
          name, mimeType,
          note: 'Legacy .doc format not supported. Re-save as .docx and re-upload, or paste the relevant text.',
          webViewLink,
        };
      }

      // Plain text / CSV / TSV
      if (/^text\//i.test(mimeType)) {
        const buf = await downloadBytes();
        const text = buf.toString('utf8');
        return {
          name, mimeType,
          content: text.length > TEXT_CAP ? text.slice(0, TEXT_CAP) + '\n\n... (truncated)' : text,
        };
      }

      // Google Doc → export to text/plain
      if (mimeType === 'application/vnd.google-apps.document') {
        const resp = await drive.files.export(
          { fileId: args.file_id, mimeType: 'text/plain' },
          { responseType: 'arraybuffer' }
        );
        const text = Buffer.from(resp.data).toString('utf8');
        return {
          name, mimeType,
          content: text.length > TEXT_CAP ? text.slice(0, TEXT_CAP) + '\n\n... (truncated)' : text,
        };
      }

      // Google Sheet → export to CSV
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        const resp = await drive.files.export(
          { fileId: args.file_id, mimeType: 'text/csv' },
          { responseType: 'arraybuffer' }
        );
        const text = Buffer.from(resp.data).toString('utf8');
        return {
          name, mimeType,
          content: text.length > TEXT_CAP ? text.slice(0, TEXT_CAP) + '\n\n... (truncated)' : text,
        };
      }

      return { name, mimeType, note: `File type ${mimeType} not supported by read_attachment.`, webViewLink };
    }

    // ── Products ────────────────────────────────────────────────────────────

    case 'list_product_categories': {
      // Phase 4.9.1: accept parentId + includeArchived filters and a
      // tree flag. tree=true returns a nested {id,name,children:[]}
      // shape; otherwise a flat list ordered by sortOrder ASC.
      const where = { isActive: true };
      if (args.parentId !== undefined) where.parentId = args.parentId || null;
      if (args.includeArchived !== true) where.isArchived = false;
      const cats = await getDb().ProductCategory.findAll({
        where,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
        attributes: ['id', 'name', 'slug', 'description', 'parentId', 'sortOrder', 'isArchived'],
      });
      if (!cats.length) return 'No product categories found.';
      if (args.tree === true) {
        const rows = cats.map(c => c.toJSON());
        const byParent = {};
        for (const r of rows) {
          const key = r.parentId || 'ROOT';
          if (!byParent[key]) byParent[key] = [];
          byParent[key].push({ ...r });
        }
        const stitch = (parentId) => (byParent[parentId || 'ROOT'] || []).map(n => ({
          ...n,
          children: stitch(n.id),
        }));
        return stitch(null);
      }
      return cats.map(c => c.toJSON());
    }

    case 'list_products': {
      // Phase 4.9.3a: extended filters per spec — brandCode,
      // productCategoryId, active, ironliteBadged, searchTerm.
      const { Op } = require('sequelize');
      const where = { deletedAt: null };
      const term = args.searchTerm || args.search;
      if (term) {
        where[Op.or] = [
          { name: { [Op.like]: `%${term}%` } },
          { sku:  { [Op.like]: `%${term}%` } },
        ];
      }
      if (args.category_id || args.productCategoryId) {
        where.categoryId = args.productCategoryId || args.category_id;
      }
      if (args.factory_id) where.factoryId = args.factory_id;
      if (args.brandCode || args.brand_code) {
        where.brandCode = String(args.brandCode || args.brand_code).toUpperCase();
      }
      if (args.active !== undefined) where.isActive = Boolean(args.active);

      let products = await getDb().Product.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'name', 'sku', 'brandCode', 'description', 'unit', 'moqUnit',
          'productType', 'specifications', 'baseFobPrice', 'currency',
          'minOrderQty', 'hsCode', 'isActive', 'categoryId', 'factoryId'],
        include: [
          { model: getDb().ProductCategory, as: 'category', attributes: ['id', 'name'] },
          { model: getDb().Factory, as: 'factory', attributes: ['id', 'companyName', 'country'] },
        ],
      });
      if (args.ironliteBadged !== undefined) {
        const want = Boolean(args.ironliteBadged);
        products = products.filter(p => Boolean(p.specifications?.ironliteBadged) === want);
      }
      return products.length ? products.map(p => p.toJSON()) : 'No products found.';
    }

    case 'get_product': {
      // Phase 4.9.3a: decorates the product row with the array of
      // currently-active ProductPrice rows so the AI doesn't need a
      // second call to see the floor.
      const id = args.id || args.productId || args.product_id;
      const product = await getDb().Product.findOne({
        where: { id, deletedAt: null },
        include: [
          { model: getDb().ProductCategory, as: 'category', attributes: ['id', 'name'] },
          { model: getDb().Factory, as: 'factory', attributes: ['id', 'companyName', 'country', 'city'] },
        ],
      });
      if (!product) return `Product ${id} not found.`;
      const today = new Date().toISOString().slice(0, 10);
      const { Op } = require('sequelize');
      const currentPrices = await getDb().ProductPrice.findAll({
        where: {
          productId: id,
          validFrom: { [Op.lte]: today },
          [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: today } }],
        },
        order: [['validFrom', 'DESC']],
      });
      return { ...product.toJSON(), _currentPrices: currentPrices.map(p => p.toJSON()) };
    }

    case 'create_product': {
      const { Op } = require('sequelize');

      // Phase 4.9.3a: brandCode is required (was implicit-default 'SH').
      // Validates against active Brand. AI must pick a brand context
      // explicitly so cross-brand product creation is auditable.
      const brandCode = (args.brandCode || args.brand_code || '').toUpperCase();
      if (!brandCode) return 'Error: brandCode is required. Use list_brands to find a valid code (e.g. "FW" for HanHua / FlorWay / IronLite, "SH" for Sovern House).';
      const brand = await getDb().Brand.findOne({ where: { code: brandCode, active: true } });
      if (!brand) return `Error: brand "${brandCode}" not active.`;

      // Resolve factory: prefer factory_id, fall back to name search.
      // Now optional — products can be created without a factory in
      // the AI assistant flow (factory tagged later via create_product_price).
      let factoryId = args.factory_id;
      if (!factoryId && args.factory_name) {
        const factory = await getDb().Factory.findOne({
          where: { companyName: { [Op.like]: `%${args.factory_name}%` } },
          attributes: ['id', 'companyName'],
        });
        if (!factory) return `Factory not found: "${args.factory_name}". Use list_factories to find the correct record.`;
        factoryId = factory.id;
      }

      // Resolve category: prefer category_id (or productCategoryId from
      // spec), fall back to name search. Refuse create_category fallback;
      // category provisioning is its own preview-confirm flow.
      let categoryId = args.productCategoryId || args.category_id;
      if (!categoryId && args.category_name) {
        const cat = await getDb().ProductCategory.findOne({
          where: { name: { [Op.like]: `%${args.category_name}%` }, isActive: true, isArchived: false },
          attributes: ['id', 'name'],
        });
        if (!cat) return `Error: category "${args.category_name}" not found. Use list_product_categories to find one, or create_product_category to add a new one (with preview + confirm).`;
        categoryId = cat.id;
      }
      if (!categoryId) return 'Error: productCategoryId or category_name is required.';

      // Auto-generate SKU if not provided
      let sku = args.sku;
      if (!sku) {
        const prefix = args.name
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, '')
          .split(' ')
          .filter(Boolean)
          .slice(0, 3)
          .map(w => w.slice(0, 3))
          .join('-');
        const suffix = Date.now().toString().slice(-4);
        sku = `${prefix}-${suffix}`;
      }

      // Build specifications object. Phase 4.9.3a: spec fields that
      // don't map to typed columns land here as a typed sub-bag, so
      // a future schema migration can promote any of them without
      // touching write callers.
      const specs = {};
      const specKeys = ['thickness', 'width', 'length', 'material', 'finish', 'color',
        'wearLayer', 'acRating', 'species', 'grade', 'construction', 'clickSystem'];
      for (const k of specKeys) {
        if (args.specifications?.[k] != null) specs[k] = args.specifications[k];
      }
      // Logistics fields stored in specifications JSON
      if (args.departure_port)  specs.departurePort = args.departure_port;
      if (args.lead_time)       specs.leadTime      = args.lead_time;
      if (args.packing)         specs.packing       = args.packing;
      if (args.certifications)  specs.certifications = args.certifications;

      // Phase 4.9.3a typed spec fields, all into specs JSON for now:
      const pcKeys = [
        'productType', 'constructionType', 'fullBuildDescription',
        'plankWidthInches', 'plankLengthInches', 'totalThicknessMm', 'wearLayerMil',
        'piecesPerBox', 'boxesPerPallet', 'palletsPerContainer',
        'm2PerBox', 'm2PerPallet', 'm2PerContainer',
        'ironliteBadged', 'defaultCommissionRate',
      ];
      for (const k of pcKeys) {
        if (args[k] !== undefined && args[k] !== null) specs[k] = args[k];
      }
      // Merge any caller-supplied raw specs object too.
      if (args.specs && typeof args.specs === 'object') {
        Object.assign(specs, args.specs);
      }

      // productType column is a STRICT ENUM (lvt/spc/wpc/hardwood/
      // laminate/tile/ceramic/other). If the AI passes a free-form
      // label that matches one of the enum values, use it; otherwise
      // store the raw label in specs.productTypeLabel and set the
      // column to 'other' so the catalog filter still sees it.
      const productTypeEnum = ['lvt', 'spc', 'wpc', 'hardwood', 'laminate', 'tile', 'ceramic', 'other'];
      let typedProductType = null;
      if (args.productType) {
        const lower = String(args.productType).toLowerCase();
        if (productTypeEnum.includes(lower)) {
          typedProductType = lower;
        } else {
          specs.productTypeLabel = args.productType;
          typedProductType = 'other';
        }
      }

      // moqUnit is also ENUM (sqm/sqft/box/pallet/roll/piece/container).
      // Spec's unitOfMeasure: m2/sqft/piece/set. Map m2 → sqm, set → piece.
      const unitMap = { m2: 'sqm', sqft: 'sqft', piece: 'piece', set: 'piece', sqm: 'sqm', box: 'box', pallet: 'pallet', roll: 'roll', container: 'container' };
      const resolvedMoqUnit = unitMap[String(args.unitOfMeasure || args.unit || 'sqm').toLowerCase()] || 'sqm';

      // Products are created inactive — Alex must approve before they're live
      // EXCEPT when args.active===true is explicitly passed (the 4.9.3a
      // spec allows active default true; we keep inactive as a safer
      // default unless the caller opts in).
      const isActive = args.active === true;

      // Phase 4.16.3: accept top-level Product columns the AI directive
      // needs (base_fob_price, lead_time_days, origin_country,
      // origin_variants, cubic_meters). Each is optional; nulls preserve
      // pre-4.16.3 behavior for existing callers. originVariants accepts
      // an array of {origin, factoryId, ...} entries — pass-through to
      // the JSON column without re-validation here (validation happens
      // at quote-build / landed-cost time per L-023).
      const product = await getDb().Product.create({
        brandCode,
        name:               args.name,
        sku,
        description:        args.description         || null,
        salesDescription:   args.sales_description   || null,
        purchaseDescription:args.purchase_description || null,
        categoryId,
        factoryId:          factoryId || null,
        productType:        typedProductType,
        unit:               resolvedMoqUnit,
        moqUnit:            resolvedMoqUnit,
        currency:           args.currency || 'USD',
        specifications:     specs,
        minOrderQty:        args.min_order_qty        || 1,
        weight:             args.weight               || null,
        cubicMeters:        args.cubic_meters ?? args.cubicMeters ?? null,
        hsCode:             args.hs_code              || null,
        baseFobPrice:       args.base_fob_price ?? args.baseFobPrice ?? null,
        leadTimeDays:       args.lead_time_days ?? args.leadTimeDays ?? null,
        originCountry:      args.origin_country ?? args.originCountry ?? null,
        originVariants:     Array.isArray(args.origin_variants)
                              ? args.origin_variants
                              : (Array.isArray(args.originVariants) ? args.originVariants : []),
        certifications:     Array.isArray(args.certifications_list)
                              ? args.certifications_list
                              : (Array.isArray(args.certificationsArray) ? args.certificationsArray : []),
        isActive,
      });

      // Create a ProductPrice record if FOB price is provided.
      // Phase 4.9.2b schema: costPriceUsdPerM2 (req) + sellingPriceUsdPerM2
      // (optional, computed when null) + markupPercent (decimal 0..1) +
      // origin/factoryId (at least one required). Without a factoryId
      // we need an origin — derive from the country of the matched
      // factory if known, else require args.origin.
      let priceRecord = null;
      const fobPriceUsd = args.fob_price ?? args.fobPrice ?? args.costPriceUsdPerM2;
      if (fobPriceUsd) {
        const cost = parseFloat(fobPriceUsd);
        const markupArg = args.margin ?? args.markupPercent;
        // Old code accepted margin as a percentage (5 = 5%); new schema
        // stores decimal (0.05 = 5%). Heuristic: > 1 → treat as percent.
        const markup = markupArg != null
          ? (Number(markupArg) > 1 ? Number(markupArg) / 100 : Number(markupArg))
          : null;
        const selling = args.sellingPriceUsdPerM2 != null
          ? parseFloat(args.sellingPriceUsdPerM2)
          : (markup != null ? +(cost * (1 + markup)).toFixed(4) : cost);
        const validTo = args.price_valid_until || args.validTo || null;
        const origin = args.origin || (factoryId ? null : null);
        if (!origin && !factoryId) {
          // Skip price creation — at least one of origin/factoryId is
          // required by the ProductPrice validator. Tell the caller.
          return {
            success: true,
            productId: product.id,
            name: product.name,
            sku: product.sku,
            status: 'pending_approval',
            priceId: null,
            warning: 'Product created without a price row: provide origin (e.g. "China") or factory_id/factory_name when you want to seed a ProductPrice in the same call.',
          };
        }
        priceRecord = await getDb().ProductPrice.create({
          productId:           product.id,
          factoryId:           factoryId || null,
          origin:              origin || null,
          costPriceUsdPerM2:   cost,
          sellingPriceUsdPerM2:selling,
          markupPercent:       markup,
          currency:            args.currency || 'USD',
          tariffRate:          args.tariffRate != null ? parseFloat(args.tariffRate) : null,
          tariffDestination:   args.tariffDestination || null,
          validFrom:           (args.validFrom || new Date().toISOString().slice(0, 10)),
          validTo:             validTo,
          sourceNote:          args.sourceNote || 'create_product MCP call',
          createdBy:           USER_ID || null,
        });
      }

      // Schedule an approval task for Alex
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDateStr = tomorrow.toISOString().slice(0, 10);

      const priceNote = priceRecord
        ? `\nFactory FOB: USD ${parseFloat(args.fob_price).toFixed(4)} / ${product.unit}\nMargin: ${parseFloat(args.margin ?? 5)}%\nSovern selling price: USD ${priceRecord.sellingPrice} / ${product.unit}${args.price_valid_until ? `\nPrice valid until: ${args.price_valid_until}` : ''}`
        : '';
      const logisticsNote = [
        specs.departurePort ? `Departure port: ${specs.departurePort}` : null,
        specs.leadTime      ? `Lead time: ${specs.leadTime}`           : null,
        specs.packing       ? `Packing: ${specs.packing}`              : null,
      ].filter(Boolean).join('\n');

      // Phase 4.17: only schedule an approval activity when the product
      // was created in pending state (active=false, the safer default).
      // If the caller explicitly passed active:true, they've already
      // approved the create — queueing a redundant "Approve …" pill on
      // the dashboard is noise. Bulk creates (e.g. the IronLite 9-SKU
      // launch) used to spam 9 chips for products that were already
      // live; that pattern is what triggered this gate.
      if (USER_ID && !isActive) {
        await getDb().ScheduledActivity.create({
          type:        'approve',
          entityType:  'Product',
          entityId:    product.id,
          entityLabel: `${product.name} (${product.sku})`,
          assignedToId:  USER_ID,
          assignedById:  USER_ID,
          dueDate:     dueDateStr,
          priority:    'normal',
          note:        `New product added by AI assistant — review and approve before use in quotations.\n\nProduct: ${product.name}\nSKU: ${product.sku}${priceNote}${logisticsNote ? '\n' + logisticsNote : ''}`,
          status:      'pending',
        });
      }

      const missing = [];
      if (!args.fob_price)         missing.push('FOB price');
      if (!specs.departurePort)    missing.push('departure port');
      if (!specs.leadTime)         missing.push('lead time');
      if (!args.price_valid_until) missing.push('price validity date');
      if (!args.hs_code)           missing.push('HS code');

      return {
        success:      true,
        productId:    product.id,
        name:         product.name,
        sku:          product.sku,
        status:       'pending_approval',
        priceId:      priceRecord?.id || null,
        sellingPrice: priceRecord ? `USD ${priceRecord.sellingPrice} / ${product.unit}` : null,
        missingFields: missing.length ? missing : null,
        message: `Product created and pending your approval (currently inactive). Approval task scheduled for tomorrow.${missing.length ? ` Still needed for quotations: ${missing.join(', ')}.` : ' All quotation fields present.'}`,
      };
    }

    // ── Phase 4.9.3a: Product update / get / archive ────────────────────

    case 'update_product': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.productId || args.product_id;
      if (!id) return 'Error: id is required.';
      const product = await getDb().Product.findByPk(id);
      if (!product) return `Error: Product ${id} not found.`;

      const patch = {};
      // Typed columns
      const direct = ['name', 'sku', 'description', 'salesDescription', 'purchaseDescription',
                      'categoryId', 'factoryId', 'currency', 'minOrderQty', 'weight', 'hsCode',
                      'baseFobPrice', 'originCountry'];
      for (const k of direct) {
        if (args[k] !== undefined) patch[k] = args[k];
      }
      const aliases = {
        productCategoryId: 'categoryId',
        unitOfMeasure:     'moqUnit',
        unit:              'moqUnit',
        brand_code:        'brandCode',
        brandCode:         'brandCode',
        active:            'isActive',
      };
      for (const [src, dst] of Object.entries(aliases)) {
        if (args[src] !== undefined) patch[dst] = args[src];
      }
      // Brand validation
      if (patch.brandCode !== undefined) {
        const code = String(patch.brandCode).toUpperCase();
        const b = await getDb().Brand.findOne({ where: { code, active: true } });
        if (!b) return `Error: brand "${code}" not active.`;
        patch.brandCode = code;
      }
      // moqUnit ENUM mapping
      if (patch.moqUnit !== undefined) {
        const unitMap = { m2: 'sqm', sqft: 'sqft', piece: 'piece', set: 'piece', sqm: 'sqm', box: 'box', pallet: 'pallet', roll: 'roll', container: 'container' };
        patch.moqUnit = unitMap[String(patch.moqUnit).toLowerCase()] || patch.moqUnit;
        patch.unit = patch.moqUnit;
      }
      // active → isActive boolean
      if (patch.isActive !== undefined) patch.isActive = Boolean(patch.isActive);

      // productType ENUM coercion
      if (args.productType !== undefined) {
        const productTypeEnum = ['lvt', 'spc', 'wpc', 'hardwood', 'laminate', 'tile', 'ceramic', 'other'];
        const lower = String(args.productType).toLowerCase();
        if (productTypeEnum.includes(lower)) patch.productType = lower;
        else {
          patch.productType = 'other';
          // Stash label into specs below.
        }
      }

      // Spec-bag fields merge into existing specifications JSON.
      const specMerge = {};
      const pcKeys = [
        'constructionType', 'fullBuildDescription',
        'plankWidthInches', 'plankLengthInches', 'totalThicknessMm', 'wearLayerMil',
        'piecesPerBox', 'boxesPerPallet', 'palletsPerContainer',
        'm2PerBox', 'm2PerPallet', 'm2PerContainer',
        'ironliteBadged', 'defaultCommissionRate',
      ];
      for (const k of pcKeys) {
        if (args[k] !== undefined) specMerge[k] = args[k];
      }
      if (args.productType !== undefined && patch.productType === 'other') {
        specMerge.productTypeLabel = args.productType;
      }
      if (args.specs && typeof args.specs === 'object') Object.assign(specMerge, args.specs);
      if (Object.keys(specMerge).length > 0) {
        patch.specifications = { ...(product.specifications || {}), ...specMerge };
      }

      if (Object.keys(patch).length === 0) return 'Error: no editable fields provided.';

      const before = {};
      for (const k of Object.keys(patch)) before[k] = product[k];
      await product.update(patch);
      await auditAiWrite('update_product', 'Product', product.id, { before, after: patch }, requester.id);
      return { success: true, id: product.id, updated: Object.keys(patch), before, after: patch };
    }

    case 'archive_product': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.productId || args.product_id;
      if (!id) return 'Error: id is required.';
      const product = await getDb().Product.findByPk(id);
      if (!product) return `Error: Product ${id} not found.`;
      if (!product.isActive) return `Product "${product.name}" (${product.sku}) is already inactive.`;
      await product.update({ isActive: false });
      await auditAiWrite('archive_product', 'Product', product.id, { name: product.name, sku: product.sku }, requester.id);
      return { success: true, id: product.id, name: product.name, sku: product.sku, archived: true };
    }

    case 'approve_product': {
      const requester = await requireSuperAdmin();
      const product = await getDb().Product.findByPk(args.product_id);
      if (!product) return `Product ${args.product_id} not found.`;

      const wasActive = product.isActive;
      await product.update({ isActive: true });

      const priceCount = await getDb().ProductPrice.update(
        { isActive: true },
        { where: { productId: args.product_id } }
      );

      await getDb().ScheduledActivity.update(
        { status: 'done', completedAt: new Date(), completedNote: args.note || 'Approved via AI assistant' },
        { where: { entityType: 'Product', entityId: args.product_id, status: 'pending' } }
      );

      const activatedCount = Array.isArray(priceCount) ? priceCount[0] : priceCount;
      await auditAiWrite('approve_product', 'Product', product.id, {
        sku: product.sku,
        name: product.name,
        wasActive,
        pricesActivated: activatedCount,
        note: args.note || null,
      }, requester.id);

      return {
        success: true,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        pricesActivated: activatedCount,
        message: `Product "${product.name}" is now active and available for quotations.`,
      };
    }

    case 'list_pending_approvals': {
      if (!USER_ID) return 'ERP_USER_ID not set.';
      const tasks = await getDb().ScheduledActivity.findAll({
        where: { assignedToId: USER_ID, status: 'pending', type: 'approve' },
        order: [['dueDate', 'ASC']],
        limit: 20,
      });
      if (!tasks.length) return 'No pending approval tasks.';
      return tasks.map(t => ({
        id:          t.id,
        entity:      `${t.entityType}: ${t.entityLabel || t.entityId}`,
        note:        t.note,
        due:         t.dueDate,
        priority:    t.priority,
      }));
    }

    // ── Customers (Phase 4.9.3a CRUD + lookup) ──────────────────────────────

    case 'create_customer': {
      const requester = await requireSuperAdmin();
      const brandCode = (args.brandCode || args.brand_code || '').toUpperCase();
      const companyName = (args.companyName || args.company_name || '').trim();
      if (!brandCode) return 'Error: brandCode is required.';
      if (!companyName) return 'Error: companyName is required.';

      const brand = await getDb().Brand.findOne({ where: { code: brandCode, active: true } });
      if (!brand) return `Error: brand "${brandCode}" not active. Use list_brands to find a valid code.`;

      // Uniqueness check WITHIN this brand. brandRelationships is a JSON
      // array; SQLite can't query it efficiently, so we filter in JS.
      const existing = await getDb().Customer.findAll({
        where: { companyName },
        attributes: ['id', 'companyName', 'brandRelationships'],
      });
      const dup = existing.find(c => Array.isArray(c.brandRelationships) && c.brandRelationships.includes(brandCode));
      if (dup) return `Error: a customer named "${companyName}" already exists under brand ${brandCode} (id ${dup.id}).`;

      // Primary address: spec gives an object, the model has flat
      // address/city/country strings. Flatten the object into the
      // typed columns and stash the full object in metadata for the
      // AI / admin UI to render later.
      const primaryAddress = args.primaryAddress || {};
      const addressLines = [primaryAddress.line1, primaryAddress.line2].filter(Boolean).join('\n');

      const metadata = {
        industry:           args.industry || null,
        yearFounded:        args.yearFounded || null,
        website:            args.website || null,
        source:             args.source || null,
        legalName:          args.legalName || args.companyName,
        primaryAddress:     Object.keys(primaryAddress).length ? primaryAddress : null,
        additionalAddresses: Array.isArray(args.additionalAddresses) ? args.additionalAddresses : [],
      };

      // Email + phone are NOT NULL on the model. The spec doesn't list
      // them as top-level — but the AI must supply them. Default to
      // placeholders the admin can fix later if missing.
      const customer = await getDb().Customer.create({
        companyName,
        contactPerson: args.contactPerson || null,
        email:         args.email || 'unknown@unknown.local',
        phone:         args.phone || 'unknown',
        address:       addressLines || (args.address || null),
        city:          primaryAddress.city || args.city || null,
        country:       primaryAddress.country || args.country || null,
        currency:      args.currency || 'USD',
        paymentTerms:  args.paymentTerms || 'Net 30',
        notes:         args.notes || null,
        isActive:      args.active === undefined ? true : Boolean(args.active),
        brandRelationships: [brandCode],
        productBrandingMode: args.productBrandingMode || null,
        metadata,
      });

      await auditAiWrite('create_customer', 'Customer', customer.id, {
        companyName, brandCode, source: args.source || null,
      }, requester.id);

      return {
        success: true,
        id: customer.id,
        companyName: customer.companyName,
        brandCode,
        message: `Customer "${companyName}" created under brand ${brandCode}. Add contacts via create_contact and open the first lead/quotation when ready.`,
      };
    }

    case 'update_customer': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.customerId;
      if (!id) return 'Error: id is required.';
      const customer = await getDb().Customer.findByPk(id);
      if (!customer) return `Error: Customer ${id} not found.`;

      const patch = {};
      // Typed-column updates
      for (const k of ['companyName', 'contactPerson', 'email', 'phone', 'currency', 'paymentTerms', 'notes', 'productBrandingMode']) {
        if (args[k] !== undefined) patch[k] = args[k];
      }
      if (args.active !== undefined) patch.isActive = Boolean(args.active);

      // Address: accept primaryAddress object OR flat address/city/country.
      if (args.primaryAddress) {
        const pa = args.primaryAddress;
        const addressLines = [pa.line1, pa.line2].filter(Boolean).join('\n');
        if (addressLines) patch.address = addressLines;
        if (pa.city) patch.city = pa.city;
        if (pa.country) patch.country = pa.country;
      } else {
        if (args.address !== undefined) patch.address = args.address;
        if (args.city !== undefined) patch.city = args.city;
        if (args.country !== undefined) patch.country = args.country;
      }

      // Brand: spec passes a single brandCode; we merge into the array.
      if (args.brandCode || args.brand_code) {
        const code = String(args.brandCode || args.brand_code).toUpperCase();
        const b = await getDb().Brand.findOne({ where: { code, active: true } });
        if (!b) return `Error: brand "${code}" not active.`;
        const current = Array.isArray(customer.brandRelationships) ? customer.brandRelationships : [];
        if (!current.includes(code)) patch.brandRelationships = [...current, code];
      }

      // Metadata: shallow-merge.
      const metaUpdates = {};
      for (const k of ['industry', 'yearFounded', 'website', 'source', 'legalName', 'primaryAddress', 'additionalAddresses']) {
        if (args[k] !== undefined) metaUpdates[k] = args[k];
      }
      if (Object.keys(metaUpdates).length > 0) {
        patch.metadata = { ...(customer.metadata || {}), ...metaUpdates };
      }

      if (Object.keys(patch).length === 0) return 'Error: no editable fields provided.';

      const before = {};
      for (const k of Object.keys(patch)) before[k] = customer[k];
      await customer.update(patch);
      await auditAiWrite('update_customer', 'Customer', customer.id, { before, after: patch }, requester.id);
      return { success: true, id: customer.id, updated: Object.keys(patch), before, after: patch };
    }

    case 'get_customer': {
      const id = args.id || args.customerId;
      if (!id) return 'Error: id is required.';
      const customer = await getDb().Customer.findByPk(id, {
        attributes: ['id', 'companyName', 'contactPerson', 'email', 'phone', 'address', 'city', 'country',
          'currency', 'paymentTerms', 'creditLimit', 'balance', 'rating', 'notes',
          'isActive', 'brandRelationships', 'productBrandingMode', 'privateLabelProductName',
          'screeningStatus', 'metadata', 'createdAt'],
      });
      if (!customer) return `Customer ${id} not found.`;
      const [contactCount, leadCount] = await Promise.all([
        getDb().Contact?.count({ where: { customerId: id } }) ?? 0,
        getDb().Lead?.count({ where: { convertedCustomerId: id } }) ?? 0,
      ]);
      return { ...customer.toJSON(), _counts: { contacts: contactCount, leads: leadCount } };
    }

    case 'archive_customer': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.customerId;
      if (!id) return 'Error: id is required.';
      const customer = await getDb().Customer.findByPk(id);
      if (!customer) return `Error: Customer ${id} not found.`;
      if (!customer.isActive) return `Customer "${customer.companyName}" is already inactive.`;

      // Warn (but don't block) when open leads exist. Spec says warn.
      let openLeadsNote = '';
      if (getDb().Lead) {
        const { Op } = require('sequelize');
        const open = await getDb().Lead.count({
          where: {
            convertedCustomerId: id,
            status: { [Op.notIn]: ['won', 'lost', 'archived'] },
          },
        });
        if (open > 0) openLeadsNote = ` WARNING: ${open} open lead(s) still reference this customer; consider closing them too.`;
      }

      await customer.update({ isActive: false });
      await auditAiWrite('archive_customer', 'Customer', customer.id, { companyName: customer.companyName }, requester.id);
      return { success: true, id: customer.id, archived: true, note: `Customer "${customer.companyName}" set inactive.${openLeadsNote}` };
    }

    case 'list_customers': {
      const { Op } = require('sequelize');
      const where = {};
      if (args.search) {
        where[Op.or] = [
          { companyName: { [Op.like]: `%${args.search}%` } },
          { country:     { [Op.like]: `%${args.search}%` } },
          { city:        { [Op.like]: `%${args.search}%` } },
          { email:       { [Op.like]: `%${args.search}%` } },
        ];
      }
      if (args.country) where.country = args.country;
      const customers = await getDb().Customer.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'companyName', 'email', 'phone', 'country',
          'city', 'currency', 'paymentTerms', 'creditLimit', 'isActive'],
      });
      return customers.length ? customers.map(c => c.toJSON()) : 'No customers found.';
    }

    // ── Lessons log ─────────────────────────────────────────────────────────
    // Sanctioned exception to L-001: Alex enabled the AI Assistant to append
    // entries to skills/lessons.md without Dev Mode. Tool writes the file,
    // commits with a Sovern AI identity, and pushes to origin/main so the
    // VM doesn't lose the change on next `git reset --hard` deploy.

    case 'append_lesson': {
      const fs = require('fs').promises;
      const path = require('path');
      const cp = require('child_process');

      const { title, summary, root_cause, fix, rule } = args;
      const section = args.section || 'technical';
      if (!title || !root_cause || !fix || !rule) {
        return 'Error: title, root_cause, fix, and rule are required.';
      }

      const repoRoot = path.resolve(__dirname, '..', '..');
      const lessonsPath = path.join(repoRoot, 'skills', 'lessons.md');

      let content;
      try {
        content = await fs.readFile(lessonsPath, 'utf-8');
      } catch (e) {
        return `Error reading lessons.md at ${lessonsPath}: ${e.message}`;
      }

      const sectionMap = {
        process: '## Process & Workflow',
        trade: '## International Trade — Domain Lessons',
        technical: '## Website & Technical Lessons',
      };
      const sectionHeader = sectionMap[section];
      if (!sectionHeader) {
        return `Error: section must be one of: process, trade, technical (got "${section}")`;
      }

      const matches = [...content.matchAll(/\*\*L-(\d+)/g)];
      const nums = matches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      const id = `L-${String(next).padStart(3, '0')}`;

      const summaryBlock = summary ? `\n${summary.trim()}\n` : '';
      const entry = `\n**${id} — ${title.trim()}**\n${summaryBlock}\n- **Root cause:** ${root_cause.trim()}\n- **Fix:** ${fix.trim()}\n- **Rule:** ${rule.trim()}\n`;

      const sectionStart = content.indexOf(sectionHeader);
      if (sectionStart === -1) {
        return `Error: section header "${sectionHeader}" not found in lessons.md.`;
      }
      const nextSeparator = content.indexOf('\n---\n', sectionStart);
      if (nextSeparator === -1) {
        return 'Error: could not find end of section (no `---` after header).';
      }

      const newContent = content.slice(0, nextSeparator) + entry + content.slice(nextSeparator);
      try {
        await fs.writeFile(lessonsPath, newContent, 'utf-8');
      } catch (e) {
        return `Error writing lessons.md: ${e.message}`;
      }

      const safeTitle = title.replace(/["`$\\]/g, ' ').trim().slice(0, 70);
      const commitMsg = `docs(lessons): ${id} - ${safeTitle} [via AI Assistant]`;
      let committed = false;
      let pushed = false;
      let gitError = null;
      const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Sovern AI', GIT_AUTHOR_EMAIL: 'ai@sovernhouse.co', GIT_COMMITTER_NAME: 'Sovern AI', GIT_COMMITTER_EMAIL: 'ai@sovernhouse.co' };
      try {
        cp.execSync(`git -C "${repoRoot}" add skills/lessons.md`, { stdio: 'pipe', env: gitEnv });
        cp.execSync(`git -C "${repoRoot}" commit -m "${commitMsg}"`, { stdio: 'pipe', env: gitEnv });
        committed = true;
        try {
          cp.execSync(`git -C "${repoRoot}" push origin main`, { stdio: 'pipe', env: gitEnv });
          pushed = true;
        } catch (e) {
          gitError = `push failed: ${(e.stderr ? e.stderr.toString() : '') || e.message}`;
        }
      } catch (e) {
        gitError = `commit failed: ${(e.stderr ? e.stderr.toString() : '') || e.message}`;
      }

      return {
        lessonId: id,
        section,
        written: true,
        committed,
        pushed,
        gitError,
        commitMessage: commitMsg,
        path: 'skills/lessons.md',
        note: pushed
          ? `${id} appended, committed, and pushed. The lesson is now in main on origin and will survive the next VM deploy.`
          : committed
            ? `${id} appended and committed locally on the VM but NOT pushed. The lesson will be wiped on the next \`git reset --hard\` deploy unless pushed manually. Error: ${gitError}`
            : `${id} appended to the file on disk but NOT committed. The lesson will be wiped on the next \`git reset --hard\` deploy. Error: ${gitError}`,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Phase 4.5, C19 v2 — AI-assistant WRITE + ACTION capabilities
    //
    // These tools let Alex make configuration changes via natural-language
    // chat. The model is instructed (via the system prompt) to ALWAYS show a
    // preview/diff and wait for explicit confirmation before invoking these.
    // Every successful write writes an AuditLog row with action prefix
    // `ai_assistant_*` so we have a complete trail of AI-initiated changes.
    //
    // Hard refusals are enforced two ways:
    //  1) Field denylist below blocks the model from touching User.role,
    //     User.password, AuditLog rows, Customer.screeningStatus etc. even if
    //     the prompt cracks.
    //  2) Super-admin gate via requireSuperAdmin() on every WRITE/ACTION tool.
    //
    // Self-only writes (own profile, own dashboard) drop the super-admin
    // gate but still require an authenticated USER_ID.
    // ──────────────────────────────────────────────────────────────────────────

    case 'create_brand': {
      const requester = await requireSuperAdmin();
      const code = (args.code || '').trim().toUpperCase();
      const displayName = (args.displayName || '').trim();
      const senderEmail = (args.senderEmail || '').trim();
      const primaryColor = (args.primaryColor || '').trim();
      const accentColor = (args.accentColor || '').trim();

      if (!/^[A-Z]{2,8}$/.test(code)) {
        return 'Error: code must be 2-8 uppercase letters (e.g. "HH", "SH", "FW").';
      }
      if (!displayName) return 'Error: displayName is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
        return 'Error: senderEmail must be a valid email (e.g. "ops@hanhua.example").';
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        return 'Error: primaryColor must be a 6-digit hex color (e.g. "#1D5A32").';
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
        return 'Error: accentColor must be a 6-digit hex color (e.g. "#C8A464").';
      }

      const existing = await getDb().Brand.findOne({ where: { code } });
      if (existing) {
        return `Error: brand ${code} already exists (id ${existing.id}). Use update_brand to modify it.`;
      }

      const commissionRateRaw = args.commissionRate;
      let commissionRate = 0.05;
      if (commissionRateRaw != null && commissionRateRaw !== '') {
        const v = parseFloat(commissionRateRaw);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
          return 'Error: commissionRate must be a decimal between 0 and 1 (e.g. 0.05 = 5%). Default is 0.05.';
        }
        commissionRate = v;
      }

      const brand = await getDb().Brand.create({
        code,
        displayName,
        senderEmail,
        primaryColor,
        accentColor,
        signatureHtml:   args.signatureHtml   || null,
        signatureText:   args.signatureText   || null,
        footerLegalText: args.footerLegalText || null,
        logoUrl:         args.logoUrl         || null,
        commissionRate,
        active: true,
      });

      await auditAiWrite('create_brand', 'Brand', brand.id, {
        code,
        displayName,
        senderEmail,
        primaryColor,
        accentColor,
        commissionRate,
      }, requester.id);

      return {
        success: true,
        brandId: brand.id,
        code: brand.code,
        displayName: brand.displayName,
        senderEmail: brand.senderEmail,
        commissionRate: brand.commissionRate,
        note: 'Brand is active by default. Products and quotations can now reference brandCode=' + code + '. Add signature/footer via update_brand when ready.',
      };
    }

    // ── Phase 4.9.1: ProductCategory CRUD ─────────────────────────────────

    // ── Phase 4.9.2c: ProductPrice (temporal pricing) tools ─────────────

    case 'create_product_price': {
      const requester = await requireSuperAdmin();
      const productId = args.productId || args.product_id;
      if (!productId) return 'Error: productId is required.';
      const product = await getDb().Product.findByPk(productId);
      if (!product) return `Error: Product ${productId} not found.`;
      const origin = (args.origin || '').trim() || null;
      const factoryId = args.factoryId || args.factory_id || null;
      if (!origin && !factoryId) {
        return 'Error: at least one of origin or factoryId is required.';
      }
      if (factoryId) {
        const f = await getDb().Factory.findByPk(factoryId);
        if (!f) return `Error: Factory ${factoryId} not found.`;
      }
      const cost = parseFloat(args.costPriceUsdPerM2 ?? args.cost_price_usd_per_m2);
      if (!Number.isFinite(cost)) return 'Error: costPriceUsdPerM2 is required and must be numeric.';

      const row = await getDb().ProductPrice.create({
        id: uuidv4(),
        productId,
        factoryId,
        origin,
        costPriceUsdPerM2: cost,
        sellingPriceUsdPerM2: args.sellingPriceUsdPerM2 != null ? parseFloat(args.sellingPriceUsdPerM2) : (args.selling_price_usd_per_m2 != null ? parseFloat(args.selling_price_usd_per_m2) : null),
        markupPercent: args.markupPercent != null ? parseFloat(args.markupPercent) : (args.markup_percent != null ? parseFloat(args.markup_percent) : null),
        currency: args.currency || 'USD',
        tariffRate: args.tariffRate != null ? parseFloat(args.tariffRate) : (args.tariff_rate != null ? parseFloat(args.tariff_rate) : null),
        tariffDestination: args.tariffDestination || args.tariff_destination || null,
        validFrom: args.validFrom || args.valid_from || new Date().toISOString().slice(0, 10),
        validTo: args.validTo || args.valid_to || null,
        sourceNote: args.sourceNote || args.source_note || null,
        createdBy: requester.id,
      });
      await auditAiWrite('create_product_price', 'ProductPrice', row.id, {
        productId, origin, factoryId,
        costPriceUsdPerM2: cost,
        validFrom: row.validFrom, validTo: row.validTo,
      }, requester.id);
      return { success: true, id: row.id, productId, origin, factoryId, costPriceUsdPerM2: cost, validFrom: row.validFrom };
    }

    case 'list_product_prices': {
      const productId = args.productId || args.product_id;
      if (!productId) return 'Error: productId is required.';
      const where = { productId };
      if (args.origin) where.origin = args.origin;
      const today = new Date().toISOString().slice(0, 10);
      const { Op } = require('sequelize');
      if (args.includeExpired !== true) {
        where[Op.or] = [{ validTo: null }, { validTo: { [Op.gte]: today } }];
      }
      const rows = await getDb().ProductPrice.findAll({
        where,
        order: [['validFrom', 'DESC']],
        attributes: ['id', 'productId', 'factoryId', 'origin', 'costPriceUsdPerM2', 'sellingPriceUsdPerM2', 'markupPercent', 'currency', 'tariffRate', 'tariffDestination', 'validFrom', 'validTo', 'sourceNote', 'createdBy'],
      });
      return rows.length ? rows.map(r => r.toJSON()) : 'No prices found.';
    }

    case 'update_product_price': {
      const requester = await requireSuperAdmin();
      const id = args.id;
      if (!id) return 'Error: id is required.';
      const row = await getDb().ProductPrice.findByPk(id);
      if (!row) return `Error: ProductPrice ${id} not found.`;
      const patch = {};
      const map = {
        origin: 'origin',
        factoryId: 'factoryId', factory_id: 'factoryId',
        costPriceUsdPerM2: 'costPriceUsdPerM2', cost_price_usd_per_m2: 'costPriceUsdPerM2',
        sellingPriceUsdPerM2: 'sellingPriceUsdPerM2', selling_price_usd_per_m2: 'sellingPriceUsdPerM2',
        markupPercent: 'markupPercent', markup_percent: 'markupPercent',
        currency: 'currency',
        tariffRate: 'tariffRate', tariff_rate: 'tariffRate',
        tariffDestination: 'tariffDestination', tariff_destination: 'tariffDestination',
        validFrom: 'validFrom', valid_from: 'validFrom',
        validTo: 'validTo', valid_to: 'validTo',
        sourceNote: 'sourceNote', source_note: 'sourceNote',
      };
      for (const [k, field] of Object.entries(map)) {
        if (args[k] !== undefined) {
          let v = args[k];
          if (['costPriceUsdPerM2', 'sellingPriceUsdPerM2', 'markupPercent', 'tariffRate'].includes(field)) {
            v = v == null || v === '' ? null : parseFloat(v);
          }
          if (['origin', 'factoryId', 'tariffDestination', 'validTo', 'sourceNote'].includes(field) && (v === '' || v === null)) {
            v = null;
          }
          patch[field] = v;
        }
      }
      if (Object.keys(patch).length === 0) return 'Error: no editable fields provided.';
      const before = {};
      for (const k of Object.keys(patch)) before[k] = row[k];
      await row.update(patch);
      await auditAiWrite('update_product_price', 'ProductPrice', row.id, { before, after: patch }, requester.id);
      return { success: true, id: row.id, updated: Object.keys(patch), before, after: patch };
    }

    case 'get_current_price': {
      const productId = args.productId || args.product_id;
      if (!productId) return 'Error: productId is required.';
      const origin = (args.origin || '').trim() || null;
      const asOf = args.asOfDate || args.as_of_date || null;
      const { getCurrentPrice } = require('../services/productPriceService');
      const current = await getCurrentPrice(productId, origin, asOf);
      if (!current) return `No active price for product ${productId}${origin ? ` (origin=${origin})` : ''} as of ${asOf || 'today'}.`;
      return current;
    }

    case 'create_product_category': {
      const requester = await requireSuperAdmin();
      const name = (args.name || '').trim();
      if (!name) return 'Error: name is required.';
      const parentId = args.parentId || null;
      if (parentId) {
        const parent = await getDb().ProductCategory.findByPk(parentId);
        if (!parent) return `Error: parent ${parentId} not found.`;
      }
      const slug = (args.slug && String(args.slug).trim()) || slugifyMcp(name);

      // Conflict: same (parentId, slug) on a non-archived row would
      // create ambiguity in lookups.
      const collision = await getDb().ProductCategory.findOne({
        where: { parentId: parentId || null, slug },
      });
      if (collision && !collision.isArchived) {
        return `Error: a non-archived category with slug "${slug}" already exists under this parent (id ${collision.id}). Pick a different name or archive the existing row first.`;
      }

      const sortOrder = args.sortOrder != null ? parseInt(args.sortOrder, 10) : 99;
      const isActive = args.active === undefined ? true : Boolean(args.active);

      const row = await getDb().ProductCategory.create({
        id: uuidv4(),
        name,
        slug,
        description: args.description || null,
        icon: args.icon || null,
        image: args.image || null,
        parentId: parentId || null,
        sortOrder,
        isActive,
        isArchived: false,
      });
      await auditAiWrite('create_taxonomy_category', 'ProductCategory', row.id, {
        name, slug, parentId, sortOrder, isActive,
      }, requester.id);
      return { success: true, id: row.id, name, slug, parentId, sortOrder };
    }

    case 'update_product_category': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.categoryId;
      if (!id) return 'Error: id is required.';
      const row = await getDb().ProductCategory.findByPk(id);
      if (!row) return `Error: ProductCategory ${id} not found.`;

      const updates = {};
      for (const k of ['name', 'slug', 'description', 'icon', 'image', 'sortOrder', 'isActive']) {
        if (args[k] !== undefined) updates[k] = args[k];
      }
      // Accept `active` alias for isActive (matches Alex's 4.9.1 spec).
      if (args.active !== undefined && updates.isActive === undefined) {
        updates.isActive = Boolean(args.active);
      }
      // parentId change is the high-risk path. Spec: 5+ active products
      // bound to the moving category require force:true.
      if (args.parentId !== undefined && args.parentId !== row.parentId) {
        const activeProductCount = await getDb().Product.count({
          where: { categoryId: row.id, isActive: true },
        });
        if (activeProductCount >= 5 && args.force !== true) {
          return `Error: "${row.name}" has ${activeProductCount} active products bound. Re-parenting could break filter URLs and reports. Pass force:true to override after manual review.`;
        }
        if (args.parentId) {
          const parent = await getDb().ProductCategory.findByPk(args.parentId);
          if (!parent) return `Error: new parent ${args.parentId} not found.`;
          if (parent.id === row.id) return 'Error: a category cannot be its own parent.';
        }
        updates.parentId = args.parentId || null;
      }
      if (Object.keys(updates).length === 0) {
        return 'Error: no editable fields provided. Allowed: name, slug, description, icon, image, parentId, sortOrder, isActive/active.';
      }
      if (updates.sortOrder !== undefined) updates.sortOrder = parseInt(updates.sortOrder, 10);
      if (updates.isActive !== undefined) updates.isActive = Boolean(updates.isActive);

      const before = {};
      for (const k of Object.keys(updates)) before[k] = row[k];
      await row.update(updates);
      await auditAiWrite('update_taxonomy_category', 'ProductCategory', row.id, { name: row.name, before, after: updates }, requester.id);
      return { success: true, id: row.id, name: row.name, updated: Object.keys(updates), before, after: updates };
    }

    case 'archive_product_category': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.categoryId;
      if (!id) return 'Error: id is required.';
      const reason = String(args.reason || '').trim();
      if (reason.length < 10) {
        return 'Error: reason is required and must be at least 10 characters (e.g. "obsolete taxonomy from pre-Phase 4 import").';
      }
      const row = await getDb().ProductCategory.findByPk(id);
      if (!row) return `Error: ProductCategory ${id} not found.`;
      if (row.isArchived) return `Error: ${row.name} is already archived.`;

      // Hard refusal: active products bound. Force move/archive first.
      const activeProductCount = await getDb().Product.count({
        where: { categoryId: row.id, isActive: true },
      });
      if (activeProductCount > 0) {
        return `Error: ${row.name} has ${activeProductCount} active product(s) bound. Move or archive those products first; archive_product_category will not silently orphan inventory.`;
      }

      await row.update({ isArchived: true });
      await auditAiWrite('archive_taxonomy_category', 'ProductCategory', row.id, { name: row.name, reason }, requester.id);
      return { success: true, id: row.id, name: row.name, archived: true };
    }

    case 'restore_product_category': {
      const requester = await requireSuperAdmin();
      const id = args.id || args.categoryId;
      if (!id) return 'Error: id is required.';
      const reason = String(args.reason || '').trim();
      if (reason.length < 10) {
        return 'Error: reason is required and must be at least 10 characters.';
      }
      const row = await getDb().ProductCategory.findByPk(id);
      if (!row) return `Error: ProductCategory ${id} not found.`;
      if (!row.isArchived) return `Error: ${row.name} is not archived (nothing to restore).`;
      await row.update({ isArchived: false });
      await auditAiWrite('restore_taxonomy_category', 'ProductCategory', row.id, { name: row.name, reason }, requester.id);
      return { success: true, id: row.id, name: row.name, archived: false };
    }

    case 'update_brand': {
      const requester = await requireSuperAdmin();
      const { code } = args;
      if (!code) return 'Error: brand code is required (e.g. "SH" or "FW").';
      const brand = await getDb().Brand.findOne({ where: { code } });
      if (!brand) return `Brand ${code} not found.`;

      const updates = pickWritable(args, BRAND_WRITABLE_FIELDS);
      if (Object.keys(updates).length === 0) {
        return `Error: no writable fields provided. Allowed: ${BRAND_WRITABLE_FIELDS.join(', ')}.`;
      }

      // Phase 4.9.1 validation for the two new fields.
      if (updates.active !== undefined) {
        if (typeof updates.active !== 'boolean') {
          return 'Error: active must be a boolean (true or false).';
        }
      }
      if (updates.commissionRate !== undefined) {
        const v = parseFloat(updates.commissionRate);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
          return 'Error: commissionRate must be a decimal between 0 and 1 (e.g. 0.07 = 7%).';
        }
        updates.commissionRate = v;
      }

      const before = pickWritable(brand.toJSON(), BRAND_WRITABLE_FIELDS);
      await brand.update(updates);
      await auditAiWrite('update_brand', 'Brand', brand.id, { code, before, after: updates }, requester.id);
      return { success: true, brand: code, updated: Object.keys(updates), before, after: updates };
    }

    case 'update_email_template': {
      const requester = await requireSuperAdmin();
      const { id } = args;
      if (!id) return 'Error: template id is required.';
      const tpl = await getDb().EmailTemplate.findByPk(id);
      if (!tpl) return `EmailTemplate ${id} not found.`;
      const updates = pickWritable(args, EMAIL_TEMPLATE_WRITABLE_FIELDS);
      if (Object.keys(updates).length === 0) {
        return `Error: no writable fields provided. Allowed: ${EMAIL_TEMPLATE_WRITABLE_FIELDS.join(', ')}.`;
      }
      const before = pickWritable(tpl.toJSON(), EMAIL_TEMPLATE_WRITABLE_FIELDS);
      await tpl.update(updates);
      await auditAiWrite('update_email_template', 'EmailTemplate', tpl.id, { name: tpl.name, before, after: updates }, requester.id);
      return { success: true, templateId: tpl.id, name: tpl.name, updated: Object.keys(updates), before, after: updates };
    }

    case 'update_user_profile_self': {
      const requester = await getCurrentUserOrThrow();
      const updates = pickWritable(args, USER_SELF_WRITABLE_FIELDS);
      if (Object.keys(updates).length === 0) {
        return `Error: no writable fields provided. Allowed (self-only): ${USER_SELF_WRITABLE_FIELDS.join(', ')}. Role, email, password, and brand access are not editable through the assistant.`;
      }
      const before = pickWritable(requester.toJSON(), USER_SELF_WRITABLE_FIELDS);
      await requester.update(updates);
      await auditAiWrite('update_user_profile_self', 'User', requester.id, { before, after: updates }, requester.id);
      return { success: true, userId: requester.id, updated: Object.keys(updates), before, after: updates };
    }

    case 'update_dashboard_layout': {
      const requester = await getCurrentUserOrThrow();
      if (!Array.isArray(args.layout) && typeof args.layout !== 'object') {
        return 'Error: layout must be an array or object of widget config.';
      }
      let row = await getDb().DashboardLayout.findOne({ where: { userId: requester.id, isDefault: true } });
      if (!row) {
        row = await getDb().DashboardLayout.findOne({ where: { userId: requester.id } });
      }
      if (!row) {
        row = await getDb().DashboardLayout.create({
          userId: requester.id,
          role: requester.role,
          layout: args.layout,
          name: args.name || 'AI-configured',
          isDefault: true,
        });
        await auditAiWrite('update_dashboard_layout', 'DashboardLayout', row.id, { created: true, layout: args.layout }, requester.id);
        return { success: true, dashboardLayoutId: row.id, created: true };
      }
      const before = { layout: row.layout, name: row.name };
      await row.update({ layout: args.layout, name: args.name || row.name });
      await auditAiWrite('update_dashboard_layout', 'DashboardLayout', row.id, { before, after: { layout: args.layout, name: args.name || row.name } }, requester.id);
      return { success: true, dashboardLayoutId: row.id, updated: true };
    }

    case 'create_scheduled_task': {
      const requester = await getCurrentUserOrThrow();
      const { entity_type, entity_id, entity_label, due_date, note, priority, type } = args;
      if (!entity_type || !entity_id || !due_date) {
        return 'Error: entity_type, entity_id, and due_date are required.';
      }
      const date = new Date(due_date);
      if (isNaN(date.getTime())) return `Invalid due_date: ${due_date}`;
      const row = await getDb().ScheduledActivity.create({
        type:         type || 'follow_up',
        entityType:   entity_type,
        entityId:     String(entity_id),
        entityLabel:  entity_label || null,
        assignedToId: args.assigned_to_id || requester.id,
        assignedById: requester.id,
        dueDate:      date,
        note:         note || null,
        priority:     priority || 'normal',
        status:       'pending',
      });
      await auditAiWrite('create_scheduled_task', 'ScheduledActivity', row.id, {
        entityType: row.entityType, entityId: row.entityId, dueDate: date.toISOString(),
        assignedToId: row.assignedToId,
      }, requester.id);
      return { success: true, scheduledActivityId: row.id, dueDate: date.toISOString(), entityType: row.entityType, entityId: row.entityId };
    }

    case 'mark_item_complete': {
      const requester = await getCurrentUserOrThrow();
      const { scheduled_activity_id, completed_note } = args;
      if (!scheduled_activity_id) return 'Error: scheduled_activity_id is required.';
      const row = await getDb().ScheduledActivity.findByPk(scheduled_activity_id);
      if (!row) return `ScheduledActivity ${scheduled_activity_id} not found.`;
      // Owner or super-admin only.
      if (row.assignedToId !== requester.id && requester.role !== 'super_admin') {
        return 'Error: only the assignee or a super-admin can mark this task complete.';
      }
      await row.update({ status: 'completed', completedAt: new Date(), completedNote: completed_note || null });
      await auditAiWrite('mark_item_complete', 'ScheduledActivity', row.id, { completedAt: row.completedAt, completedNote: completed_note || null }, requester.id);
      return { success: true, scheduledActivityId: row.id, status: 'completed', completedAt: row.completedAt.toISOString() };
    }

    case 'archive_item': {
      const requester = await requireSuperAdmin();
      const { entity, id } = args;
      if (!entity || !id) return 'Error: entity and id are required.';
      if (!ARCHIVABLE_ENTITIES.includes(entity)) {
        return `Error: entity must be one of ${ARCHIVABLE_ENTITIES.join(', ')}. Got "${entity}".`;
      }
      const Model = getDb()[entity];
      if (!Model) return `Entity ${entity} model not registered.`;
      const row = await Model.findByPk(id);
      if (!row) return `${entity} ${id} not found.`;
      // TriageItem uses status='archived'; Activity has isArchived boolean.
      if (entity === 'TriageItem') {
        await row.update({ status: 'archived' });
      } else if (entity === 'Activity') {
        await row.update({ isArchived: true });
      } else {
        await row.update({ status: 'archived' });
      }
      await auditAiWrite('archive_item', entity, row.id, { archivedAt: new Date().toISOString() }, requester.id);
      return { success: true, entity, id: row.id, archived: true };
    }

    default:
      throw new Error(`Unknown tool: ${name}. Available tools: ${TOOL_DEFS.map(t => t.name).join(', ')}`);
  }
}

// ── Phase 4.5, C19 v2 — write helpers + denylists ─────────────────────────────

// Whitelists for the natural-language write tools. Anything outside these
// lists is silently dropped even if the AI tries to set it.
// Phase 4.9.1: add `active` + `commissionRate` so the AI can deactivate
// an erroneous brand and adjust commission per agreement (e.g. HanHua
// Sales Rep Agreement set FW to 7%). Validation happens inside the
// update_brand handler — these are just allow-listed.
const BRAND_WRITABLE_FIELDS = [
  'displayName', 'signatureHtml', 'signatureText',
  'primaryColor', 'accentColor', 'footerLegalText', 'logoUrl',
  'active', 'commissionRate',
];

const EMAIL_TEMPLATE_WRITABLE_FIELDS = [
  'name', 'subject', 'bodyText', 'category', 'brandCode',
];

// Self-edits only: role / email / password / brand access are NOT editable
// here. Role + permissions changes go through the dedicated admin UI with
// a different audit policy.
const USER_SELF_WRITABLE_FIELDS = [
  'firstName', 'lastName', 'phone', 'avatar', 'preferences',
];

const ARCHIVABLE_ENTITIES = ['TriageItem', 'Activity'];

function pickWritable(obj, allowed) {
  const out = {};
  if (!obj) return out;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

async function getCurrentUserOrThrow() {
  if (!USER_ID) {
    const err = new Error('ERP_USER_ID not set. The assistant must be invoked through the ERP chat endpoint.');
    err.code = 'ENOAUTH';
    throw err;
  }
  const user = await getDb().User.findByPk(USER_ID);
  if (!user) {
    const err = new Error(`User ${USER_ID} not found.`);
    err.code = 'ENOAUTH';
    throw err;
  }
  return user;
}

async function requireSuperAdmin() {
  const user = await getCurrentUserOrThrow();
  if (user.role !== 'super_admin') {
    const err = new Error(`This change requires super-admin. Your role: ${user.role}. Ask Alex to sign in if you need to apply this through the assistant.`);
    err.code = 'EPERM';
    throw err;
  }
  return user;
}

// Phase 4.12: synthesize a brandScope object from a User row so the
// aiWriteServices layer behaves the same on MCP as it does behind REST.
// MCP cross-brand mode is intentionally disabled — only Alex's "All Brands"
// dropdown in the desktop UI can flip that on, and even there it's
// read-only by design (D-3).
async function brandScopeForMcp(user) {
  const u = user || await getCurrentUserOrThrow();
  const accessibleBrands =
    Array.isArray(u.accessibleBrands) && u.accessibleBrands.length
      ? u.accessibleBrands
      : ['SH'];
  const defaultBrand = u.defaultBrand || accessibleBrands[0] || 'SH';
  return {
    accessibleBrands,
    defaultBrand,
    viewMode: 'single',
    isCrossBrand: false,
    where: { brandCode: { [require('sequelize').Op.in]: accessibleBrands } },
  };
}

// Phase 4.12: shared formatter for { ok:false, code, message, sanctionsBlock? }
// shapes returned by the aiWriteServices. Maps to a string the assistant
// can present to Alex.
function formatMcpWriteError(result) {
  if (!result || result.ok) return null;
  if (result.code === 'sanctions_block') {
    return {
      success: false,
      error: result.message,
      sanctionsBlock: result.sanctionsBlock,
    };
  }
  return { success: false, error: result.message };
}

// Phase 4.14: per-process LRU cache for parsed Drive files. 10-min TTL
// keeps a hot working set during a single AI session (the assistant
// often re-reads the same file with different narrowing params) while
// guaranteeing forward freshness across long-running processes. The
// 50-entry cap puts a ceiling on memory under a worst case (200KB per
// entry × 50 = 10MB).
let _driveReadCache = null;
function getDriveReadCache() {
  if (_driveReadCache) return _driveReadCache;
  const { LRUCache } = require('lru-cache');
  _driveReadCache = new LRUCache({
    max: 50,
    ttl: 10 * 60 * 1000,
  });
  return _driveReadCache;
}

// Wrapper around the parsers' applyOutputCap for the legacy
// (Google Docs / Sheets / plain text / CSV) branches that don't go
// through parseByMime. Keeps the 200KB hard cap consistent across all
// read_drive_file paths.
function applyDriveReadOutputCap(text) {
  const { applyOutputCap } = require('../services/driveDocumentParsers');
  return applyOutputCap(text);
}

async function auditAiWrite(action, entity, entityId, changes, userId) {
  if (!getDb().AuditLog) return;
  try {
    await getDb().AuditLog.create({
      userId: userId || null,
      action: 'ai_assistant_' + action,
      entity,
      entityId: String(entityId),
      changes,
      ipAddress: null,
    });
  } catch (e) {
    process.stderr.write(`[erp-mcp] auditAiWrite failed for ${action}: ${e.message}\n`);
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOL_DEFS = [
  // ── Generic ERP read tools ────────────────────────────────────────────────
  // Prefer these for ad-hoc reads. They cover every queryable entity in the
  // ERP without per-table wrappers, so they keep working even when the schema
  // changes. Use the entity-specific tools (list_leads, list_factories, etc.)
  // only when you need their richer return shape (joins, computed fields).
  {
    name: 'erp_list_entities',
    description: 'List every ERP entity (Sequelize model) you can query via erp_query. Returns names like Lead, Contact, Factory, Customer, Product, Quotation, Inquiry, Invoice, Payment, PurchaseOrder, Shipment, ScheduledActivity, TriageItem, etc. Auth/secret models are intentionally excluded.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'erp_describe_entity',
    description: 'Describe an ERP entity: list its attributes, the string fields that free-text search will match, and its associations. Source = in-process Sequelize model registry. CAVEAT (Phase 4.9.3): the MCP server is a subprocess loaded once; new code-side model fields only appear here AFTER the subprocess restarts. If you suspect staleness (a new column should exist but is missing), call erp_describe_entity_db for PRAGMA-based ground truth.',
    inputSchema: {
      type: 'object',
      required: ['entity'],
      properties: {
        entity: { type: 'string', description: 'Entity name from erp_list_entities, e.g. "Factory"' },
      },
    },
  },
  {
    name: 'erp_describe_entity_db',
    description: 'Phase 4.9.3 — Describe an ERP entity from the LIVE SQLite schema via PRAGMA, bypassing the in-process Sequelize model registry. Returns physical columns (name, type, notnull, default, primaryKey) + indexes + a mismatch report (model attributes missing from DB, DB columns missing from model). Use this when erp_describe_entity looks stale, or to debug DB-vs-model drift directly.',
    inputSchema: {
      type: 'object',
      required: ['entity'],
      properties: {
        entity: { type: 'string', description: 'Entity name (same value space as erp_describe_entity).' },
      },
    },
  },
  {
    name: 'erp_query',
    description: 'Read rows from any queryable ERP entity. Pass entity (e.g. "Factory"), optional where (equality filters: { country: "Taiwan" }), optional search (free-text across string fields), optional limit / offset / order_by / order_dir. Returns { rows, count, total }.',
    inputSchema: {
      type: 'object',
      required: ['entity'],
      properties: {
        entity:    { type: 'string', description: 'Entity name, e.g. "Factory" or "Contact"' },
        where:     { type: 'object', description: 'Equality filters keyed by field name, e.g. { factoryId: "abc-123" }' },
        search:    { type: 'string', description: 'Free-text search across string/text fields' },
        limit:     { type: 'number', description: 'Max rows (default 20, max 100)' },
        offset:    { type: 'number', description: 'Pagination offset (default 0)' },
        order_by:  { type: 'string', description: 'Field to sort by (must exist on the entity)' },
        order_dir: { type: 'string', enum: ['ASC', 'DESC'], description: 'Sort direction (default ASC)' },
      },
    },
  },
  // ── Cross-conversation memory ─────────────────────────────────────────────
  {
    name: 'list_recent_conversations',
    description: 'List your prior conversations with Alex (most-recent first). Each entry includes id, title, message count, last activity time, and a preview of his last message in that thread. Use this to orient yourself at the start of a session, or when Alex says "remember when we discussed..." or "earlier you said...".',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max conversations to return (default 20, max 50)' },
      },
    },
  },
  {
    name: 'read_conversation',
    description: 'Read the full message thread of a past conversation by id. Use after list_recent_conversations or search_conversations when you need the actual content.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Conversation id from list_recent_conversations or search_conversations' },
      },
    },
  },
  {
    name: 'search_conversations',
    description: 'Search every past conversation for a keyword or phrase (case-insensitive). Returns matching conversations with id, title, match count, and short snippets. Use this when Alex references something specific from earlier ("the SPC supplier we talked about", "what did I say about margins").',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Keyword or short phrase to find' },
        limit: { type: 'number', description: 'Max matching conversations (default 10)' },
      },
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List Google Calendar events. Use to check schedule, availability, or find upcoming meetings.',
    inputSchema: {
      type: 'object',
      properties: {
        days_ago:   { type: 'number', description: 'Days back to search from today (default: 0)' },
        days_ahead: { type: 'number', description: 'Days forward to search (default: 14)' },
        limit:      { type: 'number', description: 'Max events (default: 20)' },
        query:      { type: 'string', description: 'Free-text search (company name, person, keyword)' },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a Google Calendar event. Default duration is 45 min if end_time is omitted. Asia/Taipei timezone by default. Supports custom popup reminders via reminders_minutes. Do not ask the user for duration unless they explicitly bring it up.',
    inputSchema: {
      type: 'object',
      required: ['title', 'start_time'],
      properties: {
        title:              { type: 'string',  description: 'Event title' },
        start_time:         { type: 'string',  description: 'ISO 8601 datetime e.g. 2026-05-10T14:00:00' },
        end_time:           { type: 'string',  description: 'ISO 8601 datetime. Optional — defaults to start_time + 45 min.' },
        reminders_minutes:  { type: 'array',   items: { type: 'number' }, description: 'Minutes-before-event for popup reminders, e.g. [30, 15] for two popups at 30 and 15 min before. Omit to use the calendar default reminder.' },
        description:        { type: 'string',  description: 'Agenda or notes' },
        location:           { type: 'string',  description: 'Physical address or call link' },
        attendees:          { type: 'array',   items: { type: 'string' }, description: 'Attendee email addresses' },
        timezone:           { type: 'string',  description: 'Timezone (default: Asia/Taipei)' },
        add_meet_link:      { type: 'boolean', description: 'Generate a Google Meet link' },
        all_day:            { type: 'boolean', description: 'All-day event' },
        start_date:         { type: 'string',  description: 'YYYY-MM-DD for all-day events' },
        end_date:           { type: 'string',  description: 'YYYY-MM-DD for all-day events' },
      },
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a Google Calendar event by its event_id. Use the eventId returned from create_calendar_event or from list_calendar_events. By default does not email attendees about the cancellation.',
    inputSchema: {
      type: 'object',
      required: ['event_id'],
      properties: {
        event_id:          { type: 'string',  description: 'Google Calendar event ID' },
        notify_attendees:  { type: 'boolean', description: 'If true, email all attendees about the cancellation. Default false.' },
      },
    },
  },
  {
    name: 'list_emails',
    description: 'List emails from Gmail. Supports Gmail search syntax (from:, subject:, is:unread, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (default: is:inbox)' },
        limit: { type: 'number', description: 'Max emails (default: 10)' },
      },
    },
  },
  {
    name: 'read_email_thread',
    description: 'Read the full content of an email thread (all messages).',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string', description: 'Gmail thread ID from list_emails' },
      },
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail. IMPORTANT: Always show the complete draft (From / To / Subject / Body) to the user and get explicit confirmation before calling this tool. Never send autonomously. Phase 4.7, C-1: pass from_email when the conversation has a brand context. Use alexflorway@gmail.com for any FlorWay / FW / IronLite / HanHua thread; use alex@sovernhouse.co for Sovern House / SH / general trading. The two accounts are both active, so without from_email the tool picks whichever was created first, which is not always what you want.',
    inputSchema: {
      type: 'object',
      required: ['to', 'subject', 'body'],
      properties: {
        from_email:          { type: 'string', description: 'Sender account email. alexflorway@gmail.com (FW brand context) or alex@sovernhouse.co (SH brand context). Omit to use the default active account.' },
        to:                  { type: 'string', description: 'Recipient email (or comma-separated list)' },
        subject:             { type: 'string', description: 'Email subject' },
        body:                { type: 'string', description: 'Plain-text email body' },
        reply_to_thread_id:  { type: 'string', description: 'Thread ID to reply within (keeps conversation threaded)' },
      },
    },
  },
  {
    name: 'list_leads',
    description: 'List CRM leads. Use to check pipeline, find contacts, or get a status overview.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (new, contacted, qualified, converted, lost)' },
        search: { type: 'string', description: 'Search by company name, contact name, or email' },
        limit:  { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_lead',
    description: 'Get full details of a lead including recent activities.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Lead ID' },
      },
    },
  },
  {
    name: 'update_lead',
    description: 'Update a lead\'s status, location, industry, draft email, or any other editable field. Use this to backfill missing data on existing leads (e.g. industry/state/city/address from the company website) or to refine the AI-drafted cold email.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                { type: 'string', description: 'Lead ID' },
        status:            { type: 'string', description: 'New status' },
        stage:             { type: 'string', description: 'Pipeline stage' },
        notes:             { type: 'string', description: 'Notes to save' },
        productInterest:   { type: 'string', description: 'Products of interest' },
        estimatedValue:    { type: 'number', description: 'Estimated deal value USD' },
        priority:          { type: 'string', description: 'Priority: low, medium, high' },
        nextFollowUp:      { type: 'string', description: 'Next follow-up date ISO format' },
        industry:          { type: 'string', description: 'Industry (e.g. "Flooring distribution")' },
        address:           { type: 'string', description: 'Street address' },
        city:              { type: 'string', description: 'City' },
        state:             { type: 'string', description: 'State / Province (full name)' },
        country:           { type: 'string', description: 'Country' },
        website:           { type: 'string', description: 'Website URL' },
        vertical:          { type: 'string', description: 'Product vertical (e.g. "flooring")' },
        draftEmailSubject: { type: 'string', description: 'Cold-email draft subject (3-6 words, follow Sovern voice)' },
        draftEmailBody:    { type: 'string', description: 'Cold-email draft body (~80-120 words, follow Sovern voice + L-014 factory positioning for LVT/SPC campaign)' },
        assignedToId:      { type: 'string', description: 'Reassign the primary responsible owner. Pass a User UUID (look up via list_users first).' },
        responsibleUserIds:{ type: 'array', items: { type: 'string' }, description: 'Followers / additional responsible team members. Pass a complete array of User UUIDs (this REPLACES the existing list — to add one, get the current array first via get_lead and append). Look up users via list_users.' },
      },
    },
  },
  {
    name: 'list_users',
    description: 'List active Sovern House team members. Use this to resolve a name like "tag in Maria" or "assign to John" to a user UUID, which you then pass into update_lead (assignedToId or responsibleUserIds) or add_lead_activity (user_id).',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search firstName, lastName, or email. Partial match.' },
        role:   { type: 'string', description: 'Filter by role (admin, manager, sales, sales_rep, project_manager, etc.)' },
        limit:  { type: 'number', description: 'Max results (default: 50, max: 100)' },
      },
    },
  },
  {
    name: 'add_lead_activity',
    description: 'Add a chatter entry to a lead. Use for logging notes ("called Andre, left voicemail"), recording a call/meeting/email touchpoint, or queuing a follow-up task. Notes auto-mark complete; tasks/calls/meetings can be scheduled for later via scheduledAt or completed via is_completed.',
    inputSchema: {
      type: 'object',
      required: ['lead_id', 'subject'],
      properties: {
        lead_id:      { type: 'string', description: 'Lead UUID this activity belongs to' },
        type:         { type: 'string', enum: ['note', 'call', 'email', 'meeting', 'task', 'follow_up'], description: 'Activity type. Default: note.' },
        subject:      { type: 'string', description: 'Short headline (e.g. "Left voicemail with Andre")' },
        description:  { type: 'string', description: 'Longer body text. Optional.' },
        user_id:      { type: 'string', description: 'User UUID who created this activity. If omitted, defaults to the lead\'s createdById/assignedToId. The system prompt should tell you the current chat user\'s UUID — pass that.' },
        priority:     { type: 'string', enum: ['low', 'medium', 'high'], description: 'Default: medium' },
        is_completed: { type: 'boolean', description: 'Mark complete on creation. Notes are always complete; for tasks/calls leave false to keep them as open follow-ups.' },
      },
    },
  },
  {
    name: 'list_contacts',
    description: 'List CRM contacts (people). Each contact may be linked to a Factory (supplier-side) or Customer (buyer-side) via factoryId/customerId. Returned objects include a Factory and Customer relation.',
    inputSchema: {
      type: 'object',
      properties: {
        search:      { type: 'string', description: 'Search firstName, lastName, email, or jobTitle' },
        side:        { type: 'string', enum: ['supplier', 'customer'], description: 'supplier = contacts linked to a Factory; customer = contacts linked to a Customer' },
        factory_id:  { type: 'string', description: 'Only return contacts at this factory' },
        customer_id: { type: 'string', description: 'Only return contacts at this customer' },
        is_active:   { type: 'boolean', description: 'Filter by active status' },
        limit:       { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_contact',
    description: 'Get full details of a contact, including the linked Factory or Customer.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Contact ID' },
      },
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new Contact (a person). Must be linked to either a Factory (supplier-side) or a Customer (buyer-side). Use this to create proper standalone contacts like "Cyanine at Naoevo, sales rep" rather than just stuffing the name into Factory.contactPerson.',
    inputSchema: {
      type: 'object',
      required: ['email'],
      properties: {
        first_name:   { type: 'string',  description: 'Given name (at least one of first_name/last_name required)' },
        last_name:    { type: 'string',  description: 'Family name' },
        email:        { type: 'string',  description: 'Email (required)' },
        phone:        { type: 'string' },
        mobile:       { type: 'string' },
        job_title:    { type: 'string',  description: 'e.g. "Sales Manager", "QC Lead", "Owner"' },
        department:   { type: 'string' },
        factory_id:   { type: 'string',  description: 'Link to a Factory (one of factory_id or customer_id is required)' },
        customer_id:  { type: 'string',  description: 'Link to a Customer (one of factory_id or customer_id is required)' },
        is_primary:   { type: 'boolean', description: 'Mark as the primary contact for the linked company' },
        website:      { type: 'string' },
        linkedin_url: { type: 'string' },
        notes:        { type: 'string' },
        is_active:    { type: 'boolean', description: 'Default true' },
      },
    },
  },
  {
    name: 'delete_contact',
    description: 'Delete a Contact (the person record itself). Use to clean up duplicates or wrong entries.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Contact ID' },
      },
    },
  },
  {
    name: 'delete_factory',
    description: 'Delete a Factory. Blocked if there are open purchase orders — close or cancel those first. Soft delete (paranoid).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Factory ID' },
      },
    },
  },
  {
    name: 'update_contact',
    description: 'Update a contact. Most useful for setting factoryId or customerId to link a person to their company.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:           { type: 'string',  description: 'Contact ID' },
        first_name:   { type: 'string' },
        last_name:    { type: 'string' },
        email:        { type: 'string' },
        phone:        { type: 'string' },
        mobile:       { type: 'string' },
        job_title:    { type: 'string' },
        department:   { type: 'string' },
        factory_id:   { type: 'string',  description: 'Link this person to a Factory' },
        customer_id:  { type: 'string',  description: 'Link this person to a Customer' },
        is_primary:   { type: 'boolean' },
        is_active:    { type: 'boolean' },
        website:      { type: 'string' },
        linkedin_url: { type: 'string' },
        notes:        { type: 'string' },
      },
    },
  },
  {
    name: 'list_factories',
    description: 'List factory/supplier records (the supplier company itself, not the people). Each factory has a companyName, country, certifications, lead time, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        search:    { type: 'string',  description: 'Search by companyName, country, or city' },
        country:   { type: 'string',  description: 'Filter to a specific country' },
        is_active: { type: 'boolean', description: 'Filter by active status' },
        limit:     { type: 'number',  description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_factory',
    description: 'Get full details of a factory/supplier.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Factory ID' },
      },
    },
  },
  {
    name: 'create_factory',
    description: 'Create a new factory (supplier company). Useful for backfilling factories from existing supplier-contact data, or adding a new supplier discovered via outreach. Show Alex the proposed list before mass-creating; do not auto-create dozens of factories without confirmation.',
    inputSchema: {
      type: 'object',
      required: ['company_name'],
      properties: {
        company_name:    { type: 'string',  description: 'Factory legal/trade name (required)' },
        contact_person:  { type: 'string',  description: 'Primary contact person name' },
        email:           { type: 'string',  description: 'Primary email. If unknown, omit and Alex will fill it in.' },
        phone:           { type: 'string',  description: 'Primary phone. If unknown, omit.' },
        address:         { type: 'string' },
        city:            { type: 'string' },
        country:         { type: 'string' },
        currency:        { type: 'string',  description: 'Default USD' },
        payment_terms:   { type: 'string',  description: 'Default "Net 60"' },
        lead_time_days:  { type: 'number',  description: 'Default 30' },
        rating:          { type: 'number',  description: '0-5, default 5.0' },
        certifications:  { type: 'array',   items: { type: 'string' }, description: 'e.g. ["FSC", "ISO 9001", "CE"]' },
        specializations: { type: 'array',   items: { type: 'string' }, description: 'e.g. ["SPC flooring", "engineered wood"]' },
        notes:           { type: 'string' },
        brand_code:      { type: 'string',  description: 'Phase 4.9.2a: optional brand context. Set to a code from list_brands (e.g. "FW" for HanHua + FlorWay supplier ecosystem). Leave omitted for unclassified suppliers; admin can set later.' },
      },
    },
  },
  {
    name: 'update_factory',
    description: 'Update an existing factory. Use to fill in missing fields (email, phone, certifications) or correct mistakes.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:              { type: 'string',  description: 'Factory ID' },
        company_name:    { type: 'string' },
        contact_person:  { type: 'string' },
        email:           { type: 'string' },
        phone:           { type: 'string' },
        address:         { type: 'string' },
        city:            { type: 'string' },
        country:         { type: 'string' },
        currency:        { type: 'string' },
        payment_terms:   { type: 'string' },
        lead_time_days:  { type: 'number' },
        rating:          { type: 'number' },
        certifications:  { type: 'array', items: { type: 'string' } },
        specializations: { type: 'array', items: { type: 'string' } },
        notes:           { type: 'string' },
        brand_code:      { type: ['string', 'null'], description: 'Phase 4.9.2a: brand context. Pass a code from list_brands, or null to clear.' },
      },
    },
  },
  {
    name: 'list_quotations',
    description: 'List quotations from the ERP.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (draft, sent, accepted, rejected)' },
        limit:  { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'list_triage_items',
    description: 'List emails from the ERP triage inbox (AI-scored inbound emails). Search by sender or subject to find a specific supplier quotation or inquiry.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by sender email, sender name, or subject' },
        status: { type: 'string', enum: ['pending', 'promoted', 'forwarded', 'spam', 'dismissed', 'archived', 'all'], description: 'Status filter (default: pending). Use "all" to see every status.' },
        limit:  { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_triage_item',
    description: 'Read the full content of an email from the ERP triage inbox, including the complete body. Use this to extract product specs, pricing, or any other details from a supplier email.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Triage item ID from list_triage_items' },
      },
    },
  },
  {
    name: 'sync_inbox_now',
    description: 'Trigger an immediate Gmail sync to pull any new emails into the triage inbox. The cron interval is hourly by default (configurable via GMAIL_SYNC_INTERVAL_MINUTES); use this tool for on-demand pulls when Alex wants to check for fresh inbound. Returns immediately; new TriageItem rows land within ~10-30 seconds. Follow up with list_triage_items to read what arrived.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_triage_item',
    description: 'Update a triage item (currently: status only). Use this to flip a triage item to spam, dismissed, or archived without going through the dedicated action routes. To create a Lead from a triage item, prefer the /promote action route (this generic update will NOT create the Lead). To forward to Mohannad Fanzey + send the email, prefer the /forward-fanzey action route.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:     { type: 'string', description: 'Triage item ID' },
        status: { type: 'string', enum: ['pending', 'promoted', 'forwarded', 'spam', 'dismissed', 'archived'], description: 'New status' },
      },
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new outbound prospect lead in the CRM. Use this for net-new prospects you found via research, customs data, or referrals — NOT for inbound replies (those go through the triage /promote route). Idempotent on email: if a lead with the same email already exists, returns the existing record instead of creating a duplicate.',
    inputSchema: {
      type: 'object',
      required: ['company_name', 'contact_name', 'email'],
      properties: {
        company_name:     { type: 'string', description: 'Company / buyer organisation name' },
        contact_name:     { type: 'string', description: 'Primary contact full name' },
        email:            { type: 'string', description: 'Primary contact email (must be valid format)' },
        phone:            { type: 'string', description: 'Phone number (optional)' },
        country:          { type: 'string', description: 'Country (e.g. United States, Egypt)' },
        city:             { type: 'string', description: 'City' },
        website:          { type: 'string', description: 'Company website URL' },
        linkedin_url:     { type: 'string', description: 'Contact LinkedIn URL' },
        industry:         { type: 'string', description: 'Industry / vertical (free text)' },
        vertical:         { type: 'string', description: 'Sovern product vertical (e.g. flooring, auto_parts, garments)' },
        product_interests:{ type: 'array', items: { type: 'string' }, description: 'Product subcategory slugs (e.g. ["spc", "lvt"])' },
        estimated_value:  { type: 'number', description: 'Estimated deal value in USD' },
        source:           { type: 'string', enum: ['website', 'referral', 'trade_show', 'cold_call', 'social_media', 'advertisement', 'other'], description: 'Lead source' },
        lead_type:        { type: 'string', enum: ['inbound', 'outbound_prospect', 'supplier_contact'], description: 'Default: outbound_prospect' },
        notes:            { type: 'string', description: 'Free-text notes / context' },
        tags:             { type: 'array', items: { type: 'string' }, description: 'Tags' },
      },
    },
  },
  {
    name: 'send_outreach_email',
    description: 'Send (or draft) a tracked outreach email to a lead. ALWAYS show the full draft (subject + body + recipient) to Alex and wait for explicit confirmation before calling this tool — never auto-send. Two modes: (1) DEFAULT — sends immediately via SMTP, creates an OutreachEmail row with status=sent, bumps lead status new→contacted, uses the brand signature. (2) draftOnly=true (Phase 4.9.3b) — skips SMTP entirely, creates the same OutreachEmail row with status=draft so it appears in the outreach UI at /crm/leads/{leadId} for review before manual send. Use draftOnly=true whenever the user asks to "stage" / "draft" / "queue for review" an outreach email; use the default mode only when the user has explicitly approved the content for immediate send. The sender address (fromAddress) is resolved from lead.brandCode -> Brand.senderEmail (Phase 4.9.3.1). For untracked one-off Gmail use send_email instead.',
    inputSchema: {
      type: 'object',
      required: ['lead_id', 'subject', 'body_text'],
      properties: {
        lead_id:        { type: 'string', description: 'Lead ID (from list_leads or create_lead)' },
        subject:        { type: 'string', description: 'Email subject' },
        body_text:      { type: 'string', description: 'Plain-text body (will be wrapped in HTML with the brand signature)' },
        touch_number:   { type: 'number', description: 'Sequence step (1=initial, 2=first follow-up, etc.). Default 1.' },
        follow_up_days: { type: 'number', description: 'Days until follow-up is due. Default: touch1=3, touch2=5, touch3+=7' },
        cc:             { type: 'string', description: 'CC address(es), comma-separated' },
        bcc:            { type: 'string', description: 'BCC address(es), comma-separated' },
        draftOnly:      { type: 'boolean', description: 'Phase 4.9.3b: when true, persist the row with status=draft (no SMTP send). Default false (= immediate send). Use draft mode when the user wants to stage for review.' },
        fromAddress:    { type: 'string', description: 'Phase 4.9.3.1: explicit sender override. If omitted, resolved from lead.brandCode -> Brand.senderEmail (FW -> alexflorway@gmail.com, SH -> alex@sovernhouse.co). Use only when the AI assistant has reason to override the brand default.' },
      },
    },
  },
  {
    name: 'list_outreach_emails',
    description: 'List outreach emails with filters. Use follow_up_due=true to identify which leads are overdue for a follow-up. Use lead_id to see the full sequence sent to one prospect.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id:       { type: 'string', description: 'Filter to one lead' },
        status:        { type: 'string', enum: ['queued', 'sent', 'failed', 'bounced'] },
        touch_number:  { type: 'number', description: 'Filter by sequence step' },
        follow_up_due: { type: 'boolean', description: 'true = show only sends whose follow-up is due now and not yet completed' },
        limit:         { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
  },
  {
    name: 'schedule_follow_up',
    description: 'Set or reschedule a follow-up date. Pass outreach_email_id to update an OutreachEmail row\'s followUpDueAt, OR lead_id to log a follow-up Activity against a lead and set its expectedCloseDate. Use this when Alex says "remind me to follow up on X next Tuesday" or after a reply that asks for a delay.',
    inputSchema: {
      type: 'object',
      required: ['follow_up_at'],
      properties: {
        outreach_email_id: { type: 'string', description: 'OutreachEmail row to reschedule (preferred when applicable)' },
        lead_id:           { type: 'string', description: 'Lead row to schedule a follow-up Activity against' },
        follow_up_at:      { type: 'string', description: 'ISO datetime string (e.g. 2026-05-15T09:00:00Z). Asia/Taipei assumed if no timezone given.' },
        note:              { type: 'string', description: 'Reason / context for the follow-up' },
      },
    },
  },
  {
    name: 'get_lead_thread',
    description: 'Single-call lead profile: returns the lead row plus recent activities, every outreach email sent, all triage items promoted from this lead, AND any unprocessed triage items from the same sender email. Use this when Alex asks about a specific prospect ("where are we with X?") instead of making 4-5 separate read calls.',
    inputSchema: {
      type: 'object',
      required: ['lead_id'],
      properties: {
        lead_id: { type: 'string', description: 'Lead ID' },
      },
    },
  },
  {
    name: 'match_factories_for_product',
    description: 'Suggest factories that look like a fit for a given product requirement, ranked by country/specialization/certification/lead-time/rating fit. Activates the "compounding dataset" angle: each new factory and product you add improves future suggestions. Use this when sourcing a new product to identify which existing suppliers could quote it before reaching out to net-new factories.',
    inputSchema: {
      type: 'object',
      properties: {
        product_description:    { type: 'string', description: 'Free-text description of what you\'re sourcing (e.g. "SPC flooring 5mm, 0.5mm wear layer, click-lock")' },
        vertical:               { type: 'string', description: 'Sovern product vertical: flooring, auto_parts, garments, etc.' },
        country:                { type: 'string', description: 'Preferred country of origin (e.g. Malaysia, China, Vietnam)' },
        hs_code:                { type: 'string', description: 'HS / HTS classification (optional, future use)' },
        required_certifications:{ type: 'array', items: { type: 'string' }, description: 'Required certs (e.g. ["FloorScore", "CARB Phase 2"]). All must match for the full bonus.' },
        min_quantity:           { type: 'number', description: 'Minimum order quantity in units / containers' },
        target_lead_time_days:  { type: 'number', description: 'Maximum acceptable lead time in days' },
        brand_code:             { type: 'string', description: 'Phase 4.9.2a: product brand. When set, factories whose brandCode matches get a +15 score bump; mismatched brands get a -5 penalty (not a filter — cross-brand sourcing is allowed).' },
        limit:                  { type: 'number', description: 'Max candidates to return (default 10)' },
      },
    },
  },
  {
    name: 'create_quotation',
    description: 'Create a draft quotation with line items. Resolves lead→customer automatically: if you pass lead_id and the lead has no Customer record yet, this tool creates one from the lead data and marks the lead as converted (status=won). For inbound replies that already have a Customer, pass customer_id directly. Items must include product_id, quantity, unit_price. Returns the full quotation with items + computed totals. ALWAYS show Alex the full draft (line items + total + Incoterms + validity) and wait for explicit confirmation before treating it as ready to send.',
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        customer_id:     { type: 'string', description: 'Customer ID. Pass this OR lead_id.' },
        lead_id:         { type: 'string', description: 'Lead ID. Auto-converts lead→customer if no Customer exists yet.' },
        items: {
          type: 'array',
          description: 'Line items. Each: { product_id, quantity, unit_price, description?, unit?, discount?, notes? }',
          items: {
            type: 'object',
            required: ['product_id', 'quantity', 'unit_price'],
            properties: {
              product_id:  { type: 'string' },
              quantity:    { type: 'number' },
              unit_price:  { type: 'number' },
              description: { type: 'string' },
              unit:        { type: 'string' },
              discount:    { type: 'number' },
              notes:       { type: 'string' },
            },
          },
        },
        currency:       { type: 'string', description: 'Currency code (default USD)' },
        valid_days:     { type: 'number', description: 'Days the quotation is valid (default 30)' },
        terms:          { type: 'string', description: 'Free-text terms / notes block' },
        factory_id:     { type: 'string', description: 'Sourcing factory (for the sourcing-trail link)' },
        discount:       { type: 'number', description: 'Quotation-level discount (default 0)' },
        discount_type:  { type: 'string', enum: ['percentage', 'fixed'], description: 'Default fixed' },
        tax_rate:       { type: 'number', description: 'Tax rate % (default 0)' },
        payment_terms:  { type: 'string', description: 'Payment terms when auto-creating Customer (default "Net 30")' },
      },
    },
  },

  // ── Phase 4.15a: Quotation CRUD completion ──────────────────────────────
  {
    name: 'erp_update_quotation',
    description: 'Phase 4.15a — patch a DRAFT Quotation. Allowed fields: status, currency, validUntil, terms, discount, discountType, taxRate, displayAreaUnit, displayDimensionUnit, salesPersonId, factoryId. brandCode and quotationNumber are immutable. Sent / accepted / rejected quotations cannot be edited — create a revision instead. Writes ai_assistant_update_quotation to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                   { type: 'string', description: 'Quotation UUID.' },
        status:               { type: 'string', description: 'New status (draft / sent / accepted / rejected).' },
        currency:             { type: 'string' },
        validUntil:           { type: 'string', description: 'ISO datetime.' },
        terms:                { type: 'string' },
        discount:             { type: 'number' },
        discountType:         { type: 'string', enum: ['percentage', 'fixed'] },
        taxRate:              { type: 'number' },
        displayAreaUnit:      { type: 'string', enum: ['sqm', 'sqft'] },
        displayDimensionUnit: { type: 'string', enum: ['mm', 'inch'] },
        salesPersonId:        { type: 'string' },
        factoryId:            { type: 'string' },
      },
    },
  },
  {
    name: 'erp_get_quotation',
    description: 'Phase 4.15a — fetch a Quotation with all relations (items + product, customer, salesPerson, factory, lead). Use before generate_quotation_pdf so the AI can preview line items and totals.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Quotation UUID.' } },
    },
  },
  {
    name: 'erp_list_quotations',
    description: 'Phase 4.15a — list Quotations with filters. Supports status, brand_code, customer_id, date range. Returns up to 100. Use to find a recent quotation by customer or status before triggering a PDF regeneration.',
    inputSchema: {
      type: 'object',
      properties: {
        status:      { type: 'string', description: 'Filter by status (draft / sent / accepted / rejected).' },
        brand_code:  { type: 'string', description: 'Filter by brand (SH / FW).' },
        customer_id: { type: 'string', description: 'Filter to one customer.' },
        date_from:   { type: 'string', description: 'ISO datetime lower bound on createdAt.' },
        date_to:     { type: 'string', description: 'ISO datetime upper bound on createdAt.' },
        limit:       { type: 'number', description: 'Max results (default 25, max 100).' },
      },
    },
  },
  {
    name: 'erp_archive_quotation',
    description: 'Phase 4.15a — soft-delete a Quotation (paranoid). The row stays in the database with deletedAt set; downstream reads filter it out. Use for cancelled draft quotations. Writes ai_assistant_archive_quotation to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Quotation UUID.' } },
    },
  },

  // ── Phase 4.15d-1: Internal Approvals (5 tools) ─────────────────────────
  {
    name: 'erp_submit_approval',
    description: 'Phase 4.15d — submit an internal approval request. approval_type must be one of: send_quotation, confirm_sales_order, place_purchase_order, process_payment, stage_advancement, general (catch-all). Self-approval is blocked: assigned_to_user_id cannot equal the requester. Writes ai_assistant_submit_approval to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['entity_type', 'entity_id'],
      properties: {
        approval_type:         { type: 'string', enum: ['send_quotation', 'confirm_sales_order', 'place_purchase_order', 'process_payment', 'stage_advancement', 'general'], description: 'Workflow type. Default "general" if omitted or invalid.' },
        entity_type:           { type: 'string', description: 'Entity being approved (Quotation, SalesOrder, PurchaseOrder, etc.).' },
        entity_id:             { type: 'string', description: 'UUID of the entity.' },
        assigned_to_user_id:   { type: 'string', description: 'Specific approver UUID. Leave omitted for "any manager / admin can approve". Must differ from the requester.' },
        request_note:          { type: 'string', description: 'Optional context for the approver.' },
        priority:              { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Default "normal".' },
        due_date:              { type: 'string', description: 'ISO datetime by which approval is needed.' },
      },
    },
  },
  {
    name: 'erp_list_approvals',
    description: 'Phase 4.15d — list internal approvals with filters. Default returns up to 25 (max 100). Includes the requester, assignedTo, and decidedBy User joins. Use status="pending" + assigned_to_user_id=<self> to see your inbox.',
    inputSchema: {
      type: 'object',
      properties: {
        status:                 { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'], description: 'Filter by workflow state.' },
        approval_type:          { type: 'string', description: 'Filter by workflow type.' },
        requested_by_user_id:   { type: 'string', description: 'Filter to one requester.' },
        assigned_to_user_id:    { type: 'string', description: 'Filter to one assigned approver.' },
        entity_type:            { type: 'string', description: 'Filter by entity type (Quotation, SalesOrder, etc).' },
        entity_id:              { type: 'string', description: 'Filter to one entity UUID.' },
        limit:                  { type: 'number', description: 'Max results (default 25, max 100).' },
      },
    },
  },
  {
    name: 'erp_get_approval',
    description: 'Phase 4.15d — fetch one approval with full requester + assignedTo + decidedBy User joins.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'InternalApproval UUID.' } },
    },
  },
  {
    name: 'erp_approve_request',
    description: 'Phase 4.15d — approve a pending request. The decider must differ from the original requester (self-approval is hard-blocked). If the approval was assigned to a specific user, only that assignee (or super_admin) can decide. Writes ai_assistant_approve_request to AuditLog with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:   { type: 'string', description: 'InternalApproval UUID.' },
        note: { type: 'string', description: 'Optional manager comment.' },
      },
    },
  },
  {
    name: 'erp_reject_request',
    description: 'Phase 4.15d — reject a pending approval. Reason required (>=5 chars). Same decider rules as erp_approve_request (no self-rejection, assigned-only-can-decide). Writes ai_assistant_reject_request to AuditLog with before/after + reason.',
    inputSchema: {
      type: 'object',
      required: ['id', 'reason'],
      properties: {
        id:     { type: 'string', description: 'InternalApproval UUID.' },
        reason: { type: 'string', description: 'Why the request was rejected (>=5 chars). Becomes the decisionNote.' },
      },
    },
  },

  // ── Phase 4.15d-2a: Product Specifications (6 tools) ──────────────────
  // ProductSpecification is a typed wide-table (one row per Product,
  // ~30 named columns). The MCP tools surface upsert / get / list /
  // search / qa-lookup / archive against that schema.
  {
    name: 'erp_upsert_product_spec',
    description: 'Phase 4.15d — create or update a ProductSpecification row (one per product). Pass product_id or product_sku to identify the product. All other fields are optional and silently filtered to the writable column set. Fields: flooringType, coreType, construction, length, width, thickness, wearLayerThickness, wearLayerMil, acRating, waterproof, fireRating, slipRating, surfaceFinish, surfaceTexture, colorPattern, edgeType, woodSpecies, woodGrade, installationMethod, clickSystem, underlaymentRequired, underlaymentType, sqftPerBox, sqmPerBox, planksPerBox, boxWeight, warrantyResidential, warrantyCommercial, certifications (array), origin, format, clientVisibleFields (array), notes. Writes ai_assistant_create_product_spec or ai_assistant_update_product_spec to AuditLog.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id:           { type: 'string', description: 'Product UUID. Required if product_sku is not provided.' },
        product_sku:          { type: 'string', description: 'Product SKU. Alternative to product_id.' },
        flooringType:         { type: 'string', description: 'SPC, WPC, LVT, Laminate, Engineered Wood, Solid Wood, Bamboo, Vinyl Dry Back, etc.' },
        coreType:             { type: 'string' },
        construction:         { type: 'string' },
        length:               { type: 'number', description: 'Plank length in mm.' },
        width:                { type: 'number', description: 'Plank width in mm.' },
        thickness:            { type: 'number', description: 'Total thickness in mm.' },
        wearLayerThickness:   { type: 'number', description: 'Wear layer thickness in mm.' },
        wearLayerMil:         { type: 'integer', description: 'Wear layer in mil (US measurement, e.g., 12, 20, 28).' },
        acRating:             { type: 'string', description: 'AC1–AC5 (laminate).' },
        waterproof:           { type: 'boolean' },
        fireRating:           { type: 'string', description: 'Bfl-s1, Cfl-s1, etc.' },
        slipRating:           { type: 'string', description: 'R9 / R10 / R11 / COF.' },
        surfaceFinish:        { type: 'string' },
        surfaceTexture:       { type: 'string' },
        colorPattern:         { type: 'string' },
        edgeType:             { type: 'string', description: 'Micro-bevel, Square edge, Painted bevel, V-groove, etc.' },
        woodSpecies:          { type: 'string' },
        woodGrade:            { type: 'string', description: 'AB, BC, CD, EF, Character, Select, Prime, Rustic.' },
        installationMethod:   { type: 'string', description: 'Click-lock, Glue-down, Nail-down, Floating, Loose Lay.' },
        clickSystem:          { type: 'string', description: 'Uniclick, Valinge, Drop-lock, etc.' },
        underlaymentRequired: { type: 'string', description: 'Attached, Required, Optional, Not Required.' },
        underlaymentType:     { type: 'string', description: 'IXPE, Cork, EVA, EPE, Rubber, Foam.' },
        sqftPerBox:           { type: 'number' },
        sqmPerBox:            { type: 'number' },
        planksPerBox:         { type: 'integer' },
        boxWeight:            { type: 'number', description: 'kg.' },
        warrantyResidential:  { type: 'string' },
        warrantyCommercial:   { type: 'string' },
        certifications:       { type: 'array', items: { type: 'string' }, description: 'FSC, EUDR, FloorScore, CARB2, CE, etc.' },
        origin:               { type: 'string', description: 'Country of origin / manufacturing.' },
        format:               { type: 'string', description: 'Plank, Herringbone, Chevron, etc.' },
        clientVisibleFields:  { type: 'array', items: { type: 'string' }, description: 'Override which fields the client sees on quotations.' },
        notes:                { type: 'string' },
      },
    },
  },
  {
    name: 'erp_get_product_spec',
    description: 'Phase 4.15d — fetch a ProductSpecification by product_id OR product_sku. Returns the full row + the Product joined for context.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id:  { type: 'string', description: 'Product UUID.' },
        product_sku: { type: 'string', description: 'Product SKU. Alternative to product_id.' },
      },
    },
  },
  {
    name: 'erp_list_product_specs',
    description: 'Phase 4.15d — list ProductSpecifications with filters. Includes the joined Product (id, sku, name, brandCode). Up to 100. Use has_value=<fieldName> to narrow to rows where that field is set.',
    inputSchema: {
      type: 'object',
      properties: {
        flooring_type: { type: 'string' },
        core_type:     { type: 'string' },
        waterproof:    { type: 'boolean' },
        ac_rating:     { type: 'string' },
        fire_rating:   { type: 'string' },
        origin:        { type: 'string' },
        format:        { type: 'string' },
        brand_code:    { type: 'string', description: 'Filter via Product.brandCode join. SH or FW.' },
        has_value:     { type: 'string', description: 'Field name (or alias) that must be non-null on the row.' },
        limit:         { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_search_product_specs',
    description: 'Phase 4.15d — case-insensitive LIKE search across the string-typed columns of ProductSpecification (flooringType, coreType, surfaceFinish, woodSpecies, colorPattern, edgeType, installationMethod, certifications, origin, format, notes, etc). Returns up to 25 results with matched fields highlighted for each row. Use this when the AI gets a natural query like "AC4 commercial" or "wide oak plank engineered".',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search text (>=2 chars).' },
      },
    },
  },
  {
    name: 'erp_lookup_spec_qa',
    description: 'Phase 4.15d — natural-language Q&A against ProductSpecifications. Pass a product (id, sku, or name-ish string) and an attribute (user-facing name like "AC rating", "wear layer", "thickness", "core type", "warranty residential" etc — aliased to the canonical column). Returns the value or "not_yet_recorded" / "unknown_attribute". Use this in customer chat / email drafting when a user asks "what is the AC rating of IL-180x1220-7.5mm?" — the AI calls this tool first, then composes the answer.',
    inputSchema: {
      type: 'object',
      required: ['attribute'],
      properties: {
        product_id:  { type: 'string', description: 'Product UUID.' },
        product_sku: { type: 'string', description: 'Product SKU.' },
        product:     { type: 'string', description: 'Free-text product reference (UUID or SKU). Convenience alias.' },
        attribute:   { type: 'string', description: 'User-facing attribute name. Aliased liberally: "AC rating" → acRating, "wear layer" → wearLayerThickness, "thickness" → thickness, etc.' },
      },
    },
  },
  {
    name: 'erp_archive_product_spec',
    description: 'Phase 4.15d — hard-delete a ProductSpecification row (the model has no paranoid flag). Use when the spec is incorrect and needs to start over via erp_upsert_product_spec. Writes ai_assistant_archive_product_spec to AuditLog.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id:  { type: 'string', description: 'Product UUID.' },
        product_sku: { type: 'string', description: 'Product SKU. Alternative to product_id.' },
      },
    },
  },

  // ── Phase 4.15b-1: Landed Cost (5 tools) ────────────────────────────────
  {
    name: 'erp_create_landed_cost_template',
    description: 'Phase 4.15b — create a LandedCostTemplate. Name must be unique (409 if duplicated). supplier_id optional; country pair optional. components defaults to all-zeros; default_percentages defaults to {freight:5, insurance:1, customsDuty:10, handling:2, localDelivery:3}. Writes ai_assistant_create_landed_cost_template to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:                  { type: 'string', description: 'Unique template name.' },
        description:           { type: 'string' },
        supplier_id:           { type: 'string', description: 'Factory UUID. Optional.' },
        country_of_origin:     { type: 'string' },
        destination_country:   { type: 'string' },
        components:            { type: 'object', description: 'JSON: { productCost, freight, insurance, customsDuty, handlingCharges, localDelivery }.' },
        default_percentages:   { type: 'object', description: 'JSON: { freightPercent, insurancePercent, customsDutyPercent, handlingChargesPercent, localDeliveryPercent }.' },
        currency:              { type: 'string', description: 'Default USD.' },
        is_active:             { type: 'boolean', description: 'Default true.' },
        notes:                 { type: 'string' },
      },
    },
  },
  {
    name: 'erp_list_landed_cost_templates',
    description: 'Phase 4.15b — list LandedCostTemplates with filters. Up to 50. Default active_only=true.',
    inputSchema: {
      type: 'object',
      properties: {
        name:                 { type: 'string', description: 'LIKE %name% on template name.' },
        supplier_id:          { type: 'string' },
        country_of_origin:    { type: 'string' },
        destination_country:  { type: 'string' },
        active_only:          { type: 'boolean', description: 'Default true.' },
        limit:                { type: 'number', description: 'Max 50.' },
      },
    },
  },
  {
    name: 'erp_persist_landed_cost_calculation',
    description: 'Phase 4.15b — compute a landed-cost breakdown AND persist a LandedCostCalculation row (reference number LCC-YYYYMMDD-NNN). Computes totalProductCost = productCost*quantity, then adds freight + insurance + customsDuty + handlingCharges + localDelivery. costPerUnit = totalLandedCost / quantity. If `origin` is supplied AND a current ProductPrice row exists for (productId, origin) with validTo in the past, fails with price_expired pointing the caller to refresh the temporal price first (per Alex\'s Phase 4.15 spec). The pure-calc-no-persist version remains as calculate_landed_cost. Writes ai_assistant_persist_landed_cost_calculation to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['product_id', 'supplier_id', 'quantity', 'product_cost'],
      properties: {
        product_id:        { type: 'string', description: 'Product UUID.' },
        supplier_id:       { type: 'string', description: 'Factory UUID.' },
        quantity:          { type: 'number', description: 'Units (>0).' },
        product_cost:      { type: 'number', description: 'Per-unit FOB / EXW cost.' },
        freight:           { type: 'number', description: 'Total freight cost (default 0).' },
        insurance:         { type: 'number', description: 'Total insurance cost (default 0).' },
        customs_duty:      { type: 'number', description: 'Total customs duty (default 0).' },
        handling_charges:  { type: 'number', description: 'Port/handling (default 0).' },
        local_delivery:    { type: 'number', description: 'Inland delivery (default 0).' },
        currency:          { type: 'string', description: 'Default USD.' },
        exchange_rate:     { type: 'number', description: 'Default 1.' },
        purchase_order_id: { type: 'string', description: 'Optional PO link.' },
        template_id:       { type: 'string', description: 'Optional LandedCostTemplate link.' },
        origin:            { type: 'string', description: 'Origin country code/name. When set, triggers ProductPrice.validTo expiration check.' },
        notes:             { type: 'string' },
      },
    },
  },
  {
    name: 'erp_list_landed_cost_calculations',
    description: 'Phase 4.15b — list persisted LandedCostCalculations with filters. Up to 100. Useful for "what landed cost did we calculate for IronLite IL-SPC-4MM last month".',
    inputSchema: {
      type: 'object',
      properties: {
        product_id:        { type: 'string' },
        supplier_id:       { type: 'string' },
        purchase_order_id: { type: 'string' },
        date_from:         { type: 'string', description: 'ISO datetime lower bound on createdAt.' },
        date_to:           { type: 'string', description: 'ISO datetime upper bound on createdAt.' },
        search:            { type: 'string', description: 'LIKE on referenceNumber.' },
        limit:             { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_landed_cost_calculation',
    description: 'Phase 4.15b — fetch a single persisted LandedCostCalculation by id. Returns the full row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'LandedCostCalculation UUID.' } },
    },
  },

  // ── Phase 4.15d-2b-1: Compliance read/calc tools (8) ────────────────────
  {
    name: 'erp_compliance_check',
    description: 'Phase 4.15d — rule-based compliance check. Pass shipmentId OR productId + countryOrigin + countryDestination. Returns requirements (anti_dumping, cpsc, ce_marking, customs) + riskLevel. Rule set: CN→US triggers anti-dumping; any →US triggers CPSC; →EU triggers CE marking; customs always required. Stateless — no DB writes.',
    inputSchema: {
      type: 'object',
      required: ['country_origin', 'country_destination'],
      properties: {
        shipment_id:         { type: 'string', description: 'Shipment UUID. shipment_id OR product_id is required.' },
        product_id:          { type: 'string', description: 'Product UUID. shipment_id OR product_id is required.' },
        country_origin:      { type: 'string', description: 'ISO code or country name.' },
        country_destination: { type: 'string', description: 'ISO code or country name.' },
      },
    },
  },
  {
    name: 'erp_lookup_hs_codes',
    description: 'Phase 4.15d — search the HarmonizedCode catalog by code or description (LIKE). Optional chapter filter. Up to 100. Use before erp_calculate_duties or when classifying a product.',
    inputSchema: {
      type: 'object',
      properties: {
        search:  { type: 'string', description: 'LIKE %search% on code or description.' },
        chapter: { type: 'string', description: 'Exact chapter filter (e.g. "44" for wood, "39" for plastics).' },
        limit:   { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_calculate_duties',
    description: 'Phase 4.15d — compute duty + anti-dumping rate × unit price × quantity. Pulls baseRate + antiDumpingRate from HarmonizedCode; country-specific overrides take precedence over the base when set. Returns {baseRate, antiDumpingRate, totalDutyRate, dutyAmount}. Stateless — no DB writes.',
    inputSchema: {
      type: 'object',
      required: ['hs_code', 'country_origin', 'country_destination'],
      properties: {
        hs_code:             { type: 'string', description: 'HS code (e.g. "440710").' },
        country_origin:      { type: 'string', description: 'ISO code.' },
        country_destination: { type: 'string', description: 'ISO code.' },
        unit_price:          { type: 'number', description: 'Optional. When set with quantity, returns dutyAmount.' },
        quantity:            { type: 'integer', description: 'Optional. When set with unit_price, returns dutyAmount.' },
      },
    },
  },
  {
    name: 'erp_list_compliance_records',
    description: 'Phase 4.15d — list ComplianceRecord rows with filters. Up to 100. Use for audit trails on compliance status of shipments / products.',
    inputSchema: {
      type: 'object',
      properties: {
        shipment_id:         { type: 'string' },
        product_id:          { type: 'string' },
        type:                { type: 'string', description: 'anti_dumping / cpsc / ce_marking / customs / etc.' },
        status:              { type: 'string', description: 'pending / approved / flagged.' },
        country_origin:      { type: 'string' },
        country_destination: { type: 'string' },
        limit:               { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_compliance_record',
    description: 'Phase 4.15d — fetch one ComplianceRecord by id.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'ComplianceRecord UUID.' } },
    },
  },
  {
    name: 'erp_list_certificates_of_origin',
    description: 'Phase 4.15d — list CertificateOfOrigin rows with filters. Up to 100. Use to see what COs have been issued for a shipment or country.',
    inputSchema: {
      type: 'object',
      properties: {
        status:           { type: 'string', description: 'draft / issued / used / expired.' },
        shipment_id:      { type: 'string' },
        country_of_origin:{ type: 'string' },
        limit:            { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_certificate_of_origin',
    description: 'Phase 4.15d — fetch one CertificateOfOrigin by id. Use erp_generate_certificate_of_origin_pdf (Phase 4.15a) to produce the PDF.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'CertificateOfOrigin UUID.' } },
    },
  },

  // ── Phase 4.15d-2b-2: Compliance write tools (6) ────────────────────────
  {
    name: 'erp_create_compliance_record',
    description: 'Phase 4.15d — create a ComplianceRecord row (status=pending). type / countryOrigin / countryDestination required; shipment_id and product_id both optional. Writes ai_assistant_create_compliance_record to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['type', 'country_origin', 'country_destination'],
      properties: {
        shipment_id:         { type: 'string' },
        product_id:          { type: 'string' },
        type:                { type: 'string', description: 'anti_dumping / cpsc / ce_marking / customs / etc.' },
        country_origin:      { type: 'string' },
        country_destination: { type: 'string' },
        hs_code:             { type: 'string' },
        duty_rate:           { type: 'number' },
        anti_dumping_rate:   { type: 'number' },
        certificate_number:  { type: 'string' },
        notes:               { type: 'string' },
      },
    },
  },
  {
    name: 'erp_update_compliance_record',
    description: 'Phase 4.15d — patch a ComplianceRecord. Allowed fields: status, expiry_date, notes (matches the REST controller surface). Writes ai_assistant_update_compliance_record with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:          { type: 'string', description: 'ComplianceRecord UUID.' },
        status:      { type: 'string', description: 'pending / approved / flagged / expired.' },
        expiry_date: { type: 'string', description: 'ISO datetime.' },
        notes:       { type: 'string' },
      },
    },
  },
  {
    name: 'erp_create_hs_code',
    description: 'Phase 4.15d — add a new HS code to the HarmonizedCode catalog. SUPER_ADMIN ONLY (HS codes are global reference data and misclassification is expensive — gated to limit who can write). Refuses duplicate code with 409. Writes ai_assistant_create_hs_code to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['code', 'description'],
      properties: {
        code:               { type: 'string', description: 'HS code (typically 6–10 digits).' },
        description:        { type: 'string' },
        chapter:            { type: 'string' },
        heading:            { type: 'string' },
        subheading:         { type: 'string' },
        duty_rate:          { type: 'number' },
        anti_dumping_rate:  { type: 'number' },
        country_specific:   { type: 'object', description: 'JSON: { "CN": { dutyRate, antiDumpingRate }, ... }.' },
        notes:              { type: 'string' },
      },
    },
  },
  {
    name: 'erp_create_certificate_of_origin',
    description: 'Phase 4.15d — create a CertificateOfOrigin row (NOT the PDF — the PDF generator is erp_generate_certificate_of_origin_pdf, Phase 4.15a, which renders this row). Generates the certNumber, sets status=issued + issueDate=now. Writes ai_assistant_create_certificate_of_origin to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['shipment_id', 'exporter_name', 'exporter_address', 'importer_name', 'country_of_origin', 'country_of_destination', 'items'],
      properties: {
        shipment_id:             { type: 'string' },
        exporter_name:           { type: 'string' },
        exporter_address:        { type: 'string' },
        importer_name:           { type: 'string' },
        country_of_origin:       { type: 'string' },
        country_of_destination:  { type: 'string' },
        items:                   { description: 'Array or object describing the goods. Free-form to match the existing model.' },
        chamber_of_commerce:     { type: 'string' },
        notes:                   { type: 'string' },
      },
    },
  },
  {
    name: 'erp_get_compliance_dashboard',
    description: 'Phase 4.15d — compliance dashboard counters: expiringCerts (next 30 days), flaggedRecords, pendingApprovals, highRiskShipments (anti_dumping type). Read-only aggregation across ComplianceRecord + CertificateOfOrigin. No filters yet — returns the global view.',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Phase 4.15c-1: Container loading (5 tools) ──────────────────────────
  {
    name: 'erp_create_container_load',
    description: 'Phase 4.15c — create a Container row in planning status. Auto-generates containerNumber when not supplied. containerType: 20ft / 40ft / 40ft_hc. Writes ai_assistant_create_container_load to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['container_type'],
      properties: {
        container_type:    { type: 'string', enum: ['20ft', '40ft', '40ft_hc'] },
        container_number:  { type: 'string', description: 'Optional. Auto-generated as PLAN-<TYPE>-<TS> when omitted.' },
        shipment_id:       { type: 'string' },
        purchase_order_id: { type: 'string' },
        destination_port:  { type: 'string' },
        etd:               { type: 'string', description: 'ISO datetime — Estimated Time of Departure.' },
        eta:               { type: 'string', description: 'ISO datetime — Estimated Time of Arrival.' },
        notes:             { type: 'string' },
      },
    },
  },
  {
    name: 'erp_optimize_container_load',
    description: 'Phase 4.15c — pure-math optimizer: given a container_type + list of {product_id, quantity}, returns total weight + cube + utilization % + fits/overflow. Does NOT persist. Fetches each Product to read its weight + cubicMeters; flags products with missing spec data. Use before erp_create_container_load to validate the plan.',
    inputSchema: {
      type: 'object',
      required: ['container_type', 'items'],
      properties: {
        container_type: { type: 'string', enum: ['20ft', '40ft', '40ft_hc'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['product_id', 'quantity'],
            properties: {
              product_id: { type: 'string' },
              quantity:   { type: 'number' },
            },
          },
        },
      },
    },
  },
  {
    name: 'erp_list_container_loads',
    description: 'Phase 4.15c — list Container rows with filters. Up to 100. Search is LIKE on containerNumber.',
    inputSchema: {
      type: 'object',
      properties: {
        container_type:    { type: 'string', enum: ['20ft', '40ft', '40ft_hc'] },
        container_status:  { type: 'string', enum: ['available', 'planning', 'loading', 'loaded', 'in_transit', 'delivered', 'empty', 'maintenance'] },
        shipment_id:       { type: 'string' },
        purchase_order_id: { type: 'string' },
        search:            { type: 'string', description: 'LIKE on containerNumber.' },
        limit:             { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_container_load',
    description: 'Phase 4.15c — fetch one Container by id.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Container UUID.' } },
    },
  },
  {
    name: 'erp_update_container_load',
    description: 'Phase 4.15c — patch Container fields. Editable: container_status, destination_port, etd, eta, cargo_weight, used_capacity, pallet_count, box_count, loading_date, departure_date, notes. container_type and container_number are immutable on this path. Writes ai_assistant_update_container_load with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                { type: 'string' },
        container_status:  { type: 'string', enum: ['available', 'planning', 'loading', 'loaded', 'in_transit', 'delivered', 'empty', 'maintenance'] },
        destination_port:  { type: 'string' },
        etd:               { type: 'string', description: 'ISO datetime.' },
        eta:               { type: 'string', description: 'ISO datetime.' },
        cargo_weight:      { type: 'number' },
        used_capacity:     { type: 'number' },
        pallet_count:      { type: 'integer' },
        box_count:         { type: 'integer' },
        loading_date:      { type: 'string', description: 'ISO datetime.' },
        departure_date:    { type: 'string', description: 'ISO datetime.' },
        notes:             { type: 'string' },
      },
    },
  },

  // ── Phase 4.15c-2: Quality / inspection (9 tools) ───────────────────────
  {
    name: 'erp_schedule_inspection',
    description: 'Phase 4.15c — create an Inspection row in status=scheduled. type covers the full QC lifecycle: pre_production, during_production, pre_shipment, loading. factory_id + inspector_id required; sales_order_id and/or purchase_order_id optional. inspection_number auto-generated when omitted. Writes ai_assistant_schedule_inspection.',
    inputSchema: {
      type: 'object',
      required: ['type', 'factory_id', 'inspector_id'],
      properties: {
        type: { type: 'string', enum: ['pre_production', 'during_production', 'pre_shipment', 'loading'] },
        factory_id: { type: 'string' },
        inspector_id: { type: 'string', description: 'User UUID of the assigned inspector.' },
        sales_order_id: { type: 'string' },
        purchase_order_id: { type: 'string' },
        scheduled_date: { type: 'string', description: 'ISO datetime.' },
        notes: { type: 'string' },
        inspection_number: { type: 'string', description: 'Override the auto-generated number.' },
      },
    },
  },
  {
    name: 'erp_start_inspection',
    description: 'Phase 4.15c — transition scheduled → in_progress. Refuses if the inspection is already in_progress or finalized. Writes ai_assistant_start_inspection with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Inspection UUID.' } },
    },
  },
  {
    name: 'erp_complete_inspection',
    description: 'Phase 4.15c — finalize an in_progress inspection. overall_result (pass | fail | conditional) drives the final status (passed | failed | conditional). completed_date defaults to now. Writes ai_assistant_complete_inspection with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id', 'overall_result'],
      properties: {
        id: { type: 'string', description: 'Inspection UUID.' },
        overall_result: { type: 'string', enum: ['pass', 'fail', 'conditional'] },
        notes: { type: 'string' },
        completed_date: { type: 'string', description: 'ISO datetime. Defaults to now.' },
      },
    },
  },
  {
    name: 'erp_add_inspection_item',
    description: 'Phase 4.15c — add a checkpoint line item to an inspection. Each item has a check_point (e.g., "Dimensions"), criteria (e.g., "Width 6mm ± 0.2mm"), result (pass/fail/na), optional measured value, notes, and images array. Refuses if the parent inspection is already finalized.',
    inputSchema: {
      type: 'object',
      required: ['inspection_id', 'product_id', 'check_point', 'criteria'],
      properties: {
        inspection_id: { type: 'string' },
        product_id: { type: 'string' },
        check_point: { type: 'string', description: 'Short label for the check (e.g. "Dimensions", "Color match").' },
        criteria: { type: 'string', description: 'Pass criteria — what the inspector measures against.' },
        result: { type: 'string', enum: ['pass', 'fail', 'na'] },
        value: { type: 'string', description: 'Measured value (free-text — keep numeric values as strings to preserve units).' },
        notes: { type: 'string' },
        images: { type: 'array', items: { type: 'string' }, description: 'Array of image URLs.' },
      },
    },
  },
  {
    name: 'erp_update_inspection_item',
    description: 'Phase 4.15c — patch an inspection item. Editable: result, value, notes, check_point, criteria, images. Refuses if the parent inspection is already finalized. Writes ai_assistant_update_inspection_item with before/after.',
    inputSchema: {
      type: 'object',
      required: ['item_id'],
      properties: {
        item_id: { type: 'string', description: 'InspectionItem UUID.' },
        result: { type: 'string', enum: ['pass', 'fail', 'na'] },
        value: { type: 'string' },
        notes: { type: 'string' },
        check_point: { type: 'string' },
        criteria: { type: 'string' },
        images: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'erp_list_inspections',
    description: 'Phase 4.15c — list inspections with filters. Up to 100. scheduledFrom/To are ISO datetime range filters on scheduled_date.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled', 'in_progress', 'passed', 'failed', 'conditional'] },
        type: { type: 'string', enum: ['pre_production', 'during_production', 'pre_shipment', 'loading'] },
        factory_id: { type: 'string' },
        inspector_id: { type: 'string' },
        sales_order_id: { type: 'string' },
        purchase_order_id: { type: 'string' },
        scheduled_from: { type: 'string', description: 'ISO datetime — inspections scheduled at or after this.' },
        scheduled_to: { type: 'string', description: 'ISO datetime — inspections scheduled at or before this.' },
        search: { type: 'string', description: 'LIKE on inspection_number.' },
        limit: { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_inspection',
    description: 'Phase 4.15c — fetch one Inspection by id, with items, report, factory, and inspector eager-loaded.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Inspection UUID.' } },
    },
  },
  {
    name: 'erp_generate_inspection_report',
    description: 'Phase 4.15c — create an InspectionReport row for a given inspection. Auto-derives findings (per-checkpoint pass/fail/na counts + overall counts) from the inspection items. Summary defaults to a one-line "X/Y passed" string when omitted. Refuses if a report already exists for the inspection (one-to-one). Returns the report row including the auto-generated reportNumber. Writes ai_assistant_generate_inspection_report.',
    inputSchema: {
      type: 'object',
      required: ['inspection_id'],
      properties: {
        inspection_id: { type: 'string' },
        summary: { type: 'string' },
        recommendations: { type: 'string' },
        file_url: { type: 'string', description: 'Optional URL to the PDF (use erp_generate_inspection_certificate_pdf to produce one).' },
        extra_findings: {
          type: 'array',
          description: 'Additional finding objects to prepend before the auto-derived count/per_checkpoint findings.',
          items: { type: 'object' },
        },
      },
    },
  },
  {
    name: 'erp_get_inspection_report',
    description: 'Phase 4.15c — fetch an InspectionReport. Provide exactly one of report_id, report_number, or inspection_id.',
    inputSchema: {
      type: 'object',
      properties: {
        report_id: { type: 'string' },
        report_number: { type: 'string' },
        inspection_id: { type: 'string' },
      },
    },
  },

  // ── Phase 4.15c-3: Sample management (6 tools) ──────────────────────────
  {
    name: 'erp_create_sample_request',
    description: 'Phase 4.15c — create a SampleRequest in status=pending. products is an array of {productId, quantity, ...}; totalQuantity is auto-summed. Validates each productId exists. Priority defaults to medium. request_number auto-generated when omitted.',
    inputSchema: {
      type: 'object',
      required: ['customer_id', 'products'],
      properties: {
        customer_id: { type: 'string' },
        products: {
          type: 'array',
          items: {
            type: 'object',
            required: ['quantity'],
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' },
              notes: { type: 'string' },
            },
          },
        },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        required_by_date: { type: 'string', description: 'ISO datetime.' },
        special_requirements: { type: 'string' },
        notes: { type: 'string' },
        request_number: { type: 'string' },
      },
    },
  },
  {
    name: 'erp_approve_sample_request',
    description: 'Phase 4.15c — transition pending → approved. Records approvedBy (the MCP requester) + approvalDate. Refuses if the request is not in pending. Writes ai_assistant_approve_sample_request with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'SampleRequest UUID.' } },
    },
  },
  {
    name: 'erp_create_sample_shipment',
    description: 'Phase 4.15c — create a SampleShipment for an approved sample request. Auto-generates shipmentNumber when omitted. Promotes the parent request to status=shipped when previously approved/processing (allows multiple shipments for split deliveries). Writes ai_assistant_create_sample_shipment.',
    inputSchema: {
      type: 'object',
      required: ['sample_request_id', 'quantity'],
      properties: {
        sample_request_id: { type: 'string' },
        quantity: { type: 'number' },
        shipping_method: { type: 'string', enum: ['courier', 'air_freight', 'sea_freight', 'local_delivery'] },
        carrier: { type: 'string', description: 'e.g. DHL, FedEx, UPS, Aramex.' },
        tracking_number: { type: 'string' },
        shipped_date: { type: 'string', description: 'ISO datetime. Defaults to now.' },
        expected_delivery_date: { type: 'string', description: 'ISO datetime.' },
        weight: { type: 'number' },
        weight_unit: { type: 'string', enum: ['kg', 'lb'] },
        shipping_cost: { type: 'number' },
        currency: { type: 'string', description: 'ISO-3 currency code. Defaults to USD.' },
        notes: { type: 'string' },
        shipment_number: { type: 'string' },
      },
    },
  },
  {
    name: 'erp_record_sample_feedback',
    description: 'Phase 4.15c — capture customer feedback after sample delivery. rating (1–5) is required; quality/packaging/delivery axes are optional 1–5 scores. issues is an array of free-text issue objects. status defaults to "escalated" when rating ≤ 2, otherwise "pending_action". Writes ai_assistant_record_sample_feedback.',
    inputSchema: {
      type: 'object',
      required: ['sample_request_id', 'rating'],
      properties: {
        sample_request_id: { type: 'string' },
        rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Overall rating, 1–5.' },
        quality: { type: 'integer', minimum: 1, maximum: 5 },
        packaging: { type: 'integer', minimum: 1, maximum: 5 },
        delivery: { type: 'integer', minimum: 1, maximum: 5 },
        comments: { type: 'string', description: 'Customer-facing comments.' },
        issues: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'string' },
        sent_by_contact_id: { type: 'string' },
        follow_up_date: { type: 'string', description: 'ISO datetime.' },
        internal_notes: { type: 'string', description: 'Internal-only notes (not surfaced to customer).' },
        status: { type: 'string', enum: ['pending_action', 'under_review', 'resolved', 'escalated'] },
      },
    },
  },
  {
    name: 'erp_list_sample_requests',
    description: 'Phase 4.15c — list SampleRequests with filters. Up to 100. requestFrom/To filter on request_date.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        request_from: { type: 'string', description: 'ISO datetime.' },
        request_to: { type: 'string', description: 'ISO datetime.' },
        search: { type: 'string', description: 'LIKE on request_number.' },
        limit: { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_sample_request',
    description: 'Phase 4.15c — fetch one SampleRequest by id with shipments, feedback, and customer eager-loaded.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'SampleRequest UUID.' } },
    },
  },

  // ── Phase 4.15b-2: Letter of Credit (7 tools) ───────────────────────────
  {
    name: 'erp_create_letter_of_credit',
    description: 'Phase 4.15b — create a draft Letter of Credit. status starts as "draft". Validates supplier (Factory) + customer existence, amount > 0, expiry > issue, enum constraints on type/payment_terms/tolerance_type. tolerance + tolerance_type drive the payment-discrepancy check at erp_record_lc_payment. lc_number auto-generated when omitted.',
    inputSchema: {
      type: 'object',
      required: ['supplier_id', 'customer_id', 'issuing_bank', 'beneficiary', 'amount', 'issue_date', 'expiry_date'],
      properties: {
        lc_number: { type: 'string' },
        supplier_id: { type: 'string', description: 'Factory UUID.' },
        customer_id: { type: 'string' },
        issuing_bank: { type: 'string' },
        advising_bank: { type: 'string' },
        beneficiary: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string', description: 'ISO-3 code. Defaults to USD.' },
        issue_date: { type: 'string', description: 'ISO datetime.' },
        expiry_date: { type: 'string', description: 'ISO datetime. Must be after issue_date.' },
        type: { type: 'string', enum: ['sight', 'usance', 'revolving', 'standby'] },
        terms: { type: 'string' },
        payment_terms: { type: 'string', enum: ['at_sight', 'days_30', 'days_60', 'days_90', 'days_120'] },
        tolerance: { type: 'number', description: 'Allowed payment variance (in % if tolerance_type=percentage, else absolute amount).' },
        tolerance_type: { type: 'string', enum: ['percentage', 'amount'] },
        partial_shipment: { type: 'boolean' },
        transhipment_allowed: { type: 'boolean' },
        incoterm: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'erp_submit_letter_of_credit',
    description: 'Phase 4.15b — transition draft → submitted. Records the submitter identity in notes so erp_approve_letter_of_credit can enforce self-approval prevention. Writes ai_assistant_submit_letter_of_credit with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'LetterOfCredit UUID.' } },
    },
  },
  {
    name: 'erp_approve_letter_of_credit',
    description: 'Phase 4.15b — transition submitted → approved. SUPER_ADMIN ONLY (high-stakes financial decision). Self-approval is blocked: the user who submitted the LC cannot also approve it. Writes ai_assistant_approve_letter_of_credit with before/after.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'LetterOfCredit UUID.' } },
    },
  },
  {
    name: 'erp_attach_lc_document',
    description: 'Phase 4.15b — attach a LetterOfCreditDocument row. Use after erp_generate_*_pdf or to register an externally-uploaded file. document_type is one of invoice, bill_of_lading, packing_list, certificate_of_origin, inspection_report, insurance_document, draft, amendment, other.',
    inputSchema: {
      type: 'object',
      required: ['letter_of_credit_id', 'document_type', 'file_name', 'file_url'],
      properties: {
        letter_of_credit_id: { type: 'string' },
        document_type: { type: 'string', enum: ['invoice', 'bill_of_lading', 'packing_list', 'certificate_of_origin', 'inspection_report', 'insurance_document', 'draft', 'amendment', 'other'] },
        document_number: { type: 'string' },
        file_name: { type: 'string' },
        file_url: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'verified', 'rejected', 'discrepancy_found'] },
        remarks: { type: 'string' },
      },
    },
  },
  {
    name: 'erp_record_lc_payment',
    description: 'Phase 4.15b — record presentation and/or payment against an LC. Setting presented_amount alone promotes status approved/active → presented (does not finalize). Setting paid_amount enforces the tolerance check (within amount ± tolerance) and finalizes status → paid. Both fields can be set in one call. LC must be in approved/active/presented to record payment.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        presented_amount: { type: 'number' },
        presented_date: { type: 'string', description: 'ISO datetime. Defaults to now when presented_amount is set.' },
        paid_amount: { type: 'number' },
        paid_date: { type: 'string', description: 'ISO datetime. Defaults to now when paid_amount is set.' },
      },
    },
  },
  {
    name: 'erp_list_letters_of_credit',
    description: 'Phase 4.15b — list LCs with filters. Up to 100. expiring_before flags LCs about to lapse. search runs LIKE on lc_number OR beneficiary.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'active', 'presented', 'paid', 'cancelled', 'expired'] },
        supplier_id: { type: 'string' },
        customer_id: { type: 'string' },
        type: { type: 'string', enum: ['sight', 'usance', 'revolving', 'standby'] },
        issuing_bank: { type: 'string', description: 'LIKE match on issuing_bank.' },
        expiring_before: { type: 'string', description: 'ISO datetime — LCs whose expiry_date is on or before this.' },
        search: { type: 'string', description: 'LIKE on lc_number OR beneficiary.' },
        limit: { type: 'number', description: 'Default 25, max 100.' },
      },
    },
  },
  {
    name: 'erp_get_letter_of_credit',
    description: 'Phase 4.15b — fetch one LC by id with attached documents, customer, and supplier eager-loaded.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'LetterOfCredit UUID.' } },
    },
  },

  // ── Phase 4.15a: Document generation (13 tools) ─────────────────────────
  // All thirteen share the same contract: pass an entity id, get back
  // { driveFileId, driveUrl, documentRowId, fileName, sizeKB }. PDFs are
  // saved to the brand-appropriate Drive folder (SH → Documents/<type>/,
  // FW → Brand Assets/Documents/<type>/) and a Document row is created
  // linking back to the source entity.
  {
    name: 'erp_generate_quotation_pdf',
    description: 'Phase 4.15a — generate the brand-aware Quotation PDF (SH classic / FW IronLite / FW generic / FW private label per quotation.brandCode + customer config). Uploads to Drive, returns the share link, creates a Document row. Writes ai_assistant_generate_quotation_pdf to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Quotation UUID.' } },
    },
  },
  {
    name: 'erp_generate_invoice_pdf',
    description: 'Phase 4.15a — generate an Invoice PDF. Includes FW internal-record banner for FW invoices (Phase 4 C16). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Invoice UUID.' } },
    },
  },
  {
    name: 'erp_generate_proforma_invoice_pdf',
    description: 'Phase 4.15a — generate a Proforma Invoice PDF. Includes FW internal-record banner for FW PIs (Phase 4 C16). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'ProformaInvoice UUID.' } },
    },
  },
  {
    name: 'erp_generate_purchase_order_pdf',
    description: 'Phase 4.15a — generate a Purchase Order PDF (for the factory). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'PurchaseOrder UUID.' } },
    },
  },
  {
    name: 'erp_generate_packing_list_pdf',
    description: 'Phase 4.15a — generate a Packing List PDF. Default uses the basic generator; pass advanced=true for the professional pdfTemplates renderer. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:       { type: 'string',  description: 'PackingList UUID.' },
        advanced: { type: 'boolean', description: 'Default false. true switches to the professional pdfTemplates renderer.' },
      },
    },
  },
  {
    name: 'erp_generate_certificate_of_origin_pdf',
    description: 'Phase 4.15a — generate a Certificate of Origin PDF. Uses the professional pdfTemplates renderer. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Certificate of Origin UUID.' } },
    },
  },
  {
    name: 'erp_generate_credit_note_pdf',
    description: 'Phase 4.15a — generate a Credit Note PDF for an Invoice. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Invoice UUID (the credit note references the source invoice).' } },
    },
  },
  {
    name: 'erp_generate_inspection_certificate_pdf',
    description: 'Phase 4.15a — generate an Inspection Certificate PDF for a completed inspection. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Inspection UUID.' } },
    },
  },
  {
    name: 'erp_generate_product_spec_sheet_pdf',
    description: 'Phase 4.15a — generate a Product Specification Sheet PDF. Includes factory certifications + commercial details + compliance footer. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Product UUID.' } },
    },
  },
  {
    name: 'erp_generate_sales_note_pdf',
    description: 'Phase 4.15a — generate a Sales Note (Purchase Contract — signed ProformaInvoice) PDF. Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'ProformaInvoice UUID (sales note references the PI).' } },
    },
  },
  {
    name: 'erp_generate_sales_order_pdf',
    description: 'Phase 4.15a — generate a Sales Order PDF. Includes FW internal-record banner for FW orders (Phase 4 C16). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'SalesOrder UUID.' } },
    },
  },
  {
    name: 'erp_generate_shipment_document_pdf',
    description: 'Phase 4.15a — generate a Shipment Document PDF (carrier, vessel, container, ports, ETA). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Shipment UUID.' } },
    },
  },
  {
    name: 'erp_generate_statement_of_account_pdf',
    description: 'Phase 4.15a — generate a Statement of Account PDF for a customer (all invoices + payments + outstanding balance). Uploads to Drive, creates a Document row.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Customer UUID.' } },
    },
  },

  {
    name: 'calculate_landed_cost',
    description: 'Calculate landed cost for a product import. Returns full breakdown: product, freight, insurance, customs duty, handling, local delivery, total landed cost, cost per unit. If margin_percent is provided, also returns sell-price suggestions using Sovern House\'s standard formula: sell_price = cost / (1 - margin/100). Pure calculation — does NOT persist to the LandedCostCalculation table; use the /api/landed-costs endpoint for that.',
    inputSchema: {
      type: 'object',
      required: ['product_cost'],
      properties: {
        product_cost:    { type: 'number', description: 'FOB / EXW unit cost in the working currency' },
        quantity:        { type: 'number', description: 'Units (default 1)' },
        freight:         { type: 'number', description: 'Total freight cost (not per-unit). Default 0' },
        insurance:       { type: 'number', description: 'Total insurance cost. Default 0' },
        customs_duty:    { type: 'number', description: 'Total customs duty. Default 0' },
        handling:        { type: 'number', description: 'Port/handling charges. Default 0' },
        local_delivery:  { type: 'number', description: 'Inland/local delivery to buyer. Default 0' },
        currency:        { type: 'string', description: 'Currency code (default USD)' },
        margin_percent:  { type: 'number', description: 'Sovern margin % to apply (e.g. 5 for 5%). Returns suggested sell prices when set.' },
      },
    },
  },
  {
    name: 'search_drive_files',
    description: 'Search a connected Google Drive for a file. Phase 4.9.3b: TWO accounts are connected — accountKey="sh" → alex@sovernhouse.co (SH brand context, default for backward compat) and accountKey="fw" → alexflorway@gmail.com (FW brand context: HanHua, FlorWay, IronLite, anything FW). Pass accountKey="fw" for any FW-brand work or pass brandCode and the tool resolves it. Search by name= and/or query= (compose with AND). Returns up to 10 files with id, name, mimeType, size, modifiedTime, webViewLink. Always surface the webViewLink in your reply.',
    inputSchema: {
      type: 'object',
      properties: {
        query:      { type: 'string', description: 'Full-text search term (searches inside file content).' },
        name:       { type: 'string', description: 'Search by file name. Partial matches work.' },
        limit:      { type: 'number', description: 'Max results (default 10, cap 20).' },
        accountKey: { type: 'string', enum: ['sh', 'fw'], description: 'Phase 4.9.3b: which connected Google account to search. "sh" = alex@sovernhouse.co (default), "fw" = alexflorway@gmail.com.' },
        brandCode:  { type: 'string', description: 'Phase 4.9.3b: alternative to accountKey. "FW" routes to fw account, anything else routes to sh.' },
      },
    },
  },
  {
    name: 'read_drive_file',
    description: 'Read the text content of a Google Drive file. Phase 4.14 supports: xlsx, xls, docx, pdf, rtf, Google Docs, Google Sheets, plain text, CSV. Optional narrowing params (sheet_name, row_range, column_range, page_range, max_pages) let the AI scope large files without blowing context. Output is hard-capped at 200KB with a [TRUNCATED] marker pointing to the right narrowing param. 10-minute LRU cache keyed on (fileId + accountKey + params) — re-reads in a session are free. accountKey/brandCode routing same as search_drive_files; default "sh". Unsupported: pptx (decks; share webViewLink instead), legacy .doc (re-save as .docx or open with Google Docs to auto-convert), image-based / scanned PDFs (OCR not yet supported), encrypted PDFs.',
    inputSchema: {
      type: 'object',
      required: ['file_id'],
      properties: {
        file_id:       { type: 'string',  description: 'Google Drive file ID from search_drive_files.' },
        accountKey:    { type: 'string',  enum: ['sh', 'fw'], description: 'Account routing. Default "sh".' },
        brandCode:     { type: 'string',  description: 'Alternative to accountKey. "FW" routes to fw account.' },
        // Phase 4.14 xlsx / xls params
        sheet_name:    { type: 'string',  description: 'xlsx/xls only. Read just the named sheet (case-insensitive). Omit to read all sheets.' },
        row_range:     { type: 'array',   items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'xlsx/xls only. [startRow, endRow] tuple, 1-indexed inclusive. Useful when factory quotes have header rows above the data.' },
        column_range:  { type: 'array',   items: { type: 'string' }, minItems: 2, maxItems: 2, description: 'xlsx/xls only. [startCol, endCol] tuple of column letters, e.g. ["A","Q"]. Inclusive.' },
        raw_formulas:  { type: 'boolean', description: 'xlsx/xls only. Default false (renders computed values like 25.50). Set true to render formula source like =ROUND(K9*(1+L9),2). Use the default for factory quotes; use true to audit a contract draft.' },
        // Phase 4.14 pdf params
        page_range:    { type: 'array',   items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'pdf only. [startPage, endPage] tuple, 1-indexed inclusive. Useful for "read page 3 of the contract".' },
        // Phase 4.14 docx params
        max_pages:     { type: 'number',  description: 'docx only. Heuristic page cap (≈3000 chars/page). Truncates with a marker indicating total estimated pages.' },
      },
    },
  },
  {
    name: 'list_product_categories',
    description: 'Phase 4.9.1 — List product categories. Filter by parentId (pass null to get root categories) or includeArchived (default false; pass true to see archived rows). Pass tree=true to get a nested {id,name,children:[]} shape instead of a flat list. Use this before create_product_category to find the right parentId, or before archive_product_category to confirm the row exists.',
    inputSchema: {
      type: 'object',
      properties: {
        parentId:        { type: ['string', 'null'], description: 'Restrict to direct children of this parent. Pass null for top-level categories. Omit to return all.' },
        includeArchived: { type: 'boolean',          description: 'Default false. Pass true to include is_archived=true rows.' },
        tree:            { type: 'boolean',          description: 'Default false. Pass true to get a nested tree instead of a flat list.' },
      },
    },
  },
  {
    name: 'create_product_price',
    description: 'Phase 4.9.2c — Create a temporal ProductPrice row (super-admin only). Pins a cost + selling combo to a (factory and/or origin) and a validity window. Used by the quotation builder via getCurrentPrice for the floor check. At least one of origin or factoryId is required. ALWAYS show Alex a preview (origin/factory, cost, selling, markup, tariff, valid window) and wait for explicit confirmation before calling. Writes ai_assistant_create_product_price to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['productId', 'costPriceUsdPerM2'],
      properties: {
        productId:           { type: 'string',  description: 'Product UUID.' },
        origin:              { type: 'string',  description: 'Origin country label (e.g. "China", "Malaysia"). At least one of origin or factoryId is required.' },
        factoryId:           { type: 'string',  description: 'Factory UUID. At least one of origin or factoryId is required.' },
        costPriceUsdPerM2:   { type: 'number',  description: 'Factory cost in USD per m². Required.' },
        sellingPriceUsdPerM2:{ type: 'number',  description: 'Buyer-facing price in USD per m². Omit to compute from cost * (1 + markupPercent).' },
        markupPercent:       { type: 'number',  description: 'Decimal 0..1 (0.07 = 7%). Used when sellingPriceUsdPerM2 is null.' },
        currency:            { type: 'string',  description: 'Default USD.' },
        tariffRate:          { type: 'number',  description: 'Decimal 0..1 (0.407714 = 40.7714%). Optional landed-cost snapshot.' },
        tariffDestination:   { type: 'string',  description: 'ISO2 destination for the tariff snapshot (e.g. "US").' },
        validFrom:           { type: 'string',  description: 'YYYY-MM-DD. Defaults to today.' },
        validTo:             { type: 'string',  description: 'YYYY-MM-DD. Null/omit = open-ended.' },
        sourceNote:          { type: 'string',  description: 'Provenance (e.g. "Per HanHua factory quotation 2026-05-14").' },
      },
    },
  },
  {
    name: 'list_product_prices',
    description: 'Phase 4.9.2c — List ProductPrice rows for a product. Filter by origin or includeExpired (default false). Use BEFORE create_product_price to confirm an active row doesn\'t already exist for the same (origin, validFrom).',
    inputSchema: {
      type: 'object',
      required: ['productId'],
      properties: {
        productId:       { type: 'string' },
        origin:          { type: 'string' },
        includeExpired:  { type: 'boolean', description: 'Default false. Pass true to also return rows with validTo past today.' },
      },
    },
  },
  {
    name: 'update_product_price',
    description: 'Phase 4.9.2c — Update a ProductPrice row (super-admin only). Pass id + any subset of editable fields. ALWAYS show the before/after diff first. Writes ai_assistant_update_product_price to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                  { type: 'string' },
        origin:              { type: ['string', 'null'] },
        factoryId:           { type: ['string', 'null'] },
        costPriceUsdPerM2:   { type: 'number' },
        sellingPriceUsdPerM2:{ type: ['number', 'null'] },
        markupPercent:       { type: ['number', 'null'] },
        currency:            { type: 'string' },
        tariffRate:          { type: ['number', 'null'] },
        tariffDestination:   { type: ['string', 'null'] },
        validFrom:           { type: 'string' },
        validTo:             { type: ['string', 'null'] },
        sourceNote:          { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'get_current_price',
    description: 'Phase 4.9.2c — Return the currently-effective ProductPrice row for a (productId, origin) as of asOfDate (defaults to today). Includes derived fields: sqft conversions, resolved sellingPriceUsdPerM2 (cost * (1 + markup) when null), landedPriceUsdPerM2 (selling * (1 + tariffRate)) when tariff is set. Lookup order: exact origin → open-price (origin=null) → any-row fallback for the product.',
    inputSchema: {
      type: 'object',
      required: ['productId'],
      properties: {
        productId: { type: 'string' },
        origin:    { type: 'string', description: 'Optional. Omit to return the open price (origin=null) if one exists.' },
        asOfDate:  { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      },
    },
  },
  {
    name: 'create_product_category',
    description: 'Phase 4.9.1 — Create a ProductCategory row (super-admin only). Use to add a new top-level category or sub-category. ALWAYS show Alex a preview (name, parent name, sortOrder, description) and wait for explicit confirmation before calling. Slug auto-derived from name when omitted. Refuses if (parentId, slug) collides with an existing non-archived row. Writes ai_assistant_create_taxonomy_category to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:        { type: 'string',          description: 'Category display name, e.g. "Engineered SPC".' },
        slug:        { type: 'string',          description: 'Optional kebab-case slug. Auto-derived from name when omitted.' },
        description: { type: 'string',          description: 'Optional short description shown in the catalog filter UI.' },
        parentId:    { type: ['string', 'null'], description: 'UUID of the parent category. Null/omit = top-level. Use list_product_categories to find a parent id.' },
        sortOrder:   { type: 'number',          description: 'Position among siblings under the same parent. Default 99 (sorts to the bottom).' },
        active:      { type: 'boolean',         description: 'Default true. Pass false to create as inactive (legacy soft-delete).' },
        icon:        { type: 'string',          description: 'Optional emoji or icon URL.' },
        image:       { type: 'string',          description: 'Optional image URL.' },
      },
    },
  },
  {
    name: 'update_product_category',
    description: 'Phase 4.9.1 — Update a ProductCategory row (super-admin only). Pass id + any subset of: name, slug, description, parentId, sortOrder, active. ALWAYS show the diff first. Re-parenting a category that has 5+ active products bound requires force:true after manual review (URL/report breakage risk). Writes ai_assistant_update_taxonomy_category.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:          { type: 'string',          description: 'ProductCategory UUID.' },
        name:        { type: 'string' },
        slug:        { type: 'string' },
        description: { type: 'string' },
        parentId:    { type: ['string', 'null'], description: 'New parent UUID. Null = move to top level. Pass force:true alongside if the row has 5+ active products bound.' },
        sortOrder:   { type: 'number' },
        active:      { type: 'boolean' },
        icon:        { type: 'string' },
        image:       { type: 'string' },
        force:       { type: 'boolean', description: 'Required when re-parenting a category with 5+ active products bound. Default false (refuse). Use only after the user has been warned about URL/report breakage.' },
      },
    },
  },
  {
    name: 'archive_product_category',
    description: 'Phase 4.9.1 — Soft-archive a ProductCategory (sets isArchived=true). Reversible via restore_product_category. HARD REFUSAL: blocked when any active products are still bound to this category — those must be re-categorised or archived first. Reason required (>= 10 chars). Writes ai_assistant_archive_taxonomy_category.',
    inputSchema: {
      type: 'object',
      required: ['id', 'reason'],
      properties: {
        id:     { type: 'string', description: 'ProductCategory UUID.' },
        reason: { type: 'string', description: 'Why this is being archived (>= 10 chars). Stored in the audit log.' },
      },
    },
  },
  {
    name: 'restore_product_category',
    description: 'Phase 4.9.1 — Reverse of archive_product_category. Sets isArchived=false. Reason required (>= 10 chars). Writes ai_assistant_restore_taxonomy_category.',
    inputSchema: {
      type: 'object',
      required: ['id', 'reason'],
      properties: {
        id:     { type: 'string', description: 'ProductCategory UUID.' },
        reason: { type: 'string', description: 'Why this is being restored (>= 10 chars). Stored in the audit log.' },
      },
    },
  },
  {
    name: 'list_products',
    description: 'Phase 4.9.3a — List products in the ERP product catalog. Filter by brandCode, productCategoryId, active, ironliteBadged, searchTerm. Combine filters as needed.',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm:        { type: 'string', description: 'Search by name or SKU (alias: search).' },
        search:            { type: 'string', description: 'Alias for searchTerm.' },
        brandCode:         { type: 'string', description: 'Restrict to a single brand (e.g. "FW" for HanHua/FlorWay/IronLite).' },
        productCategoryId: { type: 'string', description: 'ProductCategory UUID (alias: category_id).' },
        category_id:       { type: 'string' },
        factory_id:        { type: 'string', description: 'Factory UUID.' },
        active:            { type: 'boolean', description: 'true = only active products, false = only inactive. Omit for both.' },
        ironliteBadged:    { type: 'boolean', description: 'Filter by specifications.ironliteBadged. true = IronLite-branded only.' },
        limit:             { type: 'number', description: 'Max results (default 20, cap 50).' },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Phase 4.9.3a — Get a product with its currently-active ProductPrice rows attached at `_currentPrices`. Use this BEFORE quoting to confirm a floor exists.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID (aliases: productId, product_id).' },
      },
    },
  },
  {
    name: 'update_product',
    description: 'Phase 4.9.3a — Update a Product row (super_admin only). Pass id + any subset of editable fields. ALWAYS show the diff first. Spec-bag fields (constructionType, plankWidthInches, ironliteBadged, etc.) merge into product.specifications JSON. Writes ai_assistant_update_product to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                   { type: 'string' },
        name:                 { type: 'string' },
        sku:                  { type: 'string' },
        brandCode:            { type: 'string' },
        productCategoryId:    { type: 'string' },
        category_id:          { type: 'string' },
        factoryId:            { type: ['string', 'null'] },
        productType:          { type: 'string', description: 'Free-form label; coerced to the strict ENUM (lvt/spc/wpc/hardwood/laminate/tile/ceramic/other) with the raw label stored in specifications.productTypeLabel on miss.' },
        active:               { type: 'boolean' },
        unitOfMeasure:        { type: 'string', description: 'm2 / sqft / piece / set; mapped to model moqUnit ENUM.' },
        currency:             { type: 'string' },
        baseFobPrice:         { type: 'number' },
        description:          { type: 'string' },
        salesDescription:     { type: 'string' },
        // Spec-bag fields → specifications JSON
        constructionType:     { type: 'string' },
        fullBuildDescription: { type: 'string' },
        plankWidthInches:     { type: 'number' },
        plankLengthInches:    { type: 'number' },
        totalThicknessMm:     { type: 'number' },
        wearLayerMil:         { type: 'number' },
        piecesPerBox:         { type: 'number' },
        boxesPerPallet:       { type: 'number' },
        palletsPerContainer:  { type: 'number' },
        m2PerBox:             { type: 'number' },
        m2PerPallet:          { type: 'number' },
        m2PerContainer:       { type: 'number' },
        ironliteBadged:       { type: 'boolean' },
        defaultCommissionRate:{ type: 'number', description: 'Decimal 0..1.' },
        specs:                { type: 'object', description: 'Free-form merge into specifications JSON.' },
      },
    },
  },
  {
    name: 'archive_product',
    description: 'Phase 4.9.3a — Soft-archive a Product (sets isActive=false). Existing quotation lines that reference the product are unaffected; the product just disappears from the catalog picker. Writes ai_assistant_archive_product to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  },
  {
    name: 'create_product',
    description: 'Create a new product in the ERP catalog. Required: name + (brand_code OR brandCode) + (category_id OR category_name). All other fields optional. Phase 4.16.3 widened this tool so a single call can set every Product-row column the directive needs (brand, product_type, currency, base_fob_price, lead_time_days, origin_country, origin_variants, cubic_meters, weight, hs_code, certifications, specifications JSON). Pass `active: true` to launch a product live; the safer default is inactive (pending approval). Use `specs` for any free-form spec keys not in the typed `specifications` properties — anything passed there merges into the Product.specifications JSON column. To seed an initial ProductPrice row in the same call, pass `fob_price` + (origin OR factory_id/factory_name); the ProductPrice rows for multi-origin pricing should be created separately via create_product_price.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        // Identity + scope
        name:                 { type: 'string',  description: 'Product name (e.g. "IronLite Core 180mm x 1220mm x 6.5mm Engineered SPC")' },
        sku:                  { type: 'string',  description: 'SKU — auto-generated if omitted' },
        brand_code:           { type: 'string',  description: 'Brand code, e.g. "FW" or "SH". Required. Validated against active Brand. Alias: brandCode.' },
        brandCode:            { type: 'string',  description: 'Alias for brand_code.' },
        factory_id:           { type: 'string',  description: 'Factory UUID (use if known)' },
        factory_name:         { type: 'string',  description: 'Factory name to search (used if factory_id not known)' },
        category_id:          { type: 'string',  description: 'Category UUID (use if known)' },
        category_name:        { type: 'string',  description: 'Category name (e.g. "SPC Flooring", "Engineered SPC")' },
        // Descriptions
        description:          { type: 'string',  description: 'Internal product description' },
        sales_description:    { type: 'string',  description: 'Client-facing description for quotations and sales orders' },
        purchase_description: { type: 'string',  description: 'Supplier-facing description for purchase orders' },
        // Catalog filters / typed columns
        productType:          { type: 'string',  description: 'Product type. Strict enum: lvt | spc | wpc | hardwood | laminate | tile | ceramic | other. Free-form labels (e.g. "IronLite Core") land in specifications.productTypeLabel with productType=other.' },
        currency:             { type: 'string',  description: 'ISO-3 currency code. Default USD.' },
        unit:                 { type: 'string',  description: 'Unit: sqm, sqft, box, pallet, roll, piece, container. Default: sqm.' },
        min_order_qty:        { type: 'number',  description: 'Minimum order quantity' },
        weight:               { type: 'number',  description: 'Weight per unit (kg)' },
        cubic_meters:         { type: 'number',  description: 'Per-unit shipping volume (cbm). Phase 4.15c-1 column; drives container loading optimizer + packing lists.' },
        hs_code:              { type: 'string',  description: 'HS / HTS code for customs' },
        active:               { type: 'boolean', description: 'Set true to launch the product live. Default false (created pending approval; super_admin promotes via approve_product).' },
        // Pricing (top-level columns)
        base_fob_price:       { type: 'number',  description: 'Buyer-facing FOB price floor on the Product row (USD per unit). Independent of fob_price below — that one creates a ProductPrice row. Use base_fob_price when you want to populate the denormalized cache directly.' },
        // Multi-origin
        lead_time_days:       { type: 'integer', description: 'Production + shipping lead time in days (e.g. 30). Integer column. Use the string `lead_time` field below for free-form expressions like "30 days ex-stock".' },
        origin_country:       { type: 'string',  description: 'ISO-2 country code for the PRIMARY origin (e.g. "CN", "MY"). Multi-origin pricing goes in origin_variants OR via per-origin ProductPrice rows.' },
        origin_variants: {
          type: 'array',
          description: 'Per-origin pricing variants. Each entry: { origin (ISO-2 or country name), factoryId (UUID), fobPriceUsd (number, optional), priceUnit (sqm|sqft|box|...), moqOverride (number, optional), leadTimeOverride (number, optional) }. Raw JSON per L-023 — pass as a real array, do not stringify.',
          items: { type: 'object' },
        },
        // Certifications (typed list, replaces the legacy string field)
        certifications_list: {
          type: 'array',
          description: 'Array of certification objects { name, issuer, expiresAt } per the certifications JSON column. Alias: certificationsArray. Use this instead of the legacy `certifications` string when you have structured data.',
          items: { type: 'object' },
        },
        // Initial-price shortcut (creates a ProductPrice row in addition to the Product row)
        fob_price:            { type: 'number', description: 'Factory FOB price per unit (USD). Seeds an initial ProductPrice row with origin/factoryId scope. Use create_product_price for additional origins.' },
        margin:               { type: 'number', description: 'Margin % (passed as a percent like 5 = 5% or a decimal like 0.05). Applied: selling = FOB / (1 - margin/100).' },
        price_valid_until:    { type: 'string', description: 'Price validity date on the seeded ProductPrice row.' },
        origin:               { type: 'string', description: 'Origin for the seeded ProductPrice row (when factory_id not supplied). Typically a country name.' },
        // Logistics (legacy string aliases)
        departure_port:       { type: 'string', description: 'Port of loading. Stored in specifications.departurePort.' },
        lead_time:            { type: 'string', description: 'Free-form lead time string (use lead_time_days for the typed integer column).' },
        packing:              { type: 'string', description: 'Packing details (e.g. "2.23 sqm/box, 40 boxes/pallet").' },
        certifications:       { type: 'string', description: 'Legacy free-form certifications string. Prefer certifications_list above.' },
        // Specifications JSON
        specifications: {
          type: 'object',
          description: 'Typed product specs that land in the specifications JSON column. Use the typed properties below for known keys; use `specs` for everything else.',
          properties: {
            thickness:    { type: 'string', description: 'e.g. "4mm", "8mm"' },
            width:        { type: 'string', description: 'e.g. "182mm"' },
            length:       { type: 'string', description: 'e.g. "1220mm"' },
            material:     { type: 'string', description: 'e.g. "SPC", "LVT", "HDF"' },
            finish:       { type: 'string', description: 'e.g. "Embossed", "Registered Emboss"' },
            color:        { type: 'string', description: 'e.g. "Grey Oak", "Natural Walnut"' },
            wearLayer:    { type: 'string', description: 'e.g. "0.3mm", "0.5mm"' },
            acRating:     { type: 'string', description: 'e.g. "AC3", "AC4"' },
            clickSystem:  { type: 'string', description: 'e.g. "Unilin", "5G"' },
            construction: { type: 'string', description: 'e.g. "4-layer", "IXPE underlay included"' },
            grade:        { type: 'string', description: 'Product grade if specified' },
            species:      { type: 'string', description: 'Wood species (for engineered/solid wood)' },
          },
        },
        specs: {
          type: 'object',
          description: 'Free-form spec object. Merged into the Product.specifications JSON column verbatim. Use for any keys not in the typed `specifications` properties above — e.g. plankWidthMm, plankLengthMm, totalThicknessMm, ironliteCoreLayerThicknessMm, ixpeUnderlayThicknessMm, m2PerBox, m2PerPallet, m2PerContainer, piecesPerBox, boxesPerPallet, palletsPerContainer, ironliteBadged, constructionType, defaultCommissionRate, plankWidthInches, plankLengthInches, totalThicknessMm, wearLayerMil. All values pass through untyped; the AI is responsible for using consistent key names across products.',
        },
      },
    },
  },
  {
    name: 'approve_product',
    description: 'Approve a product that was created by the AI assistant. Sets the product and its prices to active so they can be used in quotations. Always call this only after Alex has explicitly confirmed approval.',
    inputSchema: {
      type: 'object',
      required: ['product_id'],
      properties: {
        product_id: { type: 'string', description: 'Product ID to approve' },
        note:       { type: 'string', description: 'Optional approval note' },
      },
    },
  },
  {
    name: 'list_pending_approvals',
    description: 'List all pending approval tasks assigned to Alex. Use this proactively at the start of a session or when Alex asks what needs his attention.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'log_activity',
    description: 'Log a call, meeting note, email, or task against a lead or contact.',
    inputSchema: {
      type: 'object',
      required: ['subject'],
      properties: {
        subject:    { type: 'string', description: 'Activity title' },
        notes:      { type: 'string', description: 'Detailed notes' },
        type:       { type: 'string', description: 'Type: note, call, meeting, email, task (default: note)' },
        lead_id:    { type: 'string', description: 'Lead ID to attach to' },
        contact_id: { type: 'string', description: 'Contact ID to attach to' },
        due_date:   { type: 'string', description: 'Due date for tasks (ISO format)' },
      },
    },
  },
  {
    name: 'list_customers',
    description: 'List existing Sovern House customers (the buyer side of the trade — companies we sell to). Use for the /clients lookup slash command and any ad-hoc search across the customer book. For sourcing NEW prospective buyers, do NOT use this — point Alex at /new-clients which kicks off a background research run.',
    inputSchema: {
      type: 'object',
      properties: {
        search:  { type: 'string', description: 'Free-text search across company name, country, city, email' },
        country: { type: 'string', description: 'Filter by country (exact match)' },
        limit:   { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'create_customer',
    description: 'Phase 4.9.3a — Create a Customer row (super_admin only). Required: brandCode (must match active Brand) and companyName (unique within that brand). Optional structured extras (industry, yearFounded, website, source, primaryAddress object, additionalAddresses array) land in Customer.metadata JSON. ALWAYS show Alex a preview (companyName, brandCode, country, source) and wait for explicit confirmation before calling. Writes ai_assistant_create_customer to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['brandCode', 'companyName'],
      properties: {
        brandCode:           { type: 'string', description: 'Brand context (e.g. "FW" for HanHua/FlorWay/IronLite, "SH" for Sovern House).' },
        companyName:         { type: 'string' },
        legalName:           { type: 'string', description: 'Defaults to companyName when omitted.' },
        industry:            { type: 'string' },
        yearFounded:         { type: 'number' },
        website:             { type: 'string' },
        contactPerson:       { type: 'string' },
        email:               { type: 'string', description: 'Required by the underlying model. Defaults to "unknown@unknown.local" if omitted; ask Alex to fix later.' },
        phone:               { type: 'string', description: 'Required by the underlying model. Defaults to "unknown" if omitted.' },
        primaryAddress:      {
          type: 'object',
          properties: {
            line1: { type: 'string' }, line2: { type: 'string' },
            city:  { type: 'string' }, state: { type: 'string' },
            postalCode: { type: 'string' }, country: { type: 'string' },
          },
          description: 'Flattened into the model\'s address/city/country columns; full object preserved in metadata.primaryAddress.',
        },
        additionalAddresses: { type: 'array', items: { type: 'object' }, description: 'Array of address objects with optional label/phone. Stored as metadata.additionalAddresses.' },
        productBrandingMode: { type: 'string', enum: ['ironlite', 'generic', 'private_label'], description: 'FW-specific; how the buyer wants the product branded on PDFs.' },
        source:              { type: 'string', description: 'How we got this buyer (e.g. "WeChat introduction", "Trade show — Domotex", "Inbound RFQ").' },
        notes:               { type: 'string' },
        currency:            { type: 'string', description: 'Default USD.' },
        paymentTerms:        { type: 'string', description: 'Default "Net 30".' },
        active:              { type: 'boolean', description: 'Default true.' },
      },
    },
  },
  {
    name: 'update_customer',
    description: 'Phase 4.9.3a — Update a Customer row (super_admin only). Pass id + any subset of editable fields. brandCode merges into the JSON brandRelationships array. Metadata fields shallow-merge. Address can be passed as a primaryAddress object or flat address/city/country. ALWAYS show the diff first.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                   { type: 'string' },
        companyName:          { type: 'string' },
        legalName:            { type: 'string' },
        industry:             { type: 'string' },
        yearFounded:          { type: 'number' },
        website:              { type: 'string' },
        source:               { type: 'string' },
        brandCode:            { type: 'string', description: 'Appended to brandRelationships if not already present.' },
        contactPerson:        { type: 'string' },
        email:                { type: 'string' },
        phone:                { type: 'string' },
        primaryAddress:       { type: 'object' },
        additionalAddresses:  { type: 'array', items: { type: 'object' } },
        address:              { type: 'string' },
        city:                 { type: 'string' },
        country:              { type: 'string' },
        currency:             { type: 'string' },
        paymentTerms:         { type: 'string' },
        productBrandingMode:  { type: 'string', enum: ['ironlite', 'generic', 'private_label'] },
        notes:                { type: 'string' },
        active:               { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_customer',
    description: 'Phase 4.9.3a — Return the full Customer record decorated with `_counts.contacts` + `_counts.leads`.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  },
  {
    name: 'archive_customer',
    description: 'Phase 4.9.3a — Soft-archive a Customer (sets isActive=false). Open leads against the customer are NOT auto-closed; the response includes a warning when any exist. Writes ai_assistant_archive_customer to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  },
  {
    name: 'read_attachment',
    description: 'Read a file the user attached to the chat (📎 button on mobile or web) OR any other Drive file by ID. Supports: images (returned as MCP vision content so you SEE them — receipts, business cards, screenshots, signs, photos of paperwork), PDFs (text extracted via pdf-parse, up to 16KB), Word .docx (text via mammoth), Excel .xlsx and .xls (per-sheet rows in tab-separated format via exceljs), Google Docs and Sheets (exported via Drive API), and plain text/CSV/TSV. Legacy .doc Word files are NOT supported — ask the user to re-save as .docx. Always call this when the user attaches files; never ask them to paste content you can fetch yourself.',
    inputSchema: {
      type: 'object',
      required: ['file_id'],
      properties: {
        file_id: { type: 'string', description: 'Drive file ID (provided in the user prompt under "## Attached files", or any Drive ID the user references)' },
      },
    },
  },
  {
    name: 'append_lesson',
    description: 'Append a new entry to skills/lessons.md, the hard-won corrections log future sessions read at startup. Use this when Alex points out a mistake worth recording, or when a non-trivial task surfaces a surprising rule. Computes the next L-NNN automatically, inserts the entry under the chosen section, commits with a "Sovern AI" git identity, and pushes to origin/main so the lesson survives the next VM deploy. Sections: "process" (workflow / commit / verification rules), "trade" (Incoterms, sanctions, tariffs, compliance, outreach copy lessons), "technical" (default — website, ERP backend, frontend, mobile, OTA, deployment). This is a sanctioned exception to the "never push from the VM" rule, enabled by Alex specifically for lessons.',
    inputSchema: {
      type: 'object',
      required: ['title', 'root_cause', 'fix', 'rule'],
      properties: {
        title:      { type: 'string', description: 'Imperative short title for the lesson, used after "L-NNN — ". Example: "Never push from the Linux VM".' },
        summary:    { type: 'string', description: 'Optional one-paragraph intro describing the incident or context. Skip for short / well-titled lessons.' },
        root_cause: { type: 'string', description: 'What actually went wrong, traced to source. Include file:line or specific commit when relevant.' },
        fix:        { type: 'string', description: 'What was done to resolve the immediate occurrence.' },
        rule:       { type: 'string', description: 'The going-forward rule. This is the bit future-AI reads at session start, so phrase it as an actionable directive.' },
        section:    { type: 'string', enum: ['process', 'trade', 'technical'], description: 'Which section to append under. Defaults to "technical".' },
      },
    },
  },

  // ── Phase 4.5, C19 v2 — WRITE + ACTION capabilities ─────────────────────────
  // The model MUST always show a preview/diff and wait for explicit
  // confirmation before invoking any of these. Hard refusals on:
  //   - delete operations (none exposed here)
  //   - payment / billing field edits
  //   - sanctions screening status / details (Customer.screeningStatus etc.)
  //   - AuditLog modifications
  //   - user role / permissions / brand-access edits (use admin UI)
  // Super-admin gate is server-side; the prompt-level guard is defense in
  // depth.
  {
    name: 'list_brands',
    description: 'Phase 4.9 — List all brands in the Brand table. Use this BEFORE create_product or any tool that references a brandCode to confirm the brand exists. Returns code, displayName, senderEmail, primaryColor, accentColor, active, commissionRate. Read-only; safe to call without confirmation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_brand',
    description: 'Phase 4.9 — Create a new Brand row (super-admin only). Use when a brand referenced by a product or quotation does not yet exist (e.g. "HH" for HanHua, "IL" for IronLite). ALWAYS show Alex a preview of the proposed brand (code, displayName, senderEmail, colors, commission rate) and wait for explicit confirmation ("yes, create" / "go ahead") before calling. Writes ai_assistant_create_brand to AuditLog. Validates: code 2-8 uppercase letters, displayName non-empty, senderEmail valid, both colors 6-digit hex. commissionRate default 0.05 (5%).',
    inputSchema: {
      type: 'object',
      required: ['code', 'displayName', 'senderEmail', 'primaryColor', 'accentColor'],
      properties: {
        code:            { type: 'string', description: 'Brand code: 2-8 uppercase letters, used as the FK in Product/Quotation/etc. Examples: "HH" (HanHua), "IL" (IronLite), "FW" (FlorWay).' },
        displayName:     { type: 'string', description: 'Public-facing brand name (e.g. "HanHua").' },
        senderEmail:     { type: 'string', description: 'Outbound email sender for this brand (e.g. "ops@hanhua.example"). Must be a valid email.' },
        primaryColor:    { type: 'string', description: 'Primary brand color as 6-digit hex (e.g. "#1D5A32").' },
        accentColor:     { type: 'string', description: 'Accent color as 6-digit hex (e.g. "#C8A464").' },
        commissionRate:  { type: 'number', description: 'Decimal 0..1. Default 0.05 (5%). For SH (Alex\'s own business) use 0.' },
        signatureHtml:   { type: 'string', description: 'Optional email signature HTML. Can be added later via update_brand.' },
        signatureText:   { type: 'string', description: 'Optional plain-text signature fallback.' },
        footerLegalText: { type: 'string', description: 'Optional footer legal line for PDFs and emails.' },
        logoUrl:         { type: 'string', description: 'Optional logo URL.' },
      },
    },
  },
  {
    name: 'update_brand',
    description: 'Phase 4.5 / 4.9.1 — Update Brand fields (super-admin only). Use to refresh signature, change brand colors, edit footer legal text, deactivate a brand row that was created in error (active:false), or adjust commission per agreement (commissionRate, decimal 0..1). ALWAYS show Alex a preview/diff and wait for explicit confirmation ("yes, save" / "go ahead") before calling. Writes ai_assistant_update_brand to AuditLog. Allowed fields: displayName, signatureHtml, signatureText, primaryColor, accentColor, footerLegalText, logoUrl, active, commissionRate. Anything else is silently dropped.',
    inputSchema: {
      type: 'object',
      required: ['code'],
      properties: {
        code:            { type: 'string',  description: 'Brand code: "SH", "FW", or other.' },
        displayName:     { type: 'string',  description: 'Public-facing brand name.' },
        signatureHtml:   { type: 'string',  description: 'Full HTML for the email signature block. Inline styles only (no <style> tags) for email-client compatibility.' },
        signatureText:   { type: 'string',  description: 'Plain-text fallback for clients that strip HTML.' },
        primaryColor:    { type: 'string',  description: 'Primary brand color as hex (e.g. #1D5A32).' },
        accentColor:     { type: 'string',  description: 'Accent color as hex.' },
        footerLegalText: { type: 'string',  description: 'Footer legal / disclaimer line shown on PDFs and emails.' },
        logoUrl:         { type: 'string',  description: 'CDN URL for the brand logo PNG/SVG.' },
        active:          { type: 'boolean', description: 'Phase 4.9.1: deactivate an erroneous brand row with false (hides it from quotation/product pickers without deleting historical data).' },
        commissionRate:  { type: 'number',  description: 'Phase 4.9.1: brand-level commission rate as a decimal between 0 and 1 (e.g. 0.07 = 7%). Used by the commission accrual flow on sales-order confirmation.' },
      },
    },
  },
  {
    name: 'update_email_template',
    description: 'Phase 4.5, C19 — Update an EmailTemplate row (super-admin only). Use to edit subject lines, body copy, brand assignment, or category. ALWAYS show the diff and wait for confirmation. Allowed fields: name, subject, bodyText, category, brandCode. Writes ai_assistant_update_email_template to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:        { type: 'string', description: 'EmailTemplate UUID.' },
        name:      { type: 'string', description: 'Template name shown in the picker.' },
        subject:   { type: 'string', description: 'Subject line. Supports {{firstName}} / {{companyName}} placeholders.' },
        bodyText: { type: 'string', description: 'Plain-text body. Supports the same placeholders.' },
        category:  { type: 'string', description: 'Category tag (e.g. "outreach", "follow-up", "quotation").' },
        brandCode: { type: 'string', description: 'Brand assignment: "SH", "FW", or null for both.' },
      },
    },
  },
  {
    name: 'update_user_profile_self',
    description: 'Phase 4.5, C19 — Update YOUR OWN User profile fields. Self-only — cannot edit other users. Allowed: firstName, lastName, phone, avatar, preferences. NOT editable here: role, email, password, brand access (those go through the admin UI with stronger auth). Writes ai_assistant_update_user_profile_self to AuditLog.',
    inputSchema: {
      type: 'object',
      properties: {
        firstName:   { type: 'string', description: 'First / given name.' },
        lastName:    { type: 'string', description: 'Last / family name.' },
        phone:       { type: 'string', description: 'Phone number with country code, e.g. "+886 970 781 818".' },
        avatar:      { type: 'string', description: 'Avatar image URL.' },
        preferences: { type: 'object', description: 'JSON preferences blob (theme, language, notifications).' },
      },
    },
  },
  {
    name: 'update_dashboard_layout',
    description: 'Phase 4.5, C19 — Save or update the calling user\'s default dashboard layout. Layout is a JSON array of widget configs. Use when Alex says things like "hide the orders widget" or "put the commission widget at the top". Writes ai_assistant_update_dashboard_layout to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['layout'],
      properties: {
        layout: { type: 'array', description: 'Array of widget config objects: { id, size, position, hidden? }. Whole array replaces the saved layout.' },
        name:   { type: 'string', description: 'Optional layout name (defaults to "AI-configured").' },
      },
    },
  },
  {
    name: 'create_scheduled_task',
    description: 'Phase 4.5, C19 — Create a ScheduledActivity row (reminder, follow-up, todo). Use when Alex says "remind me to follow up with Acme on Tuesday at 10am" or "schedule a task to call Mr. Lee next week". Always echo the resolved Taipei-time date back to Alex for confirmation. Writes ai_assistant_create_scheduled_task to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['entity_type', 'entity_id', 'due_date'],
      properties: {
        entity_type:     { type: 'string', description: 'Entity the task is about: "Lead", "Customer", "Factory", "Quotation", "SalesOrder", or "general" for free-form tasks.' },
        entity_id:       { type: 'string', description: 'UUID of the entity, or a short slug like "general" if entity_type=general.' },
        entity_label:    { type: 'string', description: 'Human-readable label shown on the task card.' },
        due_date:        { type: 'string', description: 'ISO date or datetime in Taipei time (e.g. "2026-05-21" or "2026-05-21T10:00:00+08:00").' },
        note:            { type: 'string', description: 'Task body / instructions.' },
        priority:        { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Default: normal.' },
        type:            { type: 'string', description: 'Task type: follow_up, call, email, meeting, review, etc. Default: follow_up.' },
        assigned_to_id:  { type: 'string', description: 'User UUID to assign to. Defaults to the caller.' },
      },
    },
  },
  {
    name: 'mark_item_complete',
    description: 'Phase 4.5, C19 — Mark a ScheduledActivity as completed. Caller must be the assignee OR a super-admin. Writes ai_assistant_mark_item_complete to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['scheduled_activity_id'],
      properties: {
        scheduled_activity_id: { type: 'string', description: 'ScheduledActivity UUID.' },
        completed_note:        { type: 'string', description: 'Optional note recording what was done / the outcome.' },
      },
    },
  },
  {
    name: 'archive_item',
    description: 'Phase 4.5, C19 — Archive a TriageItem or Activity row (super-admin only). Does NOT delete; the row stays in the DB with archived status. Use sparingly — most items should be left in their natural workflow. Writes ai_assistant_archive_item to AuditLog.',
    inputSchema: {
      type: 'object',
      required: ['entity', 'id'],
      properties: {
        entity: { type: 'string', enum: ['TriageItem', 'Activity'], description: 'Which model to archive.' },
        id:     { type: 'string', description: 'Row UUID.' },
      },
    },
  },
];

// ── Startup ───────────────────────────────────────────────────────────────────
// DB is lazy-loaded on first tool call — do not require('../models') here.
process.stderr.write('[erp-mcp] Server listening on stdin\n');

// Phase 4.11: test-only opt-in. When MCP_FORCE_SYNC=true, eagerly
// load + sync models so PRAGMA-backed tools (erp_describe_entity_db)
// have tables to introspect. Production NEVER sets this — model
// loading stays lazy there so the MCP initialize handshake doesn't
// pay the ~4s cost of loading 100+ models on every claude -p start.
if (process.env.MCP_FORCE_SYNC === 'true') {
  // Phase 4.11: assign the sync promise to global.__MCP_READY so the
  // tools/call branch in handleLine can await it before dispatching.
  // Otherwise the harness races startup and PRAGMA returns empty.
  global.__MCP_READY = (async () => {
    try {
      const db = getDb();
      await db.sequelize.sync({ force: false });
      process.stderr.write('[erp-mcp] MCP_FORCE_SYNC=true: model registry + tables synced\n');
    } catch (err) {
      process.stderr.write(`[erp-mcp] MCP_FORCE_SYNC sync failed: ${err.message}\n`);
    }
  })();
}
