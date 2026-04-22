import { CheckCircle, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * PendingApprovalsWidget - List of items needing approval
 */
export default function PendingApprovalsWidget() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        // Simulated pending approvals data
        const mockData = [
          { id: 1, type: 'Quote', description: 'Quote #Q-2026-001 from Acme Inc', age: 2, priority: 'high' },
          { id: 2, type: 'PO', description: 'PO #PO-2026-045 for Raw Materials', age: 5, priority: 'medium' },
          { id: 3, type: 'Invoice', description: 'Invoice #INV-2026-123 - $5,500', age: 1, priority: 'high' },
          { id: 4, type: 'GRN', description: 'GRN #GRN-2026-078 - Receipt confirmation', age: 3, priority: 'low' },
          { id: 5, type: 'Claim', description: 'Quality Claim #CLM-2026-012', age: 7, priority: 'medium' }
        ]
        setData(mockData)
      } catch (error) {
        console.error('Failed to fetch pending approvals:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPendingApprovals()
  }, [])

  if (isLoading) return <LoadingSpinner />

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-900'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      default:
        return 'bg-green-50 border-green-200 text-green-900'
    }
  }

  const totalCount = data?.length || 0
  const highPriority = data?.filter(item => item.priority === 'high').length || 0

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-700 font-medium">Pending</p>
          <p className="text-2xl font-bold text-red-900">{totalCount}</p>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-xs text-orange-700 font-medium">High Priority</p>
          <p className="text-2xl font-bold text-orange-900">{highPriority}</p>
        </div>
      </div>

      {/* Pending Items List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data?.map((item) => (
          <div
            key={item.id}
            className={`p-3 rounded-lg border ${getPriorityColor(item.priority)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-slate-200 rounded">
                    {item.type}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.priority === 'high' ? 'bg-red-200' :
                    item.priority === 'medium' ? 'bg-yellow-200' :
                    'bg-green-200'
                  }`}>
                    {item.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2 truncate">{item.description}</p>
                <div className="flex items-center space-x-1 mt-2">
                  <Clock className="w-3 h-3 opacity-70" />
                  <span className="text-xs opacity-75">{item.age} days old</span>
                </div>
              </div>
              <button
                className="ml-2 p-2 hover:bg-white rounded transition-colors flex-shrink-0"
                title="Approve"
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
        <p className="text-xs text-slate-600">Showing {data?.length} items</p>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</button>
      </div>
    </div>
  )
}
