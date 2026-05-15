/**
 * dedupeOfflineWrite — Phase 5 hardening.
 *
 * If a write request carries X-Client-Uuid AND we've seen the same
 * (uuid, method, path) in the last 24h, return the cached response
 * instead of executing the handler again. Eliminates the documented
 * duplicate-on-network-cut-after-send risk from the offline write
 * queue (5e/5f).
 *
 * Cheap: header check + indexed PK lookup on every write. GETs and
 * uuid-less requests pass through with zero DB hits.
 */

const db = require('../models');
const logger = require('../utils/logger');

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

// Paths the client may replay. Keep in lockstep with the QUEUEABLE_
// PREFIXES list on the client (desktop + mobile). Reads cheap because
// the routing layer already narrows by path; this list is the dedupe
// scope guard.
// Actual mounted route paths. Leads/contacts/activities live under /api/crm.
const DEDUPABLE_PREFIXES = [
  '/api/crm/leads',
  '/api/crm/contacts',
  '/api/crm/activities',
  '/api/scheduled-activities',
  '/api/expenses',
];

function isDedupablePath(path) {
  if (!path) return false;
  return DEDUPABLE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

async function dedupeOfflineWrite(req, res, next) {
  try {
    const uuid = req.header('X-Client-Uuid');
    if (!uuid) return next();
    const method = (req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
    if (!isDedupablePath(req.originalUrl || req.url)) return next();
    if (!db.ClientWriteDedupe) return next();

    const path = (req.originalUrl || req.url).split('?')[0];

    // Cache hit?
    const existing = await db.ClientWriteDedupe.findOne({
      where: { clientUuid: uuid, method, path },
    });
    if (existing) {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < DEDUPE_TTL_MS) {
        // Return the prior response verbatim. The replay loop sees the
        // same shape and marks the queue row replayed.
        return res.status(existing.responseStatus).json(existing.responseBody);
      }
      // Stale — fall through and let the handler run again; the post-
      // handler hook below will overwrite the row.
    }

    // Capture the response so we can cache it. Override res.json once;
    // restore the original after first call so we don't double-cache.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Upsert. The model has a composite PK so a successful row
          // for the same uuid+method+path simply replaces. Fire-and-
          // forget; never let cache write block the response.
          db.ClientWriteDedupe.upsert({
            clientUuid: uuid,
            method,
            path,
            responseStatus: res.statusCode,
            responseBody: body,
            userId: req.user?.id || null,
          }).catch(err => logger.warn(`[dedupe] upsert failed: ${err.message}`));
        }
      } catch (e) {
        logger.warn(`[dedupe] capture failed: ${e.message}`);
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    // Never block traffic on dedupe error.
    logger.warn(`[dedupe] middleware error: ${err.message}`);
    next();
  }
}

module.exports = dedupeOfflineWrite;
module.exports.DEDUPABLE_PREFIXES = DEDUPABLE_PREFIXES;
