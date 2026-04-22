import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { ordersAPI } from '../../services/api'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

export default function OrderHistory() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
  })

  useEffect(() => {
    fetchOrderHistory()
  }, [])

  const fetchOrderHistory = async () => {
    setLoading(true)
    try {
      const response = await ordersAPI.list({ limit: 1000 })
      const allOrders = response.data.orders || []
      setOrders(allOrders)

      const totalSpent = allOrders.reduce((sum, order) => sum + order.total, 0)
      setStats({
        totalOrders: allOrders.length,
        totalSpent,
        averageOrderValue: allOrders.length > 0 ? totalSpent / allOrders.length : 0,
      })
    } catch (err) {
      console.error('Failed to fetch order history:', err)
      toast.error('Failed to load order history')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Order',
      sortable: true,
      render: (value) => `ORD-${String(value).padStart(6, '0')}`,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'itemCount',
      label: 'Items',
      sortable: true,
      render: (value, row) => row.items?.length || 0,
    },
    {
      key: 'total',
      label: 'Amount',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} type="order" size="sm" />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Profile
        </button>
        <button className="btn-secondary inline-flex items-center gap-2">
          <Download size={18} />
          Export History
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6">
          <p className="text-blue-100 text-sm font-medium">Total Orders</p>
          <p className="text-3xl font-bold mt-2">{stats.totalOrders}</p>
        </div>
        <div className="card bg-gradient-to-br from-accent-600 to-accent-700 text-white p-6">
          <p className="text-accent-100 text-sm font-medium">Total Spent</p>
          <p className="text-3xl font-bold mt-2">{formatCurrency(stats.totalSpent)}</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-600 to-purple-700 text-white p-6">
          <p className="text-purple-100 text-sm font-medium">Average Order Value</p>
          <p className="text-3xl font-bold mt-2">
            {formatCurrency(stats.averageOrderValue)}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner text="Loading order history..." />
        </div>
      ) : (
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Complete Order History
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              All your orders from the beginning of your account
            </p>
          </div>
          <DataTable
            columns={columns}
            data={orders}
            loading={loading}
            pageSize={25}
            onRowClick={(row) => (window.location.href = `/orders/${row.id}`)}
          />
        </div>
      )}

      {/* Additional Info */}
      <div className="card p-6 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          Need help with your order history? Contact our support team at{' '}
          <a href="mailto:support@sovernhouse.co" className="font-semibold underline">
            support@sovernhouse.co
          </a>{' '}
          or call{' '}
          <a href="tel:+886970781818" className="font-semibold">
            +886 970 781 818
          </a>
          .
        </p>
      </div>
    </div>
  )
}
