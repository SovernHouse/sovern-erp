import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Filter } from 'lucide-react'
import { quotationsAPI } from '../../services/api'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { QUOTATION_STATUSES } from '../../utils/constants'
import toast from 'react-hot-toast'

export default function QuotationList() {
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchQuotations()
  }, [filter])

  const fetchQuotations = async () => {
    setLoading(true)
    try {
      const params = filter === 'All' ? {} : { status: filter }
      const response = await quotationsAPI.list(params)
      setQuotations(response.data.quotations || [])
    } catch (err) {
      console.error('Failed to fetch quotations:', err)
      toast.error('Failed to load quotations')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Quotation',
      sortable: true,
      render: (value) => `QT-${String(value).padStart(6, '0')}`,
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
      render: (value) => <StatusBadge status={value} type="quotation" size="sm" />,
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      sortable: true,
      render: (value) => value ? formatDate(value) : 'N/A',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-600 mt-1">Manage your quotation requests and responses</p>
        </div>
        <Link
          to="/quotations/request"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={18} />
          New Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...Object.values(QUOTATION_STATUSES)].map((status) => (
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
          <LoadingSpinner text="Loading quotations..." />
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={quotations}
            loading={loading}
            pageSize={10}
            onRowClick={(row) => (window.location.href = `/quotations/${row.id}`)}
          />
        </div>
      )}
    </div>
  )
}
