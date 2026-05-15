// ─── useConnectivity — Phase 5a ──────────────────────────────────────────
//
// Foundation hook for offline mode. Returns { isOnline, lastChecked,
// lastError }. Two signals merged:
//
//   1. navigator.onLine + window 'online'/'offline' events. Cheap, but
//      lies in two directions: VPN gaps say "online" while the API is
//      unreachable; sleep-resume can briefly say "offline" while the
//      connection is actually live.
//   2. Periodic GET /api/health ping (15s interval) used as a server-
//      reachability tiebreaker. Failure flips isOnline=false regardless
//      of what navigator.onLine says. Success flips it back true.
//
// Single source of truth via a small pub-sub so a page mount doesn't
// kick off its own ping cycle — useful when several components on the
// same page subscribe.

import { useEffect, useState } from 'react'
import api from '../services/api'

const PING_INTERVAL_MS = 15000
const PING_TIMEOUT_MS  = 5000

let state = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastChecked: null,
  lastError: null,
}
const listeners = new Set()
let pingTimer = null
let bootstrapped = false

function notify() {
  for (const fn of listeners) {
    try { fn(state) } catch (_) { /* listener crash never blocks others */ }
  }
}

function setState(next) {
  state = { ...state, ...next }
  notify()
}

async function pingOnce() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
    await api.get('/health', { signal: controller.signal })
    clearTimeout(timeout)
    setState({ isOnline: true, lastChecked: new Date(), lastError: null })
  } catch (err) {
    setState({
      isOnline: false,
      lastChecked: new Date(),
      lastError: err?.message || 'network',
    })
  }
}

function bootstrap() {
  if (bootstrapped || typeof window === 'undefined') return
  bootstrapped = true
  window.addEventListener('online',  () => pingOnce())
  window.addEventListener('offline', () => setState({ isOnline: false, lastError: 'offline event' }))
  pingOnce()
  pingTimer = setInterval(pingOnce, PING_INTERVAL_MS)
}

export function useConnectivity() {
  const [local, setLocal] = useState(state)
  useEffect(() => {
    bootstrap()
    const fn = (s) => setLocal(s)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return local
}

// For non-hook callers (axios interceptors, queue replay logic).
export function getConnectivity() { return state }
export function forcePingNow()    { return pingOnce() }
