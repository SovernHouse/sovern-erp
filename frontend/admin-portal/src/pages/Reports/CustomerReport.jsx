import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, Loader } from 'lucide-react'
import { SelectInput } from '../../components/FormFields'

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
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-cyan-500">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
    </div>
  )
}

const COLORS = ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63']

export default function CustomerReport() {
  const [period, setPeriod] = useState('year')
  const [customerId, setCustomerId] = useState('')
  const [region, setRegion] = useState('')

  const [customers, setCustomers] = useState([])
  const [regions, setRegions] = useState([])
  const [customerData, setCustomerData] = useState([])
  const [selectedCustomerStats, setSelectedCustomerStats] = useState(null)
  const [kpis, setKpis] = useState({
    activeCustomers: 0,
    totalRevenue: 0,
    avgCustomerValue: 0,
    topCustomerRevenue: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/customers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data)
        const uniqueRegions = [...new Set(json.data.map(c => c.region || c.country).filter(Boolean))]
        setRegions(uniqueRegions)
      }
    } catch (err) {
      console.error('Error fetching customers:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ period })
      if (customerId) {
        // Fetch individual customer report
        const res = await fetch(`${API}/api/reports/customer/${customerId}?${params}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const json = await res.json()
        if (json.success) {
          const stats = json.data.stats
          setSelectedCustomerStats(stats)
          setKpis({
            activeCustomers: 1,
            totalRevenue: stats.totalSpent || 0,
            avgCustomerValue: stats.avgOrderValue || 0,
            topCustomerRevenue: stats.totalSpent || 0
          })
          setCustomerData([{
            name: 'Total Spent',
            value: stats.totalSpent || 0
          }])
        }
      } else {
        // Fetch all customers analytics
        const allCustomers = customerId
          ? customers.filter(c => c.id === customerId)
          : region
            ? customers.filter(c => (c.region || c.country) === region)
            : customers

        if (allCustomers.length === 0) {
          setCustomerData([])
          setKpis({
            activeCustomers: 0,
            totalRevenue: 0,
            avgCustomerValue: 0,
            topCustomerRevenue: 0
          })
          return
        }

        // Simulate customer analytics (in real app, would get from backend)
        const analyticData = allCustomers.slice(0, 10).map(c => ({
          name: c.companyName || c.name,
          value: Math.random() * 50000,
          orders: Math.floor(Math.random() * 20) + 1
        }))

        setCustomerData(analyticData)

        const totalRev = analyticData.reduce((sum, c) => sum + c.value, 0)
        setKpis({
          activeCustomers: allCustomers.length,
          totalRevenue: totalRev,
          avgCustomerValue: allCustomers.length > 0 ? totalRev / allCustomers.length : 0,
          topCustomerRevenue: Math.max(...analyticData.map(c => c.value))
        })
      }
    } catch (err) {
      console.error('Error fetching customer data:', err)
      setError('Failed to load customer report data')
    } finally {
      setLoading(false)
    }
  }, [period, customerId, region, customers])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (customerId) params.append('customerId', customerId)

      const res = await fetch(`${API}/api/reports/export/customers?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Customer Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: 'All Customers' },
                ...customers.map(c => ({ value: c.id, label: c.companyName || c.name }))
              ]}
            />
            <SelectInput
              label="Region/Country"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              options={[
                { value: '', label: 'All Regions' },
                ...regions.map(r => ({ value: r, label: r }))
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-cyan-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Active Customers" value={kpis.activeCustomers} format="number" />
            <KPICard label="Total Revenue" value={kpis.totalRevenue} format="currency" />
            <KPICard label="Avg Customer Value" value={kpis.avgCustomerValue} format="currency" />
            <KPICard label="Top Customer Revenue" value={kpis.topCustomerRevenue} format="currency" />
          </div>

          {selectedCustomerStats && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Selected Customer Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-blue-600">Total Orders</p>
                  <p className="font-semibold text-blue-900">{selectedCustomerStats.totalOrders}</p>
                </div>
                <div>
                  <p className="text-blue-600">Total Spent</p>
                  <p className="font-semibold text-blue-900">${selectedCustomerStats.totalSpent?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-blue-600">Total Paid</p>
                  <p className="font-semibold text-blue-900">${selectedCustomerStats.totalPaid?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-blue-600">Outstanding Balance</p>
                  <p className="font-semibold text-blue-900">${selectedCustomerStats.outstandingBalance?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {customerData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Revenue Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
                    <Bar dataKey="value" fill="#06b6d4" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue by Customer (Top 5)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={customerData.slice(0, 5)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {customerData.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${parseFloat(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Orders vs Revenue Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={customerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" yAxisId="left" />
                    <YAxis stroke="#64748b" yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#0891b2"
                      strokeWidth={2}
                      name="Order Count"
                      yAxisId="left"
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      name="Revenue"
                      yAxisId="right"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center py-12">
              <p className="text-slate-600">No customer data available for the selected filters</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
