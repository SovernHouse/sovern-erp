import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * OrderStatusWidget - Displays order status distribution with pie/donut chart
 */
export default function OrderStatusWidget() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrderStatus = async () => {
      try {
        // Simulated order status data
        const mockData = [
          { status: 'Pending', count: 23, percentage: 15, color: '#f59e0b' },
          { status: 'Processing', count: 45, percentage: 30, color: '#3b82f6' },
          { status: 'Shipped', count: 62, percentage: 40, color: '#10b981' },
          { status: 'Delivered', count: 20, percentage: 15, color: '#8b5cf6' }
        ]
        setData(mockData)
      } catch (error) {
        console.error('Failed to fetch order status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderStatus()
  }, [])

  if (isLoading) return <LoadingSpinner />

  // Simple pie chart using SVG
  const total = data?.reduce((sum, item) => sum + item.count, 0) || 0
  let cumulativePercentage = 0

  return (
    <div className="space-y-4">
      {/* SVG Pie Chart */}
      <div className="flex justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {data?.map((item, index) => {
            const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2
            const endAngle = ((cumulativePercentage + item.percentage) / 100) * 2 * Math.PI - Math.PI / 2

            const x1 = 100 + 60 * Math.cos(startAngle)
            const y1 = 100 + 60 * Math.sin(startAngle)
            const x2 = 100 + 60 * Math.cos(endAngle)
            const y2 = 100 + 60 * Math.sin(endAngle)

            const largeArc = item.percentage > 50 ? 1 : 0

            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 60 60 0 ${largeArc} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ')

            cumulativePercentage += item.percentage

            return (
              <path
                key={index}
                d={pathData}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
              />
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3">
        {data?.map((item) => (
          <div key={item.status} className="flex items-start space-x-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600">{item.status}</p>
              <p className="text-sm font-bold text-slate-900">
                {item.count} ({item.percentage}%)
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-600">Total Orders: <span className="font-bold text-slate-900">{total}</span></p>
      </div>
    </div>
  )
}
