import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const ForecastChart = ({ data }) => {
  const chartData = [
    ...data.historical.map(item => ({
      month: item.month,
      revenue: parseFloat(item.revenue),
      forecast: false
    })),
    ...data.forecast.map(item => ({
      month: item.month,
      revenue: parseFloat(item.revenue),
      forecast: true
    }))
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{data.month}</p>
          <p className="text-sm text-blue-600">Revenue: ${data.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          {data.forecast && <p className="text-xs text-slate-500">(Forecasted)</p>}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Revenue Forecast (3 Months)</h2>
      <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-sm text-slate-700">
          Trend: <span className={`font-semibold ${data.trend === 'increasing' ? 'text-green-600' : data.trend === 'decreasing' ? 'text-red-600' : 'text-blue-600'}`}>
            {data.trend.charAt(0).toUpperCase() + data.trend.slice(1)}
          </span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey={undefined}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Forecast"
            data={chartData.filter(d => d.forecast)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ForecastChart
