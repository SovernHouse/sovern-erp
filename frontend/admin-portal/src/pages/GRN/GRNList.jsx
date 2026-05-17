import { useState, useEffect } from 'react'
import useAutoChainRefresh from '../../hooks/useAutoChainRefresh'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Filter } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { grnAPI } from '../../services/api'
import { formatDate } from '../../utils/formatters'
import { SelectInput } from '../../components/FormFields'

const GRN_STATUS = ['pending', 'accepted', 'rejected', 'partial']

export default function GRNList() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null })
  const navigate = useNavigate()

  const [refreshKey, setRefreshKey] = useState(0)

  useAutoChainRefresh('GoodsReceivedNote', () => setRefreshKey((k) => k + 1))


  useEffect(() => {
    fetchGRNs()
  }, [searchQuery, status, dateFrom, dateTo, refreshKey])

  const fetchGRNs = async () => {
    try {
      setIsLoading(true)
      const res = await grnAPI.getAll({
        search: searchQuery,
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
      })
      setData(res.data || [])
    } catch (e) {
      console.error('Failed to load GRNs:', e)
      toast.error('Failed to load Goods Received Notes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await grnAPI.delete(deleteConfirm.item.id)
      toast.success('GRN deleted successfully')
      setData(data.filter((item) => item.id !== deleteConfirm.item.id))
      setDeleteConfirm({ isOpen: false, item: null })
    } catch (error) {
      console.error('Failed to delete GRN:', error)
      toast.error('Failed to delete GRN')
    }
  }

  const columns = [
    { key: 'grnNumber', label: 'GRN #' },
    { key: 'poNumber', label: 'PO #' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'items', label: 'Items', render: (r) => (r.items?.length || 0).toString() },
    {
      key: 'receivedBy',
      label: 'Received By',
      render: (r) => r.receivedBy || 'N/A',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">
          Goods Received Notes (GRN)
        </h1>
        <button
          onClick={() => navigate('/grns/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New GRN</span>
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
            placeholder="Search GRN or PO number..."
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              ...GRN_STATUS.map(s => ({
                value: s,
                label: s.replace(/_/g, ' ').toUpperCase()
              }))
            ]}
          />
          <div />
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
          onEdit={(item) => navigate(`/grns/${item.id}`)}
          onDelete={(item) => setDeleteConfirm({ isOpen: true, item })}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete GRN"
        message="Are you sure you want to delete this Goods Received Note? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, item: null })}
      />
    </div>
  )
}
