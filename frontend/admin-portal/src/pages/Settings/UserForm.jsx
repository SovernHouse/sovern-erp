import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { usersAPI } from '../../services/api'
import api from '../../services/api'
import {
  TextInput,
  EmailInput,
  SelectInput,
  PasswordInput,
} from '../../components/FormFields'

// Role list — fetched from /api/settings/role-permissions at runtime.
// This static list is the fallback used before the API responds.
const DEFAULT_ROLES = [
  { value: 'admin',                label: 'Admin — Full system access' },
  { value: 'ceo',                  label: 'CEO' },
  { value: 'coo',                  label: 'COO' },
  { value: 'sales_rep',            label: 'Sales Rep' },
  { value: 'project_manager',      label: 'Project Manager' },
  { value: 'accountant',           label: 'Accountant' },
  { value: 'cashier',              label: 'Cashier' },
  { value: 'office_manager',       label: 'Office Manager' },
  { value: 'procurement_officer',  label: 'Procurement Officer' },
  { value: 'logistics_coordinator',label: 'Logistics Coordinator' },
  { value: 'qc_inspector',         label: 'QC Inspector' },
  { value: 'customer_service',     label: 'Customer Service' },
  { value: 'compliance_officer',   label: 'Compliance Officer' },
  { value: 'viewer',               label: 'Viewer — Read-only' },
]

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [roleOptions, setRoleOptions] = useState(DEFAULT_ROLES)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'viewer',
  })

  useEffect(() => {
    if (id) fetchUser()
    // Fetch live roles from DB (includes custom roles)
    api.get('/settings/role-permissions')
      .then(res => {
        const opts = (res.data?.data || res.data || []).map(r => ({ value: r.role, label: r.label }))
        if (opts.length > 0) setRoleOptions(opts)
      })
      .catch(() => {}) // fall back to DEFAULT_ROLES
  }, [id])

  const fetchUser = async () => {
    try {
      const res = await usersAPI.getById(id)
      setFormData((prev) => ({
        ...prev,
        name: res.data.name || '',
        email: res.data.email || '',
        role: res.data.role || 'viewer',
        password: '',
        confirmPassword: '',
      }))
    } catch (error) {
      console.error('Failed to fetch user:', error)
      toast.error('Failed to load user')
      navigate('/settings/users')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.role) newErrors.role = 'Role is required'

    // For new users, password is required
    if (!id) {
      if (!formData.password) newErrors.password = 'Password is required'
      if (formData.password && formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
    } else if (formData.password && formData.password.length < 6) {
      // For existing users, password is optional but must be at least 6 chars if provided
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (
      formData.password &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSaving(true)
      const submitData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      }

      // Only include password if it's provided
      if (formData.password) {
        submitData.password = formData.password
      }

      if (id) {
        await usersAPI.update(id, submitData)
        toast.success('User updated successfully')
      } else {
        await usersAPI.create(submitData)
        toast.success('User created successfully')
      }
      navigate('/settings/users')
    } catch (error) {
      console.error('Failed to save user:', error)
      toast.error(error.response?.data?.message || 'Failed to save user')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/settings/users')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {id ? 'Edit User' : 'Add User'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            error={errors.name}
          />

          <EmailInput
            label="Email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            error={errors.email}
          />

          {!id && (
            <PasswordInput
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!id}
              error={errors.password}
            />
          )}

          {(id || formData.password) && (
            <>
              <PasswordInput
                label={id ? 'New Password (leave blank to keep current)' : 'Confirm Password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
              />
            </>
          )}

          <SelectInput
            label="Role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={roleOptions}
            error={errors.role}
          />

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : id ? 'Update User' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings/users')}
              className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
