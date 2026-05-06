/**
 * useChat — data + socket hooks for the internal chat system.
 *
 * useChatRooms   — loads room list with unread counts; updates on new messages
 * useChatRoom    — loads a single room's messages + members; handles pagination
 * useChatSocket  — attaches all chat socket.io listeners to a room
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { chatAPI } from '../services/api'
import { getSocket } from '../services/socket'

// ── Source badge labels ───────────────────────────────────────────────────────
export const SOURCE_LABELS = {
  internal:  'ERP',
  whatsapp:  'WhatsApp',
  telegram:  'Telegram',
  wechat:    'WeChat',
  email:     'Email',
  sms:       'SMS',
}

export const SOURCE_COLORS = {
  internal:  '#1D5A32',
  whatsapp:  '#25D366',
  telegram:  '#2AABEE',
  wechat:    '#07C160',
  email:     '#6366F1',
  sms:       '#F59E0B',
}

// ─────────────────────────────────────────────────────────────────────────────
// useChatRooms
// Loads and maintains the room sidebar list.
// Updates unread counts in real time when a new message arrives.
// ─────────────────────────────────────────────────────────────────────────────
export function useChatRooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await chatAPI.listRooms()
      setRooms(res.data || [])
      setError(null)
    } catch (e) {
      setError(e.message || 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Listen for new messages on any room to bump unread counts
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleNewMessage = ({ roomId, message }) => {
      setRooms(prev =>
        prev.map(r => {
          if (r.id !== roomId) return r
          return {
            ...r,
            lastMessageAt: message.createdAt,
            lastMessagePreview: message.body ? message.body.substring(0, 200) : '',
            unreadCount: (r.unreadCount || 0) + 1,
          }
        }).sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt) : 0
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt) : 0
          return tb - ta
        })
      )
    }

    // New room added (DM initiated from another user, or added to a channel)
    const handleAddedToRoom = ({ room }) => {
      setRooms(prev => {
        if (prev.some(r => r.id === room.id)) return prev
        return [{ ...room, unreadCount: 0 }, ...prev]
      })
    }

    const handleRoomUpdated = ({ room }) => {
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, ...room } : r))
    }

    socket.on('chat:new_message', handleNewMessage)
    socket.on('chat:added_to_room', handleAddedToRoom)
    socket.on('chat:room_updated', handleRoomUpdated)

    return () => {
      socket.off('chat:new_message', handleNewMessage)
      socket.off('chat:added_to_room', handleAddedToRoom)
      socket.off('chat:room_updated', handleRoomUpdated)
    }
  }, [])

  const markRoomRead = useCallback((roomId) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unreadCount: 0 } : r))
  }, [])

  const addRoom = useCallback((room) => {
    setRooms(prev => {
      if (prev.some(r => r.id === room.id)) return prev
      return [{ ...room, unreadCount: 0 }, ...prev]
    })
  }, [])

  return { rooms, loading, error, reload: load, markRoomRead, addRoom }
}

// ─────────────────────────────────────────────────────────────────────────────
// useChatRoom
// Loads messages for a specific room. Supports cursor pagination (load more).
// Updates in real time via socket events.
// ─────────────────────────────────────────────────────────────────────────────
export function useChatRoom(roomId) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)

  const PAGE_SIZE = 50

  const load = useCallback(async (roomId) => {
    if (!roomId) return
    setLoading(true)
    try {
      const [msgsRes, roomRes, membersRes] = await Promise.all([
        chatAPI.listMessages(roomId, { limit: PAGE_SIZE }),
        chatAPI.getRoom(roomId),
        chatAPI.listMembers(roomId),
      ])
      setMessages(msgsRes.data || [])
      setRoom(roomRes.data || null)
      setMembers(membersRes.data || [])
      setHasMore((msgsRes.data || []).length === PAGE_SIZE)
      setError(null)
    } catch (e) {
      setError(e.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loading) return
    const oldest = messages[0]
    if (!oldest) return
    setLoading(true)
    try {
      const res = await chatAPI.listMessages(roomId, {
        limit: PAGE_SIZE,
        before: oldest.createdAt,
      })
      const older = res.data || []
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length === PAGE_SIZE)
    } catch (e) {
      setError(e.message || 'Failed to load more messages')
    } finally {
      setLoading(false)
    }
  }, [roomId, messages, hasMore, loading])

  useEffect(() => {
    if (roomId) {
      setMessages([])
      setHasMore(true)
      load(roomId)
    }
  }, [roomId, load])

  // Append incoming messages
  const appendMessage = useCallback((message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev
      return [...prev, message]
    })
  }, [])

  const updateMessage = useCallback((message) => {
    setMessages(prev => prev.map(m => m.id === message.id ? message : m))
  }, [])

  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, body: null, deletedAt: new Date().toISOString() } : m
    ))
  }, [])

  const addMember = useCallback((member) => {
    setMembers(prev => {
      if (prev.some(m => m.userId === member.userId)) return prev
      return [...prev, member]
    })
  }, [])

  const removeMember = useCallback((userId) => {
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }, [])

  return {
    room, messages, members, loading, hasMore, error,
    reload: () => load(roomId),
    loadMore,
    appendMessage, updateMessage, removeMessage,
    addMember, removeMember,
    setRoom,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useChatSocket
// Joins a socket.io chat room, wires all real-time events, cleans up on unmount.
// ─────────────────────────────────────────────────────────────────────────────
export function useChatSocket(roomId, { onMessage, onEdited, onDeleted, onMemberAdded, onMemberRemoved, onTyping, onRead } = {}) {
  const callbacksRef = useRef({ onMessage, onEdited, onDeleted, onMemberAdded, onMemberRemoved, onTyping, onRead })

  // Keep callbacks ref up to date without re-subscribing socket listeners
  useEffect(() => {
    callbacksRef.current = { onMessage, onEdited, onDeleted, onMemberAdded, onMemberRemoved, onTyping, onRead }
  })

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    if (!socket) return

    // Join the socket room
    socket.emit('chat:join_room', roomId)

    const handlers = {
      'chat:new_message':   ({ roomId: rid, message }) => rid === roomId && callbacksRef.current.onMessage?.(message),
      'chat:message_edited':({ roomId: rid, message }) => rid === roomId && callbacksRef.current.onEdited?.(message),
      'chat:message_deleted':({ roomId: rid, messageId }) => rid === roomId && callbacksRef.current.onDeleted?.(messageId),
      'chat:member_added':  ({ roomId: rid, member }) => rid === roomId && callbacksRef.current.onMemberAdded?.(member),
      'chat:member_removed':({ roomId: rid, userId }) => rid === roomId && callbacksRef.current.onMemberRemoved?.(userId),
      'chat:typing':        (payload) => payload.roomId === roomId && callbacksRef.current.onTyping?.(payload),
      'chat:read':          (payload) => payload.roomId === roomId && callbacksRef.current.onRead?.(payload),
    }

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler))

    return () => {
      socket.emit('chat:leave_room', roomId)
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler))
    }
  }, [roomId])
}

// ─────────────────────────────────────────────────────────────────────────────
// useTypingIndicator
// Sends typing events to the server (throttled) and tracks who is typing.
// ─────────────────────────────────────────────────────────────────────────────
export function useTypingIndicator(roomId, currentUserId) {
  const [typingUsers, setTypingUsers] = useState({}) // { userId: userName }
  const typingTimerRef = useRef({}) // { userId: timeoutId }
  const lastSentRef = useRef(0)

  const onIncomingTyping = useCallback(({ userId, isTyping }) => {
    if (userId === currentUserId) return
    setTypingUsers(prev => {
      const next = { ...prev }
      if (isTyping) {
        next[userId] = userId
      } else {
        delete next[userId]
      }
      return next
    })

    // Auto-clear after 3s (in case stop event is missed)
    if (isTyping) {
      clearTimeout(typingTimerRef.current[userId])
      typingTimerRef.current[userId] = setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev }
          delete next[userId]
          return next
        })
      }, 3000)
    }
  }, [currentUserId])

  const sendTyping = useCallback((isTyping = true) => {
    const now = Date.now()
    if (isTyping && now - lastSentRef.current < 2000) return // throttle 2s
    lastSentRef.current = now
    const socket = getSocket()
    if (socket && roomId) {
      socket.emit('chat:typing', { chatRoomId: roomId, isTyping })
    }
  }, [roomId])

  const typingLabel = Object.keys(typingUsers).length > 0
    ? `${Object.keys(typingUsers).length === 1 ? 'Someone is' : 'Multiple people are'} typing...`
    : null

  return { typingLabel, onIncomingTyping, sendTyping }
}
