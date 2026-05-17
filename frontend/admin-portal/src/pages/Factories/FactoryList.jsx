import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { factoriesAPI } from '../../services/api'
import { FACTORY_STATUS } from '../../utils/constants'
import { SelectInput } from '../../components/FormFields'

export default function FactoryList() {
  const [factories, setFactories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, factory: null })
  const navigate = useNavigate()

  useEffect(() => {
    fetchFactories()
  }, [searchQuery, statusFilter])

  const fetchFactories = async () => {
    try {
      setIsLoading(true)
      const res = await factoriesAPI.getAll({
        search: searchQuery,
        status: statusFilter,
      })
      setFactories(res.data || [])
    } catch (error) {
      console.error('Failed to fetch factories:', error)
      toast.error('Failed to load factories')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await factoriesAPI.delete(deleteConfirm.factory.id)
      toast.success('Factory deleted successfully')
      setFactories(factories.filter((f) => f.id !== deleteConfirm.factory.id))
      setDeleteConfirm({ isOpen: false, factory: null })
    } catch (error) {
      console.error('Failed to delete factory:', error)
      toast.error('Failed to delete factory')
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
        <button
          onClick={() => navigate('/factories/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Supplier</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchBar onSearch={setSearchQuery} placeholder="Search factories..." />
          <SelectInput
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(FACTORY_STATUS).map(([key, val]) => ({
              value: val,
              label: key.replace(/_/g, ' '),
            }))}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={factories}
          isLoading={isLoading}
          onEdit={(factory) => navigate(`/factories/${factory.id}`)}
          onDelete={(factory) => setDeleteConfirm({ isOpen: true, factory })}
        />
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, factory: null })}
        onConfirm={handleDelete}
        title="Delete Factory"
        message={`Are you sure you want to delete ${deleteConfirm.factory?.name}? This action cannot be undone.`}
        confirmText="Delete"
        isDangerous
      />
    </div>
  )
}
