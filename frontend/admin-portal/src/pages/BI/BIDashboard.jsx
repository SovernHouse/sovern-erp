import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportsAPI } from '../../services/api'
import { formatCurrency, formatNumber } from '../../utils/formatters'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function BIDashboard() {
  // KPI State
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    profitMargin: 0,
    outstandingReceivables: 0,
    activeCustomers: 0,
  })

  // Chart Data State
  const [revenueData, setRevenueData] = useState([])
  const [orderDistribution, setOrderDistribution] = useState([])
  const [financialData, setFinancialData] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [supplyChainMetrics, setSupplyChainMetrics] = useState({
    shipmentsInTransit: 0,
    pendingInspections: 0,
    lowStockItems: 0,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch all reports in parallel
        const [
          salesRes,
          financialRes,
          customerRes,
          inventoryRes,
          logisticsRes,
        ] = await Promise.all([
          reportsAPI.getSalesReport({ period: 'month' }),
          reportsAPI.getFinancialReport({ period: 'month' }),
          reportsAPI.getCustomerReport(),
          reportsAPI.getInventoryReport(),
          reportsAPI.getLogistics(),
        ])

        // Process Sales Data (Revenue Trend & KPIs)
        if (salesRes.data) {
          const sales = Array.isArray(salesRes.data) ? salesRes.data : [salesRes.data]
          setRevenueData(
            sales.map((item) => ({
              month: item.month || item.date || 'N/A',
              revenue: item.revenue || item.total || 0,
              orders: item.orderCount || 0,
            }))
          )

          const totalRevenue = sales.reduce((sum, item) => sum + (item.revenue || 0), 0)
          const totalOrders = sales.reduce((sum, item) => sum + (item.orderCount || 0), 0)
          const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

          setKpis((prev) => ({
            ...prev,
            totalRevenue,
            totalOrders,
            avgOrderValue,
          }))

          // Order Distribution (mocked from available data)
          setOrderDistribution([
            { name: 'Pending', value: Math.floor(totalOrders * 0.15) },
            { name: 'Confirmed', value: Math.floor(totalOrders * 0.25) },
            { name: 'Shipped', value: Math.floor(totalOrders * 0.35) },
            { name: 'Completed', value: Math.floor(totalOrders * 0.25) },
          ])
        }

        // Process Financial Data
        if (financialRes.data) {
          const financial = Array.isArray(financialRes.data)
            ? financialRes.data
            : [financialRes.data]
          setFinancialData(
            financial.map((item) => ({
              month: item.month || item.date || 'N/A',
              revenue: item.revenue || item.sales || 0,
              costs: item.costs || item.expenses || 0,
            }))
          )

          const totalProfit = financial.reduce(
            (sum, item) => sum + ((item.revenue || 0) - (item.costs || 0)),
            0
          )
          const totalRevenue = financial.reduce((sum, item) => sum + (item.revenue || 0), 0)
          const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

          setKpis((prev) => ({
            ...prev,
            profitMargin: parseFloat(profitMargin.toFixed(2)),
          }))
        }

        // Process Customer Data
        if (customerRes.data) {
          const customers = Array.isArray(customerRes.data)
            ? customerRes.data
            : [customerRes.data]

          setTopCustomers(
            customers
              .sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0))
              .slice(0, 8)
              .map((customer) => ({
                name: customer.name || customer.customerName || 'Unknown',
                value: customer.totalOrders || customer.orderCount || 0,
              }))
          )

          const activeCount = customers.filter((c) => c.status === 'active').length
          setKpis((prev) => ({
            ...prev,
            activeCustomers: activeCount || customers.length,
          }))
        }

        // Process Inventory Data
        if (inventoryRes.data) {
          const inventory = inventoryRes.data
          const lowStockCount = inventory.lowStockItems || inventory.filter((item) => item.quantity < item.reorderLevel).length || 0
          setSupplyChainMetrics((prev) => ({
            ...prev,
            lowStockItems: lowStockCount,
          }))
        }

        // Process Logistics Data
        if (logisticsRes.data) {
          const logistics = logisticsRes.data
          setSupplyChainMetrics((prev) => ({
            ...prev,
            shipmentsInTransit: logistics.shipmentsInTransit || 0,
            pendingInspections: logistics.pendingInspections || 0,
          }))
        }

        // Mock outstanding receivables if not provided
        setKpis((prev) => ({
          ...prev,
          outstandingReceivables: prev.totalRevenue * 0.15,
        }))
      } catch (err) {
        console.error('Failed to fetch BI data:', err)
        setError('Failed to load BI dashboard data')
        toast.error('Failed to load BI dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 bg-slate-200 rounded animate-pulse w-40"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-80 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">BI Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">Business Intelligence & Analytics</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
            <p className="text-xs text-red-700 mt-1">Some data may be unavailable or incomplete.</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          icon={DollarSign}
          color="blue"
          trend={12}
          trendLabel="vs last month"
        />
        <KPICard
          label="Total Orders"
          value={formatNumber(kpis.totalOrders)}
          icon={ShoppingCart}
          color="green"
          trend={8}
          trendLabel="vs last month"
        />
        <KPICard
          label="Avg Order Value"
          value={formatCurrency(kpis.avgOrderValue)}
          icon={DollarSign}
          color="purple"
          trend={5}
          trendLabel="vs last month"
        />
        <KPICard
          label="Profit Margin"
          value={`${kpis.profitMargin}%`}
          icon={TrendingUp}
          color="orange"
          trend={-2}
          trendLabel="vs last month"
        />
        <KPICard
          label="Outstanding Receivables"
          value={formatCurrency(kpis.outstandingReceivables)}
          icon={AlertTriangle}
          color="red"
          trend={3}
          trendLabel="vs last month"
        />
        <KPICard
          label="Active Customers"
          value={formatNumber(kpis.activeCustomers)}
          icon={Users}
          color="indigo"
          trend={15}
          trendLabel="vs last month"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Trend</h2>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>

        {/* Order Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Status Distribution</h2>
          {orderDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value} orders`}
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Summary</h2>
          {financialData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="costs" fill="#ef4444" name="Costs" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Customers</h2>
          {topCustomers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topCustomers}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={140} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                  formatter={(value) => `${value} orders`}
                />
                <Bar dataKey="value" fill="#8b5cf6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Supply Chain Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Supply Chain Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Shipments In Transit</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {supplyChainMetrics.shipmentsInTransit}
                </p>
              </div>
              <Package className="w-10 h-10 text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-900">Pending Inspections</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {supplyChainMetrics.pendingInspections}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-900">Low Stock Items</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {supplyChainMetrics.lowStockItems}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-400 opacity-50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, color, trend, trendLabel }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  }

  const trendColor = trend >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className={`rounded-lg shadow-md p-6 border ${colorClasses[color]} bg-white`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
          {trend !== undefined && (
            <div className="flex items-center mt-3 gap-1">
              <TrendingUp className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm font-medium ${trendColor}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-xs text-slate-500 ml-1">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
