import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowUpRight } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'
import { ordersAPI } from '../../services/api'

// Status palette — keep stable across renders so the colors look the same
// every time (otherwise the order pie chart re-colors as data shifts).
const STATUS_PALETTE = {
  draft:         '#94a3b8',
  pending:       '#f59e0b',
  confirmed:     '#3b82f6',
  in_production: '#6366f1',
  ready:         '#0ea5e9',
  shipped:       '#10b981',
  delivered:     '#22c55e',
  completed:     '#16a34a',
  cancelled:     '#ef4444',
}
const FALLBACK_COLOR = '#64748b'
function colorFor(status) {
  return STATUS_PALETTE[status] || FALLBACK_COLOR
}
function humanize(status) {
  return (status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function OrderStatusWidget() {
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Pull a generous page so the chart reflects everything in flight.
        const res = await ordersAPI.getAll({ limit: 200 })
        if (cancelled) return
        const orders = res.data || []
        const counts = orders.reduce((acc, o) => {
          const k = o.status || 'unknown'
          acc[k] = (acc[k] || 0) + 1
          return acc
        }, {})
        const total = orders.length
        const arr = Object.entries(counts)
          .map(([status, count]) => ({
            status,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
            color: colorFor(status),
          }))
          .sort((a, b) => b.count - a.count)
        setBuckets(arr)
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error?.message || 'Failed to load order status')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  const total = buckets.reduce((sum, b) => sum + b.count, 0)

  if (total === 0) {
    return (
      <div
        onClick={() => navigate('/orders')}
        className="text-center py-8 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
      >
        <p className="text-slate-600">No sales orders yet.</p>
        <p className="text-blue-600 text-sm mt-2">Create your first order →</p>
      </div>
    )
  }

  let cumulativePercentage = 0

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {buckets.map((item) => {
            const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2
            const endAngle = ((cumulativePercentage + item.percentage) / 100) * 2 * Math.PI - Math.PI / 2
            const x1 = 100 + 60 * Math.cos(startAngle)
            const y1 = 100 + 60 * Math.sin(startAngle)
            const x2 = 100 + 60 * Math.cos(endAngle)
            const y2 = 100 + 60 * Math.sin(endAngle)
            const largeArc = item.percentage > 50 ? 1 : 0
            const pathData = item.percentage >= 99.99
              ? `M 100 40 A 60 60 0 1 1 99.99 40 Z` // single-status ring
              : ['M 100 100', `L ${x1} ${y1}`, `A 60 60 0 ${largeArc} 1 ${x2} ${y2}`, 'Z'].join(' ')
            cumulativePercentage += item.percentage
            return (
              <path
                key={item.status}
                d={pathData}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/orders?status=${encodeURIComponent(item.status)}`)}
              >
                <title>{humanize(item.status)}: {item.count} ({item.percentage.toFixed(1)}%)</title>
              </path>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {buckets.map((item) => (
          <button
            key={item.status}
            onClick={() => navigate(`/orders?status=${encodeURIComponent(item.status)}`)}
            className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-600 truncate group-hover:text-blue-600">
                {humanize(item.status)}
              </p>
              <p className="text-sm font-bold text-slate-900">
                {item.count} <span className="text-slate-500 font-normal">({item.percentage.toFixed(0)}%)</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/orders')}
        className="w-full pt-3 border-t border-slate-200 text-xs text-slate-600 hover:text-blue-600 flex justify-between items-center"
      >
        <span>Total Orders: <span className="font-bold text-slate-900">{total}</span></span>
        <span className="flex items-center gap-1">View all <ArrowUpRight className="w-3 h-3" /></span>
      </button>
    </div>
  )
}
