/**
 * ChatPage — /chat
 *
 * Full-screen chat interface. Left panel: room list with group management.
 * Right panel: message thread. Room management features (create/edit/archive
 * groups, add/remove members, rename) are surfaced here rather than in the
 * compact bubble overlay.
 */
import { useState, useCallback } from 'react'
import {
  Settings, UserPlus, Archive, Hash, Users, Wifi,
  ChevronRight, X, Check, AlertCircle,
} from 'lucide-react'
import ChatPanel from '../components/chat/ChatPanel'
import { chatAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useChatRooms } from '../hooks/useChat'
import { SOURCE_LABELS, SOURCE_COLORS } from '../hooks/useChat'

const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Room Settings panel (shown when gear icon clicked) ────────────────────────
function RoomSettings({ room, members, onClose, onUpdated }) {
  const { user } = useAuth()
  const [name, setName] = useState(room.name || '')
  const [description, setDescription] = useState(room.description || '')
  const [addEmail, setAddEmail] = useState('')
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const isAdmin = ['admin', 'manager'].includes(user?.role) ||
    members.some(m => m.userId === user?.id && m.role === 'admin')

  const searchUsers = useCallback(async (q) => {
    try {
      const res = await chatAPI.listUsers({ q })
      setUsers(res.data || [])
    } catch {}
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await chatAPI.updateRoom(room.id, { name, description })
      onUpdated(res.data)
      setSuccess('Saved.')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!window.confirm('Archive this channel? Members will no longer receive new messages.')) return
    try {
      await chatAPI.updateRoom(room.id, { isArchived: true })
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddMember = async (uid) => {
    try {
      await chatAPI.addMembers(room.id, [uid])
      setUserSearch('')
      setUsers([])
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemoveMember = async (uid) => {
    if (!window.confirm('Remove this member?')) return
    try {
      await chatAPI.removeMember(room.id, uid)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14,13,12,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        background: CREAM, width: 460, maxHeight: '85vh',
        borderRadius: 8, display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${c(INK, 0.08)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={16} color={FOREST} />
            <span style={{ fontWeight: 700, color: INK }}>{room.name || 'Channel Settings'}</span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: c(INK, 0.5) }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {error && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 6, padding: '8px 12px', marginBottom: 12,
              fontSize: 13, color: '#DC2626',
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 6, padding: '8px 12px', marginBottom: 12,
              fontSize: 13, color: '#16A34A',
            }}>
              <Check size={14} /> {success}
            </div>
          )}

          {/* External source info */}
          {room.channelSource && room.channelSource !== 'internal' && (
            <div style={{
              background: c(SOURCE_COLORS[room.channelSource], 0.08),
              border: `1px solid ${c(SOURCE_COLORS[room.channelSource], 0.2)}`,
              borderRadius: 6, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: INK,
            }}>
              <strong style={{ color: SOURCE_COLORS[room.channelSource] }}>
                {SOURCE_LABELS[room.channelSource]} channel
              </strong>
              {' '}— Messages from this channel are ingested via webhook. Replies sent here will be routed back to {SOURCE_LABELS[room.channelSource]}.
            </div>
          )}

          {isAdmin && room.type === 'channel' && (
            <>
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: c(INK, 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Channel Info
                </h3>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Description</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder="What's this channel for?" />
                </div>
                <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </section>
            </>
          )}

          {/* Members */}
          <section style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: c(INK, 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Members ({members.length})
            </h3>
            {isAdmin && room.type === 'channel' && (
              <div style={{ marginBottom: 10, position: 'relative' }}>
                <input
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value) }}
                  placeholder="Add member by name or email..."
                  style={inputStyle}
                />
                {users.length > 0 && userSearch && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'white', border: `1px solid ${c(INK, 0.12)}`,
                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {users.map(u => {
                      const alreadyMember = members.some(m => m.userId === u.id)
                      return (
                        <button key={u.id} onClick={() => !alreadyMember && handleAddMember(u.id)}
                          disabled={alreadyMember}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '9px 12px', border: 'none', background: 'none',
                            cursor: alreadyMember ? 'default' : 'pointer', fontSize: 13, color: INK,
                            opacity: alreadyMember ? 0.5 : 1,
                          }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: c(FOREST, 0.15),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: FOREST,
                          }}>
                            {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                            <div style={{ fontSize: 11, color: c(INK, 0.5) }}>{u.email}</div>
                          </div>
                          {alreadyMember && <span style={{ marginLeft: 'auto', fontSize: 11, color: c(INK, 0.4) }}>Already added</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: `1px solid ${c(INK, 0.06)}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: c(FOREST, 0.15),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: FOREST,
                }}>
                  {(m.user?.firstName?.[0] || '') + (m.user?.lastName?.[0] || '')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                    {m.user?.firstName} {m.user?.lastName}
                    {m.role === 'admin' && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: c(FOREST, 0.1), color: FOREST, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>Admin</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: c(INK, 0.45) }}>{m.user?.email}</div>
                </div>
                {isAdmin && m.userId !== m.invitedById && (
                  <button onClick={() => handleRemoveMember(m.userId)} style={{
                    border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4,
                  }} title="Remove member">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </section>

          {/* Archive */}
          {isAdmin && room.type === 'channel' && (
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: c(INK, 0.5), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Danger Zone
              </h3>
              <button onClick={handleArchive} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', border: '1px solid #FECACA',
                background: '#FEF2F2', color: '#DC2626',
                borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                <Archive size={14} /> Archive Channel
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

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

// ── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [settingsRoom, setSettingsRoom] = useState(null)
  const [settingsMembers, setSettingsMembers] = useState([])
  const { user } = useAuth()

  const openSettings = useCallback(async (room) => {
    try {
      const res = await chatAPI.listMembers(room.id)
      setSettingsMembers(res.data || [])
      setSettingsRoom(room)
    } catch {}
  }, [])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: CREAM, fontFamily: 'inherit',
    }}>
      {/* Page header */}
      <div style={{
        padding: '20px 28px 0',
        borderBottom: `1px solid ${c(INK, 0.08)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>Team Chat</h1>
          <p style={{ fontSize: 13, color: c(INK, 0.5), margin: '4px 0 16px' }}>
            Internal messaging, group channels, and external inbox (WhatsApp, WeChat, Telegram)
          </p>
        </div>
      </div>

      {/* Full-height chat panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ChatPanel
          compact={false}
          onSettingsClick={openSettings}
        />
      </div>

      {settingsRoom && (
        <RoomSettings
          room={settingsRoom}
          members={settingsMembers}
          onClose={() => setSettingsRoom(null)}
          onUpdated={() => setSettingsRoom(null)}
        />
      )}
    </div>
  )
}
