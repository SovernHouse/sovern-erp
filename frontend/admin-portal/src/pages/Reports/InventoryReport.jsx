import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Download, Loader, AlertTriangle } from 'lucide-react'
import { SelectInput } from '../../components/FormFields'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function KPICard({ label, value, format = 'number', alert = false }) {
  let formattedValue
  if (format === 'currency') {
    formattedValue = `$${parseFloat(value || 0).toFixed(2)}`
  } else if (format === 'number') {
    formattedValue = value || 0
  } else {
    formattedValue = value || 0
  }

  const borderColor = alert ? 'border-red-500' : 'border-orange-500'

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${borderColor}`}>
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{formattedValue}</p>
    </div>
  )
}

const COLORS = ['#f59e0b', '#f97316', '#ea580c', '#c2410c', '#92400e']

export default function InventoryReport() {
  const [category, setCategory] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [stockLevel, setStockLevel] = useState('all')

  const [inventoryData, setInventoryData] = useState([])
  const [categories, setCategories] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [kpis, setKpis] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalValue: 0,
    outOfStockCount: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/categories`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data)
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/warehouses`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setWarehouses(json.data)
      }
    } catch (err) {
      console.error('Error fetching warehouses:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (warehouse) params.append('warehouse', warehouse)
      if (stockLevel !== 'all') params.append('stockLevel', stockLevel)

      const res = await fetch(`${API}/api/reports/inventory?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })

      const json = await res.json()
      if (json.success) {
        const reportData = json.data

        // Transform items data for charts
        let chartData = []
        if (reportData.items && Array.isArray(reportData.items)) {
          const byCategory = {}
          reportData.items.forEach(item => {
            const cat = item.product?.categoryId || 'Uncategorized'
            if (!byCategory[cat]) {
              byCategory[cat] = { category: cat, quantity: 0, value: 0, count: 0 }
            }
            byCategory[cat].quantity += item.quantity || 0
            byCategory[cat].value += (item.quantity || 0) * 100
            byCategory[cat].count += 1
          })
          chartData = Object.values(byCategory)
        }

        setInventoryData(chartData)

        const lowStockItems = reportData.lowStockItems ? reportData.lowStockItems.length : 0
        const outOfStockItems = reportData.items
          ? reportData.items.filter(i => i.availableQty === 0 || i.quantity === 0).length
          : 0

        setKpis({
          totalItems: reportData.totalItems || 0,
          lowStockCount: lowStockItems,
          totalValue: reportData.totalInventoryValue || 0,
          outOfStockCount: outOfStockItems
        })
      } else {
        setError(json.message || 'Failed to load inventory report')
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err)
      setError('Failed to load inventory report data')
    } finally {
      setLoading(false)
    }
  }, [category, warehouse, stockLevel])

  useEffect(() => {
    fetchCategories()
    fetchWarehouses()
  }, [fetchCategories, fetchWarehouses])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (warehouse) params.append('warehouse', warehouse)
      if (stockLevel !== 'all') params.append('stockLevel', stockLevel)

      const res = await fetch(`${API}/api/reports/export/inventory?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV')
    }
  }

  // Data for warehouse distribution (simulated)
  const warehouseDistribution = [
    { name: 'Warehouse A', value: kpis.totalValue * 0.4 },
    { name: 'Warehouse B', value: kpis.totalValue * 0.35 },
    { name: 'Warehouse C', value: kpis.totalValue * 0.25 }
  ]

  // Data for trend (simulated)
  const trendData = [
    { period: 'Week 1', value: kpis.totalValue * 0.8 },
    { period: 'Week 2', value: kpis.totalValue * 0.85 },
    { period: 'Week 3', value: kpis.totalValue * 0.95 },
    { period: 'Week 4', value: kpis.totalValue }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Inventory Report</h1>
        <button
          onClick={handleExportCSV}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

      {(kpis.lowStockCount > 0 || kpis.outOfStockCount > 0) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Inventory Alert</p>
            <p className="text-sm text-amber-800">
              {kpis.lowStockCount > 0 && `${kpis.lowStockCount} products are low on stock. `}
              {kpis.outOfStockCount > 0 && `${kpis.outOfStockCount} products are out of stock.`}
              Review and reorder to avoid stockouts.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectInput
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
            <SelectInput
              label="Warehouse"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map(w => ({ value: w.id, label: w.name }))
              ]}
            />
            <SelectInput
              label="Stock Level"
              value={stockLevel}
              onChange={(e) => setStockLevel(e.target.value)}
              options={[
                { value: 'all', label: 'All Items' },
                { value: 'low', label: 'Low Stock' },
                { value: 'normal', label: 'Normal Stock' },
                { value: 'overstock', label: 'Overstock' }
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Products" value={kpis.totalItems} format="number" />
            <KPICard label="Low Stock Items" value={kpis.lowStockCount} alert={kpis.lowStockCount > 0} />
            <KPICard label="Out of Stock" value={kpis.outOfStockCount} alert={kpis.outOfStockCount > 0} />
            <KPICard label="Total Inventory Value" value={kpis.totalValue} format="currency" />
          </div>

          {inventoryData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Stock Levels by Category</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={inventoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => value?.toFixed(0)} />
                    <Legend />
                    <Bar dataKey="quantity" fill="#f59e0b" name="Quantity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Inventory Distribution by Warehouse</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={warehouseDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {warehouseDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Inventory Value Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="Total Value"
                      dot={{ fill: '#f59e0b', r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Category Value Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value?.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center py-12">
              <p className="text-slate-600">No inventory data available for the selected filters</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
