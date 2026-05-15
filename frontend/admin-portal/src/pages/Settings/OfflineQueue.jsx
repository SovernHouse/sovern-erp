// ─── Offline Queue Inspector — Phase 5g ──────────────────────────────────
//
// Shows the local write-queue: queued/in-progress/replayed/failed rows
// with details and a Dismiss action. Live-updates via the queue's
// pub-sub events. Read-only otherwise — the actual replay happens
// automatically when isOnline=true (5e).

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle, Clock, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import {
  queueList,
} from '../../services/offlineCache'
import {
  drainQueue, dismissQueued, subscribeQueueEvents,
} from '../../services/offlineWriteQueue'
import { useConnectivity } from '../../hooks/useConnectivity'

const STATUS_PILL = {
  queued:            { bg: '#F1F5F9', fg: '#475569', icon: Clock,        label: 'Queued' },
  in_progress:       { bg: '#DBEAFE', fg: '#1E40AF', icon: RefreshCw,    label: 'In flight' },
  replayed:          { bg: '#DCFCE7', fg: '#166534', icon: CheckCircle,  label: 'Replayed' },
  failed_retryable:  { bg: '#FEF3C7', fg: '#92400E', icon: AlertTriangle, label: 'Will retry' },
  failed_permanent:  { bg: '#FEE2E2', fg: '#991B1B', icon: AlertTriangle, label: 'Failed' },
}

function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })
}

export default function OfflineQueue() {
  const conn = useConnectivity()
  const [rows, setRows] = useState([])
  const [draining, setDraining] = useState(false)

  const refresh = async () => {
    const all = await queueList()
    setRows(all.sort((a, b) => b.createdAt - a.createdAt))
  }

  useEffect(() => {
    refresh()
    const unsub = subscribeQueueEvents(() => refresh())
    const t = setInterval(refresh, 5000)
    return () => { unsub(); clearInterval(t) }
  }, [])

  const handleDrainNow = async () => {
    setDraining(true)
    try {
      const out = await drainQueue()
      if (out?.skipped) toast(`Skipped: ${out.skipped}`)
      else toast.success(`Replayed ${out?.processed ?? 0}`)
      await refresh()
    } finally {
      setDraining(false)
    }
  }

  const handleDismiss = async (id) => {
    if (!confirm('Dismiss this queued write? It will not be sent.')) return
    await dismissQueued(id)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offline queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Writes made while the app couldn't reach the server. They replay automatically when {conn.isOnline ? <strong>(currently online)</strong> : <strong>(currently offline)</strong>} the connection returns. Failed rows can be dismissed below.
          </p>
        </div>
        <button
          onClick={handleDrainNow}
          disabled={draining || !conn.isOnline}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Drain now
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-lg bg-white">
          No queued writes. Everything Alex saves goes straight to the server while online.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Method</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Endpoint</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Created (TPE)</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Replayed (TPE)</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Attempts</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Last error</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const pill = STATUS_PILL[row.status] || STATUS_PILL.queued
                const Icon = pill.icon
                return (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <span style={{ background: pill.bg, color: pill.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={12} /> {pill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 truncate max-w-md" title={row.url}>{row.url}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtTime(row.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtTime(row.replayedAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.attempts || 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={row.lastError || ''}>{row.lastError || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {(row.status === 'failed_permanent' || row.status === 'queued' || row.status === 'failed_retryable') && (
                        <button onClick={() => handleDismiss(row.id)} className="p-1.5 hover:bg-red-50 rounded" title="Dismiss">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
