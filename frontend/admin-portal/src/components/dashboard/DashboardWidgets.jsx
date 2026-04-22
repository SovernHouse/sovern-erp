import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Users,
  ShoppingCart,
  AlertCircle,
  Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { dashboardAPI } from '../../services/api'
import StatsCard from '../StatsCard'
import DataTable from '../DataTable'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function DashboardWidgets({ userRole = 'admin' }) {
  const [dashboardConfig, setDashboardConfig] = useState(null)
  const [widgetData, setWidgetData] = useState({})
  const [kpis, setKpis] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)

        // Fetch role-based dashboard configuration
        const configRes = await dashboardAPI.getRoleConfig(userRole)
        setDashboardConfig(configRes.data)

        // Fetch available widgets
        const widgetsRes = await dashboardAPI.getAvailableWidgets()
        const widgets = widgetsRes.data?.widgets || []

        // Fetch KPIs
        const kpisRes = await dashboardAPI.getKPIs()
        setKpis(kpisRes.data?.kpis)

        // Extract data based on role
        setWidgetData({
          widgets,
          totalWidgets: widgets.length,
        })
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        toast.error('Failed to load dashboard configuration')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [userRole])

  if (isLoading) return <LoadingSpinner message="Loading dashboard..." />

  if (!dashboardConfig) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <p className="text-slate-600">Unable to load dashboard configuration</p>
      </div>
    )
  }

  const renderWidget = (widget) => {
    switch (widget.id) {
      case 'revenue':
        return renderRevenueWidget()
      case 'profit':
        return renderProfitWidget()
      case 'topCustomers':
        return renderTopCustomersWidget()
      case 'pipeline':
        return renderPipelineWidget()
      case 'orderFulfillment':
        return renderOrderFulfillmentWidget()
      case 'cashFlow':
        return renderCashFlowWidget()
      case 'arAging':
        return renderARAgingWidget()
      case 'paymentCollection':
        return renderPaymentCollectionWidget()
      case 'logistics':
        return renderLogisticsWidget()
      case 'inspections':
        return renderInspectionsWidget()
      default:
        return null
    }
  }

  const renderRevenueWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={[]}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  const renderProfitWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Profit & Margin</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={[]}>
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
          <Bar dataKey="profit" fill="#10b981" />
          <Bar dataKey="margin" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const renderTopCustomersWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={[]}>
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
          <Bar dataKey="revenue" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const renderPipelineWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Pipeline</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="stage" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const renderOrderFulfillmentWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Order Fulfillment</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Fulfillment Rate</span>
          <div className="text-2xl font-bold text-green-600">
            {kpis?.orderFulfillmentRate?.value || '0'}%
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{
              width: `${kpis?.orderFulfillmentRate?.value || 0}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  )

  const renderCashFlowWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Cash Flow</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={[]}>
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
          <Line type="monotone" dataKey="inflow" stroke="#10b981" />
          <Line type="monotone" dataKey="outflow" stroke="#ef4444" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )

  const renderARAgingWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">AR Aging</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
          <span className="text-slate-600">Current</span>
          <span className="font-semibold text-slate-900">$0</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
          <span className="text-slate-600">30-60 Days</span>
          <span className="font-semibold text-slate-900">$0</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-red-50 rounded">
          <span className="text-slate-600">Over 60 Days</span>
          <span className="font-semibold text-slate-900">$0</span>
        </div>
      </div>
    </div>
  )

  const renderPaymentCollectionWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Collection</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Collection Rate</span>
          <div className="text-2xl font-bold text-blue-600">0%</div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all w-0"></div>
        </div>
      </div>
    </div>
  )

  const renderLogisticsWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Logistics Analytics</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="status" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="count" fill="#06b6d4" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const renderInspectionsWidget = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Inspection Stats</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-slate-600">Passed</p>
          <p className="text-2xl font-bold text-green-600">0</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-slate-600">Failed</p>
          <p className="text-2xl font-bold text-red-600">0</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Role Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 capitalize">
            {dashboardConfig.title}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Configured for {dashboardConfig.role.toUpperCase()} role
          </p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-lg">
          <Eye className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">
            {dashboardConfig.widgets.length} widgets available
          </span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            icon={DollarSign}
            label={kpis.revenueGrowthRate?.label}
            value={`${kpis.revenueGrowthRate?.value}${kpis.revenueGrowthRate?.unit}`}
            color="primary"
          />
          <StatsCard
            icon={TrendingUp}
            label={kpis.orderFulfillmentRate?.label}
            value={`${kpis.orderFulfillmentRate?.value}${kpis.orderFulfillmentRate?.unit}`}
            color="green"
          />
          <StatsCard
            icon={Users}
            label={kpis.customerSatisfactionScore?.label}
            value={`${kpis.customerSatisfactionScore?.value}${kpis.customerSatisfactionScore?.unit}`}
            color="blue"
          />
          <StatsCard
            icon={ShoppingCart}
            label={kpis.avgDeliveryTime?.label}
            value={`${kpis.avgDeliveryTime?.value} ${kpis.avgDeliveryTime?.unit}`}
            color="orange"
          />
          <StatsCard
            icon={AlertCircle}
            label={kpis.invoiceProcessingRate?.label}
            value={`${kpis.invoiceProcessingRate?.value}${kpis.invoiceProcessingRate?.unit}`}
            color="red"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('widgets')}
            className={`py-4 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'widgets'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Widgets
          </button>
        </div>
      </div>

      {/* Content Sections */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboardConfig.widgets.map((widget) => (
            <div key={widget.id}>{renderWidget(widget)}</div>
          ))}
        </div>
      )}

      {activeTab === 'widgets' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Available Widgets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgetData.widgets && widgetData.widgets.map((widget) => (
              <div
                key={widget.id}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-slate-900">{widget.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{widget.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                    {widget.category}
                  </span>
                  <span className="text-xs text-slate-500">{widget.defaultSize}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
