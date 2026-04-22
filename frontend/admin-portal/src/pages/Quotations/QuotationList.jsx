import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { quotationsAPI } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function QuotationList() {
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchQuotations()
  }, [searchQuery])

  const fetchQuotations = async () => {
    try {
      const res = await quotationsAPI.getAll({ search: searchQuery })
      setQuotations(res.data || [])
    } catch (error) {
      toast.error('Failed to load quotations')
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'quotationNumber', label: 'Quote #' },
    { key: 'customer', label: 'Customer' },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row) => formatCurrency(row.amount),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Quotations</h1>
        <button onClick={() => navigate('/quotations/new')} className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          <span>New Quotation</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchBar onSearch={setSearchQuery} placeholder="Search quotations..." />
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable columns={columns} data={quotations} isLoading={isLoading} onEdit={(q) => navigate(`/quotations/${q.id}`)} />
      </div>
    </div>
  )
}
