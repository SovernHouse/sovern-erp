/**
 * ActivityIndicator
 *
 * Odoo-style clock icon in the top header bar.  Always visible; changes colour
 * based on the worst pending scheduled activity assigned to the current user:
 *
 *   grey   — no pending activities
 *   green  — all upcoming (future)
 *   amber  — at least one due today
 *   red    — at least one overdue
 *
 * Clicking opens a dropdown showing all pending activity pills with quick
 * Mark Done and navigate-to-record actions.
 *
 * Polls GET /api/scheduled-activities/my every 5 minutes.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  CheckCircle2,
  X,
  CalendarClock,
  Phone,
  FileSearch,
  ThumbsUp,
  Send,
  Users,
  ClipboardList,
  ChevronRight,
} from 'lucide-react'
import { activitiesAPI } from '../services/api'

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

// ── Urgency helpers ───────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)

function urgency(dueDate) {
  const d = (dueDate || '').slice(0, 10)
  const t = todayStr()
  if (d < t)  return 'overdue'
  if (d === t) return 'today'
  return 'future'
}

function worstUrgency(activities) {
  if (!activities.length) return 'none'
  const u = activities.map(a => urgency(a.dueDate))
  if (u.includes('overdue')) return 'overdue'
  if (u.includes('today'))   return 'today'
  return 'future'
}

const URGENCY_COLORS = {
  none:    { dot: c(INK, 0.25), bg: c(INK, 0.05),          border: c(INK, 0.12),          text: c(INK, 0.50),  pill_bg: c(INK, 0.05),         pill_border: c(INK, 0.12)         },
  future:  { dot: FOREST,       bg: c(FOREST, 0.10),        border: c(FOREST, 0.25),        text: FOREST,        pill_bg: c(FOREST, 0.08),       pill_border: c(FOREST, 0.22)      },
  today:   { dot: '#E67E22',    bg: 'rgba(230,126,34,0.10)', border: 'rgba(230,126,34,0.28)', text: '#A04000',    pill_bg: 'rgba(230,126,34,0.10)', pill_border: 'rgba(230,126,34,0.28)' },
  overdue: { dot: '#C0392B',    bg: 'rgba(192,57,43,0.10)',  border: 'rgba(192,57,43,0.28)', text: '#A93226',    pill_bg: 'rgba(192,57,43,0.10)', pill_border: 'rgba(192,57,43,0.28)'  },
}

// ── Activity type icons + labels ──────────────────────────────────────────────
const TYPE_ICONS = {
  follow_up:      CalendarClock,
  call:           Phone,
  check_document: FileSearch,
  approve:        ThumbsUp,
  send:           Send,
  meeting:        Users,
  other:          ClipboardList,
}
const TYPE_LABELS = {
  follow_up:      'Follow-up',
  call:           'Call',
  check_document: 'Check Doc',
  approve:        'Approve',
  send:           'Send',
  meeting:        'Meeting',
  other:          'Task',
}

// ── Entity → route map ────────────────────────────────────────────────────────
const ENTITY_ROUTES = {
  Quotation:       '/quotations',
  ProformaInvoice: '/proforma-invoices',
  SalesOrder:      '/orders',
  PurchaseOrder:   '/purchase-orders',
  Shipment:        '/shipments',
  Invoice:         '/invoices',
  Lead:            '/crm/leads',
  Customer:        '/customers',
  Factory:         '/factories',
  Inquiry:         '/inquiries',
  Inspection:      '/inspections',
  Claim:           '/claims',
  SampleRequest:   '/samples',
  LetterOfCredit:  '/letters-of-credit',
  Payment:         '/payments',
}

const POLL_MS = 5 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────────

export default function ActivityIndicator() {
  const navigate = useNavigate()
  const [activities, setActivities]   = useState([])
  const [open, setOpen]               = useState(false)
  const [dismissed, setDismissed]     = useState(new Set())
  const [markingDone, setMarkingDone] = useState(null)
  const dropdownRef = useRef(null)
  const intervalRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await activitiesAPI.getMy()
      setActivities(res.data || [])
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(intervalRef.current)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const visible = activities.filter(a => !dismissed.has(a.id))
  const worst   = worstUrgency(visible)
  const col     = URGENCY_COLORS[worst]

  const handleNavigate = (activity) => {
    const base = ENTITY_ROUTES[activity.entityType]
    if (base) navigate(`${base}/${activity.entityId}`)
    setOpen(false)
  }

  const handleMarkDone = async (e, id) => {
    e.stopPropagation()
    setMarkingDone(null)
    try {
      await activitiesAPI.markDone(id)
      setActivities(prev => prev.filter(a => a.id !== id))
    } catch { /* silently ignore */ }
  }

  const handleDismiss = (e, id) => {
    e.stopPropagation()
    setDismissed(prev => new Set(prev).add(id))
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* ── Clock icon button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        title={
          visible.length === 0
            ? 'No pending activities'
            : `${visible.length} pending activit${visible.length === 1 ? 'y' : 'ies'}`
        }
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 8,
          border: `1px solid ${open ? col.border : 'transparent'}`,
          background: open ? col.bg : 'transparent',
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
          color: worst === 'none' ? c(INK, 0.45) : col.text,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = c(INK, 0.05) }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <Clock size={17} />

        {/* Colour badge — hidden when no activities */}
        {visible.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, fontSize: 10, fontWeight: 700,
            background: col.dot, color: '#fff',
          }}>
            {visible.length}
          </span>
        )}
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 340,
          background: '#fff',
          border: '1px solid rgba(14,13,12,0.10)',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(14,13,12,0.14)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px',
            borderBottom: '1px solid rgba(14,13,12,0.08)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>My Activities</span>
            {visible.length > 0 && (
              <span style={{ fontSize: 11, color: c(INK, 0.45) }}>
                {visible.length} pending
              </span>
            )}
          </div>

          {/* Activity list */}
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px' }}>
            {visible.length === 0 ? (
              <div style={{
                padding: '24px 12px', textAlign: 'center',
                fontSize: 13, color: c(INK, 0.40),
              }}>
                <Clock size={22} style={{ opacity: 0.25, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                No pending activities
              </div>
            ) : (
              visible.map(activity => {
                const u   = urgency(activity.dueDate)
                const col = URGENCY_COLORS[u]
                const Icon = TYPE_ICONS[activity.type] || ClipboardList
                const dueFmt = new Date(activity.dueDate + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short',
                })
                const isConfirming = markingDone === activity.id

                return (
                  <div
                    key={activity.id}
                    onClick={() => handleNavigate(activity)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 7, marginBottom: 4,
                      background: col.pill_bg,
                      border: `1px solid ${col.pill_border}`,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    title={activity.note || `${TYPE_LABELS[activity.type]} on ${activity.entityType}`}
                  >
                    {/* Urgency dot */}
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: col.dot, flexShrink: 0,
                    }} />

                    {/* Icon */}
                    <Icon size={12} style={{ color: col.text, flexShrink: 0 }} />

                    {/* Label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 500, color: col.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        margin: 0,
                      }}>
                        {activity.entityLabel
                          ? `${TYPE_LABELS[activity.type]}: ${activity.entityLabel}`
                          : `${TYPE_LABELS[activity.type]} — ${activity.entityType}`
                        }
                      </p>
                      <p style={{ fontSize: 11, color: col.text, opacity: 0.70, margin: '1px 0 0' }}>
                        Due {dueFmt}
                        {activity.assignedTo && ` · ${activity.assignedTo.firstName}`}
                      </p>
                    </div>

                    {/* Navigate arrow */}
                    <ChevronRight size={12} style={{ color: col.text, opacity: 0.5, flexShrink: 0 }} />

                    {/* Mark done */}
                    {isConfirming ? (
                      <span
                        onClick={e => handleMarkDone(e, activity.id)}
                        style={{
                          fontSize: 11, fontWeight: 600, color: col.text,
                          flexShrink: 0, borderLeft: `1px solid ${col.pill_border}`,
                          paddingLeft: 6, cursor: 'pointer',
                        }}
                      >
                        Done?
                      </span>
                    ) : (
                      <CheckCircle2
                        size={13}
                        onClick={e => { e.stopPropagation(); setMarkingDone(activity.id) }}
                        style={{ color: col.text, opacity: 0.55, flexShrink: 0, cursor: 'pointer' }}
                        title="Mark as done"
                      />
                    )}

                    {/* Dismiss */}
                    <X
                      size={11}
                      onClick={e => handleDismiss(e, activity.id)}
                      style={{ color: col.text, opacity: 0.40, flexShrink: 0, cursor: 'pointer' }}
                      title="Dismiss"
                    />
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid rgba(14,13,12,0.07)',
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => { navigate('/activities'); setOpen(false) }}
              style={{
                fontSize: 12, color: FOREST, fontWeight: 500,
                border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
              }}
            >
              View all activities →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
