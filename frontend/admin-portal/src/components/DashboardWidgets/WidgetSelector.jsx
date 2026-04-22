import { X, Check } from 'lucide-react'

/**
 * WidgetSelector - Modal to add new widgets to dashboard
 */
export default function WidgetSelector({ availableWidgets, usedWidgets, onSelectWidget, onClose }) {
  const usedIds = usedWidgets.map(w => w.id)

  const groupedWidgets = availableWidgets.reduce((acc, widget) => {
    const category = widget.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(widget)
    return acc
  }, {})

  const categoryLabels = {
    metrics: 'Key Metrics',
    charts: 'Charts',
    tables: 'Tables',
    alerts: 'Alerts',
    other: 'Other'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <h2 className="text-2xl font-bold text-slate-900">Add Widgets</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {Object.entries(groupedWidgets).map(([category, widgets]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {categoryLabels[category] || category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {widgets.map(widget => {
                  const isUsed = usedIds.includes(widget.id)
                  return (
                    <button
                      key={widget.id}
                      onClick={() => !isUsed && onSelectWidget(widget)}
                      disabled={isUsed}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isUsed
                          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                          : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{widget.name}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {widget.defaultSize?.w}×{widget.defaultSize?.h}
                          </p>
                        </div>
                        {isUsed && <Check className="w-5 h-5 text-green-600 flex-shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
