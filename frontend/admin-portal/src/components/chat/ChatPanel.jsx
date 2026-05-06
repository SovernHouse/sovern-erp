/**
 * ChatPanel
 *
 * Full chat interface: room list on the left, message thread on the right.
 * Used both inside the floating ChatBubble (compact mode) and on the /chat page (full mode).
 *
 * Props:
 *   currentUser   — from useAuth()
 *   defaultRoomId — pre-select this room on mount (optional)
 *   compact       — true = bubble overlay sizing, false = full-page sizing
 *   onClose       — callback for the bubble's close button (compact mode only)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, Plus, Search, X, Send, Hash, User, Users,
  ChevronLeft, MoreVertical, Paperclip, Smile, AtSign,
  Wifi, WifiOff, ExternalLink, Check, CheckCheck, Trash2, Edit2,
} from 'lucide-react'
import { chatAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import {
  useChatRooms, useChatRoom, useChatSocket, useTypingIndicator,
  SOURCE_LABELS, SOURCE_COLORS,
} from '../../hooks/useChat'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const FOREST_LIGHT = '#2A7040'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (isToday) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function initials(user) {
  if (!user) return '?'
  return `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
}

function Avatar({ user, size = 32, source }) {
  const bg = source && source !== 'internal' ? SOURCE_COLORS[source] : FOREST
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: CREAM, fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {user ? initials(user) : (source ? source[0].toUpperCase() : '?')}
    </div>
  )
}

// ── Room sidebar item ─────────────────────────────────────────────────────────
function RoomItem({ room, active, currentUserId, onClick }) {
  const isDM = room.type === 'dm'
  const isExternal = room.channelSource && room.channelSource !== 'internal'
  const sourceColor = isExternal ? SOURCE_COLORS[room.channelSource] : null
  const displayName = isDM
    ? (room.otherUser ? `${room.otherUser.firstName || ''} ${room.otherUser.lastName || ''}`.trim() || room.otherUser.email : 'DM')
    : (room.name || 'Unnamed')

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? c(FOREST, 0.12) : 'transparent',
        borderLeft: active ? `3px solid ${FOREST}` : '3px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {isDM
          ? <Avatar user={room.otherUser} size={36} source={room.channelSource !== 'internal' ? room.channelSource : null} />
          : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: sourceColor || c(FOREST, 0.15),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: sourceColor ? CREAM : FOREST, flexShrink: 0,
            }}>
              {isExternal ? <Wifi size={16} /> : <Hash size={16} />}
            </div>
          )
        }
        {room.unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: CREAM,
            borderRadius: '50%', minWidth: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, padding: '0 3px',
          }}>
            {room.unreadCount > 99 ? '99+' : room.unreadCount}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 13, fontWeight: room.unreadCount > 0 ? 700 : 500,
            color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {displayName}
          </span>
          {room.lastMessageAt && (
            <span style={{ fontSize: 10, color: c(INK, 0.45), flexShrink: 0 }}>
              {fmtTime(room.lastMessageAt)}
            </span>
          )}
        </div>
        {(isExternal || room.lastMessagePreview) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isExternal && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: sourceColor, color: CREAM, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
              }}>
                {SOURCE_LABELS[room.channelSource]}
              </span>
            )}
            {room.lastMessagePreview && (
              <span style={{
                fontSize: 11, color: c(INK, 0.5), whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
              }}>
                {room.lastMessagePreview}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Single chat message bubble ────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showAvatar, onDelete, onEdit }) {
  const [hover, setHover] = useState(false)
  const isDeleted = !!msg.deletedAt
  const isExternal = msg.source && msg.source !== 'internal'

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        flexDirection: isMine ? 'row-reverse' : 'row',
        marginBottom: 4, position: 'relative',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMine && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && <Avatar user={msg.sender} size={28} source={isExternal ? msg.source : null} />}
        </div>
      )}
      <div style={{ maxWidth: '72%', minWidth: 60 }}>
        {showAvatar && !isMine && (
          <div style={{ fontSize: 11, color: c(INK, 0.5), marginBottom: 2, paddingLeft: 2 }}>
            {isExternal && msg.externalSenderName
              ? msg.externalSenderName
              : msg.sender ? `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || msg.sender.email : 'Unknown'}
            {isExternal && (
              <span style={{
                marginLeft: 6, fontSize: 9, padding: '1px 4px', borderRadius: 3,
                background: SOURCE_COLORS[msg.source], color: CREAM,
                fontWeight: 700, textTransform: 'uppercase',
              }}>
                {SOURCE_LABELS[msg.source]}
              </span>
            )}
          </div>
        )}

        {/* Entity ref link */}
        {msg.entityRef && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', marginBottom: 4,
            background: c(FOREST, 0.08), border: `1px solid ${c(FOREST, 0.2)}`,
            borderRadius: 4, fontSize: 11, color: FOREST, cursor: 'pointer',
          }}>
            <ExternalLink size={10} />
            {msg.entityRef.type} {msg.entityRef.id}
            {msg.entityRef.label && ` — ${msg.entityRef.label}`}
          </div>
        )}

        <div style={{
          padding: '8px 12px',
          background: isDeleted ? c(INK, 0.04) : isMine ? FOREST : CREAM,
          border: isDeleted ? `1px dashed ${c(INK, 0.15)}` : isMine ? 'none' : `1px solid ${c(INK, 0.08)}`,
          borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          position: 'relative',
        }}>
          {isDeleted ? (
            <span style={{ fontStyle: 'italic', fontSize: 13, color: c(INK, 0.4) }}>
              Message deleted.
            </span>
          ) : (
            <span style={{
              fontSize: 13, color: isMine ? CREAM : INK,
              lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.body}
            </span>
          )}
          {msg.editedAt && !isDeleted && (
            <span style={{ fontSize: 10, color: isMine ? c(CREAM, 0.6) : c(INK, 0.4), marginLeft: 6 }}>
              (edited)
            </span>
          )}
        </div>

        <div style={{
          fontSize: 10, color: c(INK, 0.4), marginTop: 2,
          textAlign: isMine ? 'right' : 'left', paddingRight: isMine ? 2 : 0,
        }}>
          {fmtTime(msg.createdAt)}
        </div>
      </div>

      {/* Hover actions */}
      {hover && !isDeleted && (
        <div style={{
          display: 'flex', gap: 4, alignItems: 'center',
          position: 'absolute', top: 0, [isMine ? 'left' : 'right']: 0,
        }}>
          {isMine && onEdit && (
            <button onClick={() => onEdit(msg)} style={actionBtnStyle}>
              <Edit2 size={12} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(msg)} style={{ ...actionBtnStyle, color: '#EF4444' }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const actionBtnStyle = {
  border: 'none', background: CREAM, borderRadius: 4, padding: '4px 6px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', color: c(INK, 0.5),
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSep({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '16px 0', padding: '0 16px',
    }}>
      <div style={{ flex: 1, height: 1, background: c(INK, 0.08) }} />
      <span style={{ fontSize: 11, color: c(INK, 0.4), fontWeight: 600, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: c(INK, 0.08) }} />
    </div>
  )
}

// ── New DM / channel modal ────────────────────────────────────────────────────
function NewConversationModal({ onClose, onCreated }) {
  const [tab, setTab] = useState('dm') // 'dm' | 'channel'
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState([])
  const [channelName, setChannelName] = useState('')
  const [channelDesc, setChannelDesc] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await chatAPI.listUsers({ q: userSearch || undefined })
        setUsers(res.data || [])
      } catch {}
    }
    load()
  }, [userSearch])

  const startDM = async (userId) => {
    setLoading(true)
    try {
      const res = await chatAPI.getOrCreateDM(userId)
      onCreated(res.data)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const createChannel = async () => {
    if (!channelName.trim()) return
    setLoading(true)
    try {
      const res = await chatAPI.createRoom({ name: channelName, description: channelDesc, isPrivate })
      onCreated(res.data)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14,13,12,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        background: CREAM, borderRadius: 8, width: 440, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c(INK, 0.08)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: INK }}>New Conversation</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: c(INK, 0.5) }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${c(INK, 0.08)}` }}>
          {[['dm', 'Direct Message'], ['channel', 'Channel']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
              background: 'none', fontWeight: tab === key ? 700 : 400,
              color: tab === key ? FOREST : c(INK, 0.5),
              borderBottom: tab === key ? `2px solid ${FOREST}` : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {tab === 'dm' ? (
            <>
              <input
                placeholder="Search users..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              <div style={{ marginTop: 8 }}>
                {users.map(u => (
                  <button key={u.id} onClick={() => startDM(u.id)} disabled={loading} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', border: 'none', background: 'none',
                    cursor: 'pointer', borderRadius: 6, marginBottom: 4,
                    ':hover': { background: c(INK, 0.04) },
                  }}>
                    <Avatar user={u} size={32} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                        {u.firstName} {u.lastName}
                      </div>
                      <div style={{ fontSize: 11, color: c(INK, 0.5) }}>{u.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Channel Name</label>
                <input
                  placeholder="e.g. egypt-buyers, malaysia-factory"
                  value={channelName}
                  onChange={e => setChannelName(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Description (optional)</label>
                <input
                  placeholder="What's this channel for?"
                  value={channelDesc}
                  onChange={e => setChannelDesc(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                Private channel (invite only)
              </label>
              {error && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
              <button onClick={createChannel} disabled={!channelName.trim() || loading}
                style={{ ...btnPrimary, marginTop: 16, width: '100%' }}>
                Create Channel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: `1px solid ${c(INK, 0.15)}`, background: 'white',
  fontSize: 13, color: INK, outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: 12, color: c(INK, 0.6), marginBottom: 4, fontWeight: 600 }
const btnPrimary = {
  background: FOREST, color: CREAM, border: 'none', borderRadius: 6,
  padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────
export default function ChatPanel({ defaultRoomId, compact = false, onClose }) {
  const { user: currentUser } = useAuth()
  const { rooms, loading: roomsLoading, markRoomRead, addRoom, reload: reloadRooms } = useChatRooms()
  const [activeRoomId, setActiveRoomId] = useState(defaultRoomId || null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [search, setSearch] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [editingMsg, setEditingMsg] = useState(null)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const {
    room, messages, members, loading: msgLoading, hasMore, error,
    loadMore, appendMessage, updateMessage, removeMessage, addMember, removeMember,
  } = useChatRoom(activeRoomId)

  const { typingLabel, onIncomingTyping, sendTyping } = useTypingIndicator(activeRoomId, currentUser?.id)

  // Wire socket events for the active room
  useChatSocket(activeRoomId, {
    onMessage:       appendMessage,
    onEdited:        updateMessage,
    onDeleted:       removeMessage,
    onMemberAdded:   addMember,
    onMemberRemoved: removeMember,
    onTyping:        onIncomingTyping,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mark room as read when opened
  useEffect(() => {
    if (activeRoomId) {
      chatAPI.markRead(activeRoomId).catch(() => {})
      markRoomRead(activeRoomId)
    }
  }, [activeRoomId, markRoomRead])

  // Focus input when room changes
  useEffect(() => {
    if (activeRoomId) inputRef.current?.focus()
  }, [activeRoomId])

  const filteredRooms = rooms.filter(r => {
    if (!search) return true
    const name = r.name || (r.otherUser ? `${r.otherUser.firstName} ${r.otherUser.lastName}` : '')
    return name.toLowerCase().includes(search.toLowerCase())
  })

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0)

  const handleSend = async () => {
    const body = messageInput.trim()
    if (!body || !activeRoomId) return
    setSending(true)
    try {
      if (editingMsg) {
        await chatAPI.editMessage(activeRoomId, editingMsg.id, { body })
        setEditingMsg(null)
      } else {
        await chatAPI.sendMessage(activeRoomId, { body })
      }
      setMessageInput('')
      sendTyping(false)
    } catch (e) {
      console.error('Send failed', e)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && editingMsg) {
      setEditingMsg(null)
      setMessageInput('')
    }
  }

  const handleDelete = async (msg) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await chatAPI.deleteMessage(activeRoomId, msg.id)
    } catch (e) {}
  }

  const handleEdit = (msg) => {
    setEditingMsg(msg)
    setMessageInput(msg.body || '')
    inputRef.current?.focus()
  }

  // Group messages by date and detect consecutive same-sender runs
  const grouped = []
  let lastDate = null
  let lastSenderId = null
  for (const msg of messages) {
    const date = msg.createdAt ? new Date(msg.createdAt).toDateString() : null
    if (date && date !== lastDate) {
      grouped.push({ type: 'date', label: fmtDate(msg.createdAt) })
      lastDate = date
    }
    const isMine = msg.senderId === currentUser?.id
    const showAvatar = msg.senderId !== lastSenderId || (msg.source && msg.source !== 'internal')
    grouped.push({ type: 'msg', msg, isMine, showAvatar })
    lastSenderId = msg.senderId || msg.externalSenderId
  }

  // Room header info
  const activeRoom = rooms.find(r => r.id === activeRoomId) || room
  const roomDisplayName = activeRoom
    ? (activeRoom.type === 'dm'
        ? (activeRoom.otherUser ? `${activeRoom.otherUser.firstName || ''} ${activeRoom.otherUser.lastName || ''}`.trim() : 'DM')
        : (activeRoom.name || 'Channel'))
    : ''

  const panelHeight = compact ? 520 : '100%'
  const panelWidth  = compact ? 760 : '100%'

  return (
    <div style={{
      display: 'flex', width: panelWidth, height: panelHeight,
      background: 'white', overflow: 'hidden', fontFamily: 'inherit',
      borderRadius: compact ? 8 : 0,
    }}>

      {/* ── Left sidebar: room list ── */}
      <div style={{
        width: compact ? 240 : 280, flexShrink: 0,
        background: CREAM, borderRight: `1px solid ${c(INK, 0.08)}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${c(INK, 0.08)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={16} color={FOREST} />
            <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>Chat</span>
            {totalUnread > 0 && (
              <span style={{
                background: '#EF4444', color: CREAM, fontSize: 10, fontWeight: 700,
                borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
              }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowNewModal(true)} style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: 4,
              borderRadius: 4, color: c(INK, 0.5),
            }} title="New conversation">
              <Plus size={16} />
            </button>
            {compact && onClose && (
              <button onClick={onClose} style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: 4,
                borderRadius: 4, color: c(INK, 0.5),
              }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${c(INK, 0.06)}` }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: c(INK, 0.35) }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ ...inputStyle, paddingLeft: 28, padding: '6px 8px 6px 28px', fontSize: 12 }}
            />
          </div>
        </div>

        {/* Room list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {roomsLoading ? (
            <div style={{ padding: 20, color: c(INK, 0.4), fontSize: 13, textAlign: 'center' }}>Loading...</div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ padding: 20, color: c(INK, 0.4), fontSize: 13, textAlign: 'center' }}>
              No conversations yet.
              <br />
              <button onClick={() => setShowNewModal(true)} style={{
                color: FOREST, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, marginTop: 4, textDecoration: 'underline',
              }}>Start one</button>
            </div>
          ) : filteredRooms.map(r => (
            <RoomItem
              key={r.id}
              room={r}
              active={r.id === activeRoomId}
              currentUserId={currentUser?.id}
              onClick={() => setActiveRoomId(r.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right: message area ── */}
      {activeRoomId ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Room header */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${c(INK, 0.08)}`,
            display: 'flex', alignItems: 'center', gap: 10, background: 'white',
            flexShrink: 0,
          }}>
            {compact && (
              <button onClick={() => setActiveRoomId(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
                <ChevronLeft size={18} color={c(INK, 0.5)} />
              </button>
            )}
            {activeRoom?.type === 'dm'
              ? <Avatar user={activeRoom?.otherUser} size={32} />
              : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: c(FOREST, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Hash size={14} color={FOREST} />
                </div>
              )
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {roomDisplayName}
              </div>
              {members.length > 0 && activeRoom?.type !== 'dm' && (
                <div style={{ fontSize: 11, color: c(INK, 0.45) }}>{members.length} members</div>
              )}
            </div>
            {activeRoom?.channelSource && activeRoom.channelSource !== 'internal' && (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 3,
                background: SOURCE_COLORS[activeRoom.channelSource], color: CREAM,
                fontWeight: 700, textTransform: 'uppercase',
              }}>
                {SOURCE_LABELS[activeRoom.channelSource]}
              </span>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {hasMore && (
              <button onClick={loadMore} disabled={msgLoading} style={{
                display: 'block', margin: '0 auto 16px', background: 'none',
                border: `1px solid ${c(INK, 0.15)}`, borderRadius: 4,
                padding: '4px 12px', fontSize: 12, color: c(INK, 0.5), cursor: 'pointer',
              }}>
                {msgLoading ? 'Loading...' : 'Load earlier messages'}
              </button>
            )}

            {grouped.map((item, idx) =>
              item.type === 'date' ? (
                <DateSep key={`date-${idx}`} label={item.label} />
              ) : (
                <MessageBubble
                  key={item.msg.id}
                  msg={item.msg}
                  isMine={item.isMine}
                  showAvatar={item.showAvatar}
                  onDelete={item.isMine || ['admin','manager'].includes(currentUser?.role) ? handleDelete : null}
                  onEdit={item.isMine ? handleEdit : null}
                />
              )
            )}

            {typingLabel && (
              <div style={{ fontSize: 12, color: c(INK, 0.4), fontStyle: 'italic', padding: '4px 0' }}>
                {typingLabel}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            borderTop: `1px solid ${c(INK, 0.08)}`, padding: '10px 14px',
            background: 'white', flexShrink: 0,
          }}>
            {editingMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', background: c(FOREST, 0.06),
                borderRadius: 4, marginBottom: 6, fontSize: 12, color: c(INK, 0.6),
              }}>
                <Edit2 size={12} color={FOREST} />
                <span>Editing message</span>
                <button onClick={() => { setEditingMsg(null); setMessageInput('') }} style={{
                  marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: c(INK, 0.4),
                }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={messageInput}
                onChange={e => { setMessageInput(e.target.value); sendTyping(true) }}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${roomDisplayName || ''}... (Enter to send, Shift+Enter for new line)`}
                rows={1}
                style={{
                  flex: 1, resize: 'none', padding: '8px 12px', borderRadius: 6,
                  border: `1px solid ${c(INK, 0.15)}`, fontSize: 13, color: INK,
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!messageInput.trim() || sending}
                style={{
                  ...btnPrimary,
                  padding: '8px 12px',
                  opacity: !messageInput.trim() || sending ? 0.5 : 1,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: c(INK, 0.35), gap: 12,
        }}>
          <MessageCircle size={40} color={c(INK, 0.15)} />
          <div style={{ fontSize: 14, textAlign: 'center' }}>
            Select a conversation or
            <br />
            <button onClick={() => setShowNewModal(true)} style={{
              color: FOREST, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, textDecoration: 'underline',
            }}>start a new one</button>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={(room) => {
            addRoom(room)
            setActiveRoomId(room.id)
          }}
        />
      )}
    </div>
  )
}
