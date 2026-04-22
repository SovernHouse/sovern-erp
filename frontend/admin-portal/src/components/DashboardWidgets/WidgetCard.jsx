import { Trash2, GripVertical, Minimize2 } from 'lucide-react'
import { useState } from 'react'

/**
 * WidgetCard - Wrapper for dashboard widgets with drag handle and controls
 */
export default function WidgetCard({ title, children, onRemove, isDragging }) {
  const [isMinimized, setIsMinimized] = useState(false)

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all ${
      isDragging ? 'ring-2 ring-blue-500' : ''
    }`}>
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 cursor-move hover:bg-slate-100 transition-colors group">
        <div className="flex items-center space-x-2 flex-1">
          <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            <Minimize2 className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Remove widget"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* Widget Content */}
      {!isMinimized && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  )
}
