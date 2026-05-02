/**
 * KanbanBoard — Odoo-style drag-and-drop pipeline view.
 *
 * Uses the HTML5 Drag and Drop API — no extra package required.
 *
 * Props:
 *   columns     — Array<{ key: string, label: string, color: string, textColor: string }>
 *   cards       — Array of record objects (must have .id and a field matching `statusField`)
 *   statusField — Key on each card that holds the stage value (default: 'status')
 *   onMove      — async (cardId, newStatus) => void  — called when card is dropped to new column
 *   renderCard  — (card) => ReactNode  — optional custom card renderer
 *   onCardClick — (card) => void  — navigate to detail page
 *   groupValueFn — (card) => number  — optional, used to sum column totals
 *   className   — optional
 */
import { useState, useRef, useCallback } from 'react'
import { formatCurrency } from '../utils/formatters'

function defaultRenderCard(card, statusField) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900 truncate">
        {card.companyName || card.name || card.title || 'Unnamed'}
      </p>
      {card.contactName && (
        <p className="text-xs text-slate-500 mt-0.5 truncate">{card.contactName}</p>
      )}
      {card.productInterest && (
        <p className="text-xs text-forest-700 mt-1 truncate">{card.productInterest}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-bold text-slate-700">
          {card.estimatedValue || card.totalValueUSD
            ? formatCurrency(parseFloat(card.estimatedValue || card.totalValueUSD || 0))
            : '—'
          }
        </span>
        {card.probability != null && (
          <span className="text-xs text-slate-400">{card.probability}%</span>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({
  columns,
  cards,
  statusField = 'status',
  onMove,
  renderCard,
  onCardClick,
  groupValueFn,
  className = '',
}) {
  const [draggingId, setDraggingId]   = useState(null)
  const [overColumn, setOverColumn]   = useState(null)
  const [optimistic, setOptimistic]   = useState({}) // { [cardId]: newStatus } — local overrides during drag
  const dragCard = useRef(null)

  const getStatus = useCallback((card) => {
    return optimistic[card.id] ?? card[statusField]
  }, [optimistic, statusField])

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (e, card) => {
    dragCard.current = card
    setDraggingId(card.id)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image
    const ghost = document.createElement('div')
    ghost.style.position = 'fixed'
    ghost.style.top = '-1000px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setOverColumn(null)
    dragCard.current = null
  }

  const handleDragOver = (e, colKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverColumn(colKey)
  }

  const handleDrop = async (e, colKey) => {
    e.preventDefault()
    setOverColumn(null)
    const card = dragCard.current
    if (!card || getStatus(card) === colKey) return

    // Optimistic update
    setOptimistic(prev => ({ ...prev, [card.id]: colKey }))
    try {
      await onMove?.(card.id, colKey)
    } catch (err) {
      // Revert on failure
      setOptimistic(prev => {
        const next = { ...prev }
        delete next[card.id]
        return next
      })
    }
  }

  // ── Column stats ──────────────────────────────────────────────────────────
  const getColumnCards = (colKey) => cards.filter(c => getStatus(c) === colKey)
  const getColumnValue = (colKey) => {
    if (!groupValueFn) return null
    return getColumnCards(colKey).reduce((sum, c) => sum + (groupValueFn(c) || 0), 0)
  }

  return (
    <div className={`flex gap-3 overflow-x-auto pb-4 ${className}`}>
      {columns.map(col => {
        const colCards = getColumnCards(col.key)
        const colValue = getColumnValue(col.key)
        const isOver   = overColumn === col.key

        return (
          <div
            key={col.key}
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={e => handleDrop(e, col.key)}
            className={`flex-shrink-0 w-64 rounded-xl transition-all duration-150
              ${isOver ? 'bg-slate-100 ring-2 ring-forest-400' : 'bg-slate-50'}
            `}
            style={{ minHeight: '200px' }}
          >
            {/* Column header */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 font-medium">
                  {colCards.length}
                </span>
              </div>
              {colValue != null && colValue > 0 && (
                <p className="text-xs text-slate-500 pl-4">{formatCurrency(colValue)}</p>
              )}
            </div>

            {/* Cards */}
            <div className="px-2 pb-3 space-y-2 min-h-[120px]">
              {colCards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={e => handleDragStart(e, card)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onCardClick?.(card)}
                  className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none
                    shadow-sm hover:shadow-md transition-all duration-100
                    ${draggingId === card.id ? 'opacity-40 ring-2 ring-forest-400' : 'opacity-100'}
                    ${onCardClick ? 'hover:border-forest-300' : ''}
                    border-slate-200
                  `}
                >
                  {renderCard
                    ? renderCard(card)
                    : defaultRenderCard(card, statusField)
                  }
                </div>
              ))}

              {/* Drop zone indicator */}
              {isOver && draggingId && !getColumnCards(col.key).find(c => c.id === draggingId) && (
                <div className="border-2 border-dashed border-forest-400 rounded-lg h-16 flex items-center justify-center">
                  <span className="text-xs text-forest-600 font-medium">Drop here</span>
                </div>
              )}

              {colCards.length === 0 && !isOver && (
                <div className="h-16 flex items-center justify-center">
                  <span className="text-xs text-slate-400">No leads</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Pre-built column configs ────────────────────────────────────────────────

export const LEAD_KANBAN_COLUMNS = [
  { key: 'new',         label: 'New',         color: '#94a3b8' },
  { key: 'contacted',   label: 'Contacted',   color: '#60a5fa' },
  { key: 'qualified',   label: 'Qualified',   color: '#a78bfa' },
  { key: 'proposal',    label: 'Proposal',    color: '#fb923c' 