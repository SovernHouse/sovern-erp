import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, Eye } from 'lucide-react'
import { invoicesAPI } from '../../services/api'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

const INVOICE_STATUSES = {
  paid: 'paid',
  partial: 'partial',
  overdue: 'overdue',
  pending: 'pending',
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    fetchInvoices()
  }, [filter, sortBy, sortOrder])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params = {
        ...(filter !== 'all' && { status: filter }),
        sort: sortBy,
        order: sortOrder,
      }
      const response = await invoicesAPI.list(params)
      setInvoices(response.data.invoices || response.data || [])
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.invoiceNumber?.includes(searchTerm.toUpperCase()) ||
    invoice.reference?.includes(searchTerm)
  )

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'partial':
        return 'warning'
      case 'overdue':
        return 'danger'
      case 'pending':
        return 'default'
      default:
        return 'default'
    }
  }

  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      sortable: true,
      render: (value) => `INV-${value}`,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <StatusBadge
          status={value}
          type="invoice"
          size="sm"
          variant={getStatusBadgeVariant(value)}
        />
      ),
    },
    {
      key: 'balanceDue',
      label: 'Balance',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Link
            to={`/invoices/${row.id}`}
            className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
            title="View"
          >
            <Eye size={16} />
          </Link>
          <button
            onClick={() => handleDownloadPDF(row.id)}
            className="p-2 hover:bg-gray-100 rounded-lg text-green-600 transition-colors"
            title="Download PDF"
          >
            <Download size={16} />
          </button>
        </div>
      ),
    },
  ]

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const response = await invoicesAPI.downloadPDF(invoiceId)
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${invoiceId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      toast.success('Invoice downloaded')
    } catch (err) {
      console.error('Failed to download invoice:', err)
      toast.error('Failed to download invoice')
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-600 mt-1">View and manage your invoices</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search invoices by number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-base pl-10 w-full"
        />
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'paid', 'partial', 'overdue', 'pending'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all'
                ? 'All Invoices'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort Options */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="status">Sort by Status</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <DataTable
          columns={columns}
          data={filteredInvoices}
          isLoading={loading}
          emptyMessage="No invoices found"
        />
      </div>
    </div>
  )
}
