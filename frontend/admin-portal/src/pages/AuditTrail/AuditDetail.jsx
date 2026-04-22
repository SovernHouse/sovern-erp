import { useState } from 'react'

export default function AuditDetail({ log }) {
  const [viewMode, setViewMode] = useState('json')

  const renderDiff = (changes) => {
    if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
      return <div className="text-slate-500 text-sm">No changes recorded</div>
    }

    if (viewMode === 'json') {
      return (
        <pre className="bg-slate-900 text-slate-100 p-4 rounded overflow-auto text-xs font-mono max-h-64">
          {JSON.stringify(changes, null, 2)}
        </pre>
      )
    } else {
      // Table view
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Field</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Before</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">After</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(changes).map(([key, value]) => {
              const before = value.before ?? 'N/A'
              const after = value.after ?? 'N/A'
              return (
                <tr key={key} className="border-b border-slate-200 hover:bg-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{key}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{String(before)}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{String(after)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="bg-white rounded border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-900">Change Details</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'json'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Table
            </button>
          </div>
        </div>
        {renderDiff(log.changes)}
      </div>
    </div>
  )
}
