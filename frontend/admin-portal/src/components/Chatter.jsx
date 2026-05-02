/**
 * Chatter — Odoo-style polymorphic message thread.
 * Drop this below any detail page:
 *
 *   <Chatter entityType="Quotation" entityId={quotation.id} />
 *
 * Props:
 *   entityType  — string matching the backend whitelist (e.g. 'Quotation')
 *   entityId    — record PK
 *   className   — optional wrapper class
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Send, Trash2, Paperclip,
  CheckCircle, XCircle, Clock, Mail, Phone,
  Calendar, FileText, AlertCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatRelativeTime } from '../utils/formatters'

// ── Message type metadata ───────────────────────────────────────────────────
const MSG_META = {
  comment:          { icon: MessageSquare, color: 'text-slate-500', bg: 'bg-white',         label: null },
  event:            { icon: Clock,         color: 'text-slate-400', bg: 'bg-slate-50',       label: null },
  status_change:    { icon: RefreshCw,     color: 'text-blue-500',  bg: 'bg-blue-50',        label: 'Status changed' },
  approval_request: { icon: AlertCircle,   color: 'text-amber-500', bg: 'bg-amber-50',       label: 'Approval requested' },
  approval_decision:{ icon: CheckCircle,   color: 'text-green-500', bg: 'bg-green-50',       label: 'Approval decision' },
  activity:         { icon: Calendar,      color: 'text-purple-500',bg: 'bg-purple-50',      label: 'Activity' },
  email_sent:       { icon: Mail,          color: 'text-indigo-500',bg: 'bg-indigo-50',      label: 'Email sent' },
  file_attachment:  { icon: FileText,      color: 'text-slate-500', bg: 'bg-white',          label: 'File attached' },
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  const colors = [
    'bg-forest-600', 'bg-blue-600', 'bg-purple-600',
    'bg-amber-600',  'bg-rose-600', 'bg-teal-600',
  ]
  // Deterministic colour from name
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
         style={{ backgroundColor: ['#2D5A27','#2563eb','#7c3aed','#d97706','#e11d48','#0d9488'][idx] }}>
      {getInitials(name)}
    </div>
  )
}

function SystemEventRow({ msg }) {
  const meta = MSG_META[msg.messageType] || MSG_META.event
  const Icon = meta.icon
  const md = msg.metadata || {}

  let body = msg.body
  if (msg.messageType === 'status_change' && md.oldStatus && md.newStatus) {
    body = `Status changed: ${md.oldStatus} → ${md.newStatus}`
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-2 ${meta.bg} border-l-2 border-slate-200 rounded`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-600">{body}</p>
        <span className="text-xs text-slate-400">
          {msg.authorName ? `${msg.authorName} · ` : ''}
          {formatRelativeTime(msg.createdAt)}
        </span>
      </div>
    </div>
  )
}

function CommentRow({ msg, currentUserId, onDelete }) {
  const name = msg.author
    ? `${msg.author.firstName || ''} ${msg.author.lastName || ''}`.trim()
    : msg.authorName || 'System'

  const canDelete =
    msg.userId === currentUserId ||
    ['admin', 'manager'].includes(msg.author?.role)

  return (
    <div className="flex items-start gap-3 group">
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-slate-200 rounded-xl rounded-tl-none p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-slate-800">{name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{formatRelativeTime(msg.createdAt)}</span>
              {canDelete && (
                <button
                  onClick={() => onDelete(msg.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {msg.body && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
          )}
          {msg.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {msg.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                >
                  <Paperclip className="w-3 h-3" />
                  {att.name}
                </a>
              ))}
            </div>
          )}
        </div>
        {/* Replies */}
        {msg.replies?.length > 0 && (
          <div className="ml-4 mt-2 space-y-2">
            {msg.replies.map(reply => (
              <CommentRow
                key={reply.id}
                msg={reply}
                currentUserId={currentUserId}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Chatter({ entityType, entityId, className = '' }) {
  const [messages, setMessages]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [body, setBody]           = useState('')
  const textareaRef               = useRef(null)
  const bottomRef                 = useRef(null)

  // Infer current user from localStorage token via stored user object
  const [currentUserId, setCurrentUserId] = useState(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user')
      if (raw) setCurrentUserId(JSON.parse(raw).id)
    } catch {}
  }, [])

  const load = useCallback(async () => {
    if (!entityType || !entityId) return
    try {
      const res = await api.get(`/chatter/${entityType}/${entityId}`)
      setMessages(res.data?.data || res.data || [])
    } catch (err) {
      console.error('[Chatter] load', err)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post(`/chatter/${entityType}/${entityId}`, { body: body.trim() })
      const newMsg = res.data?.data || res.data
      setMessages(prev => [...prev, newMsg])
      setBody('')
      // Scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post message')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    // Cmd/Ctrl+Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/chatter/${entityType}/${entityId}/${msgId}`)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message')
    }
  }

  const isSystemEvent = (type) =>
    ['event','status_change','approval_request','approval_decision','activity','email_sent'].includes(type)

  return (
    <div className={`bg-slate-50 rounded-xl border border-slate-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Chatter</span>
          {messages.length > 0 && (
            <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thread */}
      <div className="px-4 py-4 space-y-3 max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-forest-600 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No messages yet. Add a note or log an activity.</p>
          </div>
        ) : (
          messages.map(msg => (
            isSystemEvent(msg.messageType)
              ? <SystemEventRow key={msg.id} msg={msg} />
              : <CommentRow key={msg.id} msg={msg} currentUserId={currentUserId} onDelete={handleDelete} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-4 pb-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a note… (Cmd+Enter to send)"
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent bg-white placeholder-slate-400 text-slate-800"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: body.trim() ? '#2D5A27' : undefined }}
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{submitting ? 'Sending…' : 'Send'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
