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
import { packingListsAPI } from '../../services/api'
import { formatDate, formatWeight, formatVolume } from '../../utils/formatters'
import { SelectInput } from '../../components/FormFields'

const PACKING_LIST_STATUS = ['pending', 'packed', 'ready_for_shipment', 'shipped']

export default function PackingListList() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null })
  const navigate = useNavigate()

  const [refreshKey, setRefreshKey] = useState(0)

  useAutoChainRefresh('PackingList', () => setRefreshKey((k) => k + 1))


  useEffect(() => {
    fetchPackingLists()
  }, [searchQuery, status, dateFrom, dateTo, refreshKey])

  const fetchPackingLists = async () => {
    try {
      setIsLoading(true)
      const res = await packingListsAPI.getAll({
        search: searchQuery,
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
      })
      setData(res.data || [])
    } catch (e) {
      console.error('Failed to load packing lists:', e)
      toast.error('Failed to load packing lists')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await packingListsAPI.delete(deleteConfirm.item.id)
      toast.success('Packing list deleted successfully')
      setData(data.filter((item) => item.id !== deleteConfirm.item.id))
      setDeleteConfirm({ isOpen: false, item: null })
    } catch (error) {
      console.error('Failed to delete packing list:', error)
      toast.error('Failed to delete packing list')
    }
  }

  const columns = [
    { key: 'packingListNumber', label: 'List #' },
    { key: 'orderNumber', label: 'Order' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'items', label: 'Items', render: (r) => (r.items?.length || 0).toString() },
    { key: 'totalWeight', label: 'Weight', render: (r) => formatWeight(r.totalWeight) },
    { key: 'totalVolume', label: 'Volume', render: (r) => formatVolume(r.totalVolume) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Packing Lists</h1>
        <button
          onClick={() => navigate('/packing-lists/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Packing List</span>
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
            placeholder="Search packing lists..."
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              ...PACKING_LIST_STATUS.map(s => ({
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
          onEdit={(item) => navigate(`/packing-lists/${item.id}`)}
          onDelete={(item) => setDeleteConfirm({ isOpen: true, item })}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Packing List"
        message="Are you sure you want to delete this packing list? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, item: null })}
      />
    </div>
  )
}
