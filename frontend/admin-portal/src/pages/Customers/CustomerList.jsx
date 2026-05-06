import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Filter } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { customersAPI } from '../../services/api'
import { CUSTOMER_STATUS } from '../../utils/constants'
import { SelectInput } from '../../components/FormFields'

export default function CustomerList() {
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, customer: null })
  const navigate = useNavigate()

  useEffect(() => {
    fetchCustomers()
  }, [searchQuery, statusFilter])

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const res = await customersAPI.getAll({
        search: searchQuery,
        status: statusFilter,
      })
      setCustomers(res.data || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await customersAPI.delete(deleteConfirm.customer.id)
      toast.success('Customer deleted successfully')
      setCustomers(customers.filter((c) => c.id !== deleteConfirm.customer.id))
      setDeleteConfirm({ isOpen: false, customer: null })
    } catch (error) {
      console.error('Failed to delete customer:', error)
      const msg = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to delete customer'
      toast.error(msg)
    }
  }

  const columns = [
    { key: 'companyName', label: 'Name' },
    { key: 'country', label: 'Country' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (row) => `$${row.creditLimit?.toLocaleString() || 0}`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
        <button
          onClick={() => navigate('/customers/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search customers..."
          />
          <SelectInput
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(CUSTOMER_STATUS).map(([key, val]) => ({
              value: val,
              label: key.replace(/_/g, ' '),
            }))}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={customers}
          isLoading={isLoading}
          onEdit={(customer) => navigate(`/customers/${customer.id}`)}
          onDelete={(customer) =>
            setDeleteConfirm({ isOpen: true, customer })
          }
        />
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, customer: null })}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleteConfirm.customer?.companyName || deleteConfirm.customer?.name || 'this customer'}? This action cannot be undone.`}
        confirmText="Delete"
        isDangerous
      />
    </div>
  )
}
