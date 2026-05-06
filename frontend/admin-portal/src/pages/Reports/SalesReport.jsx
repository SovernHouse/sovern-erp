import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
    </div>
  )
}

export default function SalesReport() {
  const [period, setPeriod] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [salesPersonId, setSalesPersonId] = useState('')
  const [status, setStatus] = useState('')

  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [salesPeople, setSalesPeople] = useState([])
  const [kpis, setKpis] = useState({
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    completionRate: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/customers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data)
      }
    } catch (err) {
      console.error('Error fetching customers:', err)
    }
  }, [])

  const fetchSalesPeople = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/users?role=sales`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setSalesPeople(json.data)
      }
    } catch (err) {
      console.error('Error fetching sales people:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (customerId) params.append('customerId', customerId)
      if (salesPersonId) params.append('salesPersonId', salesPersonId)
      if (status) params.append('status', status)

      const res = await fetch(`${API}/api/reports/sales?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      const json = await res.json()
      if (json.success) {
        const reportData = json.data
        setOrders(reportData.orders || [])

        // Transform orders data into chart format (by date or by salesperson)
        const ordersByDate = {}
        if (reportData.orders) {
          reportData.orders.forEach(order => {
            const date = new Date(order.createdAt).toLocaleDateString()
            if (!ordersByDate[date]) {
              ordersByDate[date] = { period: date, sales: 0, count: 0 }
            }
            ordersByDate[date].sales += parseFloat(order.total || 0)
            ordersByDate[date].count += 1
          })
        }

        setKpis({
          totalOrders: reportData.stats?.totalOrders || 0,
          completedOrders: reportData.stats?.completedOrders || 0,
          totalRevenue: reportData.stats?.totalRevenue || 0,
          avgOrderValue: reportData.stats?.avgOrderValue || 0,
          completionRate: reportData.stats?.completionRate || 0
        })
      } else {
        setError(json.message || 'Failed to load sales report')
      }
    } catch (err) {
      console.error('Error fetching sales data:', err)
      setError('Failed to load sales report data')
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate, customerId, salesPersonId, status])

  useEffect(() => {
    fetchCustomers()
    fetchSalesPeople()
  }, [fetchCustomers, fetchSalesPeople])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (customerId) params.append('customerId', customerId)
      if (salesPersonId) params.append('salesPersonId', salesPersonId)
      if (status) params.append('status', status)

      const res = await fetch(`${API}/api/reports/export/sales?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  // Prepare chart data from orders
  const chartData = orders.length > 0 ? orders.map(order => ({
    name: new Date(order.createdAt).toLocaleDateString(),
    amount: parseFloat(order.total || 0)
  })).slice(0, 10) : []

  const statusChartData = [
    { status: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { status: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
    { status: 'Shipped', count: orders.filter(o => o.status === 'shipped').length },
    { status: 'Completed', count: orders.filter(o => o.status === 'completed').length },
    { status: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
  ].filter(d => d.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Sales Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <SelectInput
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'shipped', label: 'Shipped' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Entity Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: 'All Customers' },
                ...customers.map(c => ({ value: c.id, label: c.companyName || c.name }))
              ]}
            />
            <SelectInput
              label="Salesperson"
              value={salesPersonId}
              onChange={(e) => setSalesPersonId(e.target.value)}
              options={[
                { value: '', label: 'All Salespeople' },
                ...salesPeople.map(sp => ({ value: sp.id, label: sp.name }))
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard label="Total Orders" value={kpis.totalOrders} format="number" />
            <KPICard label="Completed" value={kpis.completedOrders} format="number" />
            <KPICard label="Total Revenue" value={kpis.totalRevenue} format="currency" />
            <KPICard label="Avg Order Value" value={kpis.avgOrderValue} format="currency" />
            <KPICard label="Completion Rate" value={kpis.completionRate} format="percentage" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Sales by Order</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
                    <Bar dataKey="amount" fill="#3b82f6" name="Sales Amount" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-300 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Orders by Status</h2>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" name="Count" />
                  </BarChart>
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
