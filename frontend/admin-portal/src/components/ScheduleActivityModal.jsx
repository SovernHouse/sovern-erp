/**
 * ScheduleActivityModal
 *
 * Odoo-style "Schedule Activity" dialog. Can be triggered from any ERP detail
 * page by passing the entity context.  Posts to POST /api/scheduled-activities
 * on confirm and calls onCreated() so the parent can refresh.
 *
 * Props:
 *   open          {boolean}
 *   onClose       {() => void}
 *   onCreated     {(activity) => void}  — called after successful creation
 *   entityType    {string}  e.g. 'Quotation'
 *   entityId      {string}  UUID or numeric id as string
 *   entityLabel   {string}  e.g. 'QT-0042 — ABC Co.'
 */
import { useState, useEffect, useRef } from 'react'
import {
  X,
  CalendarClock,
  Phone,
  FileSearch,
  ThumbsUp,
  Send,
  Users,
  ClipboardList,
  Calendar,
  User,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react'
import { activitiesAPI, usersAPI } from '../services/api'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Activity types ─────────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { value: 'follow_up',      label: 'Follow-up',      Icon: CalendarClock, desc: 'Schedule a follow-up date' },
  { value: 'call',           label: 'Call',            Icon: Phone,         desc: 'Phone or video call' },
  { value: 'check_document', label: 'Check Document',  Icon: FileSearch,    desc: 'Review a document' },
  { value: 'approve',        label: 'Approve',         Icon: ThumbsUp,      desc: 'Request approval' },
  { value: 'send',           label: 'Send',            Icon: Send,          desc: 'Send a document or email' },
  { value: 'meeting',        label: 'Meeting',         Icon: Users,         desc: 'Schedule a meeting' },
  { value: 'other',          label: 'Task',            Icon: ClipboardList, desc: 'General task' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Quick-select shortcuts
const QUICK_DATES = [
  { label: 'Today',     fn: () => todayIso() },
  { label: '+3 days',   fn: () => addDays(todayIso(), 3) },
  { label: '+1 week',   fn: () => addDays(todayIso(), 7) },
  { label: '+2 weeks',  fn: () => addDays(todayIso(), 14) },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function ScheduleActivityModal({
  open,
  onClose,
  onCreated,
  entityType,
  entityId,
  entityLabel,
}) {
  const [type,         setType]         = useState('follow_up')
  const [assignedToId, setAssignedToId] = useState('')
  const [dueDate,      setDueDate]      = useState(addDays(todayIso(), 3))
  const [note,         setNote]         = useState('')
  const [priority,     setPriority]     = useState('normal')
  const [users,        setUsers]        = useState([])
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  const firstInputRef = useRef(null)

  // ── Load users for assignee dropdown ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    usersAPI.getAll({ limit: 200 })
      .then(res => {
        const list = (res.data?.users || res.data || [])
        setUsers(list)
        // Default: assign to self (first user matching current token)
        if (!assignedToId && list.length > 0) {
          try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}')
            const self = list.find(u => u.id === stored.id)
            if (self) setAssignedToId(self.id)
            else      setAssignedToId(list[0].id)
          } catch {
            setAssignedToId(list[0].id)
          }
        }
      })
      .catch(() => {}) // non-critical
  }, [open])

  // Reset form on open
  useEffect(() => {
    if (!open) return
    setType('follow_up')
    setDueDate(addDays(todayIso(), 3))
    setNote('')
    setPriority('normal')
    setError('')
    setTimeout(() => firstInputRef.current?.focus(), 80)
  }, [open])

  if (!open) return null

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!dueDate)      return setError('Please select a due date.')
    if (!assignedToId) return setError('Please select who to assign this to.')
    setError('')
    setSubmitting(true)
    try {
      const res = await activitiesAPI.create({
        type,
        entityType,
        entityId,
        entityLabel: entityLabel || '',
        assignedToId,
        dueDate,
        note: note.trim() || null,
        priority,
      })
      onCreated?.(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule activity. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,13,12,0.45)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        width: '100%',
        maxWidth: 520,
        boxShadow: '0 20px 60px rgba(14,13,12,0.20)',
        overflow: 'hidden',
      }}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: `1px solid ${c(INK, 0.08)}`,
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: INK, margin: 0 }}>
              Schedule Activity
            </h3>
            {entityLabel && (
              <p style={{ fontSize: 12, color: c(INK, 0.45), margin: '3px 0 0' }}>
                {entityLabel}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: c(INK, 0.40), padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Activity type grid */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55), display: 'block', marginBottom: 8 }}>
              ACTIVITY TYPE
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}>
              {ACTIVITY_TYPES.map(({ value, label, Icon }) => {
                const active = type === value
                return (
                  <button
                    key={value}
                    ref={value === 'follow_up' ? firstInputRef : undefined}
                    onClick={() => setType(value)}
                    title={ACTIVITY_TYPES.find(t => t.value === value)?.desc}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 5, padding: '10px 6px',
                      border: `1.5px solid ${active ? FOREST : c(INK, 0.12)}`,
                      borderRadius: 10,
                      background: active ? c(FOREST, 0.07) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon
                      size={18}
                      style={{ color: active ? FOREST : c(INK, 0.40) }}
                    />
                    <span style={{
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      color: active ? FOREST : c(INK, 0.55),
                      lineHeight: 1.2, textAlign: 'center',
                    }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Assign to */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55), display: 'block', marginBottom: 6 }}>
              ASSIGN TO
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: c(INK, 0.35), pointerEvents: 'none',
              }} />
              <select
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 32px 9px 32px',
                  border: `1px solid ${c(INK, 0.15)}`, borderRadius: 8,
                  fontSize: 13, color: INK, background: '#fff',
                  appearance: 'none', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="">Select user…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName && u.lastName
                      ? `${u.firstName} ${u.lastName}`
                      : u.email
                    }
                    {u.role ? ` (${u.role})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                color: c(INK, 0.35), pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* Due date */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55), display: 'block', marginBottom: 6 }}>
              DUE DATE
            </label>
            {/* Quick shortcuts */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
              {QUICK_DATES.map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => setDueDate(fn())}
                  style={{
                    fontSize: 11, padding: '4px 9px',
                    border: `1px solid ${c(INK, 0.15)}`, borderRadius: 6,
                    background: dueDate === fn() ? c(FOREST, 0.08) : 'transparent',
                    color: dueDate === fn() ? FOREST : c(INK, 0.55),
                    fontWeight: dueDate === fn() ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: c(INK, 0.35), pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={dueDate}
                min={todayIso()}
                onChange={e => setDueDate(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 32px',
                  border: `1px solid ${c(INK, 0.15)}`, borderRadius: 8,
                  fontSize: 13, color: INK, background: '#fff',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Priority toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55) }}>
              PRIORITY
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {['normal', 'urgent'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 6,
                    border: `1px solid ${priority === p
                      ? p === 'urgent' ? '#C0392B' : FOREST
                      : c(INK, 0.12)}`,
                    background: priority === p
                      ? p === 'urgent' ? 'rgba(192,57,43,0.08)' : c(FOREST, 0.07)
                      : 'transparent',
                    color: priority === p
                      ? p === 'urgent' ? '#C0392B' : FOREST
                      : c(INK, 0.45),
                    fontWeight: priority === p ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {p === 'urgent' && <AlertTriangle size={11} />}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55), display: 'block', marginBottom: 6 }}>
              NOTE <span style={{ fontWeight: 400, color: c(INK, 0.35) }}>(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Instructions or context for the assignee…"
              rows={3}
              style={{
                width: '100%', padding: '9px 12px',
                border: `1px solid ${c(INK, 0.15)}`, borderRadius: 8,
                fontSize: 13, color: INK, background: '#fff',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(192,57,43,0.08)',
              border: '1px solid rgba(192,57,43,0.22)',
              fontSize: 13, color: '#A93226',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px 18px',
          borderTop: `1px solid ${c(INK, 0.08)}`,
          marginTop: 4,
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: `1px solid ${c(INK, 0.15)}`,
              background: 'transparent', fontSize: 13, color: c(INK, 0.65),
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !assignedToId || !dueDate}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: 'none',
              background: submitting || !assignedToId || !dueDate ? c(INK, 0.15) : FOREST,
              color: submitting || !assignedToId || !dueDate ? c(INK, 0.35) : CREAM,
              fontSize: 13, fontWeight: 600,
              cursor: submitting || !assignedToId || !dueDate ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'Scheduling…' : 'Schedule Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}
