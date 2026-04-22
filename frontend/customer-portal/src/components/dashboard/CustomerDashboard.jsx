import { useState, useEffect } from 'react'
import {
  ShoppingCart,
  FileText,
  Truck,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { dashboardAPI } from '../../services/api'
import { ordersAPI } from '../../services/api'
import { invoicesAPI } from '../../services/api'
import { shipmentsAPI } from '../../services/api'
import StatsCard from '../StatsCard'
import DataTable from '../DataTable'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import ShipmentTimeline from '../ShipmentTimeline'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function CustomerDashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [outstandingInvoices, setOutstandingInvoices] = useState([])
  const [activeShipments, setActiveShipments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)

        // Fetch customer dashboard data
        const [ordersRes, invoicesRes, shipmentsRes] = await Promise.all([
          ordersAPI.getAll({ limit: 5, sort: 'createdAt:desc' }),
          invoicesAPI.getAll({
            filters: { status: ['draft', 'sent'] },
            limit: 10,
          }),
          shipmentsAPI.getAll({
            filters: { status: ['pending', 'in_transit'] },
            limit: 5,
          }),
        ])

        const orders = ordersRes.data?.data || []
        const invoices = invoicesRes.data?.data || []
        const shipments = shipmentsRes.data?.data || []

        setRecentOrders(orders)
        setOutstandingInvoices(invoices)
        setActiveShipments(shipments)

        // Calculate stats
        const pendingOrders = orders.filter((o) =>
          ['pending', 'confirmed', 'in_production'].includes(o.status)
        ).length
        const shippedOrders = orders.filter((o) => o.status === 'shipped').length
        const deliveredOrders = orders.filter((o) => o.status === 'delivered').length
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0)

        setStats({
          totalOrders: orders.length,
          pendingOrders,
          shippedOrders,
          deliveredOrders,
          outstandingAmount: totalOutstanding,
          outstandingInvoices: invoices.length,
          activeShipments: shipments.length,
        })
      } catch (error) {
        console.error('Failed to fetch customer dashboard data:', error)
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (isLoading) return <LoadingSpinner message="Loading your dashboard..." />

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">
            Welcome to your customer portal
          </p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={ShoppingCart}
            label="Pending Orders"
            value={stats.pendingOrders}
            color="primary"
          />
          <StatsCard
            icon={Truck}
            label="Shipped Orders"
            value={stats.shippedOrders}
            color="blue"
          />
          <StatsCard
            icon={CheckCircle}
            label="Delivered Orders"
            value={stats.deliveredOrders}
            color="green"
          />
          <StatsCard
            icon={FileText}
            label="Outstanding Invoices"
            value={stats.outstandingInvoices}
            color="orange"
          />
        </div>
      )}

      {/* Outstanding Invoices Summary */}
      {stats && stats.outstandingAmount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 mr-4 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Outstanding Balance</h3>
              <p className="text-red-700 mt-1">
                You have {stats.outstandingInvoices} outstanding invoice(s) totaling{' '}
                <span className="font-bold">{formatCurrency(stats.outstandingAmount)}</span>
              </p>
              <button className="mt-3 text-sm font-medium text-red-600 hover:text-red-700 underline">
                View Invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
            <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All Orders
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outstanding Invoices Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Outstanding Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Amount Due
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {outstandingInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    No outstanding invoices
                  </td>
                </tr>
              ) : (
                outstandingInvoices.map((invoice) => {
                  const isOverdue = new Date(invoice.dueDate) < new Date()
                  return (
                    <tr
                      key={invoice.id}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${
                        isOverdue ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {invoice.salesOrderNumber || '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {formatCurrency(invoice.balance)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4">
                        {isOverdue ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Overdue
                          </span>
                        ) : (
                          <StatusBadge status={invoice.status} />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          Pay Now
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Shipments */}
      {activeShipments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Shipments</h2>
          <div className="space-y-4">
            {activeShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {shipment.shipmentNumber}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      From: {shipment.origin} → To: {shipment.destination}
                    </p>
                  </div>
                  <StatusBadge status={shipment.status} />
                </div>
                {shipment.etaDate && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>
                      ETA: {formatDate(shipment.etaDate)}
                    </span>
                  </div>
                )}
                {shipment.trackingNumber && (
                  <p className="text-sm text-slate-600 mt-2">
                    Tracking: {shipment.trackingNumber}
                  </p>
                )}
                <button className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Track Shipment
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
