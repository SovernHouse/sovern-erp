/**
 * AI Assistant Page
 * Full-context Claude assistant embedded in the ERP.
 * Super admin / admin get the same context as Cowork (company profile, ERP snapshot, team framework).
 * All roles get a role-scoped version.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { aiAPI, devModeAPI, researchAPI, customersAPI, factoriesAPI, productsAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Send, Plus, Trash2, MessageSquare, Bot, User,
  ChevronLeft, Loader2, Sparkles, X, Pencil, Check,
  Code, ExternalLink, AlertTriangle, CheckCircle2, XCircle, HelpCircle, GitPullRequest, StopCircle, Play,
} from 'lucide-react'

// Dev Mode (super_admin only) — toggle persisted across reloads
const DEV_MODE_KEY = 'sovern.ai.devModeOn'
const NON_TERMINAL_RUN = ['queued', 'running', 'opening_pr', 'awaiting_clarification']

// ─── Slash commands ───────────────────────────────────────────────────────────
// /new-clients <brief>   → start research task (mode: clients) — background
// /new-suppliers <brief> → start research task (mode: suppliers) — background
// /clients <query>       → search existing customers — instant
// /suppliers <query>     → search existing factories — instant
// /products <query>      → search existing products — instant

function parseSlashCommand(input) {
  const trimmed = (input || '').trim()
  if (!trimmed.startsWith('/')) return null
  const m = trimmed.match(/^\/(new-clients|new-suppliers|clients|suppliers|products)(?:\s+([\s\S]+))?$/i)
  if (!m) return null
  return { kind: m[1].toLowerCase(), arg: (m[2] || '').trim() }
}

async function runSlashCommand(slash, conversationId) {
  switch (slash.kind) {
    case 'new-clients':
    case 'new-suppliers': {
      if (!slash.arg || slash.arg.length < 5) {
        return `Need a brief — e.g. \`/${slash.kind} canadian brake-pad importers, mid-size\`. What country, product, and rough size are we looking for?`
      }
      const mode = slash.kind === 'new-clients' ? 'clients' : 'suppliers'
      const res = await researchAPI.startTask(mode, slash.arg, conversationId || undefined)
      const task = res.data?.data
      const what = mode === 'clients' ? 'client prospects' : 'suppliers'
      return `🔎 Researching new ${what}.\n\nBrief: "${slash.arg.slice(0, 200)}"\n\nThis runs in the background (5-15 min). I'll drop the results back here when done — push notification + email summary too. Track progress at **AI Assistant → Research** or cancel from the same screen.\n\nTask ID: \`${task ? task.id.slice(0, 8) : '—'}\``
    }
    case 'clients': {
      const arg = slash.arg.trim()
      const res = await customersAPI.getAll(arg ? { search: arg, page: 1 } : { page: 1 })
      const rows = res.data?.data ?? res.data?.items ?? []
      if (!rows.length) return arg ? `No customers match "${arg}".` : 'No customers found.'
      return rows.slice(0, 20).map(c =>
        `- **${c.companyName}**${c.country ? ` — ${c.country}` : ''}${c.email ? ` — ${c.email}` : ''}`
      ).join('\n')
    }
    case 'suppliers': {
      const arg = slash.arg.trim()
      const res = await factoriesAPI.getAll(arg ? { search: arg, page: 1, limit: 20 } : { page: 1, limit: 20 })
      const rows = res.data?.data ?? res.data?.items ?? []
      if (!rows.length) return arg ? `No suppliers match "${arg}".` : 'No suppliers found.'
      return rows.slice(0, 20).map(f =>
        `- **${f.companyName}**${f.country ? ` — ${f.country}` : ''}${f.specializations?.length ? ` (${f.specializations.slice(0, 3).join(', ')})` : ''}`
      ).join('\n')
    }
    case 'products': {
      const arg = slash.arg.trim()
      const res = await productsAPI.getAll(arg ? { search: arg, page: 1, limit: 20 } : { page: 1, limit: 20 })
      const rows = res.data?.data ?? res.data?.items ?? []
      if (!rows.length) return arg ? `No products match "${arg}".` : 'No products found.'
      return rows.slice(0, 20).map(p =>
        `- **${p.name || p.sku}**${p.sku ? ` (${p.sku})` : ''}${p.category?.name ? ` — ${p.category.name}` : ''}`
      ).join('\n')
    }
    default:
      return null
  }
}

// localStorage key for the last-active conversation id, so the user
// resumes their previous chat after closing/reopening the ERP instead
// of being dropped into an empty new-conversation state.
const ACTIVE_CONV_KEY = 'sovern.ai.activeConvId'

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Handles bold, code blocks, inline code, bullets, numbered lists, headers.

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  let keyIdx = 0

  function nextKey() { return `md-${keyIdx++}` }

  function inlineFormat(line) {
    // Bold **text** and inline `code`
    const parts = []
    let remaining = line
    let idx = 0

    while (remaining.length > 0) {
      const bold = remaining.indexOf('**')
      const code = remaining.indexOf('`')

      if (bold === -1 && code === -1) {
        parts.push(remaining)
        break
      }

      const nextBold = bold === -1 ? Infinity : bold
      const nextCode = code === -1 ? Infinity : code

      if (nextBold < nextCode) {
        parts.push(remaining.slice(0, nextBold))
        remaining = remaining.slice(nextBold + 2)
        const end = remaining.indexOf('**')
        if (end === -1) {
          parts.push(<strong key={idx++}>{remaining}</strong>)
          remaining = ''
        } else {
          parts.push(<strong key={idx++}>{remaining.slice(0, end)}</strong>)
          remaining = remaining.slice(end + 2)
        }
      } else {
        parts.push(remaining.slice(0, nextCode))
        remaining = remaining.slice(nextCode + 1)
        const end = remaining.indexOf('`')
        if (end === -1) {
          parts.push(<code key={idx++} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'monospace' }}>{remaining}</code>)
          remaining = ''
        } else {
          parts.push(<code key={idx++} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'monospace' }}>{remaining.slice(0, end)}</code>)
          remaining = remaining.slice(end + 1)
        }
      }
    }
    return parts
  }

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={nextKey()} style={{
          background: '#0f172a', color: '#e2e8f0', padding: '12px 16px',
          borderRadius: 8, overflowX: 'auto', fontSize: 13,
          fontFamily: 'monospace', margin: '8px 0', lineHeight: 1.5
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++
      continue
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h4 key={nextKey()} style={{ margin: '12px 0 4px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{inlineFormat(line.slice(4))}</h4>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={nextKey()} style={{ margin: '14px 0 6px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{inlineFormat(line.slice(3))}</h3>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={nextKey()} style={{ margin: '16px 0 8px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{inlineFormat(line.slice(2))}</h2>)
      i++; continue
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={nextKey()} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />)
      i++; continue
    }

    // Bullet list
    if (line.match(/^(\s*[-*+])\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^(\s*[-*+])\s/)) {
        items.push(<li key={i} style={{ marginBottom: 3 }}>{inlineFormat(lines[i].replace(/^\s*[-*+]\s/, ''))}</li>)
        i++
      }
      elements.push(<ul key={nextKey()} style={{ margin: '6px 0', paddingLeft: 22, lineHeight: 1.7 }}>{items}</ul>)
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(<li key={i} style={{ marginBottom: 3 }}>{inlineFormat(lines[i].replace(/^\d+\.\s/, ''))}</li>)
        i++
      }
      elements.push(<ol key={nextKey()} style={{ margin: '6px 0', paddingLeft: 22, lineHeight: 1.7 }}>{items}</ol>)
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={nextKey()} style={{ height: 8 }} />)
      i++; continue
    }

    // Regular paragraph
    elements.push(<p key={nextKey()} style={{ margin: '4px 0', lineHeight: 1.7 }}>{inlineFormat(line)}</p>)
    i++
  }

  return elements
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'

  // Dev-mode user prompts get a Code badge so it's visually obvious which
  // turns spawned a dev run.
  const isDevModeUser = isUser && msg.devMode

  // Dev-mode run cards have their own component
  if (msg.kind === 'devRun') {
    return <DevRunCard runId={msg.runId} createdAt={msg.createdAt} />
  }

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      flexDirection: isUser ? 'row-reverse' : 'row',
      margin: '12px 0',
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? (isDevModeUser ? '#0f172a' : '#2563eb') : '#0f172a',
        color: '#fff',
      }}>
        {isDevModeUser ? <Code size={15} /> : isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '75%',
        background: isUser ? (isDevModeUser ? '#0f172a' : '#2563eb') : '#fff',
        color: isUser ? '#fff' : '#1e293b',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: isUser ? 'none' : '1px solid #e2e8f0',
      }}>
        {isDevModeUser && (
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginBottom: 4, letterSpacing: 0.6 }}>DEV MODE</div>
        )}
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
          : renderMarkdown(msg.content)
        }
        {msg.createdAt && (
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, textAlign: isUser ? 'left' : 'right' }}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dev Run Card ──────────────────────────────────────────────────────────────
// Live-status card for an in-flight dev-mode run. Polls every 4s while
// the run is non-terminal; renders final state + PR link when done.

function DevRunCard({ runId, createdAt }) {
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await devModeAPI.getRun(runId)
      if (res.data?.data) setRun(res.data.data)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }, [runId])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!run) return
    if (!NON_TERMINAL_RUN.includes(run.status)) return
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [run, refresh])

  async function submitAnswer() {
    if (!answer.trim()) return
    setSubmitting(true)
    try {
      await devModeAPI.answerClarification(runId, answer.trim())
      setAnswer('')
      await refresh()
      toast.success('Answer submitted; AI is resuming.')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  const meta = run ? statusMetaInline(run.status) : { color: '#64748b', bg: '#f1f5f9', label: 'Loading' }
  const Icon = meta.icon || Loader2

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '12px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', color: '#fff',
      }}>
        <Code size={15} />
      </div>
      <div style={{
        maxWidth: '85%',
        background: '#fff',
        color: '#1e293b',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 14px',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        minWidth: 280,
      }}>
        {error && <div style={{ color: '#991b1b' }}>⚠️ {error}</div>}
        {!error && !run && <div style={{ color: '#64748b' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 6 }} /> Starting dev-mode run...</div>}
        {run && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: meta.bg, color: meta.color, fontWeight: 600, fontSize: 11,
                padding: '3px 8px', borderRadius: 99,
              }}>
                <Icon size={11} style={meta.spin ? { animation: 'spin 1s linear infinite' } : {}} />
                {meta.label}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>turn {run.turnCount || 0}/{run.maxTurns || 30}</span>
            </div>
            {run.branchName && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                branch: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>{run.branchName}</code>
              </div>
            )}
            {run.linesAdded > 0 || run.linesDeleted > 0 ? (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>diff: +{run.linesAdded || 0} / -{run.linesDeleted || 0} across {run.filesChanged?.length || 0} files</div>
            ) : null}
            {run.errorMessage && (
              <div style={{ fontSize: 12, color: '#991b1b', background: '#fef2f2', padding: 8, borderRadius: 6, marginTop: 6 }}>
                {run.errorMessage}
              </div>
            )}
            {run.status === 'awaiting_clarification' && run.clarificationQuestion && (
              <div style={{ marginTop: 8, padding: 10, background: '#fef3c7', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#854d0e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>AI is asking</div>
                <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#854d0e' }}>{run.clarificationQuestion}</pre>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Your answer..."
                  rows={2}
                  style={{ width: '100%', marginTop: 6, padding: 6, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}
                />
                <button
                  onClick={submitAnswer}
                  disabled={submitting || !answer.trim()}
                  style={{
                    marginTop: 6, background: '#0f172a', color: '#fff',
                    border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    cursor: submitting || !answer.trim() ? 'default' : 'pointer',
                    opacity: submitting || !answer.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> : 'Submit'}
                </button>
              </div>
            )}
            {run.prUrl && (
              <a href={run.prUrl} target="_blank" rel="noreferrer" style={{
                marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#0f172a', color: '#fff', padding: '6px 12px',
                borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}>
                <GitPullRequest size={12} /> Review PR #{run.prNumber || '?'} <ExternalLink size={11} />
              </a>
            )}
          </>
        )}
        {createdAt && (
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, textAlign: 'right' }}>
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}

function statusMetaInline(status) {
  switch (status) {
    case 'queued':                 return { icon: Play,         color: '#64748b', bg: '#f1f5f9', label: 'Queued' }
    case 'running':                return { icon: Loader2,      color: '#2563eb', bg: '#eff6ff', label: 'Running',          spin: true }
    case 'opening_pr':             return { icon: GitPullRequest,color: '#7c3aed', bg: '#f5f3ff', label: 'Opening PR' }
    case 'awaiting_clarification': return { icon: HelpCircle,   color: '#d97706', bg: '#fef3c7', label: 'Awaiting answer' }
    case 'completed':              return { icon: CheckCircle2, color: '#059669', bg: '#ecfdf5', label: 'Completed' }
    case 'wip':                    return { icon: AlertTriangle,color: '#d97706', bg: '#fef3c7', label: 'WIP' }
    case 'failed':                 return { icon: XCircle,      color: '#dc2626', bg: '#fee2e2', label: 'Failed' }
    case 'aborted':                return { icon: StopCircle,   color: '#475569', bg: '#f1f5f9', label: 'Aborted' }
    default:                       return { icon: Loader2,      color: '#64748b', bg: '#f1f5f9', label: status }
  }
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '12px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', color: '#fff',
      }}>
        <Bot size={15} />
      </div>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {[0, 1, 2].map(d => (
          <div key={d} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#94a3b8',
            animation: 'bounce 1.2s infinite',
            animationDelay: `${d * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Conversation sidebar item ─────────────────────────────────────────────────

function ConvItem({ conv, active, onClick, onDelete, onRename }) {
  const [hovering, setHovering] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(conv.title || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      // Select all text on edit so the user can either replace or extend
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // If the title changes externally (e.g. server-generated title arrives
  // after first send) and we're not actively editing, sync the draft.
  useEffect(() => {
    if (!editing) setDraftTitle(conv.title || '')
  }, [conv.title, editing])

  function startEdit(e) {
    e.stopPropagation()
    setDraftTitle(conv.title || '')
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== conv.title) {
      onRename(conv.id, trimmed)
    }
    setEditing(false)
  }

  function cancelEdit() {
    setDraftTitle(conv.title || '')
    setEditing(false)
  }

  return (
    <div
      onClick={editing ? undefined : onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8, cursor: editing ? 'text' : 'pointer',
        background: active ? '#eff6ff' : hovering ? '#f8fafc' : 'transparent',
        border: active ? '1px solid #bfdbfe' : '1px solid transparent',
        transition: 'all 0.1s',
        position: 'relative',
      }}
    >
      <MessageSquare size={14} color={active ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
              else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
            }}
            onBlur={commitEdit}
            maxLength={200}
            style={{
              width: '100%', fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? '#1e40af' : '#1e293b',
              border: '1px solid #2563eb', borderRadius: 4,
              padding: '2px 6px', outline: 'none', background: '#fff',
            }}
          />
        ) : (
          <div style={{
            fontSize: 13, fontWeight: active ? 600 : 400,
            color: active ? '#1e40af' : '#1e293b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {conv.title || 'New conversation'}
          </div>
        )}
        {conv.lastMessageAt && !editing && (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatRelative(conv.lastMessageAt)}
          </div>
        )}
      </div>
      {hovering && !editing && (
        <>
          <button
            onClick={startEdit}
            title="Rename"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b', flexShrink: 0 }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
            title="Delete"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444', flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </>
      )}
      {editing && (
        <button
          onClick={e => { e.stopPropagation(); commitEdit() }}
          title="Save"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#16a34a', flexShrink: 0 }}
        >
          <Check size={13} />
        </button>
      )}
    </div>
  )
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diffMs = Date.now() - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Dev Mode: super_admin-only toggle. When ON, the input spawns a
  // sandboxed dev-mode AI run instead of the regular chat reply.
  const [devMode, setDevMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DEV_MODE_KEY) === '1'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEV_MODE_KEY, devMode ? '1' : '0')
    }
  }, [devMode])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load conversation list on mount, then auto-restore the last-active
  // conversation (or fall back to the most recent) so the user picks up
  // where they left off instead of starting fresh on every reload.
  useEffect(() => {
    (async () => {
      const loaded = await loadConversations()
      const stored = localStorage.getItem(ACTIVE_CONV_KEY)
      const target = stored && loaded.find(c => c.id === stored)
        ? stored
        : (loaded[0]?.id || null)
      if (target) loadConversation(target)
    })()
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Persist the active conversation id so it survives ERP close/reopen
  useEffect(() => {
    if (activeConvId) localStorage.setItem(ACTIVE_CONV_KEY, activeConvId)
    else localStorage.removeItem(ACTIVE_CONV_KEY)
  }, [activeConvId])

  async function loadConversations() {
    try {
      const res = await aiAPI.listConversations()
      const list = res.data || []
      setConversations(list)
      return list
    } catch (err) {
      // Non-fatal — may just not have any conversations yet
      return []
    }
  }

  async function loadConversation(id) {
    setLoadingConv(true)
    try {
      const res = await aiAPI.getConversation(id)
      const conv = res.data
      setActiveConvId(conv.conversation?.id || conv.id)
      setMessages(conv.messages || [])
    } catch (err) {
      toast.error('Failed to load conversation')
    } finally {
      setLoadingConv(false)
    }
  }

  function startNew() {
    setActiveConvId(null)
    setMessages([])
    inputRef.current?.focus()
  }

  async function handleRename(id, newTitle) {
    const trimmed = (newTitle || '').trim()
    if (!trimmed) return
    // Optimistic update
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c))
    try {
      await aiAPI.renameConversation(id, trimmed)
    } catch (err) {
      toast.error('Failed to rename conversation')
      // Revert by reloading list
      loadConversations()
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    // Slash-command branch: intercept /new-clients, /new-suppliers (Tier 2
    // background research), and /clients, /suppliers, /products (instant
    // ERP lookups). Handled client-side so the AI never sees them and the
    // routing is predictable.
    const slash = parseSlashCommand(text)
    if (slash) {
      setInput('')
      setSending(true)
      setMessages(prev => [...prev, { role: 'user', content: text, createdAt: new Date().toISOString() }])
      try {
        const reply = await runSlashCommand(slash, activeConvId)
        setMessages(prev => [...prev, { role: 'assistant', content: reply, createdAt: new Date().toISOString() }])
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Slash command failed.'
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + msg, createdAt: new Date().toISOString() }])
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
      return
    }

    // Dev Mode branch: spawn a sandboxed AI code-change run, push a
    // live-status card into the chat, no /ai/chat call. Only available
    // to super_admin.
    if (devMode && isSuperAdmin) {
      setInput('')
      setSending(true)
      setMessages(prev => [...prev, {
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        devMode: true,
      }])
      try {
        const res = await devModeAPI.startRun(text)
        const run = res.data?.data
        if (run) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            kind: 'devRun',
            runId: run.id,
            content: '',
            createdAt: new Date().toISOString(),
          }])
        }
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Failed to start dev-mode run'
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ ' + msg,
          createdAt: new Date().toISOString(),
        }])
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
      return
    }

    setInput('')
    setSending(true)

    // Optimistically show user message
    const optimisticUser = { role: 'user', content: text, createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, optimisticUser])

    try {
      const res = await aiAPI.chat({ message: text, conversationId: activeConvId })
      const { conversationId, title, reply, isNew } = res.data

      // Update messages with real timestamps (server echoes back)
      setMessages(prev => {
        const withoutOptimistic = prev.slice(0, -1) // remove the optimistic
        return [
          ...withoutOptimistic,
          { role: 'user', content: text, createdAt: new Date().toISOString() },
          { role: 'assistant', content: reply, createdAt: new Date().toISOString() },
        ]
      })

      // Update or add conversation in sidebar
      if (isNew) {
        setActiveConvId(conversationId)
        setConversations(prev => [{
          id: conversationId,
          title,
          lastMessageAt: new Date().toISOString(),
        }, ...prev])
      } else {
        setConversations(prev => prev.map(c =>
          c.id === conversationId
            ? { ...c, title, lastMessageAt: new Date().toISOString() }
            : c
        ))
      }
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1))
      const msg = err.response?.data?.error || 'Failed to get a response'
      toast.error(msg)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function handleDelete(id) {
    try {
      await aiAPI.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) {
        // Clear the deleted active id from localStorage so the next
        // mount doesn't try to restore a 404'd conversation.
        localStorage.removeItem(ACTIVE_CONV_KEY)
        setActiveConvId(null)
        setMessages([])
      }
    } catch {
      toast.error('Failed to delete conversation')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .ai-input:focus { outline: none; }
      `}</style>

      <div style={{
        display: 'flex', height: 'calc(100vh - 60px)',
        background: '#f8fafc', overflow: 'hidden',
      }}>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div style={{
            width: 260, flexShrink: 0,
            background: '#fff', borderRight: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Sidebar header */}
            <div style={{
              padding: '16px 14px 12px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Sparkles size={16} color="#2563eb" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>
                AI Assistant
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* New conversation button */}
            <div style={{ padding: '10px 12px' }}>
              <button
                onClick={startNew}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 600, fontSize: 13,
                }}
              >
                <Plus size={14} />
                New conversation
              </button>
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 13 }}>
                  No conversations yet.<br />Start one below.
                </div>
              ) : conversations.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConvId}
                  onClick={() => loadConversation(conv.id)}
                  onDelete={handleDelete}
                  onRename={handleRename}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Main chat area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Chat header */}
          <div style={{
            height: 52, flexShrink: 0,
            background: '#fff', borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
          }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
              >
                <MessageSquare size={18} />
              </button>
            )}
            <Bot size={18} color={devMode ? '#0f172a' : '#2563eb'} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>
              {activeConvId
                ? (conversations.find(c => c.id === activeConvId)?.title || 'Conversation')
                : 'Sovern House AI Assistant'}
            </span>
            <span style={{
              fontSize: 11, background: '#eff6ff', color: '#2563eb',
              padding: '2px 8px', borderRadius: 99, fontWeight: 500, marginLeft: 4,
            }}>
              Full context
            </span>

            <span style={{ flex: 1 }} />

            {/* Dev Mode toggle (super_admin only) */}
            {isSuperAdmin && (
              <button
                onClick={() => setDevMode(v => !v)}
                title={devMode
                  ? 'Dev Mode is ON — your next message will spawn a sandboxed code-change AI run'
                  : 'Switch on Dev Mode for code changes (super_admin only). PR-based, runs in a sandboxed worktree on the VM.'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: devMode ? '#0f172a' : '#fff',
                  color: devMode ? '#fff' : '#475569',
                  border: '1px solid ' + (devMode ? '#0f172a' : '#e2e8f0'),
                  borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Code size={13} />
                Dev Mode {devMode ? 'ON' : 'OFF'}
              </button>
            )}
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px 24px',
          }}>
            {loadingConv ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                <Loader2 size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite', display: 'block' }} />
                Loading...
              </div>
            ) : messages.length === 0 ? (
              <WelcomeScreen onSuggest={(text) => { setInput(text); inputRef.current?.focus() }} />
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble key={idx} msg={msg} />
                ))}
                {sending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div style={{
            flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e8f0',
            padding: '12px 16px',
          }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '8px 12px',
              transition: 'border-color 0.15s',
            }}>
              <textarea
                ref={inputRef}
                className="ai-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={devMode && isSuperAdmin
                  ? 'Describe a code change. The dev agent will edit the repo, commit, and open a PR...'
                  : 'Ask anything about the business, get email drafts, analyse data...'}
                rows={1}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 14, color: '#1e293b', resize: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  background: input.trim() && !sending ? '#2563eb' : '#e2e8f0',
                  color: input.trim() && !sending ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: 8,
                  width: 34, height: 34, cursor: input.trim() && !sending ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                {sending
                  ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={16} />
                }
              </button>
            </div>
            <div style={{ fontSize: 11, color: devMode && isSuperAdmin ? '#0f172a' : '#94a3b8', marginTop: 6, textAlign: 'center' }}>
              {devMode && isSuperAdmin
                ? <><Code size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Dev Mode: next message spawns a sandboxed code-change AI. Up to 30 min, max 5/24h. PR opens for your review.</>
                : 'Enter to send, Shift+Enter for new line. Powered by Claude (Max subscription).'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function WelcomeScreen({ onSuggest }) {
  const suggestions = [
    'Summarise the current lead pipeline and flag anything urgent',
    'Draft a follow-up email to a buyer who requested a flooring quotation',
    'What are the correct Incoterms for a CIF shipment to Rotterdam?',
    'Calculate the landed cost for a 20ft FCL of LVT from Malaysia to Los Angeles',
    'What triage items are waiting for action?',
    'Review the Egypt auto parts pipeline and suggest next steps',
  ]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Sparkles size={24} color="#fff" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
          Sovern House AI Assistant
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Your full executive team, embedded in the ERP. Access live data, draft communications,
          analyse deals, and get compliance-aware advice.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggest(s)}
            style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
              fontSize: 13, color: '#374151', lineHeight: 1.5,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff' }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
