import { useState, useEffect } from 'react'
import useAutoChainRefresh from '../../hooks/useAutoChainRefresh'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { ordersAPI } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'

function humanize(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || ''

  const [refreshKey, setRefreshKey] = useState(0)

  useAutoChainRefresh('SalesOrder', () => setRefreshKey((k) => k + 1))


  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      try {
        // Backend already supports ?status= — passing through.
        const params = statusFilter ? { status: statusFilter } : undefined
        const res = await ordersAPI.getAll(params)
        setOrders(res.data || [])
      } catch (e) {
        toast.error('Failed to load orders')
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [statusFilter, refreshKey])

  function clearStatus() {
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales Orders</h1>
          {statusFilter && (
            <button
              onClick={clearStatus}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100"
            >
              Filtered: {humanize(statusFilter)}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={() => navigate('/orders/new')} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
          <Plus className="w-4 h-4 inline mr-2" />
          New Order
        </button>
      </div>
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={[
            { key: 'orderNumber', label: 'Order #' },
            { key: 'customer', label: 'Customer' },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount) },
          ]}
          data={orders}
          isLoading={isLoading}
          onEdit={(o) => navigate(`/orders/${o.id}`)}
        />
      </div>
    </div>
  )
}
