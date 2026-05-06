import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Download, Loader } from 'lucide-react'
import { SelectInput, DateInput } from '../../components/FormFields'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function KPICard({ label, value, format = 'currency', trend = null }) {
  let formattedValue
  if (format === 'currency') {
    formattedValue = `$${parseFloat(value || 0).toFixed(2)}`
  } else if (format === 'percentage') {
    formattedValue = `${parseFloat(value || 0).toFixed(1)}%`
  } else {
    formattedValue = value || 0
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
        {trend && (
          <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function FinancialReport() {
  const [period, setPeriod] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [kpis, setKpis] = useState({
    revenue: 0,
    costs: 0,
    profit: 0,
    profitMargin: 0,
    collectionsReceived: 0,
    pendingPayments: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`${API}/api/reports/financial?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      const json = await res.json()
      if (json.success) {
        const reportData = json.data
        setKpis({
          revenue: reportData.stats?.revenue || 0,
          costs: reportData.stats?.costs || 0,
          profit: reportData.stats?.profit || 0,
          profitMargin: reportData.stats?.profitMargin || 0,
          collectionsReceived: reportData.stats?.collectionsReceived || 0,
          pendingPayments: reportData.stats?.pendingPayments || 0
        })
      } else {
        setError(json.message || 'Failed to load financial report')
      }
    } catch (err) {
      console.error('Error fetching financial data:', err)
      setError('Failed to load financial report data')
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`${API}/api/reports/export/financial?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  const timelineData = [
    { period: 'Period 1', revenue: kpis.revenue * 0.3, costs: kpis.costs * 0.3, profit: (kpis.revenue - kpis.costs) * 0.3 },
    { period: 'Period 2', revenue: kpis.revenue * 0.4, costs: kpis.costs * 0.4, profit: (kpis.revenue - kpis.costs) * 0.4 },
    { period: 'Period 3', revenue: kpis.revenue * 0.3, costs: kpis.costs * 0.3, profit: (kpis.revenue - kpis.costs) * 0.3 }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Financial Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          <h3 className="text-sm font-medium text-slate-700 mb-3">Period & Date Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <KPICard label="Total Revenue" value={kpis.revenue} format="currency" />
            <KPICard label="Total Costs" value={kpis.costs} format="currency" />
            <KPICard label="Net Profit" value={kpis.profit} format="currency" />
            <KPICard label="Profit Margin" value={kpis.profitMargin} format="percentage" />
            <KPICard label="Collections" value={kpis.collectionsReceived} format="currency" />
            <KPICard label="Pending Payments" value={kpis.pendingPayments} format="currency" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Breakdown</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#d1fae5" name="Revenue" />
                  <Area type="monotone" dataKey="costs" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Costs" />
                  <Area type="monotone" dataKey="profit" stackId="1" stroke="#3b82f6" fill="#dbeafe" name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue vs Costs Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                  <Line type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2} name="Costs" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Summary</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="costs" fill="#ef4444" name="Costs" />
                <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
