import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Filter } from 'lucide-react'
import { claimsAPI } from '../../services/api'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../utils/formatters'
import { CLAIM_STATUSES, CLAIM_PRIORITIES } from '../../utils/constants'
import toast from 'react-hot-toast'

export default function ClaimList() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchClaims()
  }, [filter])

  const fetchClaims = async () => {
    setLoading(true)
    try {
      const params = filter === 'All' ? {} : { status: filter }
      const response = await claimsAPI.list(params)
      setClaims(response.data.claims || [])
    } catch (err) {
      console.error('Failed to fetch claims:', err)
      toast.error('Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Claim',
      sortable: true,
      render: (value) => `CLM-${String(value).padStart(6, '0')}`,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'orderId',
      label: 'Order',
      sortable: true,
      render: (value) => `ORD-${String(value).padStart(6, '0')}`,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (value) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'CRITICAL'
              ? 'bg-red-100 text-red-800'
              : value === 'HIGH'
              ? 'bg-orange-100 text-orange-800'
              : value === 'MEDIUM'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} type="claim" size="sm" />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Claims</h1>
          <p className="text-gray-600 mt-1">Manage your damage and dispute claims</p>
        </div>
        <Link
          to="/claims/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={18} />
          File New Claim
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...Object.values(CLAIM_STATUSES)].map((status) => (
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
          <LoadingSpinner text="Loading claims..." />
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={claims}
            loading={loading}
            pageSize={10}
            onRowClick={(row) => (window.location.href = `/claims/${row.id}`)}
          />
        </div>
      )}
    </div>
  )
}
