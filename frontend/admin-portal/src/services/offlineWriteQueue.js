// ─── offlineWriteQueue — Phase 5e ────────────────────────────────────────
//
// Enqueues writes (POST/PUT/PATCH/DELETE) when the app is offline OR
// when a write attempt fails with a network error. Replays FIFO on
// reconnect.
//
// Scope (intentionally narrow): only entities with low conflict
// surface and no downstream cascade. Adding to the whitelist requires
// thinking about idempotency + collaborative edit conflicts.

import { queueEnqueue, queueList, queueUpdate, queueRemove } from './offlineCache'
import { getConnectivity } from '../hooks/useConnectivity'

// URL prefixes (admin-portal axios baseURL is /api, so paths here are
// relative to /api — match the actual mounted route paths, NOT the
// model name. Leads/contacts/activities live under /api/crm.
export const QUEUEABLE_PREFIXES = [
  '/crm/leads',
  '/crm/contacts',
  '/crm/activities',
  '/scheduled-activities',
  '/expenses',
]

export const QUEUEABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isQueueable(method, url) {
  if (!method || !url) return false
  if (!QUEUEABLE_METHODS.has(method.toUpperCase())) return false
  return QUEUEABLE_PREFIXES.some(p => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`))
}

// Per-tab replay lock so concurrent reconnect events don't double-fire.
let draining = false

// Listeners for UI badges (Phase 5g/5h hook in here).
const listeners = new Set()
function notify(event) {
  for (const fn of listeners) { try { fn(event) } catch (_) {} }
}
export function subscribeQueueEvents(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function enqueueWrite({ method, url, body, params, userId, clientUuid }) {
  const row = {
    method:   method.toUpperCase(),
    url,
    body:     body || null,
    params:   params || null,
    status:   'queued',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    replayedAt: null,
    responseStatus: null,
    userId: userId || null,
    clientUuid: clientUuid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`),
  }
  const id = await queueEnqueue(row)
  notify({ type: 'enqueued', id, row })
  return { ...row, id }
}

export async function pendingCount() {
  const all = await queueList()
  return all.filter(r => r.status === 'queued' || r.status === 'failed_retryable').length
}

export async function failedCount() {
  const all = await queueList()
  return all.filter(r => r.status === 'failed_permanent').length
}

// Phase 5h: collect replay outcomes from one drain pass and POST them
// to /audit-logs/offline-replay in a single batch. Server writes one
// AuditLog row per outcome so cross-device offline history is queryable.
async function flushOutcomesToAudit(api, outcomes) {
  if (!outcomes || outcomes.length === 0) return
  try {
    await api.post('/audit-logs/offline-replay', {
      entries: outcomes.map(o => ({
        status: o.status,
        method: o.row.method,
        path:   o.row.url,
        attempts: o.row.attempts,
        clientUuid: o.row.clientUuid,
        createdAt: o.row.createdAt,
        replayedAt: o.row.replayedAt || Date.now(),
        responseStatus: o.responseStatus,
        lastError: o.lastError,
      })),
    }, { _skipQueue: true })
  } catch (_) { /* never let audit logging break replay */ }
}

// Drains the queue FIFO. Calls the supplied `fetcher` (an already-
// configured axios instance via dynamic import so we don't create a
// circular dep with services/api.js).
export async function drainQueue() {
  if (draining) return { skipped: 'already draining' }
  const conn = getConnectivity()
  if (!conn.isOnline) return { skipped: 'offline' }
  draining = true
  try {
    const { default: api } = await import('./api')
    // Re-read each pass — replays can be interrupted by going offline.
    let processed = 0
    const outcomes = []
    while (true) {
      const queued = (await queueList()).filter(r => r.status === 'queued' || r.status === 'failed_retryable').sort((a, b) => a.createdAt - b.createdAt)
      if (queued.length === 0) break
      if (!getConnectivity().isOnline) break

      const row = queued[0]
      const attempts = (row.attempts || 0) + 1
      await queueUpdate(row.id, { status: 'in_progress', attempts })
      notify({ type: 'replay_started', id: row.id })
      try {
        const res = await api.request({
          method: row.method,
          url:    row.url,
          data:   row.body || undefined,
          params: row.params || undefined,
          headers: { 'X-Client-Uuid': row.clientUuid },
          // CRITICAL: don't re-enqueue if THIS replay attempt itself
          // fails with a network error — that's handled inline below.
          _skipQueue: true,
        })
        const updated = await queueUpdate(row.id, {
          status: 'replayed',
          responseStatus: res.status,
          replayedAt: Date.now(),
          lastError: null,
        })
        notify({ type: 'replay_ok', id: row.id, responseStatus: res.status })
        outcomes.push({ status: 'replayed', row: updated, responseStatus: res.status, lastError: null })
        processed++
      } catch (err) {
        const status = err?.response?.status
        if (status >= 400 && status < 500) {
          // Server-side rejection (validation, auth, conflict) — don't
          // retry. Surfaced to user via 5g UI.
          const msg = err.response?.data?.message || err.message || `HTTP ${status}`
          const updated = await queueUpdate(row.id, {
            status: 'failed_permanent',
            lastError: msg,
            responseStatus: status,
          })
          notify({ type: 'replay_failed', id: row.id, status, message: msg })
          outcomes.push({ status: 'failed_permanent', row: updated, responseStatus: status, lastError: msg })
        } else if (!err?.response) {
          // Network/timeout — went offline mid-replay. Re-mark queued
          // and bail out of this loop pass; next online tick resumes.
          await queueUpdate(row.id, {
            status: 'failed_retryable',
            lastError: err.message || 'network',
          })
          notify({ type: 'replay_deferred', id: row.id })
          break
        } else {
          // 5xx — retry next online tick.
          const msg = `HTTP ${status}: ${err.response?.data?.message || ''}`
          await queueUpdate(row.id, {
            status: 'failed_retryable',
            lastError: msg,
            responseStatus: status,
          })
          notify({ type: 'replay_deferred', id: row.id, status })
          // Don't tight-loop on a persistent 5xx; bail.
          break
        }
      }
    }
    // Phase 5h: batch-flush replay outcomes to the backend audit log.
    if (outcomes.length > 0) await flushOutcomesToAudit(api, outcomes)
    return { processed }
  } finally {
    draining = false
  }
}

// Dismiss a row from the queue. Used by the 5g conflict UI to let the
// user discard a write that the server rejected.
export async function dismissQueued(id) {
  await queueRemove(id)
  notify({ type: 'dismissed', id })
}

// Auto-drain on reconnect. Subscribe once at module load; safe because
// useConnectivity has a single shared state instance.
import { useConnectivity } from '../hooks/useConnectivity'
let bootstrapped = false
export function bootstrapAutoReplay() {
  if (bootstrapped || typeof window === 'undefined') return
  bootstrapped = true
  let prevOnline = getConnectivity().isOnline
  // Poll-style listener — useConnectivity's own subscribers run via
  // React state; we want a plain side-effect outside React. Tap into
  // the same pub-sub via a tiny wrapper component if we ever need it,
  // but for now: check every 5s, fire drain when isOnline flips true.
  setInterval(() => {
    const online = getConnectivity().isOnline
    if (online && !prevOnline) {
      drainQueue().catch(() => {})
    }
    prevOnline = online
  }, 5000)
  // Also try once on startup in case a tab loaded with queued writes.
  if (prevOnline) drainQueue().catch(() => {})
}

// Re-export for places that want the hook (Phase 5g UI).
export { useConnectivity }
