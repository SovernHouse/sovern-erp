import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmDialog from '../../components/ConfirmDialog'
import { usersAPI } from '../../services/api'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, user: null })
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
  }, [searchQuery])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const res = await usersAPI.getAll({
        search: searchQuery,
      })
      setUsers(res.data || [])
    } catch (e) {
      console.error('Failed to load users:', e)
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await usersAPI.delete(deleteConfirm.user.id)
      toast.success('User deleted successfully')
      setUsers(users.filter((u) => u.id !== deleteConfirm.user.id))
      setDeleteConfirm({ isOpen: false, user: null })
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('Failed to delete user')
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (row) =>
        (row.role || 'N/A').charAt(0).toUpperCase() + (row.role || 'N/A').slice(1),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) =>
        row.status ? (
          <span className="px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            Inactive
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <button
          onClick={() => navigate('/settings/users/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search users by name or email..."
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          onEdit={(user) => navigate(`/settings/users/${user.id}/edit`)}
          onDelete={(user) => setDeleteConfirm({ isOpen: true, user })}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteConfirm.user?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, user: null })}
      />
    </div>
  )
}
