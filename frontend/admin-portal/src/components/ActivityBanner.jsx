/**
 * ActivityBanner
 *
 * Odoo-style scheduled-activity reminder bar rendered below the top header in
 * Layout.jsx.  Polls GET /api/scheduled-activities/my and renders one pill per
 * pending activity, colour-coded by urgency:
 *
 *   green  — dueDate is in the future
 *   amber  — dueDate is today
 *   red    — dueDate is in the past (overdue)
 *
 * Clicking a pill navigates to the linked ERP record and dismisses the banner
 * for that item (the item remains in the DB; navigation is the acknowledgement).
 *
 * A "Schedule Activity" button is available here too so users can self-assign
 * follow-up tasks without leaving whatever page they're on.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  Phone,
  FileSearch,
  ThumbsUp,
  Send,
  Users,
  ClipboardList,
} from 'lucide-react'
import { activitiesAPI } from '../services/api'

// ── Brand tokens (mirrors Layout.jsx — no shared module yet) ─────────────────
const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Colour logic ─────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10) // YYYY-MM-DD

function urgency(dueDate) {
  const d = dueDate?.slice(0, 10)
  const t = today()
  if (d < t)  return 'overdue'
  if (d === t) return 'today'
  return 'future'
}

const URGENCY_COLORS = {
  overdue: { bg: 'rgba(192,57,43,0.10)', border: 'rgba(192,57,43,0.30)', text: '#A93226', dot: '#C0392B' },
  today:   { bg: 'rgba(230,126,34,0.10)', border: 'rgba(230,126,34,0.30)', text: '#A04000', dot: '#E67E22' },
  future:  { bg: c(FOREST, 0.08),         border: c(FOREST, 0.22),         text: FOREST,   dot: FOREST   },
}

// ── Activity type icons ───────────────────────────────────────────────────────
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

// ── Entity → route map (must stay in sync with App.jsx) ──────────────────────
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

// ── Poll interval ─────────────────────────────────────────────────────────────
const POLL_MS = 5 * 60 * 1000 // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────

export default function ActivityBanner({ onSchedule }) {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [dismissed, setDismissed] = useState(new Set()) // IDs hidden this session
  const [collapsed, setCollapsed] = useState(false)
  const [markingDone, setMarkingDone] = useState(null) // ID being confirmed
  const intervalRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await activitiesAPI.getMy()
      setActivities(res.data || [])
    } catch {
      // silently ignore — banner is non-critical
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(intervalRef.current)
  }, [load])

  // Refresh hook exposed so parent / modal can trigger a reload after creating
  // a new activity (passed down via onSchedule callback round-trip)
  useEffect(() => {
    if (onSchedule) onSchedule.current = load
  }, [load, onSchedule])

  const visible = activities.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const counts = visible.reduce((acc, a) => {
    const u = urgency(a.dueDate)
    acc[u] = (acc[u] || 0) + 1
    return acc
  }, {})

  const handleNavigate = (activity) => {
    const base = ENTITY_ROUTES[activity.entityType]
    if (base) navigate(`${base}/${activity.entityId}`)
  }

  const handleMarkDone = async (e, id) => {
    e.stopPropagation()
    setMarkingDone(null)
    try {
      await activitiesAPI.markDone(id)
      setActivities(prev => prev.filter(a => a.id !== id))
    } catch {
      // silently ignore
    }
  }

  const handleDismiss = (e, id) => {
    e.stopPropagation()
    setDismissed(prev => new Set(prev).add(id))
  }

  // ── Summary bar (when collapsed) ──────────────────────────────────────────
  const SummaryDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {counts.overdue && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 12,
          background: URGENCY_COLORS.overdue.bg,
          border: `1px solid ${URGENCY_COLORS.overdue.border}`,
          fontSize: 12, fontWeight: 600, color: URGENCY_COLORS.overdue.text,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: URGENCY_COLORS.overdue.dot }} />
          {counts.overdue} overdue
        </span>
      )}
      {counts.today && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 12,
          background: URGENCY_COLORS.today.bg,
          border: `1px solid ${URGENCY_COLORS.today.border}`,
          fontSize: 12, fontWeight: 600, color: URGENCY_COLORS.today.text,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: URGENCY_COLORS.today.dot }} />
          {counts.today} due today
        </span>
      )}
      {counts.future && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 12,
          background: URGENCY_COLORS.future.bg,
          border: `1px solid ${URGENCY_COLORS.future.border}`,
          fontSize: 12, fontWeight: 600, color: URGENCY_COLORS.future.text,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: URGENCY_COLORS.future.dot }} />
          {counts.future} upcoming
        </span>
      )}
    </div>
  )

  return (
    <div style={{
      borderBottom: `1px solid rgba(14,13,12,0.08)`,
      background: c(INK, 0.02),
    }}>
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 20px',
        cursor: 'pointer',
      }}
        onClick={() => setCollapsed(v => !v)}
      >
        <Clock size={14} style={{ color: c(INK, 0.45), flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: c(INK, 0.55), marginRight: 4 }}>
          My Activities
        </span>
        <SummaryDots />
        <div style={{ marginLeft: 'auto', color: c(INK, 0.35) }}>
          {collapsed
            ? <ChevronDown size={14} />
            : <ChevronUp   size={14} />
          }
        </div>
      </div>

      {/* ── Activity pills ───────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          padding: '0 20px 10px',
        }}>
          {visible.map(activity => {
            const u = urgency(activity.dueDate)
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
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 8px',
                  borderRadius: 20,
                  background: col.bg,
                  border: `1px solid ${col.border}`,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'opacity 0.15s',
                  maxWidth: 340,
                }}
                title={activity.note || activity.entityLabel || `${TYPE_LABELS[activity.type]} on ${activity.entityType}`}
              >
                {/* Urgency dot */}
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: col.dot, flexShrink: 0,
                }} />

                {/* Type icon */}
                <Icon size={12} style={{ color: col.text, flexShrink: 0 }} />

                {/* Label */}
                <span style={{
                  fontSize: 12, fontWeight: 500, color: col.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}>
                  {activity.entityLabel
                    ? `${TYPE_LABELS[activity.type]}: ${activity.entityLabel}`
                    : `${TYPE_LABELS[activity.type]} — ${activity.entityType}`
                  }
                </span>

                {/* Due date */}
                <span style={{
                  fontSize: 11, color: col.text, opacity: 0.75,
                  flexShrink: 0,
                }}>
                  {dueFmt}
                </span>

                {/* Mark done button / confirm */}
                {isConfirming ? (
                  <span
                    onClick={e => handleMarkDone(e, activity.id)}
                    style={{
                      fontSize: 11, fontWeight: 600, color: col.text,
                      marginLeft: 2, flexShrink: 0,
                      borderLeft: `1px solid ${col.border}`,
                      paddingLeft: 6,
                    }}
                  >
                    ✓ Done?
                  </span>
                ) : (
                  <CheckCircle2
                    size={13}
                    onClick={e => { e.stopPropagation(); setMarkingDone(activity.id) }}
                    style={{ color: col.text, opacity: 0.6, flexShrink: 0, marginLeft: 2, cursor: 'pointer' }}
                    title="Mark as done"
                  />
                )}

                {/* Dismiss (session-only) */}
                <X
                  size={11}
                  onClick={e => handleDismiss(e, activity.id)}
                  style={{ color: col.text, opacity: 0.45, flexShrink: 0, cursor: 'pointer' }}
                  title="Dismiss for now"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
