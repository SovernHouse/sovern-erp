// ─── useConnectivity (mobile) — Phase 5a ─────────────────────────────────
//
// Mirrors the desktop hook. NetInfo native dep is intentionally NOT
// added (would force an EAS native rebuild). Instead we poll
// /api/health every 15s and treat fetch failure as "offline". Future
// 5d (AsyncStorage read cache) and 5f (write queue) hang off this hook.
//
// Single shared state across all subscribers so we don't run N parallel
// poll loops when several screens mount.

import { useEffect, useState } from 'react';
import { CONFIG } from '../constants/config';

type State = {
  isOnline: boolean;
  lastChecked: Date | null;
  lastError: string | null;
};

const PING_INTERVAL_MS = 15000;
const PING_TIMEOUT_MS  = 5000;

let state: State = { isOnline: true, lastChecked: null, lastError: null };
const listeners = new Set<(s: State) => void>();
let pingTimer: ReturnType<typeof setInterval> | null = null;
let bootstrapped = false;

function notify() {
  for (const fn of listeners) {
    try { fn(state); } catch (_) { /* never let one listener block others */ }
  }
}
function setState(next: Partial<State>) {
  state = { ...state, ...next };
  notify();
}

async function pingOnce() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(`${CONFIG.SERVER_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`health ${res.status}`);
    setState({ isOnline: true, lastChecked: new Date(), lastError: null });
  } catch (err: any) {
    setState({ isOnline: false, lastChecked: new Date(), lastError: err?.message || 'network' });
  }
}

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  pingOnce();
  pingTimer = setInterval(pingOnce, PING_INTERVAL_MS);
}

export function useConnectivity() {
  const [local, setLocal] = useState<State>(state);
  useEffect(() => {
    bootstrap();
    const fn = (s: State) => setLocal(s);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return local;
}

export function getConnectivity()   { return state; }
export function forcePingNow()      { return pingOnce(); }
