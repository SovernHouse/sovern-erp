import { useState } from 'react'
import WidgetCard from './WidgetCard'
import KPIWidget from './KPIWidget'
import ChartWidget from './ChartWidget'
import TableWidget from './TableWidget'
import AlertWidget from './AlertWidget'

/**
 * WidgetGrid - Drag-and-drop widget grid container
 * Uses HTML5 Drag API (no external libraries)
 */
export default function WidgetGrid({ widgets, onRemoveWidget, onUpdateWidget }) {
  const [draggedWidget, setDraggedWidget] = useState(null)
  const [dropZone, setDropZone] = useState(null)

  const handleDragStart = (e, widgetId) => {
    setDraggedWidget(widgetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (draggedWidget && draggedWidget !== targetId) {
      const draggedIndex = widgets.findIndex(w => w.id === draggedWidget)
      const targetIndex = widgets.findIndex(w => w.id === targetId)

      const newWidgets = [...widgets]
      newWidgets.splice(draggedIndex, 1)
      newWidgets.splice(targetIndex, 0, widgets[draggedIndex])

      // Update parent with new order (widgets is the source of truth for order)
      widgets.forEach((w, i) => {
        onUpdateWidget(w.id, { order: i })
      })
    }
    setDraggedWidget(null)
    setDropZone(null)
  }

  const renderWidget = (widget) => {
    switch (widget.type) {
      case 'kpi':
        return <KPIWidget config={widget} />
      case 'chart':
        return <ChartWidget config={widget} />
      case 'table':
        return <TableWidget config={widget} />
      case 'alert':
        return <AlertWidget config={widget} />
      case 'widget':
      default:
        return (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600">{widget.title}</p>
          </div>
        )
    }
  }

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-max">
      {widgets.map((widget) => (
        <div
          key={widget.id}
          draggable
          onDragStart={(e) => handleDragStart(e, widget.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, widget.id)}
          onDragEnter={() => setDropZone(widget.id)}
          onDragLeave={() => setDropZone(null)}
          className={`${widget.gridSize?.w || 6} col-span-${widget.gridSize?.w || 6} cursor-move transition-opacity ${
            draggedWidget === widget.id ? 'opacity-50' : ''
          } ${dropZone === widget.id ? 'opacity-70' : ''}`}
          style={{
            gridColumn: `span ${Math.min(widget.gridSize?.w || 6, 12)}`
          }}
        >
          <WidgetCard
            title={widget.title}
            onRemove={() => onRemoveWidget(widget.id)}
            isDragging={draggedWidget === widget.id}
          >
            {renderWidget(widget)}
          </WidgetCard>
        </div>
      ))}
    </div>
  )
}
