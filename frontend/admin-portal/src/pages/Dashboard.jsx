import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  DollarSign,
  ShoppingCart,
  Inbox,
  AlertCircle,
  Truck,
  TrendingUp,
  Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import StatsCard from '../components/StatsCard'
import DataTable from '../components/DataTable'
import LoadingSpinner from '../components/LoadingSpinner'
import SkeletonLoader from '@shared/components/SkeletonLoader'
import StatusBadge from '../components/StatusBadge'
import { dashboardAPI } from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [ordersData, setOrdersData] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [recentInquiries, setRecentInquiries] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [upcomingShipments, setUpcomingShipments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        // Use allSettled so one failed API doesn't break the entire dashboard
        const safe = (promise) => promise.catch(e => { console.warn('Dashboard API error:', e.message); return { data: null } })
        const [
          metricsRes,
          revenueRes,
          ordersRes,
          customersRes,
          inquiriesRes,
          ordersRes2,
          shipmentsRes,
        ] = await Promise.all([
          safe(dashboardAPI.getMetrics()),
          safe(dashboardAPI.getRevenueChart({ period: '12m' })),
          safe(dashboardAPI.getOrdersChart()),
          safe(dashboardAPI.getTopCustomers()),
          safe(dashboardAPI.getRecentInquiries()),
          safe(dashboardAPI.getRecentOrders()),
          safe(dashboardAPI.getUpcomingShipments()),
        ])

        // Response interceptor auto-unwraps { success, data } envelope
        // so res.data is the actual payload now
        const extractArray = (res) => {
          const d = res?.data
          return Array.isArray(d) ? d : []
        }

        const metricsPayload = metricsRes?.data
        // /dashboard/admin returns { stats: {...}, recentOrders, topCustomers }
        setMetrics(metricsPayload?.stats || metricsPayload || {})
        setRevenueData(extractArray(revenueRes))
        // Orders endpoint returns raw orders — transform into pie chart data by status
        const rawOrders = extractArray(ordersRes)
        const statusCounts = {}
        rawOrders.forEach(o => {
          const s = o.status || 'unknown'
          statusCounts[s] = (statusCounts[s] || 0) + 1
        })
        setOrdersData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))
        setTopCustomers(extractArray(customersRes))
        setRecentInquiries(extractArray(inquiriesRes))
        setRecentOrders(extractArray(ordersRes2))
        setUpcomingShipments(extractArray(shipmentsRes))
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (isLoading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-48 h-8 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLoader key={i} variant="card" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </div>
      <SkeletonLoader variant="table" rows={5} columns={4} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/inquiries/new')}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Inquiry</span>
          </button>
          <button
            onClick={() => navigate('/quotations/new')}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          icon={DollarSign}
          label="Revenue (MTD)"
          value={formatCurrency(metrics?.thisMonthRevenue || metrics?.mtdRevenue || 0)}
          trend={metrics?.mtdTrend || 0}
          color="primary"
        />
        <StatsCard
          icon={TrendingUp}
          label="Total Revenue"
          value={formatCurrency(metrics?.totalRevenue || metrics?.ytdRevenue || 0)}
          trend={metrics?.ytdTrend || 0}
          color="green"
        />
        <StatsCard
          icon={ShoppingCart}
          label="Total Orders"
          value={metrics?.totalOrders || metrics?.activeOrders || 0}
          trend={metrics?.ordersTrend || 0}
          color="blue"
        />
        <StatsCard
          icon={Inbox}
          label="Active Customers"
          value={metrics?.activeCustomers || metrics?.pendingInquiries || 0}
          trend={metrics?.inquiriesTrend || 0}
          color="orange"
        />
        <StatsCard
          icon={AlertCircle}
          label="Pending Invoices"
          value={formatCurrency(metrics?.pendingInvoices || metrics?.overdueInvoices || 0)}
          trendLabel="needs attention"
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Revenue Trend (Last 12 Months)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders Status Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Orders by Status
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={ordersData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {(Array.isArray(ordersData) ? ordersData : []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers and Factory Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Top Customers (by Revenue)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Shipments in Transit */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Upcoming Shipments
          </h2>
          <div className="space-y-3">
            {upcomingShipments.length === 0 ? (
              <p className="text-slate-500 text-sm">No upcoming shipments</p>
            ) : (
              upcomingShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{shipment.shipmentNumber || shipment.trackingNumber || `SHP-${shipment.id}`}</p>
                    <p className="text-sm text-slate-600">
                      {shipment.destination || shipment.portOfDestination || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={shipment.status} />
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(shipment.eta || shipment.etaDate)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inquiries */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Inquiries
            </h2>
            <button
              onClick={() => navigate('/inquiries')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'inquiryNumber', label: 'Number' },
              { key: 'customer', label: 'Customer', render: (row) => row.customer?.companyName || row.customer || 'N/A' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date || row.createdAt) },
            ]}
            data={(recentInquiries || []).slice(0, 5)}
            isLoading={false}
            onEdit={(row) => navigate(`/inquiries/${row.id}`)}
            paginated={false}
          />
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Orders
            </h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'orderNumber', label: 'Order #', render: (row) => row.orderNumber || row.soNumber || `SO-${row.id}` },
              { key: 'customer', label: 'Customer', render: (row) => row.customer?.companyName || row.customer || 'N/A' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: 'amount',
                label: 'Amount',
                render: (row) => formatCurrency(row.total || row.amount || 0),
              },
            ]}
            data={(recentOrders || []).slice(0, 5)}
            isLoading={false}
            onEdit={(row) => navigate(`/orders/${row.id}`)}
            paginated={false}
          />
        </div>
      </div>
    </div>
  )
}
