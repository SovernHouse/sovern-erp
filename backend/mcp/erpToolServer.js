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

const { google } = require('googleapis');

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

// ── Google auth helper ────────────────────────────────────────────────────────

async function getGoogleAuth() {
  if (!USER_ID) throw new Error('ERP_USER_ID not set — cannot access Google services');
  const account = await getDb().ConnectedGoogleAccount.findOne({
    where: { connectedByUserId: USER_ID, isActive: true },
  });
  if (!account) {
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
      const cal = google.calendar({ version: 'v3', auth });
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
      const cal = google.calendar({ version: 'v3', auth });

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
      const cal = google.calendar({ version: 'v3', auth });
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
      const gmail = google.gmail({ version: 'v1', auth });

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
      const gmail = google.gmail({ version: 'v1', auth });

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
      const { auth, account } = await getGoogleAuth();
      const gmail = google.gmail({ version: 'v1', auth });

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
      const lead = await getDb().Lead.findByPk(args.id);
      if (!lead) return `Lead ${args.id} not found.`;
      const allowed = ['status', 'stage', 'notes', 'productInterest',
        'estimatedValue', 'priority', 'nextFollowUp'];
      const updates = Object.fromEntries(
        Object.entries(args).filter(([k]) => allowed.includes(k))
      );
      await lead.update(updates);
      return { success: true, updated: Object.keys(updates), lead: lead.toJSON() };
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
      // Email and phone are required by the model, but if Alex hasn't given
      // them yet (e.g. backfilling factories from contact data), accept
      // placeholder values and let him fix the records later.
      const factory = await getDb().Factory.create({
        companyName:    args.company_name,
        contactPerson:  args.contact_person || null,
        email:          args.email || 'unknown@unknown.local',
        phone:          args.phone || 'unknown',
        address:        args.address  || null,
        city:           args.city     || null,
        country:        args.country  || null,
        currency:       args.currency       || 'USD',
        paymentTerms:   args.payment_terms  || 'Net 60',
        leadTimeDays:   args.lead_time_days || 30,
        rating:         args.rating         || 5.0,
        certifications: args.certifications  || [],
        specializations:args.specializations || [],
        notes:          args.notes    || null,
      });
      return {
        success: true,
        factoryId: factory.id,
        companyName: factory.companyName,
        message: `Factory "${factory.companyName}" created. Edit at /factories/${factory.id}.`,
      };
    }

    case 'update_factory': {
      const factory = await getDb().Factory.findByPk(args.id);
      if (!factory) return `Factory ${args.id} not found.`;
      const allowed = ['companyName', 'contactPerson', 'email', 'phone',
        'address', 'city', 'country', 'currency', 'paymentTerms',
        'leadTimeDays', 'rating', 'certifications', 'specializations', 'notes'];
      // Map snake_case input to camelCase fields where applicable
      const aliasMap = {
        company_name: 'companyName',
        contact_person: 'contactPerson',
        payment_terms: 'paymentTerms',
        lead_time_days: 'leadTimeDays',
      };
      const updates = {};
      for (const [k, v] of Object.entries(args)) {
        if (k === 'id') continue;
        const field = aliasMap[k] || k;
        if (allowed.includes(field)) updates[field] = v;
      }
      await factory.update(updates);
      return { success: true, updated: Object.keys(updates), factory: factory.toJSON() };
    }

    case 'create_contact': {
      if (!args.first_name && !args.last_name) {
        return 'first_name or last_name is required.';
      }
      if (!args.email) return 'email is required.';
      if (!args.factory_id && !args.customer_id) {
        return 'Either factory_id (supplier-side) or customer_id (buyer-side) is required.';
      }
      const contact = await getDb().Contact.create({
        firstName:   args.first_name   || '',
        lastName:    args.last_name    || '',
        email:       args.email,
        phone:       args.phone        || null,
        mobile:      args.mobile       || null,
        jobTitle:    args.job_title    || null,
        department:  args.department   || null,
        customerId:  args.customer_id  || null,
        factoryId:   args.factory_id   || null,
        isPrimary:   args.is_primary === true,
        website:     args.website      || null,
        linkedinUrl: args.linkedin_url || null,
        notes:       args.notes        || null,
        isActive:    args.is_active !== false,
      });
      return {
        success: true,
        contactId: contact.id,
        message: `Contact "${contact.firstName} ${contact.lastName}" created.`,
        contact: contact.toJSON(),
      };
    }

    case 'delete_contact': {
      const contact = await getDb().Contact.findByPk(args.id);
      if (!contact) return `Contact ${args.id} not found.`;
      const name = `${contact.firstName} ${contact.lastName}`.trim();
      await contact.destroy();
      return { success: true, deletedContactId: args.id, name };
    }

    case 'delete_factory': {
      const factory = await getDb().Factory.findByPk(args.id);
      if (!factory) return `Factory ${args.id} not found.`;
      // Block delete if there are open POs — same rule as the REST endpoint.
      const openPOs = await getDb().PurchaseOrder.count({
        where: {
          factoryId: args.id,
          status: { [require('sequelize').Op.notIn]: ['completed', 'cancelled'] },
        },
      }).catch(() => 0);
      if (openPOs > 0) {
        return `Cannot delete: factory has ${openPOs} open purchase order(s). Close or cancel them first.`;
      }
      const name = factory.companyName;
      await factory.destroy();
      return { success: true, deletedFactoryId: args.id, name };
    }

    case 'update_contact': {
      const contact = await getDb().Contact.findByPk(args.id);
      if (!contact) return `Contact ${args.id} not found.`;
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
      await contact.update(updates);
      return { success: true, updated: Object.keys(updates), contact: contact.toJSON() };
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

    // ── Activities / notes ──────────────────────────────────────────────────

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
      // Light email format guard — Sequelize's isEmail validator catches the
      // rest server-side.
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
      const lead = await getDb().Lead.create({
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
        assignedToId: USER_ID || null,
      });
      return { success: true, lead: lead.toJSON() };
    }

    case 'send_outreach_email': {
      const { lead_id, subject, body_text } = args;
      if (!lead_id || !subject || !body_text) {
        return 'Missing required fields. Need: lead_id, subject, body_text.';
      }
      const lead = await getDb().Lead.findByPk(lead_id);
      if (!lead) return `Lead ${lead_id} not found.`;

      const { sendOutreachEmail } = require('../services/emailService');
      const fromAddress = process.env.SMTP_USER;

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

      let smtpResult = null;
      let sendError = null;
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

      // Always create the OutreachEmail row, even on send failure, so we have
      // an audit trail and can retry.
      const touchNumber = args.touch_number || 1;
      const followUpDays = args.follow_up_days || (touchNumber === 1 ? 3 : touchNumber === 2 ? 5 : 7);
      const followUpDueAt = new Date(Date.now() + followUpDays * 86400000);

      const row = await getDb().OutreachEmail.create({
        leadId: lead.id,
        sentByUserId: USER_ID || null,
        fromAddress,
        toAddress: lead.email,
        toName: lead.contactName,
        subject,
        bodyText: body_text,
        touchNumber,
        status: sendError ? 'failed' : 'sent',
        sentAt: sendError ? null : new Date(),
        smtpMessageId: smtpResult?.messageId || null,
        followUpDueAt,
        errorMessage: sendError || null,
      });

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
      const { outreach_email_id, lead_id, follow_up_at, note } = args;
      if (!follow_up_at) return 'Missing follow_up_at (ISO date string).';
      const date = new Date(follow_up_at);
      if (isNaN(date.getTime())) return `Invalid follow_up_at: ${follow_up_at}`;

      if (outreach_email_id) {
        const oe = await getDb().OutreachEmail.findByPk(outreach_email_id);
        if (!oe) return `Outreach email ${outreach_email_id} not found.`;
        await oe.update({ followUpDueAt: date, followUpNote: note || oe.followUpNote, followUpCompleted: false });
        return { success: true, scope: 'outreach_email', id: oe.id, followUpDueAt: date.toISOString() };
      }
      if (lead_id) {
        const lead = await getDb().Lead.findByPk(lead_id);
        if (!lead) return `Lead ${lead_id} not found.`;
        await lead.update({ expectedCloseDate: lead.expectedCloseDate || date });
        // Also log an Activity row for visibility on the lead detail page.
        if (getDb().Activity) {
          await getDb().Activity.create({
            type: 'follow_up',
            subject: 'Follow-up scheduled',
            description: note || `Follow-up scheduled for ${date.toISOString().slice(0, 10)}`,
            scheduledAt: date,
            leadId: lead.id,
            userId: USER_ID || null,
            isCompleted: false,
            priority: 'medium',
          });
        }
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
      const { Op } = require('sequelize');
      const { product_description, vertical, country, hs_code,
              required_certifications = [], min_quantity, target_lead_time_days } = args;

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
      // Creates a draft Quotation with items. Resolves lead→customer:
      //   - If customer_id passed: use it directly.
      //   - If lead_id passed and lead.convertedCustomerId set: use that.
      //   - If lead_id passed without conversion: auto-create a Customer
      //     from the lead's data, link via convertedCustomerId, proceed.
      // Generates quotationNumber via incrementCounter (matches the
      // existing /api/quotations create flow). Sets status='draft'.

      const { customer_id, lead_id, items, currency, valid_days, terms,
              factory_id, discount, discount_type, tax_rate, payment_terms } = args;

      if (!Array.isArray(items) || items.length === 0) {
        return 'Missing items array. Each item needs: product_id, quantity, unit_price.';
      }
      for (const it of items) {
        if (!it.product_id || it.quantity === undefined || it.unit_price === undefined) {
          return 'Each item must have product_id, quantity, unit_price.';
        }
      }

      // Resolve customer
      let resolvedCustomerId = customer_id;
      let resolvedLeadId = lead_id || null;
      let lead = null;
      if (lead_id) {
        lead = await getDb().Lead.findByPk(lead_id);
        if (!lead) return `Lead ${lead_id} not found.`;
        if (lead.convertedCustomerId) {
          resolvedCustomerId = lead.convertedCustomerId;
        } else if (!resolvedCustomerId) {
          // Auto-convert: create a Customer from the lead's data
          const newCustomer = await getDb().Customer.create({
            companyName: lead.companyName,
            contactPerson: lead.contactName,
            email: lead.email,
            phone: lead.phone || '',  // Customer.phone is allowNull: false
            country: lead.country || null,
            city: lead.city || null,
            currency: lead.currency || currency || 'USD',
            paymentTerms: payment_terms || 'Net 30',
          });
          resolvedCustomerId = newCustomer.id;
          // Mark the lead as converted (status=won, convertedCustomerId set)
          await lead.update({ convertedCustomerId: newCustomer.id, status: 'won', wonDate: new Date() });
        }
      }
      if (!resolvedCustomerId) {
        return 'Need either customer_id, or lead_id (will auto-convert lead to customer).';
      }

      // Generate quotationNumber via the existing helper
      const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');
      const lastQuotation = await getDb().Quotation.findOne({ order: [['createdAt', 'DESC']] });
      const counter = incrementCounter(lastQuotation?.quotationNumber);
      const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

      // Compute totals
      let subtotal = 0;
      const itemRows = [];
      for (const it of items) {
        const product = await getDb().Product.findByPk(it.product_id);
        const lineTotal = parseFloat(it.quantity) * parseFloat(it.unit_price);
        subtotal += lineTotal;
        itemRows.push({
          productId: it.product_id,
          description: it.description || (product ? product.name : null),
          quantity: parseFloat(it.quantity),
          unit: it.unit || (product ? product.unit : null),
          unitPrice: parseFloat(it.unit_price),
          discount: parseFloat(it.discount || 0),
          total: lineTotal,
          notes: it.notes || '',
        });
      }
      const discAmt = (discount_type === 'percentage')
        ? (subtotal * parseFloat(discount || 0)) / 100
        : parseFloat(discount || 0);
      const afterDisc = subtotal - discAmt;
      const taxAmt = (afterDisc * parseFloat(tax_rate || 0)) / 100;
      const total = afterDisc + taxAmt;

      const validUntil = new Date(Date.now() + (parseInt(valid_days || 30, 10)) * 86400000);

      // Create the quotation
      const quotation = await getDb().Quotation.create({
        quotationNumber,
        customerId: resolvedCustomerId,
        leadId: resolvedLeadId || null,
        factoryId: factory_id || null,
        salesPersonId: USER_ID || null,
        status: 'draft',
        subtotal,
        discount: parseFloat(discount || 0),
        discountType: discount_type || 'fixed',
        tax: taxAmt,
        taxRate: parseFloat(tax_rate || 0),
        total,
        currency: currency || 'USD',
        validUntil,
        terms: terms || null,
      });

      // Create the items
      for (const row of itemRows) {
        await getDb().QuotationItem.create({ ...row, quotationId: quotation.id });
      }

      // Reload with items for the return shape
      const full = await getDb().Quotation.findByPk(quotation.id, {
        include: [{ model: getDb().QuotationItem, as: 'items' }],
      });

      return {
        success: true,
        quotation: full.toJSON(),
        message: `Created ${quotation.status} quotation ${quotation.quotationNumber} with ${itemRows.length} item(s). Total: ${currency || 'USD'} ${total.toFixed(2)}.${lead && !customer_id ? ' (Auto-converted lead to customer.)' : ''}`,
      };
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
      const { auth } = await getGoogleAuth();
      const drive = google.drive({ version: 'v3', auth });

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
      return files.length ? files : 'No Drive files found matching that query.';
    }

    case 'read_drive_file': {
      const { auth } = await getGoogleAuth();
      const drive = google.drive({ version: 'v3', auth });

      // Get file metadata to determine type
      const meta = await drive.files.get({
        fileId: args.file_id,
        fields: 'id, name, mimeType',
      });
      const { mimeType, name } = meta.data;

      let text = '';

      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Doc → export as plain text
        const resp = await drive.files.export(
          { fileId: args.file_id, mimeType: 'text/plain' },
          { responseType: 'arraybuffer' }
        );
        text = Buffer.from(resp.data).toString('utf8').slice(0, 8000);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheet → export as CSV
        const resp = await drive.files.export(
          { fileId: args.file_id, mimeType: 'text/csv' },
          { responseType: 'arraybuffer' }
        );
        text = Buffer.from(resp.data).toString('utf8').slice(0, 8000);
      } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
        const resp = await drive.files.get(
          { fileId: args.file_id, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        text = Buffer.from(resp.data).toString('utf8').slice(0, 8000);
      } else if (mimeType === 'application/pdf') {
        return { name, mimeType, note: 'PDF content cannot be extracted via Drive API. Ask Alex to share the text or copy key details.' };
      } else {
        return { name, mimeType, note: `File type ${mimeType} is not supported for text extraction.` };
      }

      return { name, mimeType, content: text };
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
      const drive = google.drive({ version: 'v3', auth });

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

      // PDF → pdf-parse text
      if (mimeType === 'application/pdf') {
        try {
          // pdf-parse loads test PDFs at top-level when imported as `pdf-parse`.
          // Use the inner module path to skip that auto-execute and avoid a
          // boot-time crash if the test fixtures aren't bundled.
          const pdfParse = require('pdf-parse/lib/pdf-parse.js');
          const buf = await downloadBytes();
          const parsed = await pdfParse(buf);
          const text = (parsed.text || '').trim();
          return {
            name, mimeType,
            pageCount: parsed.numpages || null,
            content: text.length > TEXT_CAP
              ? text.slice(0, TEXT_CAP) + `\n\n... (truncated; full file ${parsed.numpages || '?'} pages, view at ${webViewLink || '(no link)'})`
              : text,
          };
        } catch (e) {
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
      const cats = await getDb().ProductCategory.findAll({
        where: { isActive: true },
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
        attributes: ['id', 'name', 'slug', 'description', 'parentId'],
      });
      return cats.length ? cats.map(c => c.toJSON()) : 'No product categories found.';
    }

    case 'list_products': {
      const { Op } = require('sequelize');
      const where = { deletedAt: null };
      if (args.search) {
        where[Op.or] = [
          { name:  { [Op.like]: `%${args.search}%` } },
          { sku:   { [Op.like]: `%${args.search}%` } },
        ];
      }
      if (args.category_id) where.categoryId = args.category_id;
      if (args.factory_id)  where.factoryId  = args.factory_id;

      const products = await getDb().Product.findAll({
        where,
        limit: Math.min(args.limit || 20, 50),
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'name', 'sku', 'description', 'unit', 'specifications',
          'minOrderQty', 'hsCode', 'isActive', 'categoryId', 'factoryId'],
        include: [
          { model: getDb().ProductCategory, as: 'category', attributes: ['id', 'name'] },
          { model: getDb().Factory, as: 'factory', attributes: ['id', 'name', 'country'] },
        ],
      });
      return products.length ? products.map(p => p.toJSON()) : 'No products found.';
    }

    case 'get_product': {
      const product = await getDb().Product.findOne({
        where: { id: args.id, deletedAt: null },
        include: [
          { model: getDb().ProductCategory, as: 'category', attributes: ['id', 'name'] },
          { model: getDb().Factory, as: 'factory', attributes: ['id', 'name', 'country', 'city'] },
        ],
      });
      if (!product) return `Product ${args.id} not found.`;
      return product.toJSON();
    }

    case 'create_product': {
      const { Op } = require('sequelize');

      // Resolve factory: prefer factory_id, fall back to name search
      let factoryId = args.factory_id;
      if (!factoryId && args.factory_name) {
        const factory = await getDb().Factory.findOne({
          where: { name: { [Op.like]: `%${args.factory_name}%` } },
          attributes: ['id', 'name'],
        });
        if (!factory) return `Factory not found: "${args.factory_name}". Use list_factories to find the correct record.`;
        factoryId = factory.id;
      }
      if (!factoryId) return 'factory_id or factory_name is required.';

      // Resolve category: prefer category_id, fall back to name search
      let categoryId = args.category_id;
      if (!categoryId && args.category_name) {
        const cat = await getDb().ProductCategory.findOne({
          where: { name: { [Op.like]: `%${args.category_name}%` }, isActive: true },
          attributes: ['id', 'name'],
        });
        if (!cat) {
          // Create category on the fly if it doesn't exist
          const newCat = await getDb().ProductCategory.create({ name: args.category_name });
          categoryId = newCat.id;
        } else {
          categoryId = cat.id;
        }
      }
      if (!categoryId) return 'category_id or category_name is required.';

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

      // Build specifications object — includes product specs + logistics/pricing metadata
      const specs = {};
      const specKeys = ['thickness', 'width', 'length', 'material', 'finish', 'color',
        'wearLayer', 'acRating', 'species', 'grade', 'construction', 'clickSystem'];
      for (const k of specKeys) {
        if (args.specifications?.[k] != null) specs[k] = args.specifications[k];
      }
      // Logistics fields stored in specifications JSON (no dedicated column)
      if (args.departure_port)  specs.departurePort = args.departure_port;
      if (args.lead_time)       specs.leadTime      = args.lead_time;
      if (args.packing)         specs.packing       = args.packing;
      if (args.certifications)  specs.certifications = args.certifications;

      // Products are created inactive — Alex must approve before they're live
      const product = await getDb().Product.create({
        name:               args.name,
        sku,
        description:        args.description         || null,
        salesDescription:   args.sales_description   || null,
        purchaseDescription:args.purchase_description || null,
        categoryId,
        factoryId,
        unit:               args.unit                || 'sqm',
        specifications:     specs,
        minOrderQty:        args.min_order_qty        || 1,
        weight:             args.weight               || null,
        hsCode:             args.hs_code              || null,
        isActive:           false,
      });

      // Create a ProductPrice record if FOB price is provided (also inactive pending approval)
      let priceRecord = null;
      if (args.fob_price) {
        // Sovern selling price = factory FOB / (1 - margin/100), margin by division
        const margin       = parseFloat(args.margin ?? 5);
        const costPrice    = parseFloat(args.fob_price);
        const sellingPrice = parseFloat((costPrice / (1 - margin / 100)).toFixed(4));
        const validTo      = args.price_valid_until ? new Date(args.price_valid_until) : null;

        priceRecord = await getDb().ProductPrice.create({
          productId:  product.id,
          factoryId,
          costPrice,
          priceType:    'FOB',
          markup:       margin,
          sellingPrice,
          currency:     'USD',
          validFrom:    new Date(),
          validTo,
          isActive:     false, // inactive until Alex approves
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

      if (USER_ID) {
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

    case 'approve_product': {
      const product = await getDb().Product.findByPk(args.product_id);
      if (!product) return `Product ${args.product_id} not found.`;

      await product.update({ isActive: true });

      // Activate all prices for this product
      const priceCount = await getDb().ProductPrice.update(
        { isActive: true },
        { where: { productId: args.product_id } }
      );

      // Mark approval task(s) done
      await getDb().ScheduledActivity.update(
        { status: 'done', completedAt: new Date(), completedNote: args.note || 'Approved via AI assistant' },
        { where: { entityType: 'Product', entityId: args.product_id, status: 'pending' } }
      );

      return {
        success:       true,
        productId:     product.id,
        name:          product.name,
        sku:           product.sku,
        pricesActivated: Array.isArray(priceCount) ? priceCount[0] : priceCount,
        message:       `Product "${product.name}" is now active and available for quotations.`,
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

    // ── Customers (lookup wrapper) ──────────────────────────────────────────

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

    default:
      throw new Error(`Unknown tool: ${name}. Available tools: ${TOOL_DEFS.map(t => t.name).join(', ')}`);
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
    description: 'Describe an ERP entity: list its attributes, the string fields that free-text search will match, and its associations. Use this before erp_query if you are unsure of the field names.',
    inputSchema: {
      type: 'object',
      required: ['entity'],
      properties: {
        entity: { type: 'string', description: 'Entity name from erp_list_entities, e.g. "Factory"' },
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
    description: 'Send an email via Gmail. IMPORTANT: Always show the complete draft (To / Subject / Body) to the user and get explicit confirmation before calling this tool. Never send autonomously.',
    inputSchema: {
      type: 'object',
      required: ['to', 'subject', 'body'],
      properties: {
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
    description: 'Update a lead\'s status, stage, notes, or follow-up date.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:              { type: 'string', description: 'Lead ID' },
        status:          { type: 'string', description: 'New status' },
        stage:           { type: 'string', description: 'Pipeline stage' },
        notes:           { type: 'string', description: 'Notes to save' },
        productInterest: { type: 'string', description: 'Products of interest' },
        estimatedValue:  { type: 'number', description: 'Estimated deal value USD' },
        priority:        { type: 'string', description: 'Priority: low, medium, high' },
        nextFollowUp:    { type: 'string', description: 'Next follow-up date ISO format' },
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
    description: 'Send a tracked outreach email to a lead. Creates an OutreachEmail row (sequence step + follow-up due date), bumps lead status new→contacted on first send, and uses the Sovern House signature. ALWAYS show the full draft (subject + body + recipient) to Alex and wait for explicit confirmation before calling this tool — never auto-send. For untracked one-off Gmail use send_email instead.',
    inputSchema: {
      type: 'object',
      required: ['lead_id', 'subject', 'body_text'],
      properties: {
        lead_id:        { type: 'string', description: 'Lead ID (from list_leads or create_lead)' },
        subject:        { type: 'string', description: 'Email subject' },
        body_text:      { type: 'string', description: 'Plain-text body (will be wrapped in HTML with the Sovern signature)' },
        touch_number:   { type: 'number', description: 'Sequence step (1=initial, 2=first follow-up, etc.). Default 1.' },
        follow_up_days: { type: 'number', description: 'Days until follow-up is due. Default: touch1=3, touch2=5, touch3+=7' },
        cc:             { type: 'string', description: 'CC address(es), comma-separated' },
        bcc:            { type: 'string', description: 'BCC address(es), comma-separated' },
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
    description: 'Search Google Drive for files. Use to find supplier quotations, spec sheets, or price lists stored in Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Full-text search term (searches inside file content)' },
        name:  { type: 'string', description: 'Search by file name' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
    },
  },
  {
    name: 'read_drive_file',
    description: 'Read the text content of a Google Drive file (Google Docs, Sheets, plain text, CSV). Use to extract product specs, pricing tables, or quotation details from a file Alex has shared.',
    inputSchema: {
      type: 'object',
      required: ['file_id'],
      properties: {
        file_id: { type: 'string', description: 'Google Drive file ID from search_drive_files' },
      },
    },
  },
  {
    name: 'list_product_categories',
    description: 'List all product categories in the ERP. Use this to find the right category ID or name before creating a product.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_products',
    description: 'List products in the ERP product catalog. Search by name or SKU.',
    inputSchema: {
      type: 'object',
      properties: {
        search:      { type: 'string', description: 'Search by name or SKU' },
        category_id: { type: 'string', description: 'Filter by category ID' },
        factory_id:  { type: 'string', description: 'Filter by factory ID' },
        limit:       { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Get full details of a product including category and factory.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
  },
  {
    name: 'create_product',
    description: 'Create a new product in the ERP catalog from quotation or supplier data. Resolves factory and category by name. Auto-generates SKU if not provided. Use this when Alex shares a supplier quotation and asks to add the product to the system.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:                 { type: 'string',  description: 'Product name (e.g. "SPC Flooring 4mm Grey Oak")' },
        sku:                  { type: 'string',  description: 'SKU — auto-generated if omitted' },
        factory_id:           { type: 'string',  description: 'Factory UUID (use if known)' },
        factory_name:         { type: 'string',  description: 'Factory name to search (used if factory_id not known)' },
        category_id:          { type: 'string',  description: 'Category UUID (use if known)' },
        category_name:        { type: 'string',  description: 'Category name (e.g. "SPC Flooring", "LVT", "Auto Parts") — created if not found' },
        description:          { type: 'string',  description: 'Internal product description' },
        sales_description:    { type: 'string',  description: 'Client-facing description for quotations and sales orders' },
        purchase_description: { type: 'string',  description: 'Supplier-facing description for purchase orders' },
        unit:                 { type: 'string',  description: 'Unit: sqm, sqft, box, pallet, roll, piece (default: sqm)' },
        min_order_qty:        { type: 'number',  description: 'Minimum order quantity' },
        weight:               { type: 'number',  description: 'Weight per unit (kg)' },
        hs_code:              { type: 'string',  description: 'HS / HTS code for customs' },
        fob_price:            { type: 'number', description: 'Factory FOB price per unit (USD). Sovern selling price is auto-calculated at FOB / (1 - margin/100).' },
        margin:               { type: 'number', description: 'Sovern margin % to apply (default: 5). Use whatever Alex specifies — e.g. 8 for 8%, 10 for 10%. Applied by division: selling price = FOB / (1 - margin/100).' },
        price_valid_until:    { type: 'string', description: 'Price validity date (ISO format, e.g. 2026-08-31). Required for client quotations.' },
        departure_port:       { type: 'string', description: 'Port of loading / departure port (e.g. "Qingdao", "Shanghai", "Klang"). Required for client quotations.' },
        lead_time:            { type: 'string', description: 'Production and shipping lead time (e.g. "30 days ex-stock", "45 days from order confirmation").' },
        packing:              { type: 'string', description: 'Packing details (e.g. "2.23 sqm/box, 40 boxes/pallet, 22 pallets/40ft").' },
        certifications:       { type: 'string', description: 'Certifications held (e.g. "FloorScore, CARB2, CE").' },
        specifications: {
          type: 'object',
          description: 'Product specs extracted from the quotation',
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
];

// ── Startup ───────────────────────────────────────────────────────────────────
// DB is lazy-loaded on first tool call — do not require('../models') here.
process.stderr.write('[erp-mcp] Server listening on stdin\n');
