/**
 * AI Assistant Page
 * Full-context Claude assistant embedded in the ERP.
 * Super admin / admin get the same context as Cowork (company profile, ERP snapshot, team framework).
 * All roles get a role-scoped version.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { aiAPI, devModeAPI, researchAPI, customersAPI, factoriesAPI, productsAPI, expensesAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Send, Plus, Trash2, MessageSquare, Bot, User,
  ChevronLeft, Loader2, Sparkles, X, Pencil, Check,
  Code, ExternalLink, AlertTriangle, CheckCircle2, XCircle, HelpCircle, GitPullRequest, StopCircle, Play,
  Mic, MicOff, Paperclip, FileText, Image as ImageIcon,
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

const SLASH_COMMANDS = [
  { name: 'new-clients',    args: '<brief>',                      desc: 'Source NEW client prospects (background research, 5-15 min)' },
  { name: 'new-suppliers',  args: '<brief>',                      desc: 'Source NEW factories (background research, 5-15 min)' },
  { name: 'clients',        args: '<query>',                      desc: 'Search existing customers' },
  { name: 'suppliers',      args: '<query>',                      desc: 'Search existing factories' },
  { name: 'products',       args: '<query>',                      desc: 'Search existing products' },
  { name: 'expense',        args: '<amount> <ccy> <description>', desc: 'Quick-log an expense (e.g. /expense 142 TWD taxi from airport)' },
  { name: 'expenses',       args: '[unpaid|all]',                 desc: 'List recent expenses (default: unpaid only)' },
  { name: 'expense-report', args: '<office-code>',                desc: 'Bundle all draft expenses for an office into a report (XLSX in Drive)' },
]

// Returns the suggested commands for the current input, OR null when the
// autocomplete should be hidden (no leading slash, or already past the
// command into the argument).
function suggestSlashCommands(input) {
  if (!input || !input.startsWith('/')) return null
  if (input.includes(' ')) return null  // user is past the command into the arg
  const prefix = input.slice(1).toLowerCase()
  return SLASH_COMMANDS.filter(c => c.name.startsWith(prefix))
}

function parseSlashCommand(input) {
  const trimmed = (input || '').trim()
  if (!trimmed.startsWith('/')) return null
  // Order matters: longer keywords first so /expense-report doesn't match /expense.
  const m = trimmed.match(/^\/(new-clients|new-suppliers|clients|suppliers|products|expense-report|expenses|expense)(?:\s+([\s\S]+))?$/i)
  if (!m) return null
  return { kind: m[1].toLowerCase(), arg: (m[2] || '').trim() }
}

// "142 TWD taxi from airport" → { amount, currency, description }
function parseExpenseArgs(arg) {
  const cleaned = String(arg || '').replace(/^[$¥₫฿]|NT\$/gi, '').trim()
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s+(\S+)\s+(.*)$/)
  if (m) return { amount: Number(m[1]), currency: m[2].toUpperCase().slice(0, 3), description: m[3].trim() }
  const m2 = cleaned.match(/^(\d+(?:\.\d+)?)\s+(.*)$/)
  if (m2) return { amount: Number(m2[1]), currency: 'USD', description: m2[2].trim() }
  return { amount: null, currency: 'USD', description: arg }
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

    case 'expense': {
      if (!slash.arg) {
        return 'Need an amount + currency + description — e.g. `/expense 142 TWD taxi from airport for LAU trip`.'
      }
      const { amount, currency, description } = parseExpenseArgs(slash.arg)
      if (amount == null) {
        return 'Could not parse the amount. Format: `/expense <amount> <currency> <description>`. Example: `/expense 580 USD hotel at LAU`.'
      }
      const res = await expensesAPI.create({
        category: 'Other',
        description,
        originalCurrency: currency,
        originalAmount: amount,
        submissionStatus: 'draft',
      })
      const e = res.data?.data
      return `✓ Logged: **${currency} ${amount.toLocaleString()}** — ${description}\n\nStatus: draft. Open the Expenses page to attach a receipt or assign to a customer/office. ID: \`${e?.id?.slice(0, 8)}\``
    }

    case 'expenses': {
      const arg = slash.arg.trim().toLowerCase()
      const params = arg === 'all' ? { limit: 20 } : { paid: false, limit: 20 }
      const res = await expensesAPI.list(params)
      const rows = res.data?.data || []
      if (!rows.length) return arg === 'all' ? 'No expenses found.' : 'No unpaid expenses. 🎉'
      const lines = rows.map(e =>
        `- ${e.entryDate} · **${e.originalCurrency} ${Number(e.originalAmount).toLocaleString()}** — ${e.description || e.category}` +
        (e.submissionStatus !== 'draft' ? ` _(${e.submissionStatus})_` : ''),
      )
      return `${arg === 'all' ? 'All' : 'Unpaid'} expenses (last ${rows.length}):\n${lines.join('\n')}`
    }

    case 'expense-report': {
      const officeArg = slash.arg.trim()
      if (!officeArg) return 'Specify an office code — e.g. `/expense-report SOVERN_TW`. Run `/expenses` first to see what\'s pending.'
      const officesRes = await expensesAPI.listOffices()
      const offices = officesRes.data?.data || []
      const office = offices.find(o =>
        o.code?.toLowerCase() === officeArg.toLowerCase() ||
        o.displayName?.toLowerCase() === officeArg.toLowerCase(),
      )
      if (!office) {
        const list = offices.map(o => `${o.code} (${o.displayName})`).join(', ') || 'none registered yet'
        return `No office matches "${officeArg}". Available: ${list}.`
      }
      if (!office.exportTemplateKey) {
        return `Office **${office.code}** has no export template set. PATCH /api/expense-offices/${office.id} with one of: \`expense_to_alex_v2\`, \`inspector_travel_v2\`, \`custom_csv\`.`
      }
      const subRes = await expensesAPI.createSubmission({ officeId: office.id })
      const sub = subRes.data?.data
      const repRes = await expensesAPI.generateReport(sub.id)
      const file = repRes.data?.data?.driveFile
      return `📑 Report generated for **${office.code}** using \`${repRes.data?.data?.templateKey}\`.\n\n${file?.webViewLink ? `[Open in Drive](${file.webViewLink})` : `Drive file ID: \`${file?.id}\``}`
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

// Memoised so re-renders of the parent (each new streaming message append)
// don't re-render existing bubbles. Without this, every append re-runs
// renderMarkdown for every visible reply, which re-creates the DOM nodes
// underneath any in-progress text selection — killing copy/paste mid-drag.
const MessageBubble = React.memo(function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  // Dev-mode user prompts get a Code badge so it's visually obvious which
  // turns spawned a dev run.
  const isDevModeUser = isUser && msg.devMode

  // Dev-mode run cards have their own component
  if (msg.kind === 'devRun') {
    return <DevRunCard runId={msg.runId} createdAt={msg.createdAt} />
  }

  function copyContent() {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(msg.content || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
        margin: '12px 0',
        position: 'relative',
      }}
    >
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
        position: 'relative',
      }}>
        {isDevModeUser && (
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginBottom: 4, letterSpacing: 0.6 }}>DEV MODE</div>
        )}
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
          : renderMarkdown(msg.content)
        }
        {/* Attachments rendered below the message content. Image
            attachments show inline thumbnails (Drive thumbnailLink works
            without authentication for files the user has access to);
            non-image attachments show a file chip with the name. */}
        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {msg.attachments.map(a => {
              const isImg = a.mimeType?.startsWith('image/')
              const link = a.webViewLink || (a.driveFileId ? `https://drive.google.com/file/d/${a.driveFileId}/view` : null)
              return isImg && a.thumbnailUrl ? (
                <a
                  key={a.driveFileId}
                  href={link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={a.name}
                  style={{ display: 'block', borderRadius: 6, overflow: 'hidden' }}
                >
                  <img
                    src={a.thumbnailUrl}
                    alt={a.name}
                    style={{ maxWidth: 120, maxHeight: 120, display: 'block', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                </a>
              ) : (
                <a
                  key={a.driveFileId}
                  href={link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: isUser ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
                    color: isUser ? '#fff' : '#475569',
                    padding: '4px 10px', borderRadius: 6, fontSize: 12,
                    textDecoration: 'none', maxWidth: 220,
                  }}
                >
                  {isImg ? <ImageIcon size={12} /> : <FileText size={12} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                </a>
              )
            })}
          </div>
        )}
        {msg.createdAt && (
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, textAlign: isUser ? 'left' : 'right' }}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Copy-on-hover button. Visible only on assistant replies (no point
            for user messages that the user just typed). */}
        {!isUser && hovered && msg.content && (
          <button
            onClick={copyContent}
            title="Copy reply"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              border: '1px solid #e2e8f0',
              background: copied ? '#dcfce7' : '#f8fafc',
              color: copied ? '#166534' : '#475569',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}, (prev, next) => (
  // Re-render only when the message itself changes. Identity by createdAt+role+content
  // is sufficient — those are the only fields the bubble visualises.
  prev.msg === next.msg ||
  (prev.msg?.createdAt === next.msg?.createdAt &&
   prev.msg?.role === next.msg?.role &&
   prev.msg?.content === next.msg?.content &&
   prev.msg?.kind === next.msg?.kind)
))

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

  // ── Voice input (item 2) ─────────────────────────────────────────────────
  // Browser SpeechRecognition. Click 🎙️ to toggle; transcript fills the input
  // and Alex tap sends manually (DECIDE 2B). Multi-language autodetect via
  // sequential restart fallback (Web Speech API doesn't support real autodetect
  // — we just default to en-US which is permissive of common ZH proper nouns).
  const recognitionRef = useRef(null)
  const inputAtRecordStart = useRef('')
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const SpeechRecognitionClass = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  function toggleRecording() {
    if (!SpeechRecognitionClass) {
      setVoiceError('Voice input not supported in this browser. Use Chrome, Edge, or Safari.')
      return
    }
    if (recording) {
      try { recognitionRef.current?.stop() } catch (_) {}
      setRecording(false)
      return
    }
    setVoiceError(null)
    inputAtRecordStart.current = input
    const recog = new SpeechRecognitionClass()
    recog.lang = 'en-US'
    recog.continuous = true
    recog.interimResults = true
    recog.maxAlternatives = 1
    let finalText = ''
    recog.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      const live = (finalText + interim).trim()
      const snapshot = inputAtRecordStart.current
      setInput(snapshot ? `${snapshot} ${live}`.trim() : live)
    }
    recog.onerror = (e) => {
      setVoiceError(e.error || 'recognition error')
      setRecording(false)
    }
    recog.onend = () => setRecording(false)
    try {
      recog.start()
      recognitionRef.current = recog
      setRecording(true)
    } catch (err) {
      setVoiceError(err.message || 'could not start recording')
      setRecording(false)
    }
  }

  // Stop recognition if the user navigates away.
  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch (_) {}
  }, [])

  // ── Attachments (item 3) ─────────────────────────────────────────────────
  // Files the user has picked but not yet sent. Each rendered as a chip
  // above the textarea. On send the array is included in the chat call
  // and cleared. Supports the file picker (click 📎) AND drag-and-drop
  // anywhere in the input area.
  const [pendingAttachments, setPendingAttachments] = useState([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [attachmentError, setAttachmentError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  async function uploadFiles(files) {
    if (!files || files.length === 0) return
    if (pendingAttachments.length + files.length > 5) {
      setAttachmentError('Max 5 attachments per message. Send these first.')
      return
    }
    setAttachmentError(null)
    for (const f of files) {
      setUploadingCount(c => c + 1)
      try {
        const res = await aiAPI.uploadAttachment(f)
        const att = res.data?.data
        if (att) setPendingAttachments(prev => [...prev, att])
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Upload failed'
        setAttachmentError(`${f.name}: ${msg}`)
      } finally {
        setUploadingCount(c => Math.max(0, c - 1))
      }
    }
  }

  function onFileInputChange(e) {
    const files = Array.from(e.target.files || [])
    uploadFiles(files)
    e.target.value = '' // reset so picking the same file again still triggers change
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer?.files || [])
    uploadFiles(files)
  }

  function removePendingAttachment(driveFileId) {
    setPendingAttachments(prev => prev.filter(a => a.driveFileId !== driveFileId))
  }

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

    // Snapshot attachments for this send so the next message starts clean.
    const attachmentsForSend = pendingAttachments
    setPendingAttachments([])

    // Optimistically show user message
    const optimisticUser = {
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      ...(attachmentsForSend.length > 0 ? { attachments: attachmentsForSend } : {}),
    }
    setMessages(prev => [...prev, optimisticUser])

    try {
      const res = await aiAPI.chat({
        message: text,
        conversationId: activeConvId,
        ...(attachmentsForSend.length > 0 ? { attachments: attachmentsForSend } : {}),
      })
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

  // Slash autocomplete navigation: when suggestions are visible, intercept
  // ArrowUp/Down to move highlight, Tab/Enter to insert, Esc to dismiss.
  // Falls through to the default Enter→send handler when no suggestions.
  const [slashHighlight, setSlashHighlight] = useState(0)
  const slashSuggestions = suggestSlashCommands(input)
  const slashOpen = !!slashSuggestions && slashSuggestions.length > 0
  // Reset highlight when the suggestion list changes shape so it never
  // points past the end.
  useEffect(() => {
    if (slashOpen && slashHighlight >= slashSuggestions.length) setSlashHighlight(0)
  }, [slashOpen, slashSuggestions, slashHighlight])

  function insertSlash(name) {
    setInput('/' + name + ' ')
    setSlashHighlight(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashHighlight(h => (h + 1) % slashSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashHighlight(h => (h - 1 + slashSuggestions.length) % slashSuggestions.length)
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        insertSlash(slashSuggestions[slashHighlight].name)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setInput('')
        return
      }
    }
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
                  // STABLE keys based on createdAt+role so React doesn't tear
                  // down existing bubbles on each new append. Index keys would
                  // re-mount every visible bubble on every chat update, which
                  // kills any in-progress text selection.
                  <MessageBubble key={`${msg.createdAt}-${msg.role}-${idx}`} msg={msg} />
                ))}
                {sending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e8f0',
              padding: '12px 16px',
              position: 'relative',
              outline: dragOver ? '2px dashed #2563eb' : 'none',
              outlineOffset: -4,
              transition: 'outline-color 0.15s',
            }}
          >
            {/* Pending attachments — chips above the input. */}
            {(pendingAttachments.length > 0 || uploadingCount > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {pendingAttachments.map(a => (
                  <div key={a.driveFileId} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#f1f5f9', border: '1px solid #cbd5e1',
                    borderRadius: 999, padding: '4px 4px 4px 10px', fontSize: 12,
                    maxWidth: 220,
                  }}>
                    {a.mimeType?.startsWith('image/') ? <ImageIcon size={12} /> : <FileText size={12} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <button
                      onClick={() => removePendingAttachment(a.driveFileId)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {uploadingCount > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#f1f5f9', borderRadius: 999, padding: '4px 10px', fontSize: 12, color: '#64748b',
                  }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    uploading…
                  </div>
                )}
              </div>
            )}
            {attachmentError && (
              <div style={{
                background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>⚠️ {attachmentError}</span>
                <button
                  onClick={() => setAttachmentError(null)}
                  style={{ background: 'none', border: 'none', color: '#7f1d1d', cursor: 'pointer', fontSize: 14 }}
                >×</button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
              multiple
              onChange={onFileInputChange}
              style={{ display: 'none' }}
            />
            {/* Slash command autocomplete — appears as a floating panel
                anchored above the textarea when input starts with '/' and
                hasn't yet been completed by a space. ArrowUp/Down navigates,
                Tab/Enter inserts, Esc clears. */}
            {slashOpen && (
              <div style={{
                position: 'absolute',
                left: 16, right: 16, bottom: 'calc(100% - 8px)',
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
                maxHeight: 240, overflowY: 'auto',
                padding: 4,
              }}>
                {slashSuggestions.map((c, i) => (
                  <div
                    key={c.name}
                    onClick={() => insertSlash(c.name)}
                    onMouseEnter={() => setSlashHighlight(i)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: i === slashHighlight ? '#eff6ff' : 'transparent',
                      display: 'flex', alignItems: 'baseline', gap: 10,
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1d5a32' }}>
                      /{c.name}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                      {c.args}
                    </span>
                    <span style={{ fontSize: 12, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.desc}
                    </span>
                  </div>
                ))}
                <div style={{
                  borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4,
                  fontSize: 11, color: '#94a3b8', padding: '6px 10px',
                }}>
                  ↑↓ to navigate · Tab/Enter to insert · Esc to clear
                </div>
              </div>
            )}
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
                  : recording ? 'Listening… click 🎙️ again to stop'
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
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploadingCount > 0}
                title="Attach file"
                style={{
                  background: '#fff',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  width: 34, height: 34,
                  cursor: sending ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                <Paperclip size={16} />
              </button>
              {SpeechRecognitionClass && (
                <button
                  onClick={toggleRecording}
                  disabled={sending}
                  title={recording ? 'Stop recording' : 'Voice input'}
                  style={{
                    background: recording ? '#fee2e2' : '#fff',
                    color: recording ? '#dc2626' : '#475569',
                    border: `1px solid ${recording ? '#fecaca' : '#e2e8f0'}`,
                    borderRadius: 8,
                    width: 34, height: 34,
                    cursor: sending ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  {recording ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
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
            {voiceError && (
              <div style={{
                background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, marginTop: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>⚠️ {voiceError}</span>
                <button
                  onClick={() => setVoiceError(null)}
                  style={{ background: 'none', border: 'none', color: '#7f1d1d', cursor: 'pointer', fontSize: 14 }}
                >×</button>
              </div>
            )}
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
