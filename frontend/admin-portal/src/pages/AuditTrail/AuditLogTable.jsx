import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import AuditDetail from './AuditDetail'

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800'
}

export default function AuditLogTable({ logs, page, limit, total, onPageChange, onLimitChange }) {
  const [expandedId, setExpandedId] = useState(null)

  const pages = Math.ceil(total / limit)
  const hasNextPage = page < pages
  const hasPrevPage = page > 1

  const formatDate = (date) => {
    return new Date(date).toLocaleString()
  }

  const getUserName = (log) => {
    if (log.user) {
      return `${log.user.firstName} ${log.user.lastName}`
    }
    return 'System'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Timestamp</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">User</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Action</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Entity</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">IP Address</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                No audit logs found
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-900">{formatDate(log.timestamp)}</td>
                <td className="px-6 py-4 text-sm text-slate-900">{getUserName(log)}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-800'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  <div>
                    <div className="font-medium">{log.entity}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{log.entityId}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{log.ipAddress || 'N/A'}</td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600"
                  >
                    {expandedId === log.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Expanded Details Rows */}
      {logs.map((log) =>
        expandedId === log.id ? (
          <div key={`${log.id}-detail`} className="border-b border-slate-200 bg-slate-50">
            <AuditDetail log={log} />
          </div>
        ) : null
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center gap-4">
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <div className="text-sm text-slate-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrevPage}
            className="px-3 py-2 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Previous
          </button>
          <div className="px-4 py-2 text-sm">
            Page {page} of {pages}
          </div>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage}
            className="px-3 py-2 border border-slate-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
