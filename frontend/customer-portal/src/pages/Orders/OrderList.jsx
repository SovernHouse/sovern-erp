import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ordersAPI } from '../../services/api'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { ORDER_STATUSES } from '../../utils/constants'
import toast from 'react-hot-toast'

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [filter])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = filter === 'All' ? {} : { status: filter }
      const response = await ordersAPI.list(params)
      setOrders(response.data.orders || [])
    } catch (err) {
      console.error('Failed to fetch orders:', err)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(
    (order) =>
      `ORD-${String(order.id).padStart(6, '0')}`.includes(searchTerm.toUpperCase()) ||
      order.reference?.includes(searchTerm)
  )

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">View and manage your orders</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-base pl-10 w-full"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...Object.values(ORDER_STATUSES)].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner text="Loading orders..." />
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredOrders}
            loading={loading}
            pageSize={10}
            onRowClick={(row) => (window.location.href = `/orders/${row.id}`)}
          />
        </div>
      )}
    </div>
  )
}
