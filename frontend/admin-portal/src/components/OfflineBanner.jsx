// ─── OfflineBanner — Phase 5a ────────────────────────────────────────────
//
// Sticky banner across the top when the app loses server reachability.
// Hides instantly on reconnect. Future Phase 5 commits (5c read cache,
// 5e write queue) plug into the same useConnectivity hook so the banner
// is the visible signal that reads are coming from cache and writes are
// queued.

import { useConnectivity, forcePingNow } from '../hooks/useConnectivity'

export default function OfflineBanner() {
  const { isOnline, lastError, lastChecked } = useConnectivity()
  if (isOnline) return null

  const lastCheckedLabel = lastChecked
    ? new Date(lastChecked).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei' })
    : '—'

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#FEE2E2',
        borderBottom: '1px solid #FCA5A5',
        padding: '8px 16px',
        color: '#991B1B',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>
        <strong>Offline.</strong> Server unreachable
        {lastError ? ` (${lastError})` : ''}. Last check {lastCheckedLabel} TPE.
        Reads will fall back to cache; writes will queue and replay when reconnected.
      </span>
      <button
        type="button"
        onClick={() => forcePingNow()}
        style={{
          padding: '4px 12px',
          border: '1px solid #991B1B',
          background: 'white',
          color: '#991B1B',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Retry now
      </button>
    </div>
  )
}
