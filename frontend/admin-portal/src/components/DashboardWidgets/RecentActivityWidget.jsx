import { User, File, Package, Truck, DollarSign, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * RecentActivityWidget - Activity feed with icons
 */
export default function RecentActivityWidget() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        // Simulated activity data
        const mockData = [
          {
            id: 1,
            type: 'order',
            action: 'New order created',
            description: 'Order #O-2026-567 from Smith Corp',
            user: 'John Smith',
            time: '2 hours ago',
            icon: Package
          },
          {
            id: 2,
            type: 'shipment',
            action: 'Shipment dispatched',
            description: 'Order #O-2026-560 shipped via DHL',
            user: 'Sarah Johnson',
            time: '4 hours ago',
            icon: Truck
          },
          {
            id: 3,
            type: 'payment',
            action: 'Payment received',
            description: 'Invoice #INV-2026-089 marked as paid',
            user: 'Finance Team',
            time: '6 hours ago',
            icon: DollarSign
          },
          {
            id: 4,
            type: 'document',
            action: 'Document uploaded',
            description: 'PO #PO-2026-034 confirmation document',
            user: 'Mike Chen',
            time: '1 day ago',
            icon: File
          },
          {
            id: 5,
            type: 'alert',
            action: 'Stock alert',
            description: 'Product SKU-2041 low in inventory',
            user: 'System',
            time: '1 day ago',
            icon: AlertCircle
          },
          {
            id: 6,
            type: 'customer',
            action: 'New customer added',
            description: 'Bright Industries registered',
            user: 'Lisa Wong',
            time: '2 days ago',
            icon: User
          }
        ]
        setData(mockData)
      } catch (error) {
        console.error('Failed to fetch activity:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivity()
  }, [])

  if (isLoading) return <LoadingSpinner />

  const getActivityColor = (type) => {
    switch (type) {
      case 'order':
        return 'bg-blue-50 text-blue-600'
      case 'shipment':
        return 'bg-green-50 text-green-600'
      case 'payment':
        return 'bg-emerald-50 text-emerald-600'
      case 'document':
        return 'bg-purple-50 text-purple-600'
      case 'alert':
        return 'bg-red-50 text-red-600'
      case 'customer':
        return 'bg-indigo-50 text-indigo-600'
      default:
        return 'bg-slate-50 text-slate-600'
    }
  }

  return (
    <div className="space-y-3">
      {/* Activity Timeline */}
      <div className="space-y-0">
        {data?.map((activity, index) => {
          const ActivityIcon = activity.icon
          return (
            <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-slate-50 rounded transition-colors">
              {/* Timeline Icon */}
              <div className={`p-2 rounded-lg flex-shrink-0 ${getActivityColor(activity.type)}`}>
                <ActivityIcon className="w-4 h-4" />
              </div>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{activity.action}</p>
                <p className="text-xs text-slate-600 truncate">{activity.description}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{activity.user}</span>
                  <span className="text-xs text-slate-400">{activity.time}</span>
                </div>
              </div>

              {/* Timeline Connector */}
              {index < data.length - 1 && (
                <div className="absolute left-6 top-full w-0.5 h-3 bg-slate-200" />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
        <p className="text-xs text-slate-600">Last 7 days</p>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</button>
      </div>
    </div>
  )
}
