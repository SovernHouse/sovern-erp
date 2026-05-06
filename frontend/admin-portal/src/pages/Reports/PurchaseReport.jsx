import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download, Loader } from 'lucide-react'
import { SelectInput, DateInput } from '../../components/FormFields'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function KPICard({ label, value, format = 'number' }) {
  let formattedValue
  if (format === 'currency') {
    formattedValue = `$${parseFloat(value || 0).toFixed(2)}`
  } else if (format === 'percentage') {
    formattedValue = `${parseFloat(value || 0).toFixed(1)}%`
  } else {
    formattedValue = value || 0
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
    </div>
  )
}

const COLORS = ['#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6']

export default function PurchaseReport() {
  const [period, setPeriod] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [factoryId, setFactoryId] = useState('')
  const [status, setStatus] = useState('')

  const [orders, setOrders] = useState([])
  const [factories, setFactories] = useState([])
  const [kpis, setKpis] = useState({
    totalOrders: 0,
    receivedOrders: 0,
    totalCost: 0,
    avgOrderValue: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchFactories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/factories`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
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
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (factoryId) params.append('factoryId', factoryId)
      if (status) params.append('status', status)

      const res = await fetch(`${API}/api/reports/purchase?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      const json = await res.json()
      if (json.success) {
        const reportData = json.data
        setOrders(reportData.orders || [])

        setKpis({
          totalOrders: reportData.stats?.totalOrders || 0,
          receivedOrders: reportData.stats?.receivedOrders || 0,
          totalCost: reportData.stats?.totalCost || 0,
          avgOrderValue: reportData.stats?.avgOrderValue || 0
        })
      } else {
        setError(json.message || 'Failed to load purchase report')
      }
    } catch (err) {
      console.error('Error fetching purchase data:', err)
      setError('Failed to load purchase report data')
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate, factoryId, status])

  useEffect(() => {
    fetchFactories()
  }, [fetchFactories])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (factoryId) params.append('factoryId', factoryId)
      if (status) params.append('status', status)

      const res = await fetch(`${API}/api/reports/export/purchase?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `purchase-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  // Prepare chart data
  const chartData = orders.length > 0 ? orders.map(order => ({
    name: new Date(order.createdAt).toLocaleDateString(),
    value: parseFloat(order.total || 0)
  })).slice(0, 10) : []

  const statusDistribution = [
    { status: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { status: 'Ordered', count: orders.filter(o => o.status === 'ordered').length },
    { status: 'Received', count: orders.filter(o => o.status === 'received').length },
    { status: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
  ].filter(d => d.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Purchase Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Period & Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectInput
              label="Period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'quarter', label: 'Quarter' },
                { value: 'year', label: 'Year' }
              ]}
            />
            <DateInput
              label="From Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <DateInput
              label="To Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Entity Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'ordered', label: 'Ordered' },
                { value: 'received', label: 'Received' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Orders" value={kpis.totalOrders} format="number" />
            <KPICard label="Received Orders" value={kpis.receivedOrders} format="number" />
            <KPICard label="Total Cost" value={kpis.totalCost} format="currency" />
            <KPICard label="Avg Order Value" value={kpis.avgOrderValue} format="currency" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Purchase Orders by Date</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} name="Order Value" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-300 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Distribution</h2>
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-300 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
