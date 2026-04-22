import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * AlertWidget - Displays system alerts and notifications
 */
export default function AlertWidget({ config }) {
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // Simulated alerts - in production, fetch from actual alerts API
        const mockAlerts = [
          { id: 1, type: 'error', title: 'Low Stock Alert', message: 'Component A is below reorder level', timestamp: '5 min ago' },
          { id: 2, type: 'warning', title: 'Overdue Invoice', message: 'INV-001 is 15 days overdue', timestamp: '2 hours ago' },
          { id: 3, type: 'info', title: 'New Order Received', message: 'SO-005 from Acme Corp', timestamp: '1 hour ago' },
          { id: 4, type: 'error', title: 'Payment Failed', message: 'Payment for PO-002 was declined', timestamp: '30 min ago' }
        ]
        setAlerts(mockAlerts)
      } catch (error) {
        console.error('Failed to fetch alerts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlerts()
  }, [config.widget])

  if (isLoading) return <LoadingSpinner />

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />
    }
  }

  const getAlertColor = (type) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {alerts.length > 0 ? (
        alerts.map(alert => (
          <div
            key={alert.id}
            className={`flex gap-3 p-3 rounded-lg border ${getAlertColor(alert.type)}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getAlertIcon(alert.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900">{alert.title}</p>
              <p className="text-sm text-slate-700 mt-1">{alert.message}</p>
              <p className="text-xs text-slate-500 mt-2">{alert.timestamp}</p>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-600">No alerts at this time</p>
        </div>
      )}
    </div>
  )
}
