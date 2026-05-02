/**
 * WorkflowStatusBar — Odoo-style stage progress bar.
 *
 * Usage:
 *   <WorkflowStatusBar stages={QUOTATION_STAGES} currentStatus="sent" />
 *
 * Preset stage definitions are exported below so each page can import them
 * without duplicating the config.
 */
import { CheckCircle } from 'lucide-react'

// ── Stage presets ───────────────────────────────────────────────────────────

export const QUOTATION_STAGES = [
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Sent' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'converted', label: 'Converted' },
  { key: 'cancelled', label: 'Cancelled', terminal: true, negative: true },
]

export const PROFORMA_STAGES = [
  { key: 'draft',    label: 'Draft' },
  { key: 'sent',     label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid',     label: 'Paid' },
  { key: 'cancelled',label: 'Cancelled', terminal: true, negative: true },
]

export const SALES_ORDER_STAGES = [
  { key: 'draft',      label: 'Draft' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'invoiced',   label: 'Invoiced' },
  { key: 'cancelled',  label: 'Cancelled', terminal: true, negative: true },
]

export const PURCHASE_ORDER_STAGES = [
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Sent' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'received',  label: 'Received' },
  { key: 'paid',      label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled', terminal: true, negative: true },
]

export const LEAD_STAGES = [
  { key: 'new',         label: 'New' },
  { key: 'contacted',   label: 'Contacted' },
  { key: 'qualified',   label: 'Qualified' },
  { key: 'proposal',    label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won',         label: 'Won', terminal: true },
  { key: 'lost',        label: 'Lost', terminal: true, negative: true },
]

export const APPROVAL_STAGES = [
  { key: 'draft',     label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewing', label: 'Under Review' },
  { key: 'approved',  label: 'Approved', terminal: true },
  { key: 'rejected',  label: 'Rejected', terminal: true, negative: true },
]

// ── Component ───────────────────────────────────────────────────────────────

export default function WorkflowStatusBar({
  stages,
  currentStatus,
  onStageClick,   // optional: (stageKey) => void  — allows clicking to advance
  className = '',
}) {
  const currentIdx = stages.findIndex(s => s.key === currentStatus)
  const currentStage = stages[currentIdx]
  const isNegative = currentStage?.negative

  return (
    <div className={`bg-white rounded-xl border border-slate-200 px-5 py-4 ${className}`}>
      <div className="flex items-center gap-0">
        {stages.map((stage, idx) => {
          const isPast    = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isFuture  = idx > currentIdx
          const isLast    = idx === stages.length - 1

          // A cancelled/negative terminal stage is shown separately at the end
          if (stage.negative && !isCurrent) {
            return null
          }

          let stageColor = 'text-slate-400'
          let circleFill = 'bg-slate-100 border-slate-200'
          let lineColor  = 'bg-slate-200'

          if (isPast) {
            stageColor = 'text-forest-700'
            circleFill = 'bg-forest-600 border-forest-600'
            lineColor  = 'bg-forest-400'
          } else if (isCurrent && !isNegative) {
            stageColor = 'text-forest-800'
            circleFill = 'bg-forest-600 border-forest-600'
          } else if (isCurrent && isNegative) {
            stageColor = 'text-red-700'
            circleFill = 'bg-red-100 border-red-400'
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              {/* Stage node */}
              <button
                onClick={() => onStageClick?.(stage.key)}
                disabled={!onStageClick || isCurrent}
                className={`flex flex-col items-center gap-1 group flex-shrink-0 ${onStageClick && !isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                  ${circleFill}
                  ${onStageClick && !isCurrent ? 'group-hover:scale-110' : ''}
                `}>
                  {isPast ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? (isNegative ? 'bg-red-500' : 'bg-white') : 'bg-slate-300'}`} />
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${stageColor}`}>
                  {stage.label}
                </span>
              </button>

              {/* Connector line (skip after last visible node) */}
              {!isLast && !stage.negative && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${lineColor}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
