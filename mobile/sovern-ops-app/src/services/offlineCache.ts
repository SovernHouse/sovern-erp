// ─── offlineCache (mobile) — Phase 5d ────────────────────────────────────
//
// AsyncStorage read-through cache for /api GETs. Mirrors the desktop
// IDB cache in services/offlineCache.js: same key shape, same TTL,
// same whitelist. AsyncStorage is plenty for the response volume an
// individual ERP user generates (low-hundreds of cached payloads).
// MMKV upgrade path noted in the architecture plan for later when we
// care about read latency on cold lists.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'offlineCache:v1:';
const INDEX_KEY  = 'offlineCache:v1:__index__';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const CACHEABLE_PREFIXES = [
  '/api/leads',
  '/api/customers',
  '/api/factories',
  '/api/products',
  '/api/quotations',
  '/api/tariff-rates',
  '/api/dashboard',
  '/api/inquiries',
  '/api/sales-orders',
  '/api/purchase-orders',
  '/api/invoices',
  '/api/expenses',
  '/api/brands',
  '/api/commissions',
];

export function isCacheable(path: string): boolean {
  if (!path) return false;
  return CACHEABLE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

export function buildKey(userId: string | null, path: string): string {
  return `${userId || 'anon'}:${path}`;
}

type Row<T> = {
  key: string;
  data: T;
  savedAt: number;
  ttlMs: number;
  userId: string | null;
};

async function readIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

async function writeIndex(keys: string[]): Promise<void> {
  try { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(keys)); } catch (_) { /* ignore */ }
}

export async function getCached<T = unknown>(key: string): Promise<Row<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const row = JSON.parse(raw) as Row<T>;
    if (row.savedAt + row.ttlMs < Date.now()) return null;
    return row;
  } catch (_) {
    return null;
  }
}

export async function setCached<T = unknown>(
  key: string,
  data: T,
  opts: { ttlMs?: number; userId?: string | null } = {},
): Promise<void> {
  try {
    const row: Row<T> = {
      key,
      data,
      savedAt: Date.now(),
      ttlMs: opts.ttlMs || DEFAULT_TTL_MS,
      userId: opts.userId ?? null,
    };
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(row));
    const idx = await readIndex();
    if (!idx.includes(key)) {
      idx.push(key);
      await writeIndex(idx);
    }
  } catch (_) { /* writes are best-effort */ }
}

export async function clearAll(): Promise<void> {
  try {
    const idx = await readIndex();
    const keys = idx.map(k => KEY_PREFIX + k);
    keys.push(INDEX_KEY);
    await AsyncStorage.multiRemove(keys);
  } catch (_) { /* ignore */ }
}

// ─── Phase 5f: write queue ─────────────────────────────────────────────

const QUEUE_KEY = 'offlineCache:v1:__writeQueue__';

export type QueuedWrite = {
  id: string;
  method: string;
  path: string;
  body: any;
  status: 'queued' | 'in_progress' | 'replayed' | 'failed_retryable' | 'failed_permanent';
  attempts: number;
  lastError: string | null;
  createdAt: number;
  replayedAt: number | null;
  responseStatus: number | null;
  userId: string | null;
  clientUuid: string;
};

async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

async function writeQueue(rows: QueuedWrite[]): Promise<void> {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(rows)); } catch (_) { /* ignore */ }
}

export async function queueEnqueueMobile(row: Omit<QueuedWrite, 'id'>): Promise<QueuedWrite> {
  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const next = await readQueue();
  const full: QueuedWrite = { ...row, id };
  next.push(full);
  await writeQueue(next);
  return full;
}

export async function queueListMobile(): Promise<QueuedWrite[]> {
  return readQueue();
}

export async function queueUpdateMobile(id: string, patch: Partial<QueuedWrite>): Promise<QueuedWrite | null> {
  const all = await readQueue();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeQueue(all);
  return all[idx];
}

export async function queueRemoveMobile(id: string): Promise<void> {
  const all = await readQueue();
  await writeQueue(all.filter(r => r.id !== id));
}

export async function queueClearMobile(): Promise<void> {
  try { await AsyncStorage.removeItem(QUEUE_KEY); } catch (_) { /* ignore */ }
}
