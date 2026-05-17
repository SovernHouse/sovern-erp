// ─── useAutoChainPoller — Phase 4.26 mobile parity ──────────────────────────
//
// Polls /api/notifications every 30s while the app is foregrounded. When a
// notification with type='auto_chain' arrives that we haven't seen before,
// emits a DeviceEventEmitter event `autoChain:created` with the data
// payload, AND shows a native Alert so the user sees the chain step land.
//
// Mobile equivalent of the admin portal's useNotifications hook + the
// window CustomEvent broadcast that Phase 4.26b/c set up. Mobile tabs that
// want to refetch on chain events can listen via:
//
//   import { DeviceEventEmitter } from 'react-native';
//   useEffect(() => {
//     const sub = DeviceEventEmitter.addListener('autoChain:created', (data) => {
//       if (data.entityType === 'SalesOrder') refetch();
//     });
//     return () => sub.remove();
//   }, []);

import { useEffect, useRef } from 'react';
import { AppState, DeviceEventEmitter, Alert } from 'react-native';
import { listMyNotifications, type NotificationRow } from '../services/api';
import { useAuthStore } from '../store/authStore';

const POLL_INTERVAL_MS = 30_000;
const SEEN_LIMIT = 200;

export function useAutoChainPoller() {
  const { isAuthenticated } = useAuthStore();
  const seenIds = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    const tick = async () => {
      try {
        const rows = await listMyNotifications({ limit: 50 });
        for (const n of rows) {
          if (seenIds.current.has(n.id)) continue;
          seenIds.current.add(n.id);
          if (firstRun.current) continue;  // suppress backlog on first poll
          if (n.type !== 'auto_chain') continue;
          // Trim seen set so it doesn't grow unbounded.
          if (seenIds.current.size > SEEN_LIMIT) {
            const trimmed = Array.from(seenIds.current).slice(-SEEN_LIMIT / 2);
            seenIds.current = new Set(trimmed);
          }
          // Emit + toast
          DeviceEventEmitter.emit('autoChain:created', n.data || {});
          Alert.alert('Workflow update', n.message, [{ text: 'OK', style: 'default' }]);
        }
        firstRun.current = false;
      } catch (_) { /* polling errors are silent */ }
    };

    // Initial tick + interval
    tick();
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);

    // Resume on foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      sub.remove();
    };
  }, [isAuthenticated]);
}

export default useAutoChainPoller;
