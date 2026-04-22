import { Trash2, GripVertical } from 'lucide-react'
import { useState } from 'react'

/**
 * WidgetContainer - Draggable dashboard widget wrapper with HTML5 drag API
 * Supports drag-and-drop reordering without external libraries
 */
export default function WidgetContainer({
  id,
  title,
  type,
  size = 'medium',
  position,
  children,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) {
  const [isMinimized, setIsMinimized] = useState(false)

  // Grid size classes: small (1x1), medium (2x1), large (1x2)
  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-2 row-span-1',
    large: 'col-span-1 row-span-2'
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, id)}
      onDragOver={(e) => onDragOver && onDragOver(e)}
      onDrop={(e) => onDrop && onDrop(e, id)}
      className={`${sizeClasses[size] || sizeClasses.medium} bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all ${
        isDragging ? 'ring-2 ring-blue-500 opacity-50' : ''
      } hover:shadow-md cursor-move`}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
          <h3 className="font-semibold text-slate-900 truncate">{title}</h3>
          <span className="ml-auto text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded flex-shrink-0">
            {type}
          </span>
        </div>
        <button
          onClick={() => onRemove && onRemove(id)}
          className="p-1 hover:bg-red-100 rounded transition-colors ml-2 flex-shrink-0"
          title="Remove widget"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      </div>

      {/* Widget Content */}
      {!isMinimized && (
        <div className="p-4 overflow-auto max-h-96">
          {children}
        </div>
      )}

      {/* Minimize Button */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-xs px-2 py-1 rounded hover:bg-slate-200 transition-colors"
        >
          {isMinimized ? 'Expand' : 'Minimize'}
        </button>
      </div>
    </div>
  )
}
