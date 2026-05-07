import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { inquiriesAPI } from '../../services/api'
import { formatDate } from '../../utils/formatters'

export default function InquiryList() {
  const [inquiries, setInquiries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchInquiries()
  }, [searchQuery])

  const fetchInquiries = async () => {
    try {
      const res = await inquiriesAPI.getAll({ search: searchQuery })
      setInquiries(res.data || [])
    } catch (error) {
      toast.error('Failed to load inquiries')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (inquiry) => {
    if (!window.confirm(`Delete inquiry ${inquiry.inquiryNumber}? This cannot be undone.`)) return
    try {
      await inquiriesAPI.delete(inquiry.id)
      toast.success('Inquiry deleted')
      setInquiries((prev) => prev.filter((i) => i.id !== inquiry.id))
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to delete inquiry'
      toast.error(typeof msg === 'string' ? msg : 'Failed to delete inquiry')
    }
  }

  const columns = [
    { key: 'inquiryNumber', label: 'Inquiry #' },
    { key: 'customer', label: 'Customer', render: (row) => row.customer?.companyName || '—' },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Inquiries</h1>
        <button
          onClick={() => navigate('/inquiries/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Inquiry</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchBar onSearch={setSearchQuery} placeholder="Search inquiries..." />
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={inquiries}
          isLoading={isLoading}
          onEdit={(inquiry) => navigate(`/inquiries/${inquiry.id}`)}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
