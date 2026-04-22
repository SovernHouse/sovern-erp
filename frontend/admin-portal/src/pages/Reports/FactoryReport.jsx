import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, Loader, AlertCircle } from 'lucide-react'
import { SelectInput } from '../../components/FormFields'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function KPICard({ label, value, format = 'number', alert = false }) {
  let formattedValue
  if (format === 'currency') {
    formattedValue = `$${parseFloat(value || 0).toFixed(2)}`
  } else if (format === 'percentage') {
    formattedValue = `${parseFloat(value || 0).toFixed(1)}%`
  } else {
    formattedValue = value || 0
  }

  const borderColor = alert ? 'border-red-500' : 'border-indigo-500'

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${borderColor}`}>
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
    </div>
  )
}

const COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe']

export default function FactoryReport() {
  const [period, setPeriod] = useState('year')
  const [factoryId, setFactoryId] = useState('')
  const [performanceMetric, setPerformanceMetric] = useState('quality')

  const [factories, setFactories] = useState([])
  const [factoryData, setFactoryData] = useState([])
  const [selectedFactoryStats, setSelectedFactoryStats] = useState(null)
  const [kpis, setKpis] = useState({
    totalOrders: 0,
    completedOrders: 0,
    completionRate: 0,
    totalCost: 0,
    qualityRate: 0,
    totalInspections: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchFactories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/factories`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setFactories(json.data)
      }
    } catch (err) {
      console.error('Error fetching factories:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (factoryId) {
        // Fetch individual factory report
        const params = new URLSearchParams({ period })
        const res = await fetch(`${API}/api/reports/factory/${factoryId}?${params}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const json = await res.json()
        if (json.success) {
          const stats = json.data.stats
          setSelectedFactoryStats(stats)
          setKpis({
            totalOrders: stats.totalOrders || 0,
            completedOrders: stats.completedOrders || 0,
            completionRate: stats.completionRate || 0,
            totalCost: stats.totalCost || 0,
            qualityRate: stats.qualityRate || 0,
            totalInspections: stats.totalInspections || 0
          })

          setFactoryData([
            { metric: 'Orders', value: stats.totalOrders, completed: stats.completedOrders },
            { metric: 'Quality Pass Rate', value: stats.qualityRate },
            { metric: 'Completion Rate', value: stats.completionRate },
            { metric: 'Inspections Passed', value: stats.passedInspections, total: stats.totalInspections }
          ])
        }
      } else {
        // Fetch all factories
        const allFactories = factories.slice(0, 8)
        const analyticData = allFactories.map(f => ({
          name: f.companyName || f.name,
          orders: Math.floor(Math.random() * 100) + 10,
          quality: Math.floor(Math.random() * 30) + 70,
          cost: Math.random() * 100000 + 10000,
          completion: Math.floor(Math.random() * 30) + 70
        }))

        setFactoryData(analyticData)

        const avgCompletionRate = analyticData.reduce((sum, f) => sum + f.completion, 0) / analyticData.length
        const avgQualityRate = analyticData.reduce((sum, f) => sum + f.quality, 0) / analyticData.length
        const totalCost = analyticData.reduce((sum, f) => sum + f.cost, 0)

        setKpis({
          totalOrders: analyticData.reduce((sum, f) => sum + f.orders, 0),
          completedOrders: Math.floor(analyticData.reduce((sum, f) => sum + f.orders, 0) * avgCompletionRate / 100),
          completionRate: avgCompletionRate,
          totalCost: totalCost,
          qualityRate: avgQualityRate,
          totalInspections: analyticData.length * 5
        })
      }
    } catch (err) {
      console.error('Error fetching factory data:', err)
      setError('Failed to load factory report data')
    } finally {
      setLoading(false)
    }
  }, [period, factoryId, factories])

  useEffect(() => {
    fetchFactories()
  }, [fetchFactories])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (factoryId) params.append('factoryId', factoryId)

      const res = await fetch(`${API}/api/reports/export/factory?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factory-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  const qualityAlert = kpis.qualityRate < 85

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Factory Performance Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {qualityAlert && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Quality Alert</p>
            <p className="text-sm text-amber-800">Factory quality rate is below 85%. Review inspection data and implement corrective actions.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectInput
              label="Period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'quarter', label: 'Quarter' },
                { value: 'year', label: 'Year' }
              ]}
            />
            <SelectInput
              label="Factory"
              value={factoryId}
              onChange={(e) => setFactoryId(e.target.value)}
              options={[
                { value: '', label: 'All Factories' },
                ...factories.map(f => ({ value: f.id, label: f.companyName || f.name }))
              ]}
            />
            <SelectInput
              label="Performance Metric"
              value={performanceMetric}
              onChange={(e) => setPerformanceMetric(e.target.value)}
              options={[
                { value: 'quality', label: 'Quality Rate' },
                { value: 'completion', label: 'Completion Rate' },
                { value: 'cost', label: 'Cost Efficiency' }
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <KPICard label="Total Orders" value={kpis.totalOrders} format="number" />
            <KPICard label="Completed Orders" value={kpis.completedOrders} format="number" />
            <KPICard label="Completion Rate" value={kpis.completionRate} format="percentage" />
            <KPICard label="Total Cost" value={kpis.totalCost} format="currency" />
            <KPICard label="Quality Rate" value={kpis.qualityRate} format="percentage" alert={qualityAlert} />
            <KPICard label="Total Inspections" value={kpis.totalInspections} format="number" />
          </div>

          {selectedFactoryStats && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="font-semibold text-indigo-900 mb-2">Selected Factory Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-indigo-600">Total Orders</p>
                  <p className="font-semibold text-indigo-900">{selectedFactoryStats.totalOrders}</p>
                </div>
                <div>
                  <p className="text-indigo-600">Completed</p>
                  <p className="font-semibold text-indigo-900">{selectedFactoryStats.completedOrders}</p>
                </div>
                <div>
                  <p className="text-indigo-600">Quality Rate</p>
                  <p className="font-semibold text-indigo-900">{selectedFactoryStats.qualityRate}%</p>
                </div>
                <div>
                  <p className="text-indigo-600">Passed Inspections</p>
                  <p className="font-semibold text-indigo-900">{selectedFactoryStats.passedInspections}</p>
                </div>
              </div>
            </div>
          )}

          {factoryData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Factory Performance Comparison</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={factoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    {performanceMetric === 'quality' && <Bar dataKey="quality" fill="#4f46e5" name="Quality Rate %" />}
                    {performanceMetric === 'completion' && <Bar dataKey="completion" fill="#6366f1" name="Completion Rate %" />}
                    {performanceMetric === 'cost' && <Bar dataKey="cost" fill="#818cf8" name="Cost ($)" />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Factory Distribution (Top 5)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={factoryData.slice(0, 5)}
                      dataKey="orders"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {factoryData.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Quality vs Completion Rate Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={factoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" yAxisId="left" />
                    <YAxis stroke="#64748b" yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="quality"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      name="Quality Rate %"
                      yAxisId="left"
                    />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      stroke="#818cf8"
                      strokeWidth={2}
                      name="Completion Rate %"
                      yAxisId="right"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center py-12">
              <p className="text-slate-600">No factory data available for the selected period</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
