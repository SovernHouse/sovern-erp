import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Filter } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { paymentsAPI } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { SelectInput } from '../../components/FormFields'

const PAYMENT_METHODS = ['Credit Card', 'Bank Transfer', 'Check', 'Cash', 'PayPal']
const PAYMENT_STATUS = ['pending', 'completed', 'failed', 'cancelled']

export default function PaymentList() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchPayments()
  }, [searchQuery, paymentMethod, status, dateFrom, dateTo])

  const fetchPayments = async () => {
    try {
      setIsLoading(true)
      const res = await paymentsAPI.getAll({
        search: searchQuery,
        method: paymentMethod,
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
      })
      setData(res.data || [])
    } catch (e) {
      console.error('Failed to load payments:', e)
      toast.error('Failed to load payments')
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'paymentNumber', label: 'Payment #' },
    { key: 'referenceNumber', label: 'Reference' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'paymentMethod', label: 'Method' },
    { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
        <button
          onClick={() => navigate('/payments/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex items-center space-x-2 mb-2 text-slate-700 font-medium">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search by reference..."
          />
          <SelectInput
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: '', label: 'All Methods' },
              ...PAYMENT_METHODS.map(m => ({ value: m, label: m }))
            ]}
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              ...PAYMENT_STATUS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))
            ]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          onEdit={(payment) => navigate(`/payments/${payment.id}`)}
        />
      </div>
    </div>
  )
}
