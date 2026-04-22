import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * AlertsWidget - System alerts and notifications
 */
export default function AlertsWidget() {
  const [alerts, setAlerts] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // Simulated alerts data
        const mockAlerts = [
          {
            id: 1,
            type: 'error',
            title: 'Critical Inventory Alert',
            message: 'SKU-2041 stock level below minimum threshold',
            time: '30 mins ago',
            dismissible: true
          },
          {
            id: 2,
            type: 'warning',
            title: 'Pending Approvals',
            message: '5 purchase orders awaiting manager approval',
            time: '2 hours ago',
            dismissible: true
          },
          {
            id: 3,
            type: 'info',
            title: 'System Maintenance',
            message: 'Scheduled maintenance tonight at 11 PM',
            time: '1 day ago',
            dismissible: true
          },
          {
            id: 4,
            type: 'error',
            title: 'Overdue Invoice',
            message: 'Invoice #INV-2026-045 is 15 days overdue',
            time: '3 days ago',
            dismissible: true
          }
        ]
        setAlerts(mockAlerts)
      } catch (error) {
        console.error('Failed to fetch alerts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  const handleDismiss = (id) => {
    setAlerts(alerts?.filter(alert => alert.id !== id) || [])
  }

  if (isLoading) return <LoadingSpinner />

  const getAlertStyles = (type) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          text: 'text-red-700'
        }
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-600',
          title: 'text-yellow-900',
          text: 'text-yellow-700'
        }
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          text: 'text-blue-700'
        }
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          icon: 'text-slate-600',
          title: 'text-slate-900',
          text: 'text-slate-700'
        }
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'error':
        return AlertCircle
      case 'warning':
        return AlertTriangle
      default:
        return Info
    }
  }

  return (
    <div className="space-y-2">
      {/* Alert Count Summary */}
      <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-900">
          {alerts?.length || 0} Active Alerts
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {alerts?.filter(a => a.type === 'error').length || 0} Critical • {alerts?.filter(a => a.type === 'warning').length || 0} Warnings
        </p>
      </div>

      {/* Alerts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => {
            const styles = getAlertStyles(alert.type)
            const IconComponent = getIcon(alert.type)

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${styles.bg} ${styles.border} relative`}
              >
                <div className="flex items-start space-x-3">
                  <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${styles.title}`}>{alert.title}</p>
                    <p className={`text-xs mt-1 ${styles.text}`}>{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                  </div>
                  {alert.dismissible && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1 hover:bg-white rounded transition-colors flex-shrink-0"
                    >
                      <X className={`w-4 h-4 ${styles.icon}`} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600">No active alerts</p>
            <p className="text-xs text-slate-500 mt-1">Everything is running smoothly</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts && alerts.length > 0 && (
        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => setAlerts([])}
            className="text-xs text-slate-600 hover:text-slate-700 font-medium"
          >
            Dismiss All
          </button>
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            View Details →
          </button>
        </div>
      )}
    </div>
  )
}
