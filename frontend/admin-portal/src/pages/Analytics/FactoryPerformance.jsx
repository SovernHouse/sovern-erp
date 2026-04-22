import React from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const FactoryPerformance = ({ data }) => {
  const chartData = data.slice(0, 5).map(factory => ({
    name: factory.name.substring(0, 12),
    quality: parseFloat(factory.quality),
    delivery: parseFloat(factory.delivery),
    cost: Math.min(100, parseFloat(factory.cost) * 10), // Scale for visibility
    communication: factory.communication,
    capacity: factory.capacity
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const factory = data.payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{factory.name}</p>
          <p className="text-sm text-slate-600">Quality: {factory.quality}%</p>
          <p className="text-sm text-slate-600">Delivery: {factory.delivery}%</p>
          <p className="text-sm text-slate-600">Communication: {factory.communication}%</p>
          <p className="text-sm text-slate-600">Capacity: {factory.capacity}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Factory Performance Comparison</h2>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="name" stroke="#64748b" />
          <PolarRadiusAxis stroke="#64748b" />
          <Radar name="Quality" dataKey="quality" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
          <Radar name="Delivery" dataKey="delivery" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
          <Radar name="Communication" dataKey="communication" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FactoryPerformance
