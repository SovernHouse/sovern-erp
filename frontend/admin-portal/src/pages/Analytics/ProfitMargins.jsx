import React from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const ProfitMargins = ({ data }) => {
  const chartData = data.slice(0, 10).map(item => ({
    name: item.name.substring(0, 20),
    revenue: parseFloat(item.revenue),
    cost: parseFloat(item.cost),
    marginPercent: parseFloat(item.marginPercent)
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{data.name}</p>
          <p className="text-sm text-slate-600">Revenue: ${data.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-slate-600">Cost: ${data.cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-green-600">Margin: {data.marginPercent}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Profit Margins</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          layout="vertical"
          margin={{ left: 100, right: 20, top: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" />
          <YAxis dataKey="name" type="category" stroke="#64748b" width={90} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
          <Bar dataKey="cost" fill="#ef4444" name="Cost" />
          <Line
            type="monotone"
            dataKey="marginPercent"
            stroke="#10b981"
            name="Margin %"
            yAxisId="right"
            strokeWidth={2}
          />
          <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ProfitMargins
