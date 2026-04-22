import { TrendingUp, TrendingDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * RevenueWidget - Displays revenue summary with trend
 */
export default function RevenueWidget() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        // Simulated revenue data
        const mockData = {
          currentMonth: 125400,
          lastMonth: 112300,
          trend: 11.6,
          isUp: true,
          ytdRevenue: 1245000,
          target: 1500000,
          conversionRate: 32.5
        }
        setData(mockData)
      } catch (error) {
        console.error('Failed to fetch revenue data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRevenue()
  }, [])

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Current Month Revenue */}
      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">Current Month Revenue</p>
            <p className="text-3xl font-bold text-green-900 mt-2">${data?.currentMonth?.toLocaleString()}</p>
            <div className="flex items-center mt-2 space-x-1">
              {data?.isUp ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">+{data?.trend}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">{data?.trend}%</span>
                </>
              )}
              <span className="text-xs text-green-700 ml-2">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* YTD Progress */}
      <div>
        <p className="text-sm text-slate-600 font-medium mb-2">YTD Revenue Target</p>
        <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${Math.min((data?.ytdRevenue / data?.target) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-600">${data?.ytdRevenue?.toLocaleString()}</span>
          <span className="text-xs text-slate-600">${data?.target?.toLocaleString()}</span>
        </div>
      </div>

      {/* Conversion Rate */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-600 font-medium">Conversion Rate</p>
        <p className="text-2xl font-bold text-slate-900 mt-2">{data?.conversionRate}%</p>
      </div>
    </div>
  )
}
