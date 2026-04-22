import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']
const ENTITIES = ['User', 'Customer', 'Factory', 'Invoice', 'PurchaseOrder', 'SalesOrder', 'Quotation', 'Shipment', 'Claim']
const TIME_RANGES = [
  { value: 1, label: 'Last 1 Hour' },
  { value: 6, label: 'Last 6 Hours' },
  { value: 24, label: 'Last 24 Hours' },
  { value: 7 * 24, label: 'Last 7 Days' },
  { value: 30 * 24, label: 'Last 30 Days' },
  { value: null, label: 'All Time' }
]

export default function AuditFilters({ filters, onChange }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleActionChange = (action) => {
    onChange({
      ...filters,
      action: filters.action === action ? null : action
    })
  }

  const handleEntityChange = (entity) => {
    onChange({
      ...filters,
      entity: filters.entity === entity ? null : entity
    })
  }

  const handleTimeRangeChange = (hours) => {
    onChange({
      ...filters,
      hoursBack: hours
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          {isOpen ? 'Hide' : 'Show'} <ChevronDown className={`w-4 h-4 transition ${isOpen ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Action</label>
            <div className="space-y-2">
              {ACTIONS.map(action => (
                <label key={action} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.action === action}
                    onChange={() => handleActionChange(action)}
                    className="rounded border-slate-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">{action}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Entity Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Entity Type</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ENTITIES.map(entity => (
                <label key={entity} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.entity === entity}
                    onChange={() => handleEntityChange(entity)}
                    className="rounded border-slate-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">{entity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Time Range</label>
            <select
              value={filters.hoursBack ?? ''}
              onChange={(e) => handleTimeRangeChange(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value ?? 'all'} value={range.value ?? ''}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
