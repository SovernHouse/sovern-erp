// ─── offlineWriteQueue (mobile) — Phase 5f ───────────────────────────────
//
// Mobile mirror of services/offlineWriteQueue.js. Same whitelist, same
// FIFO replay rules, same outcome categories. The fetch wrapper in
// services/api.ts enqueues on offline + network-error, returns a
// synthetic queued response, and the auto-replay loop drains on
// reconnect.

import { CONFIG } from '../constants/config';
import * as SecureStore from 'expo-secure-store';
import {
  queueEnqueueMobile, queueListMobile, queueUpdateMobile, queueRemoveMobile,
  type QueuedWrite,
} from './offlineCache';
import { getConnectivity } from '../hooks/useConnectivity';

export const QUEUEABLE_PREFIXES = [
  '/api/leads',
  '/api/contacts',
  '/api/activities',
  '/api/scheduled-activities',
  '/api/expenses',
  '/api/notes',
];

export const QUEUEABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isQueueable(method: string | undefined, path: string | undefined): boolean {
  if (!method || !path) return false;
  if (!QUEUEABLE_METHODS.has(method.toUpperCase())) return false;
  return QUEUEABLE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

let draining = false;

const listeners = new Set<(evt: any) => void>();
function notify(evt: any) {
  for (const fn of listeners) { try { fn(evt); } catch (_) {} }
}
export function subscribeQueueEvents(fn: (evt: any) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function enqueueWriteMobile(params: {
  method: string;
  path: string;
  body: any;
  userId: string | null;
}): Promise<QueuedWrite> {
  const row: Omit<QueuedWrite, 'id'> = {
    method: params.method.toUpperCase(),
    path:   params.path,
    body:   params.body || null,
    status: 'queued',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    replayedAt: null,
    responseStatus: null,
    userId: params.userId,
    clientUuid: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  };
  const full = await queueEnqueueMobile(row);
  notify({ type: 'enqueued', id: full.id, row: full });
  return full;
}

export async function pendingCountMobile(): Promise<number> {
  const all = await queueListMobile();
  return all.filter(r => r.status === 'queued' || r.status === 'failed_retryable').length;
}

// Phase 5h: batch-POST replay outcomes to /api/audit-logs/offline-replay
// so cross-device offline history is queryable in the central audit log.
async function flushOutcomesToAuditMobile(outcomes: Array<any>) {
  if (!outcomes || outcomes.length === 0) return;
  try {
    const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
    await fetch(`${CONFIG.SERVER_URL}/api/audit-logs/offline-replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        entries: outcomes.map(o => ({
          status: o.status,
          method: o.row.method,
          path:   o.row.path,
          attempts: o.row.attempts,
          clientUuid: o.row.clientUuid,
          createdAt: o.row.createdAt,
          replayedAt: o.row.replayedAt || Date.now(),
          responseStatus: o.responseStatus,
          lastError: o.lastError,
        })),
      }),
    });
  } catch (_) { /* audit logging is best-effort */ }
}

export async function drainQueueMobile(): Promise<{ processed?: number; skipped?: string }> {
  if (draining) return { skipped: 'already draining' };
  if (!getConnectivity().isOnline) return { skipped: 'offline' };
  draining = true;
  try {
    let processed = 0;
    const outcomes: Array<any> = [];
    while (true) {
      const all = await queueListMobile();
      const queued = all
        .filter(r => r.status === 'queued' || r.status === 'failed_retryable')
        .sort((a, b) => a.createdAt - b.createdAt);
      if (queued.length === 0) break;
      if (!getConnectivity().isOnline) break;

      const row = queued[0];
      const attempts = row.attempts + 1;
      await queueUpdateMobile(row.id, { status: 'in_progress', attempts });
      notify({ type: 'replay_started', id: row.id });

      try {
        const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
        const res = await fetch(`${CONFIG.SERVER_URL}${row.path}`, {
          method: row.method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Client-Uuid': row.clientUuid,
          },
          body: row.body ? JSON.stringify(row.body) : undefined,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body?.message || `HTTP ${res.status}`;
          if (res.status >= 400 && res.status < 500) {
            const updated = await queueUpdateMobile(row.id, {
              status: 'failed_permanent',
              lastError: msg,
              responseStatus: res.status,
            });
            notify({ type: 'replay_failed', id: row.id, status: res.status, message: msg });
            outcomes.push({ status: 'failed_permanent', row: updated, responseStatus: res.status, lastError: msg });
          } else {
            await queueUpdateMobile(row.id, {
              status: 'failed_retryable',
              lastError: msg,
              responseStatus: res.status,
            });
            notify({ type: 'replay_deferred', id: row.id, status: res.status });
            break;
          }
        } else {
          const updated = await queueUpdateMobile(row.id, {
            status: 'replayed',
            responseStatus: res.status,
            replayedAt: Date.now(),
            lastError: null,
          });
          notify({ type: 'replay_ok', id: row.id, responseStatus: res.status });
          outcomes.push({ status: 'replayed', row: updated, responseStatus: res.status, lastError: null });
          processed++;
        }
      } catch (err: any) {
        // Network error mid-replay -> went offline. Re-mark queued.
        await queueUpdateMobile(row.id, {
          status: 'failed_retryable',
          lastError: err?.message || 'network',
        });
        notify({ type: 'replay_deferred', id: row.id });
        break;
      }
    }
    if (outcomes.length > 0) await flushOutcomesToAuditMobile(outcomes);
    return { processed };
  } finally {
    draining = false;
  }
}

export async function dismissQueuedMobile(id: string) {
  await queueRemoveMobile(id);
  notify({ type: 'dismissed', id });
}

// Same offline->online edge polling as desktop. Single setInterval; safe
// because useConnectivity has a single shared state instance.
let bootstrapped = false;
export function bootstrapMobileAutoReplay() {
  if (bootstrapped) return;
  bootstrapped = true;
  let prevOnline = getConnectivity().isOnline;
  setInterval(() => {
    const online = getConnectivity().isOnline;
    if (online && !prevOnline) {
      drainQueueMobile().catch(() => {});
    }
    prevOnline = online;
  }, 5000);
  if (prevOnline) drainQueueMobile().catch(() => {});
}
