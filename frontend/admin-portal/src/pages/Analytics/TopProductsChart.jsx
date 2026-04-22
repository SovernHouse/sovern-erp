import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const TopProductsChart = ({ data }) => {
  const chartData = data.slice(0, 10).map(product => ({
    name: product.name,
    revenue: parseFloat(product.revenue),
    quantity: parseInt(product.quantity),
    percentage: parseFloat(product.percentage)
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{data.name}</p>
          <p className="text-sm text-blue-600">Revenue: ${data.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-slate-600">Qty: {data.quantity}</p>
          <p className="text-sm text-green-600">{data.percentage}% of total</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Top 10 Products by Revenue</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 150, right: 20, top: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" />
          <YAxis dataKey="name" type="category" stroke="#64748b" width={140} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" radius={[0, 8, 8, 0]} fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TopProductsChart
