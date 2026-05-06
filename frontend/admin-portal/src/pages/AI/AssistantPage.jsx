/**
 * AI Assistant Page
 * Full-context Claude assistant embedded in the ERP.
 * Super admin / admin get the same context as Cowork (company profile, ERP snapshot, team framework).
 * All roles get a role-scoped version.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { aiAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Send, Plus, Trash2, MessageSquare, Bot, User,
  ChevronLeft, Loader2, Sparkles, X
} from 'lucide-react'

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
        background: isUser ? '#2563eb' : '#0f172a',
        color: '#fff',
      }}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '75%',
        background: isUser ? '#2563eb' : '#fff',
        color: isUser ? '#fff' : '#1e293b',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: isUser ? 'none' : '1px solid #e2e8f0',
      }}>
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

function ConvItem({ conv, active, onClick, onDelete }) {
  const [hovering, setHovering] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
        background: active ? '#eff6ff' : hovering ? '#f8fafc' : 'transparent',
        border: active ? '1px solid #bfdbfe' : '1px solid transparent',
        transition: 'all 0.1s',
        position: 'relative',
      }}
    >
      <MessageSquare size={14} color={active ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: active ? 600 : 400,
          color: active ? '#1e40af' : '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {conv.title || 'New conversation'}
        </div>
        {conv.lastMessageAt && (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatRelative(conv.lastMessageAt)}
          </div>
        )}
      </div>
      {hovering && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444', flexShrink: 0 }}
        >
          <X size={13} />
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
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load conversation list on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function loadConversations() {
    try {
      const res = await aiAPI.listConversations()
      setConversations(res.data || [])
    } catch (err) {
      // Non-fatal — may just not have any conversations yet
    }
  }

  async function loadConversation(id) {
    setLoadingConv(true)
    try {
      const res = await aiAPI.getConversation(id)
      const conv = res.data
      setActiveConvId(conv.id)
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

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

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
            <Bot size={18} color="#2563eb" />
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
                placeholder="Ask anything about the business, get email drafts, analyse data..."
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
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
              Enter to send, Shift+Enter for new line. Powered by Claude (Max subscription).
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
