import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, ClipboardList, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import { settingsAPI } from '../../services/api'
import { formatDateTime } from '../../utils/formatters'

// ── Audit Log tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    settingsAPI.getSystemLogs()
      .then(res => setLogs(res.data || []))
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg shadow">
      <DataTable
        columns={[
          { key: 'timestamp', label: 'Time',   render: (r) => formatDateTime(r.timestamp) },
          { key: 'user',      label: 'User',   render: (r) => r.User ? `${r.User.firstName} ${r.User.lastName}`.trim() : '—' },
          { key: 'action',    label: 'Action' },
          { key: 'entity',    label: 'Entity' },
        ]}
        data={logs}
        isLoading={isLoading}
        paginated
      />
    </div>
  )
}

// ── Frontend Errors tab ──────────────────────────────────────────────────────

function StackRow({ label, text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 overflow-auto max-h-48 whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  )
}

function FrontendErrorsTab() {
  const [errors, setErrors] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    settingsAPI.getFrontendErrors({ limit: 100 })
      .then(res => setErrors(res.data || []))
      .catch(() => toast.error('Failed to load frontend errors'))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const handleClear = async () => {
    if (!window.confirm('Clear all frontend error records? This cannot be undone.')) return
    try {
      await settingsAPI.clearFrontendErrors()
      setErrors([])
      toast.success('Frontend error log cleared.')
    } catch {
      toast.error('Failed to clear log.')
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {errors.length} recorded crash{errors.length !== 1 ? 'es' : ''}. Captured automatically whenever the app error boundary fires.
        </p>
        {errors.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={14} />
            Clear log
          </button>
        )}
      </div>

      {errors.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-slate-400 text-sm">
          No frontend crashes recorded.
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map(err => {
            const who = err.user
              ? `${err.user.firstName} ${err.user.lastName}`.trim() || err.user.email
              : 'Anonymous'
            const page = err.pageUrl
              ? err.pageUrl.replace(/^https?:\/\/[^/]+/, '')
              : '—'
            return (
              <div key={err.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700 break-all">{err.errorMessage}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateTime(err.createdAt)} · {who} · <span className="font-mono">{page}</span>
                    </p>
                    <StackRow label="Error stack"     text={err.errorStack} />
                    <StackRow label="Component stack" text={err.componentStack} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'errors',    label: 'Frontend Crashes', icon: AlertTriangle },
  { id: 'audit',     label: 'Audit Log',        icon: ClipboardList },
]

export default function SystemLog() {
  const [tab, setTab] = useState('errors')

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">System Log</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'errors' && <FrontendErrorsTab />}
      {tab === 'audit'  && <AuditLogTab />}
    </div>
  )
}
