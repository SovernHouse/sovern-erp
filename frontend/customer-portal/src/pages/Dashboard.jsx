import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  FileText,
  Truck,
  AlertCircle,
  ArrowRight,
  ShoppingCart,
  Package,
  Clock,
} from 'lucide-react'
import { ordersAPI, quotationsAPI, shipmentsAPI, claimsAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate, formatTimeAgo } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    activeOrders: [],
    recentQuotations: [],
    shipmentsInTransit: [],
    pendingClaims: [],
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [ordersRes, quotesRes, shipmentsRes, claimsRes] = await Promise.all([
        ordersAPI.list({ limit: 5, status: ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'IN_TRANSIT'] }),
        quotationsAPI.list({ limit: 5, status: ['PENDING', 'REVISION_REQUESTED'] }),
        shipmentsAPI.list({ limit: 5, status: ['IN_TRANSIT'] }),
        claimsAPI.list({ limit: 5, status: ['SUBMITTED', 'UNDER_INVESTIGATION'] }),
      ])

      setData({
        activeOrders: ordersRes.data.orders || [],
        recentQuotations: quotesRes.data.quotations || [],
        shipmentsInTransit: shipmentsRes.data.shipments || [],
        pendingClaims: claimsRes.data.claims || [],
      })
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    )
  }

  const activeOrdersCount = data.activeOrders.length
  const pendingQuotesCount = data.recentQuotations.filter(q => q.status === 'PENDING').length
  const shipmentsCount = data.shipmentsInTransit.length
  const claimsCount = data.pendingClaims.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
          <p className="text-gray-600 mt-1">Here's what's happening with your orders today.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/products"
            className="btn-primary inline-flex items-center gap-2"
          >
            <ShoppingCart size={18} />
            Browse Products
          </Link>
          <Link
            to="/quotations/request"
            className="btn-primary inline-flex items-center gap-2"
          >
            <FileText size={18} />
            Request Quote
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Active Orders"
          value={activeOrdersCount}
          color="blue"
          link="/orders"
        />
        <StatCard
          icon={FileText}
          label="Pending Quotes"
          value={pendingQuotesCount}
          color="purple"
          link="/quotations"
        />
        <StatCard
          icon={Truck}
          label="In Transit"
          value={shipmentsCount}
          color="orange"
          link="/shipments"
        />
        <StatCard
          icon={AlertCircle}
          label="Open Claims"
          value={claimsCount}
          color="red"
          link="/claims"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Orders */}
        <div className="lg:col-span-2 card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Active Orders</h2>
              <Link
                to="/orders"
                className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1"
              >
                View All
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {data.activeOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No active orders
              </div>
            ) : (
              data.activeOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">ORD-{String(order.id).padStart(6, '0')}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {order.items?.length || 0} items • {formatCurrency(order.total)}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={order.status} type="order" size="sm" />
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quotations */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-purple-600" />
                Recent Quotations
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {data.recentQuotations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No quotations
                </div>
              ) : (
                data.recentQuotations.slice(0, 3).map((quote) => (
                  <Link
                    key={quote.id}
                    to={`/quotations/${quote.id}`}
                    className="p-4 hover:bg-gray-50 transition-colors block"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      QT-{String(quote.id).padStart(6, '0')}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatCurrency(quote.total)}
                    </p>
                    <StatusBadge status={quote.status} type="quotation" size="sm" className="mt-2" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Shipments */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Truck size={18} className="text-orange-600" />
                Shipments in Transit
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {data.shipmentsInTransit.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No shipments in transit
                </div>
              ) : (
                data.shipmentsInTransit.slice(0, 3).map((ship) => (
                  <Link
                    key={ship.id}
                    to={`/shipments`}
                    className="p-4 hover:bg-gray-50 transition-colors block"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {ship.containerNumber}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {ship.originPort} → {ship.destinationPort}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      ETA: {formatDate(ship.eta)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Claims */}
          {claimsCount > 0 && (
            <div className="card border-2 border-red-200 bg-red-50">
              <div className="p-6">
                <h3 className="font-semibold text-red-900 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Open Claims
                </h3>
                <p className="text-2xl font-bold text-red-600 mt-2">{claimsCount}</p>
                <Link
                  to="/claims"
                  className="mt-4 inline-block text-sm text-red-700 hover:text-red-800 font-medium"
                >
                  Review Claims →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {data.activeOrders.length === 0 && data.recentQuotations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <>
              {/* Orders */}
              {data.activeOrders.slice(0, 2).map((order) => (
                <div key={`order-${order.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Package size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Order ORD-{String(order.id).padStart(6, '0')} updated
                      </p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(order.updatedAt)}</p>
                    </div>
                    <StatusBadge status={order.status} type="order" size="sm" />
                  </div>
                </div>
              ))}
              {/* Quotations */}
              {data.recentQuotations.slice(0, 2).map((quote) => (
                <div key={`quote-${quote.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <FileText size={18} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Quotation QT-{String(quote.id).padStart(6, '0')} received
                      </p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(quote.createdAt)}</p>
                    </div>
                    <StatusBadge status={quote.status} type="quotation" size="sm" />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, link }) {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-700 text-blue-100',
    purple: 'from-purple-600 to-purple-700 text-purple-100',
    orange: 'from-orange-600 to-orange-700 text-orange-100',
    red: 'from-red-600 to-red-700 text-red-100',
  }

  return (
    <Link
      to={link}
      className={`card card-hover bg-gradient-to-br ${colorClasses[color]} p-6 group`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="opacity-90 text-sm font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <Icon size={40} className="opacity-20 group-hover:opacity-30 transition-opacity" />
      </div>
      <div className="mt-4 flex items-center gap-1 opacity-80 text-sm group-hover:opacity-100 transition-opacity">
        View Details <ArrowRight size={14} />
      </div>
    </Link>
  )
}
