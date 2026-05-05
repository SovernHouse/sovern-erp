import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Clock, CheckCircle2, Mail, FileText,
  ArrowRight, Send, Trash2, Check, RefreshCw, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { chatterAPI, activitiesAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function timeAgo(dateStr) {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function dueDateClass(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return 'text-red-600 bg-red-50 border-red-200'
  if (dateStr === today) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-green-700 bg-green-50 border-green-200'
}

function formatDueDate(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ACTIVITY_LABELS = {
  follow_up: 'Follow-up',
  check_document: 'Check Document',
  approve: 'Approve',
  send: 'Send',
  call: 'Call',
  meeting: 'Meeting',
  other: 'Other',
}

// ─── system event row ─────────────────────────────────────────────────────────

function SystemEvent({ msg }) {
  const icons = {
    status_change: <ArrowRight className="w-3.5 h-3.5 text-blue-400" />,
    event: <RefreshCw className="w-3.5 h-3.5 text-slate-400" />,
    activity: <Clock className="w-3.5 h-3.5 text-purple-400" />,
    approval_request: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
    approval_decision: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
    email_sent: <Mail className="w-3.5 h-3.5 text-sky-400" />,
  }
  const icon = icons[msg.messageType] || <RefreshCw className="w-3.5 h-3.5 text-slate-400" />

  return (
    <div className="flex items-start gap-2 py-1.5 px-1">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="text-xs text-slate-500 leading-relaxed">{msg.body}</p>
      <span className="ml-auto text-[10px] text-slate-400 whitespace-nowrap shrink-0">
        {timeAgo(msg.createdAt)}
      </span>
    </div>
  )
}

// ─── comment bubble ───────────────────────────────────────────────────────────

function CommentBubble({ msg, currentUserId, currentUserRole, onDelete }) {
  const canDelete =
    msg.userId === currentUserId ||
    ['admin', 'manager'].includes(currentUserRole)

  return (
    <div className="flex items-start gap-3">
      {/* avatar */}
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0 mt-0.5">
        {initials(msg.authorName || 'U')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-800">{msg.authorName || 'Unknown'}</span>
          <span className="text-[11px] text-slate-400">{timeAgo(msg.createdAt)}</span>
        </div>
        <div className="mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap break-words shadow-sm">
          {msg.body}
          {/* file attachments */}
          {msg.attachments?.length > 0 && (
            <div className="mt-2 space-y-1">
              {msg.attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {a.name}
                </a>
              ))}
            </div>
          )}
        </div>
        {/* replies */}
        {msg.replies?.length > 0 && (
          <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-2">
            {msg.replies.map(reply => (
              <CommentBubble
                key={reply.id}
                msg={reply}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(msg.id)}
          className="mt-2 text-slate-300 hover:text-red-400 transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── pending activity row ─────────────────────────────────────────────────────

function PendingActivityRow({ activity, onMarkDone }) {
  const [loading, setLoading] = useState(false)
  const cls = dueDateClass(activity.dueDate)

  const handleDone = async () => {
    setLoading(true)
    try {
      await activitiesAPI.markDone(activity.id, {})
      onMarkDone(activity.id)
    } catch {
      toast.error('Could not mark activity done')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${cls}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{ACTIVITY_LABELS[activity.type] || activity.type}</span>
        {activity.note && (
          <span className="ml-1 text-opacity-80"> · {activity.note.slice(0, 60)}{activity.note.length > 60 ? '…' : ''}</span>
        )}
        <div className="opacity-75 mt-0.5">
          Due {formatDueDate(activity.dueDate)}
          {activity.assignedTo && ` · ${activity.assignedTo.firstName} ${activity.assignedTo.lastName}`}
        </div>
      </div>
      <button
        onClick={handleDone}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 px-2 py-1 bg-white bg-opacity-60 hover:bg-opacity-100 border border-current rounded-md transition-all disabled:opacity-50"
        title="Mark done"
      >
        <Check className="w-3 h-3" />
        <span className="font-medium">Done</span>
      </button>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ChatterPanel({ entityType, entityId }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [activities, setActivities] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (entityType && entityId) load()
  }, [entityType, entityId])

  const load = async () => {
    setLoading(true)
    try {
      const [msgRes, actRes] = await Promise.all([
        chatterAPI.getMessages(entityType, entityId),
        activitiesAPI.getForEntity(entityType, entityId),
      ])
      setMessages(msgRes.data?.data || msgRes.data || [])
      const all = actRes.data?.data || actRes.data || []
      setActivities(all.filter(a => a.status === 'pending'))
    } catch {
      // non-fatal — panel just shows empty
    } finally {
      setLoading(false)
    }
  }

  // scroll to bottom after messages load
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await chatterAPI.postMessage(entityType, entityId, { body: body.trim() })
      const newMsg = res.data?.data || res.data
      setMessages(prev => [...prev, newMsg])
      setBody('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (messageId) => {
    try {
      await chatterAPI.deleteMessage(entityType, entityId, messageId)
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch {
      toast.error('Could not delete message')
    }
  }

  const handleMarkDone = (activityId) => {
    setActivities(prev => prev.filter(a => a.id !== activityId))
    // reload messages so the "marked done" event appears
    load()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const isSystem = (type) =>
    !['comment', 'file_attachment'].includes(type)

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-slate-50 rounded-xl border border-slate-200">

      {/* pending activities */}
      {activities.length > 0 && (
        <div className="px-4 pt-4 pb-2 space-y-2 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Pending Activities
          </p>
          {activities.map(a => (
            <PendingActivityRow key={a.id} activity={a} onMarkDone={handleMarkDone} />
          ))}
        </div>
      )}

      {/* message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-2">
            <MessageSquare className="w-6 h-6 opacity-40" />
            <span className="text-sm">No messages yet — start the conversation.</span>
          </div>
        ) : (
          messages.map(msg =>
            isSystem(msg.messageType) ? (
              <SystemEvent key={msg.id} msg={msg} />
            ) : (
              <CommentBubble
                key={msg.id}
                msg={msg}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onDelete={handleDelete}
              />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* comment input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white rounded-b-xl">
        <div className="flex gap-2 items-end">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a note or comment… (Ctrl+Enter to send)"
            rows={2}
            className="flex-1 resize-none text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 bg-slate-50"
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
