import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
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
 * AlertsWidget — pulls real user notifications from /api/notifications.
 * Dismiss = DELETE the notification (permanent). Unread items appear here;
 * they disappear when read or deleted.
 */
export default function AlertsWidget() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState(null)
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
  }, [fetchAlerts])

  const handleDismiss = async (id) => {
    setAlerts((prev) => (prev || []).filter((a) => a.id !== id))
    try {
      await api.delete(`/notifications/${id}`)
    } catch (e) {
      fetchAlerts()
    }
  }

  const handleDismissAll = async () => {
    const ids = (alerts || []).map((a) => a.id)
    setAlerts([])
    await Promise.all(ids.map((id) => api.delete(`/notifications/${id}`).catch(() => {})))
  }

  const handleClick = async (alert) => {
    try {
      await api.patch(`/notifications/${alert.id}/read`)
    } catch (e) { /* non-fatal */ }
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

  const errorCount = (alerts || []).filter((a) => TYPE_TO_SEVERITY[a.type] === 'error').length
  const warningCount = (alerts || []).filter((a) => TYPE_TO_SEVERITY[a.type] === 'warning').length

  const getStyles = (type) => {
    const sev = TYPE_TO_SEVERITY[type] || 'info'
    if (sev === 'error') return { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700', Icon: AlertCircle }
    if (sev === 'warning') return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-900', text: 'text-yellow-700', Icon: AlertTriangle }
    return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-900', text: 'text-blue-700', Icon: Info }
  }

  return (
    <div className="space-y-2">
      <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-900">{(alerts || []).length} Active Notifications</p>
        <p className="text-xs text-slate-600 mt-1">{errorCount} Critical • {warningCount} Warnings</p>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => {
            const styles = getStyles(alert.type)
            const Icon = styles.Icon
            return (
              <div key={alert.id} className={`p-3 rounded-lg border ${styles.bg} ${styles.border} relative`}>
                <div className="flex items-start space-x-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
                  <div
                    className={`flex-1 min-w-0 ${alert.link ? 'cursor-pointer' : ''}`}
                    onClick={alert.link ? () => handleClick(alert) : undefined}
                  >
                    <p className={`text-sm font-medium ${styles.title}`}>{alert.title}</p>
                    <p className={`text-xs mt-1 ${styles.text}`}>{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{relativeTime(alert.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 hover:bg-white rounded transition-colors flex-shrink-0"
                    title="Dismiss"
                  >
                    <X className={`w-4 h-4 ${styles.icon}`} />
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600">No active notifications</p>
            <p className="text-xs text-slate-500 mt-1">Everything is running smoothly</p>
          </div>
        )}
      </div>

      {alerts && alerts.length > 0 && (
        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={handleDismissAll}
            className="text-xs text-slate-600 hover:text-slate-700 font-medium"
          >
            Dismiss All
          </button>
          <button
            onClick={() => fetchAlerts()}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh →
          </button>
        </div>
      )}
    </div>
  )
}
