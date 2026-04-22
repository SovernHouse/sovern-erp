import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const CustomerSegments = ({ data }) => {
  const chartData = data.map(segment => ({
    name: segment.name,
    value: parseInt(segment.count),
    revenue: parseFloat(segment.revenue)
  }))

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{data.name}</p>
          <p className="text-sm text-slate-600">Customers: {data.value}</p>
          <p className="text-sm text-blue-600">Revenue: ${parseFloat(data.revenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Customer Segments</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#3b82f6"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CustomerSegments
