import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../LoadingSpinner'

const TYPE_TO_SEVERITY = {
  claim: 'error',
  payment: 'error',
  shipment: 'warning',
  inspection: 'warning',
  triage: 'warning',
  inquiry: 'info',
  quotation: 'info',
  order: 'info',
  system: 'info',
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * AlertWidget — compact list of unread notifications from /api/notifications.
 * Click an alert to mark read + navigate to its link. Dismiss permanently
 * deletes the row. No mock data.
 */
export default function AlertWidget({ config }) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/notifications', { params: { unreadOnly: 'true', limit: 20 } })
      const rows = Array.isArray(res?.data) ? res.data : (res?.data?.data || [])
      setAlerts(rows)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [fetchAlerts, config?.widget])

  const handleDismiss = async (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    try { await api.delete(`/notifications/${id}`) } catch (e) { fetchAlerts() }
  }

  const handleClick = async (alert) => {
    try { await api.patch(`/notifications/${alert.id}/read`) } catch (e) { /* non-fatal */ }
    if (alert.link) navigate(alert.link)
  }

  if (isLoading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">Could not load notifications.</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    )
  }

  const getIcon = (type) => {
    const sev = TYPE_TO_SEVERITY[type] || 'info'
    if (sev === 'error') return <AlertCircle className="w-5 h-5 text-red-600" />
    if (sev === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-600" />
    return <Info className="w-5 h-5 text-blue-600" />
  }

  const getBgColor = (type) => {
    const sev = TYPE_TO_SEVERITY[type] || 'info'
    if (sev === 'error') return 'bg-red-50 border-red-200'
    if (sev === 'warning') return 'bg-yellow-50 border-yellow-200'
    return 'bg-blue-50 border-blue-200'
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {alerts.length > 0 ? (
        alerts.map((alert) => (
          <div key={alert.id} className={`flex gap-3 p-3 rounded-lg border ${getBgColor(alert.type)} relative`}>
            <div className="flex-shrink-0 mt-0.5">{getIcon(alert.type)}</div>
            <div
              className={`flex-1 min-w-0 ${alert.link ? 'cursor-pointer' : ''}`}
              onClick={alert.link ? () => handleClick(alert) : undefined}
            >
              <p className="font-semibold text-sm text-slate-900">{alert.title}</p>
              <p className="text-sm text-slate-700 mt-1">{alert.message}</p>
              <p className="text-xs text-slate-500 mt-2">{relativeTime(alert.createdAt)}</p>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              className="p-1 hover:bg-white rounded transition-colors flex-shrink-0 self-start"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-600">No active notifications</p>
        </div>
      )}
    </div>
  )
}
