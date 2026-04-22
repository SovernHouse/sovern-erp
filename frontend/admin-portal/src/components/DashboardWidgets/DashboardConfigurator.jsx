import { ChevronDown, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'

/**
 * DashboardConfigurator - UI to add/remove/resize widgets
 */
export default function DashboardConfigurator({ onApply, currentWidgets, onReset }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedWidgets, setSelectedWidgets] = useState(
    currentWidgets?.map(w => w.id) || []
  )
  const [widgetSizes, setWidgetSizes] = useState(
    currentWidgets?.reduce((acc, w) => ({ ...acc, [w.id]: w.size }), {}) || {}
  )

  const availableWidgets = [
    { id: 'revenue', name: 'Revenue Summary', type: 'revenue', defaultSize: 'medium' },
    { id: 'orders', name: 'Order Status', type: 'orders', defaultSize: 'medium' },
    { id: 'approvals', name: 'Pending Approvals', type: 'approvals', defaultSize: 'medium' },
    { id: 'activity', name: 'Recent Activity', type: 'activity', defaultSize: 'large' },
    { id: 'kpi', name: 'KPI Card', type: 'kpi', defaultSize: 'small' },
    { id: 'actions', name: 'Quick Actions', type: 'actions', defaultSize: 'medium' },
    { id: 'alerts', name: 'Alerts & Notifications', type: 'alerts', defaultSize: 'medium' }
  ]

  const sizeOptions = [
    { value: 'small', label: '1x1 (Small)', width: '1x1' },
    { value: 'medium', label: '2x1 (Medium)', width: '2x1' },
    { value: 'large', label: '1x2 (Large)', width: '1x2' }
  ]

  const toggleWidget = (widgetId) => {
    setSelectedWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    )
  }

  const updateWidgetSize = (widgetId, newSize) => {
    setWidgetSizes(prev => ({ ...prev, [widgetId]: newSize }))
  }

  const handleApply = () => {
    const newLayout = availableWidgets
      .filter(w => selectedWidgets.includes(w.id))
      .map(w => ({
        ...w,
        size: widgetSizes[w.id] || w.defaultSize
      }))

    onApply?.(newLayout)
    setExpanded(false)
  }

  const handleReset = () => {
    setSelectedWidgets(availableWidgets.map(w => w.id))
    setWidgetSizes(availableWidgets.reduce((acc, w) => ({ ...acc, [w.id]: w.defaultSize }), {}))
    onReset?.()
  }

  return (
    <div className="mb-6">
      {/* Configurator Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Customize Dashboard</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Configurator Panel */}
      {expanded && (
        <div className="mt-4 p-6 bg-white rounded-lg border-2 border-blue-300 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Dashboard Configuration</h3>

          {/* Widget Selection */}
          <div className="space-y-4 mb-6">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Available Widgets</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableWidgets.map(widget => (
                  <div key={widget.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      id={`widget-${widget.id}`}
                      checked={selectedWidgets.includes(widget.id)}
                      onChange={() => toggleWidget(widget.id)}
                      className="mt-1 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`widget-${widget.id}`}
                        className="block text-sm font-medium text-slate-900 cursor-pointer mb-2"
                      >
                        {widget.name}
                      </label>
                      <select
                        value={widgetSizes[widget.id] || widget.defaultSize}
                        onChange={(e) => updateWidgetSize(widget.id, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {sizeOptions.map(size => (
                          <option key={size.value} value={size.value}>
                            {size.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">💡 Tip:</span> You can drag widgets to reorder them on the dashboard. Uncheck widgets to hide them.
              </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default</span>
            </button>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setExpanded(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply Changes
              </button>
            </div>
          </div>

          {/* Status */}
          <p className="text-xs text-slate-600 mt-4">
            Selected: {selectedWidgets.length} of {availableWidgets.length} widgets
          </p>
        </div>
      )}
    </div>
  )
}
