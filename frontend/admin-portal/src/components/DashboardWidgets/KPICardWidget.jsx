import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'

/**
 * KPICardWidget - Single KPI with value, change %, and trend arrow
 */
export default function KPICardWidget({ title = 'Key Performance Indicator' }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        // Simulated KPI data - could be parameterized from props
        const mockData = {
          title: title,
          value: 45230,
          unit: '$',
          change: 12.5,
          isPositive: true,
          timeframe: 'vs. last month',
          baseline: 40100,
          target: 50000,
          lastUpdated: '2 hours ago'
        }
        setData(mockData)
      } catch (error) {
        console.error('Failed to fetch KPI data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchKPI()
  }, [title])

  if (isLoading) return <LoadingSpinner />

  const progressPercent = Math.min((data?.value / data?.target) * 100, 100)

  return (
    <div className="space-y-4">
      {/* Main KPI Display */}
      <div className={`p-6 rounded-lg border-2 ${
        data?.isPositive
          ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
          : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${
              data?.isPositive ? 'text-green-700' : 'text-red-700'
            }`}>
              {data?.title}
            </p>
            <p className={`text-4xl font-bold mt-2 ${
              data?.isPositive ? 'text-green-900' : 'text-red-900'
            }`}>
              {data?.unit}{data?.value?.toLocaleString()}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            data?.isPositive ? 'bg-green-200' : 'bg-red-200'
          }`}>
            {data?.isPositive ? (
              <TrendingUp className={`w-6 h-6 ${
                data?.isPositive ? 'text-green-700' : 'text-red-700'
              }`} />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-700" />
            )}
          </div>
        </div>

        {/* Change Indicator */}
        <div className="flex items-center space-x-2 mt-4">
          {data?.isPositive ? (
            <ArrowUp className="w-4 h-4 text-green-700" />
          ) : (
            <ArrowDown className="w-4 h-4 text-red-700" />
          )}
          <span className={`text-lg font-bold ${
            data?.isPositive ? 'text-green-700' : 'text-red-700'
          }`}>
            {data?.isPositive ? '+' : ''}{data?.change}%
          </span>
          <span className={`text-sm ${
            data?.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {data?.timeframe}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-600">Progress to Target</p>
          <span className="text-xs font-bold text-slate-900">{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-600">Current: {data?.unit}{data?.value?.toLocaleString()}</span>
          <span className="text-xs text-slate-600">Target: {data?.unit}{data?.target?.toLocaleString()}</span>
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 font-medium">Baseline</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {data?.unit}{data?.baseline?.toLocaleString()}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 font-medium">Last Updated</p>
          <p className="text-sm font-bold text-slate-900 mt-1">{data?.lastUpdated}</p>
        </div>
      </div>
    </div>
  )
}
