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
import BrandFilterPicker from '../components/BrandFilterPicker'
import CommissionWidget from '../components/DashboardWidgets/CommissionWidget'
import BrandRevenueComparison from '../components/DashboardWidgets/BrandRevenueComparison'
import TariffExpiringWidget from '../components/DashboardWidgets/TariffExpiringWidget'
import { dashboardAPI } from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'

// Sovern House chart palette — forest-anchored
const COLORS = ['#1D5A32', '#2A7040', '#4A9060', '#E4E0D8', '#8BA888', '#0E0D0C']

const SH = {
  forest: '#1D5A32',
  forestLight: '#2A7040',
  cream: '#F1EEE7',
  creamDark: '#E4E0D8',
  ink: '#0E0D0C',
  inkMuted: 'rgba(14,13,12,0.55)',
}

// Shared card style — cream bg, no radius, left rule
const cardStyle = {
  background: '#F1EEE7',
  padding: '24px',
}

// Section heading style — Arsenal SC uppercase
const sectionHeading = {
  fontFamily: "'Arsenal SC', sans-serif",
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(14,13,12,0.55)',
  marginBottom: 16,
  fontWeight: 400,
}

// Action button style
const actionBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#1D5A32',
  color: '#F1EEE7',
  fontFamily: "'Arsenal SC', sans-serif",
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  padding: '8px 14px',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [ordersData, setOrdersData] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [recentInquiries, setRecentInquiries] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [upcomingShipments, setUpcomingShipments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  // Phase 3, C11: brand filter. null = picker hasn't initialized yet,
  // 'all' = aggregate (super_admin cross-brand only), 'SH'/'FW'/... = narrow.
  const [brandFilter, setBrandFilter] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        // Use allSettled so one failed API doesn't break the entire dashboard
        const safe = (promise) => promise.catch(e => { console.warn('Dashboard API error:', e.message); return { data: null } })
        // Phase 3, C11: pass ?brandCode= when a specific brand is picked.
        // 'all' or null both mean "no override, use the user's scope".
        const params = brandFilter && brandFilter !== 'all' ? { brandCode: brandFilter } : undefined
        const [
          metricsRes,
          revenueRes,
          ordersRes,
          customersRes,
          inquiriesRes,
          ordersRes2,
          shipmentsRes,
        ] = await Promise.all([
          safe(dashboardAPI.getMetrics(params)),
          safe(dashboardAPI.getRevenueChart({ period: '12m', ...(params || {}) })),
          safe(dashboardAPI.getOrdersChart(params)),
          safe(dashboardAPI.getTopCustomers(params)),
          safe(dashboardAPI.getRecentInquiries(params)),
          safe(dashboardAPI.getRecentOrders(params)),
          safe(dashboardAPI.getUpcomingShipments(params)),
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
  }, [brandFilter])

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

  const tooltipStyle = {
    backgroundColor: SH.cream,
    border: `1px solid ${SH.creamDark}`,
    borderRadius: 0,
    fontFamily: "'Arsenal SC', sans-serif",
    fontSize: 12,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontFamily: "'Big Shoulders Display', sans-serif",
            fontWeight: 700,
            fontSize: 28,
            color: SH.ink,
            letterSpacing: '0.01em',
          }}
        >
          Dashboard
        </h1>
        <div className="flex items-center" style={{ gap: 12 }}>
          {/* Phase 3, C11: brand filter (hidden for single-brand users) */}
          <BrandFilterPicker value={brandFilter} onChange={setBrandFilter} />
          <button onClick={() => navigate('/inquiries/new')} style={actionBtn}
            onMouseEnter={e => e.currentTarget.style.background = SH.forestLight}
            onMouseLeave={e => e.currentTarget.style.background = SH.forest}>
            <Plus style={{ width: 12, height: 12 }} />
            New Inquiry
          </button>
          <button onClick={() => navigate('/quotations/new')} style={actionBtn}
            onMouseEnter={e => e.currentTarget.style.background = SH.forestLight}
            onMouseLeave={e => e.currentTarget.style.background = SH.forest}>
            <Plus style={{ width: 12, height: 12 }} />
            New Quotation
          </button>
          <button onClick={() => navigate('/orders/new')} style={actionBtn}
            onMouseEnter={e => e.currentTarget.style.background = SH.forestLight}
            onMouseLeave={e => e.currentTarget.style.background = SH.forest}>
            <Plus style={{ width: 12, height: 12 }} />
            New Order
          </button>
        </div>
      </div>

      {/* Phase 3, C11: brand-aware widgets. CommissionWidget renders only
          for users with FW access. BrandRevenueComparison renders only for
          super_admin in cross-brand viewMode. Both gracefully no-op
          otherwise so the dashboard stays unchanged for single-brand users. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommissionWidget />
        <BrandRevenueComparison />
      </div>

      {/* Phase 4.9 C-5: tariff expiry warning. Self-hiding when no rows
          are at risk so single-domestic-brand users don't see noise. */}
      <TariffExpiringWidget />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard icon={DollarSign} label="Revenue (MTD)" value={formatCurrency(metrics?.thisMonthRevenue || metrics?.mtdRevenue || 0)} trend={metrics?.mtdTrend || 0} />
        <StatsCard icon={TrendingUp} label="Total Revenue" value={formatCurrency(metrics?.totalRevenue || metrics?.ytdRevenue || 0)} trend={metrics?.ytdTrend || 0} />
        <StatsCard icon={ShoppingCart} label="Total Orders" value={metrics?.totalOrders || metrics?.activeOrders || 0} trend={metrics?.ordersTrend || 0} />
        <StatsCard icon={Inbox} label="Active Customers" value={metrics?.activeCustomers || metrics?.pendingInquiries || 0} trend={metrics?.inquiriesTrend || 0} />
        <StatsCard icon={AlertCircle} label="Pending Invoices" value={formatCurrency(metrics?.pendingInvoices || metrics?.overdueInvoices || 0)} trendLabel="needs attention" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2" style={cardStyle}>
          <p style={sectionHeading}>Revenue Trend — Last 12 Months</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={SH.creamDark} />
              <XAxis dataKey="month" stroke={SH.inkMuted} tick={{ fontFamily: "'Arsenal SC'", fontSize: 11 }} />
              <YAxis stroke={SH.inkMuted} tick={{ fontFamily: "'Arsenal SC'", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: "'Arsenal SC'", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <Line type="monotone" dataKey="revenue" stroke={SH.forest} strokeWidth={2} dot={{ fill: SH.forest, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders Status Pie Chart */}
        <div style={cardStyle}>
          <p style={sectionHeading}>Orders by Status</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={ordersData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {(Array.isArray(ordersData) ? ordersData : []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers and Shipments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div style={cardStyle}>
          <p style={sectionHeading}>Top Customers — by Revenue</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers}>
              <CartesianGrid strokeDasharray="3 3" stroke={SH.creamDark} />
              <XAxis dataKey="name" stroke={SH.inkMuted} tick={{ fontFamily: "'Arsenal SC'", fontSize: 11 }} />
              <YAxis stroke={SH.inkMuted} tick={{ fontFamily: "'Arsenal SC'", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill={SH.forest} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Shipments */}
        <div style={cardStyle}>
          <p style={sectionHeading}>Upcoming Shipments</p>
          <div className="space-y-3">
            {upcomingShipments.length === 0 ? (
              <p style={{ color: SH.inkMuted, fontSize: 13 }}>No upcoming shipments</p>
            ) : (
              upcomingShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between"
                  style={{ padding: '10px 12px', background: SH.creamDark }}
                >
                  <div className="flex-1">
                    <p style={{ fontWeight: 600, fontSize: 13, color: SH.ink }}>{shipment.shipmentNumber || shipment.trackingNumber || `SHP-${shipment.id}`}</p>
                    <p style={{ fontSize: 12, color: SH.inkMuted }}>{shipment.destination || shipment.portOfDestination || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={shipment.status} />
                    <p style={{ fontSize: 11, color: SH.inkMuted, marginTop: 4 }}>{formatDate(shipment.eta || shipment.etaDate)}</p>
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
        <div style={cardStyle}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <p style={sectionHeading}>Recent Inquiries</p>
            <button onClick={() => navigate('/inquiries')}
              style={{ fontFamily: "'Arsenal SC'", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SH.forest, background: 'none', border: 'none', cursor: 'pointer' }}>
              View All
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'inquiryNumber', label: 'Number' },
              { key: 'customer', label: 'Customer', render: (row) => row.customer?.companyName || row.customer || 'N/A' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date || row.createdAt) },
            ]}
            data={(recentInquiries || []).slice(0, 5)}
            isLoading={false}
            onEdit={(row) => navigate(`/inquiries/${row.id}`)}
            paginated={false}
          />
        </div>

        {/* Recent Orders */}
        <div style={cardStyle}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <p style={sectionHeading}>Recent Orders</p>
            <button onClick={() => navigate('/orders')}
              style={{ fontFamily: "'Arsenal SC'", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SH.forest, background: 'none', border: 'none', cursor: 'pointer' }}>
              View All
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'orderNumber', label: 'Order #', render: (row) => row.orderNumber || row.soNumber || `SO-${row.id}` },
              { key: 'customer', label: 'Customer', render: (row) => row.customer?.companyName || row.customer || 'N/A' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.total || row.amount || 0) },
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
