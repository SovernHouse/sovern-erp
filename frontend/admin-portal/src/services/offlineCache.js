// ─── offlineCache — Phase 5c ─────────────────────────────────────────────
//
// Thin IndexedDB read-through cache for /api GETs. No third-party dep
// (Dexie or idb-keyval would add ~30KB and pull in promise wrappers we
// don't need). All async, all promise-based, all string-keyed.
//
// Schema: single object store "responses" keyed by string. Value shape:
//   { key, data, savedAt, ttlMs, etag?, userId }
//
// Cache key = `${userId}:${urlPath}?${sortedQS}`. user_id scoping
// matters for brand isolation: a user who can only see FW data should
// not accidentally hydrate from another user's SH cache after switching
// accounts on the same browser. The key namespace gets cleared on
// logout (see useAuth).
//
// Whitelist: caching is opt-in by URL prefix. Listed under
// CACHEABLE_PREFIXES. Adding a prefix here makes every GET on that
// path cacheable; non-listed paths are passthrough.

const DB_NAME    = 'sovern-erp-offline'
const DB_VERSION = 2 // bump: adds writeQueue store (Phase 5e)
const STORE      = 'responses'
const QUEUE      = 'writeQueue'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h

// URL prefix allow-list. Conservative on purpose; widen as we verify
// each list view degrades gracefully when served from stale data.
export const CACHEABLE_PREFIXES = [
  '/leads',
  '/customers',
  '/factories',
  '/products',
  '/quotations',
  '/tariff-rates',
  '/dashboard',
  '/inquiries',
  '/sales-orders',
  '/purchase-orders',
  '/invoices',
  '/expenses',
  '/brands',
  '/commissions',
]

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.reject(new Error('IndexedDB unavailable'))
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
      // Phase 5e: write queue. Auto-incrementing key so FIFO order is
      // implicit. Rows: { id (auto), method, url, body, params, status,
      // attempts, lastError, createdAt, replayedAt, responseStatus,
      // userId, clientUuid }.
      if (!db.objectStoreNames.contains(QUEUE)) {
        const q = db.createObjectStore(QUEUE, { keyPath: 'id', autoIncrement: true })
        q.createIndex('status', 'status', { unique: false })
        q.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error || new Error('IDB open failed'))
  })
  return dbPromise
}

function tx(mode) {
  return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE))
}

// Phase 5e: separate tx helper for the writeQueue store.
function qtx(mode) {
  return openDb().then(db => db.transaction(QUEUE, mode).objectStore(QUEUE))
}

export function isCacheable(urlPath) {
  if (!urlPath) return false
  return CACHEABLE_PREFIXES.some(p => urlPath === p || urlPath.startsWith(`${p}/`) || urlPath.startsWith(`${p}?`))
}

export function buildKey(userId, urlPath, params) {
  const qs = (() => {
    if (!params) return ''
    const ordered = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] ?? '')}`).join('&')
    return ordered ? `?${ordered}` : ''
  })()
  return `${userId || 'anon'}:${urlPath}${qs}`
}

export async function getCached(key) {
  try {
    const store = await tx('readonly')
    return await new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => {
        const row = req.result
        if (!row) return resolve(null)
        if (row.savedAt + row.ttlMs < Date.now()) return resolve(null)
        resolve(row)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (_) {
    return null
  }
}

export async function setCached(key, data, opts = {}) {
  try {
    const store = await tx('readwrite')
    const row = {
      key,
      data,
      savedAt: Date.now(),
      ttlMs:   opts.ttlMs || DEFAULT_TTL_MS,
      userId:  opts.userId || null,
    }
    return await new Promise((resolve, reject) => {
      const req = store.put(row)
      req.onsuccess = () => resolve(row)
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return null
  }
}

// Wipes every cached row. Called on logout so a different user logging
// in on the same browser doesn't see the previous user's cached data
// (and the brand-scope boundary stays intact).
export async function clearAll() {
  try {
    const store = await tx('readwrite')
    return await new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = () => resolve(true)
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return false
  }
}

// ─── Phase 5e: write queue ─────────────────────────────────────────────

export async function queueEnqueue(row) {
  try {
    const store = await qtx('readwrite')
    return await new Promise((resolve, reject) => {
      const req = store.add(row)
      req.onsuccess = () => resolve(req.result)
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return null
  }
}

export async function queueList(statusFilter = null) {
  try {
    const store = await qtx('readonly')
    return await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        const rows = req.result || []
        resolve(statusFilter ? rows.filter(r => r.status === statusFilter) : rows)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (_) {
    return []
  }
}

export async function queueUpdate(id, patch) {
  try {
    const store = await qtx('readwrite')
    return await new Promise((resolve, reject) => {
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const row = getReq.result
        if (!row) return resolve(null)
        const next = { ...row, ...patch }
        const putReq = store.put(next)
        putReq.onsuccess = () => resolve(next)
        putReq.onerror   = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch (_) {
    return null
  }
}

export async function queueRemove(id) {
  try {
    const store = await qtx('readwrite')
    return await new Promise((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = () => resolve(true)
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return false
  }
}

// Debug helper used by future offline-history UI (Phase 5h).
export async function listAll() {
  try {
    const store = await tx('readonly')
    return await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return []
  }
}
