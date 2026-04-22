import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { ordersAPI } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await ordersAPI.getAll()
        setOrders(res.data || [])
      } catch (e) {
        toast.error('Failed to load orders')
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Sales Orders</h1>
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
