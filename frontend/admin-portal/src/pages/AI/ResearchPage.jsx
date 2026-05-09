/**
 * AI Research — audit view for Tier 2 background sourcing tasks.
 *
 * Lists every research run started via /new-clients or /new-suppliers from
 * the AI chat. Click a row for full detail (brief, summary, findings list
 * with deep-link to the created Lead or Factory rows for review).
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { researchAPI } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Loader2, Filter, X, CheckCircle2, XCircle, StopCircle, Search,
  ExternalLink, Building, Factory,
} from 'lucide-react'

const NON_TERMINAL = new Set(['queued', 'running'])

const STATUS_FILTERS = [
  { value: '',          label: 'All' },
  { value: 'queued',    label: 'Queued' },
  { value: 'running',   label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed',    label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const MODE_FILTERS = [
  { value: '',          label: 'All modes' },
  { value: 'clients',   label: 'New clients' },
  { value: 'suppliers', label: 'New suppliers' },
]

function statusMeta(status) {
  switch (status) {
    case 'queued':    return { icon: Loader2,      color: '#64748b', bg: '#f1f5f9', label: 'Queued' }
    case 'running':   return { icon: Loader2,      color: '#2563eb', bg: '#eff6ff', label: 'Running', spin: true }
    case 'completed': return { icon: CheckCircle2, color: '#059669', bg: '#ecfdf5', label: 'Completed' }
    case 'failed':    return { icon: XCircle,      color: '#dc2626', bg: '#fee2e2', label: 'Failed' }
    case 'cancelled': return { icon: StopCircle,   color: '#475569', bg: '#f1f5f9', label: 'Cancelled' }
    default:          return { icon: Search,       color: '#64748b', bg: '#f1f5f9', label: status }
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

function ModeBadge({ mode }) {
  const isClients = mode === 'clients'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isClients ? '#e6f0ff' : '#fff3e0',
      color: isClients ? '#1d4ed8' : '#b45309',
      fontWeight: 600, fontSize: 11, padding: '3px 8px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: 0.4,
    }}>
      {isClients ? <Building size={11} /> : <Factory size={11} />}
      {isClients ? 'New clients' : 'New suppliers'}
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

export default function ResearchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (statusFilter) params.status = statusFilter
      if (modeFilter) params.mode = modeFilter
      const res = await researchAPI.listTasks(params)
      setTasks(res.data?.data ?? [])
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not load research tasks')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, modeFilter])

  useEffect(() => { load() }, [load])

  const anyActive = useMemo(() => tasks.some(t => NON_TERMINAL.has(t.status)), [tasks])
  useEffect(() => {
    if (!anyActive) return
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [anyActive, load])

  async function refreshSelected(id) {
    try {
      const res = await researchAPI.getTask(id)
      setSelected(res.data?.data ?? null)
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not load task')
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this research run? Drafts already created will remain.')) return
    try {
      await researchAPI.cancelTask(id)
      toast.success('Task cancelled')
      await load()
      if (selected?.id === id) await refreshSelected(id)
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not cancel')
    }
  }

  function jumpToDraft(f) {
    if (!f.draftId) return
    if (f.type === 'lead' || f.type === 'customer') {
      navigate(`/crm/leads/${f.draftId}`)
    } else if (f.type === 'factory') {
      navigate(`/factories/${f.draftId}`)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>AI Research</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Background sourcing runs from <code>/new-clients</code> and <code>/new-suppliers</code>.
          Drafts are unverified — review before any outreach.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Filter size={16} color="#64748b" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} style={selectStyle}>
          {MODE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {(statusFilter || modeFilter) && (
          <button onClick={() => { setStatusFilter(''); setModeFilter('') }} style={clearBtnStyle}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Loader2 className="animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          No research tasks yet. Type <code>/new-clients ...</code> or <code>/new-suppliers ...</code> in the AI Assistant chat.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>Mode</th>
                <th style={thStyle}>Brief</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Drafts</th>
                <th style={thStyle}>When</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr
                  key={t.id}
                  onClick={() => { setSelected(t); refreshSelected(t.id) }}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fafbfc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={tdStyle}><ModeBadge mode={t.mode} /></td>
                  <td style={{ ...tdStyle, maxWidth: 420 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.brief}</div>
                  </td>
                  <td style={tdStyle}><StatusPill status={t.status} /></td>
                  <td style={tdStyle}>
                    {t.status === 'completed'
                      ? `${t.draftsCreated}${t.duplicatesFound ? ` (+${t.duplicatesFound} dup)` : ''}`
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b', fontSize: 13 }}>
                    {relTime(t.completedAt || t.startedAt || t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div onClick={() => setSelected(null)} style={drawerOverlay}>
          <div onClick={e => e.stopPropagation()} style={drawerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <ModeBadge mode={selected.mode} />
                  <StatusPill status={selected.status} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Task <code>{selected.id.slice(0, 8)}</code> · started {relTime(selected.startedAt || selected.createdAt)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={iconBtnStyle}><X size={18} /></button>
            </div>

            <SectionLabel>Brief</SectionLabel>
            <p style={{ margin: '4px 0 16px', whiteSpace: 'pre-wrap' }}>{selected.brief}</p>

            {selected.summary && (
              <>
                <SectionLabel>Summary</SectionLabel>
                <p style={{ margin: '4px 0 16px', whiteSpace: 'pre-wrap', color: '#374151' }}>{selected.summary}</p>
              </>
            )}

            {selected.errorMessage && (
              <>
                <SectionLabel>Error</SectionLabel>
                <p style={{ margin: '4px 0 16px', color: '#dc2626' }}>{selected.errorMessage}</p>
              </>
            )}

            <SectionLabel>
              Findings · {selected.draftsCreated || 0} draft{selected.draftsCreated === 1 ? '' : 's'}
              {selected.duplicatesFound ? ` · ${selected.duplicatesFound} duplicate${selected.duplicatesFound === 1 ? '' : 's'}` : ''}
            </SectionLabel>
            {(selected.findings || []).length === 0 ? (
              <p style={{ margin: '4px 0', color: '#94a3b8' }}>No findings.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selected.findings.map((f, i) => (
                  <li
                    key={i}
                    onClick={() => jumpToDraft(f)}
                    style={{
                      padding: 12, borderBottom: '1px solid #f1f5f9',
                      cursor: f.draftId ? 'pointer' : 'default',
                      opacity: f.draftId ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{f.companyName}</strong>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{f.country || ''}</span>
                    </div>
                    {f.draftId && (
                      <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>
                        ✓ Draft created — click to review <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                      </div>
                    )}
                    {f.dedupedAgainst && (
                      <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 4 }}>
                        ↻ Already in {f.dedupedAgainst.type} ({f.dedupedAgainst.companyName})
                      </div>
                    )}
                    {f.skipped && (
                      <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>⨯ Skipped: {f.skipped}</div>
                    )}
                    {f.evidence && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{f.evidence}</div>
                    )}
                    {f.sourceUrl && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.sourceUrl}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {NON_TERMINAL.has(selected.status) && (
              <button onClick={() => handleCancel(selected.id)} style={cancelBtnStyle}>
                Cancel task
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16 }}>{children}</div>
}

const selectStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: 'white' }
const clearBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
const thStyle = { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#475569', letterSpacing: 0.3, textTransform: 'uppercase' }
const tdStyle = { padding: '12px', fontSize: 14, color: '#0f172a', verticalAlign: 'middle' }
const drawerOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex', justifyContent: 'flex-end', zIndex: 50,
}
const drawerStyle = {
  width: 'min(480px, 100vw)', height: '100vh', background: 'white',
  padding: 24, overflowY: 'auto', boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
}
const iconBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 4, color: '#64748b',
}
const cancelBtnStyle = {
  marginTop: 24, width: '100%', padding: '12px',
  background: '#fee2e2', color: '#9a2222', border: 'none', borderRadius: 8,
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
