import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts'

const RevenueChart = ({ data }) => {
  const chartData = data.slice(0, -3).map(item => ({
    ...item,
    revenue: parseFloat(item.revenue),
    orderCount: parseInt(item.orderCount)
  }))

  // Calculate 3-month moving average
  const withMovingAvg = chartData.map((item, index) => {
    if (index < 2) return { ...item, movingAvg: item.revenue }
    const sum = chartData.slice(index - 2, index + 1).reduce((acc, d) => acc + d.revenue, 0)
    return { ...item, movingAvg: sum / 3 }
  })

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{data.month}</p>
          <p className="text-sm text-blue-600">Revenue: ${data.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-slate-600">Orders: {data.orderCount}</p>
          {data.movingAvg && (
            <p className="text-sm text-green-600">3M Avg: ${data.movingAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Revenue Trend</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={withMovingAvg}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="revenue" fill="#3b82f6" name="Monthly Revenue" />
          <Line
            type="monotone"
            dataKey="movingAvg"
            stroke="#10b981"
            name="3-Month Moving Avg"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RevenueChart
