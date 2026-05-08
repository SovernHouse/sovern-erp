/**
 * Dev Mode Runs — audit view (super_admin only).
 *
 * Lists every dev-mode run with status, PR link, telemetry. Click a row
 * for full detail (prompt, files changed, error, clarification chain).
 */

import { useEffect, useState, useCallback } from 'react'
import { devModeAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Loader2, ExternalLink, Code, Filter, X,
  CheckCircle2, AlertTriangle, XCircle, StopCircle, HelpCircle, Play, GitPullRequest,
} from 'lucide-react'

const STATUS_FILTERS = [
  { value: '',                       label: 'All' },
  { value: 'queued',                 label: 'Queued' },
  { value: 'running',                label: 'Running' },
  { value: 'awaiting_clarification', label: 'Awaiting' },
  { value: 'opening_pr',             label: 'Opening PR' },
  { value: 'completed',              label: 'Completed' },
  { value: 'wip',                    label: 'WIP' },
  { value: 'failed',                 label: 'Failed' },
  { value: 'aborted',                label: 'Aborted' },
]

function statusMeta(status) {
  switch (status) {
    case 'queued':                 return { icon: Play,         color: '#64748b', bg: '#f1f5f9', label: 'Queued' }
    case 'running':                return { icon: Loader2,      color: '#2563eb', bg: '#eff6ff', label: 'Running',          spin: true }
    case 'opening_pr':             return { icon: GitPullRequest,color: '#7c3aed', bg: '#f5f3ff', label: 'Opening PR' }
    case 'awaiting_clarification': return { icon: HelpCircle,   color: '#d97706', bg: '#fef3c7', label: 'Awaiting answer' }
    case 'completed':              return { icon: CheckCircle2, color: '#059669', bg: '#ecfdf5', label: 'Completed' }
    case 'wip':                    return { icon: AlertTriangle,color: '#d97706', bg: '#fef3c7', label: 'WIP' }
    case 'failed':                 return { icon: XCircle,      color: '#dc2626', bg: '#fee2e2', label: 'Failed' }
    case 'aborted':                return { icon: StopCircle,   color: '#475569', bg: '#f1f5f9', label: 'Aborted' }
    default:                       return { icon: Code,         color: '#64748b', bg: '#f1f5f9', label: status }
  }
}

function StatusPill({ status }) {
  const m = statusMeta(status)
  const Icon = m.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: m.bg, color: m.color, fontWeight: 600, fontSize: 12,
      padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap',
    }}>
      <Icon size={12} style={m.spin ? { animation: 'spin 1s linear infinite' } : {}} />
      {m.label}
    </span>
  )
}

function relTime(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return s + 's ago'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  return d + 'd ago'
}

export default function DevRunsPage() {
  const { user } = useAuth()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? { status: statusFilter, limit: 100 } : { limit: 100 }
      const res = await devModeAPI.listRuns(params)
      setRuns(res.data?.data || [])
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to load dev runs'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  // Auto-poll while any run is in a non-terminal state, every 5s
  useEffect(() => {
    const NON_TERMINAL = ['queued', 'running', 'opening_pr', 'awaiting_clarification']
    const hasInFlight = runs.some(r => NON_TERMINAL.includes(r.status))
    if (!hasInFlight) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [runs, load])

  if (user?.role !== 'super_admin') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
        <h2>Forbidden</h2>
        <p>Dev Mode runs are visible to super_admin only.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Code size={22} color="#2563eb" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Dev Mode runs</h1>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{runs.length} {runs.length === 1 ? 'run' : 'runs'}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Filter size={14} color="#64748b" style={{ alignSelf: 'center' }} />
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value || 'all'}
            onClick={() => setStatusFilter(f.value)}
            style={{
              background: statusFilter === f.value ? '#0f172a' : '#fff',
              color: statusFilter === f.value ? '#fff' : '#475569',
              border: '1px solid ' + (statusFilter === f.value ? '#0f172a' : '#e2e8f0'),
              borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
          Loading...
        </div>
      ) : runs.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 14 }}>No dev-mode runs yet.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>Open the AI Assistant, switch on Dev Mode, and ask for a code change.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={th()}>Status</th>
                <th style={th()}>Prompt</th>
                <th style={th()}>Diff</th>
                <th style={th()}>Turns</th>
                <th style={th()}>PR</th>
                <th style={th()}>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                >
                  <td style={td()}><StatusPill status={r.status} /></td>
                  <td style={{ ...td(), maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.prompt}>{r.prompt}</td>
                  <td style={td()}>+{r.linesAdded || 0} / -{r.linesDeleted || 0}</td>
                  <td style={td()}>{r.turnCount || 0}/{r.maxTurns || 30}</td>
                  <td style={td()}>
                    {r.prUrl ? (
                      <a href={r.prUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        #{r.prNumber || '?'} <ExternalLink size={12} />
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ ...td(), color: '#64748b' }}>{relTime(r.startedAt || r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <RunDetailDrawer run={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}

function th() { return { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 } }
function td() { return { padding: '10px 12px', verticalAlign: 'top' } }

function RunDetailDrawer({ run: initialRun, onClose, onChanged }) {
  const [run, setRun] = useState(initialRun)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')

  // Re-fetch on open + poll while non-terminal
  const refresh = useCallback(async () => {
    try {
      const res = await devModeAPI.getRun(initialRun.id)
      if (res.data?.data) setRun(res.data.data)
    } catch (_) { /* ignore */ }
  }, [initialRun.id])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const NON_TERMINAL = ['queued', 'running', 'opening_pr']
    if (!NON_TERMINAL.includes(run.status)) return
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [run.status, refresh])

  async function handleAnswer() {
    if (!answer.trim()) return
    setLoading(true)
    try {
      await devModeAPI.answerClarification(run.id, answer.trim())
      setAnswer('')
      await refresh()
      onChanged?.()
      toast.success('Answer submitted; AI is resuming.')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to submit answer')
    } finally {
      setLoading(false)
    }
  }

  async function handleAbort() {
    if (!confirm('Abort this dev-mode run?')) return
    setLoading(true)
    try {
      await devModeAPI.abortRun(run.id)
      await refresh()
      onChanged?.()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to abort run')
    } finally {
      setLoading(false)
    }
  }

  const NON_TERMINAL = ['queued', 'running', 'opening_pr', 'awaiting_clarification']
  const canAbort = NON_TERMINAL.includes(run.status)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: '95vw', background: '#fff', height: '100%', overflowY: 'auto',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Code size={18} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>Dev Mode run</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 18, flex: 1 }}>
          <div style={{ marginBottom: 14 }}><StatusPill status={run.status} /></div>

          <Field label="Run ID" value={<code style={mono()}>{run.id}</code>} />
          <Field label="Branch" value={run.branchName ? <code style={mono()}>{run.branchName}</code> : '—'} />
          {run.prUrl && (
            <Field label="PR" value={<a href={run.prUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}>#{run.prNumber || '?'} <ExternalLink size={12} /></a>} />
          )}
          <Field label="Diff" value={`+${run.linesAdded || 0} / -${run.linesDeleted || 0} across ${run.filesChanged?.length || 0} files`} />
          <Field label="Turns" value={`${run.turnCount || 0} / ${run.maxTurns || 30}`} />
          {run.tokenUsage && Object.keys(run.tokenUsage).length > 0 && (
            <Field label="Tokens" value={`${run.tokenUsage.input || 0} in / ${run.tokenUsage.output || 0} out${run.tokenUsage.cacheRead ? ` (${run.tokenUsage.cacheRead} cache)` : ''}`} />
          )}
          <Field label="Started" value={run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'} />
          {run.completedAt && <Field label="Completed" value={new Date(run.completedAt).toLocaleString()} />}

          <Section title="Prompt">
            <pre style={pre()}>{run.prompt}</pre>
          </Section>

          {run.errorMessage && (
            <Section title="Error">
              <pre style={{ ...pre(), background: '#fef2f2', color: '#991b1b' }}>{run.errorMessage}</pre>
            </Section>
          )}

          {run.status === 'awaiting_clarification' && run.clarificationQuestion && (
            <Section title="AI is asking">
              <pre style={{ ...pre(), background: '#fef3c7', color: '#854d0e' }}>{run.clarificationQuestion}</pre>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                style={{
                  width: '100%', marginTop: 8, padding: 10, border: '1px solid #e2e8f0',
                  borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleAnswer}
                disabled={loading || !answer.trim()}
                style={{
                  marginTop: 8, background: '#0f172a', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  cursor: loading || !answer.trim() ? 'default' : 'pointer',
                  opacity: loading || !answer.trim() ? 0.5 : 1,
                }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> : 'Submit answer'}
              </button>
            </Section>
          )}

          {run.filesChanged && run.filesChanged.length > 0 && (
            <Section title="Files changed">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {run.filesChanged.map((f, i) => (
                  <li key={i}><code style={mono()}>{f.path}</code> <span style={{ color: '#64748b' }}>(+{f.additions} / -{f.deletions})</span></li>
                ))}
              </ul>
            </Section>
          )}

          {run.clarificationAnswer && (
            <Section title="Your previous answer">
              <pre style={pre()}>{run.clarificationAnswer}</pre>
            </Section>
          )}
        </div>

        {canAbort && (
          <div style={{ padding: 14, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button onClick={handleAbort} disabled={loading} style={{
              background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
              borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <StopCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Abort run
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: 80 }}>{label}</span>
      <span style={{ color: '#1e293b', flex: 1, wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}
function mono() { return { fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 } }
function pre() { return { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', border: '1px solid #e2e8f0', margin: 0 } }
