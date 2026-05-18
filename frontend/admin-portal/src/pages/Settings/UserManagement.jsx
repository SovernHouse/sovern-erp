import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, X, Eye, EyeOff, ChevronDown, UserCheck, UserX,
  Shield, Edit2, ExternalLink,
} from 'lucide-react'
import { usersAPI } from '../../services/api'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// ─── Role metadata ────────────────────────────────────────────────────────────
// Grouped for display; descriptions mirror tooltipContent.js ROLE_TIPS
const ROLE_GROUPS = [
  {
    label: 'Executive',
    roles: ['admin', 'ceo', 'coo', 'manager'],
  },
  {
    label: 'Sales & CRM',
    roles: ['sales', 'sales_rep', 'office_manager', 'customer_service'],
  },
  {
    label: 'Operations & Procurement',
    roles: ['operations', 'project_manager', 'procurement_officer', 'logistics_coordinator'],
  },
  {
    label: 'Finance',
    roles: ['finance', 'accountant', 'cashier'],
  },
  {
    label: 'Quality & Compliance',
    roles: ['quality', 'qc_inspector', 'compliance_officer'],
  },
  {
    label: 'Other',
    roles: ['warehouse', 'viewer'],
  },
]

const ROLE_DESCRIPTIONS = {
  admin:                'Full access to everything including user management, settings, and system configuration.',
  manager:              'Access to all operational modules. No settings or user management.',
  sales:                'Sales pipeline, CRM, quotations, PIs, and outreach. No factory costs or finance.',
  operations:           'Factories, purchase orders, shipments, inspections, and inventory.',
  finance:              'Invoices, payments, claims, and financial reports.',
  warehouse:            'Inventory and shipments only.',
  quality:              'Inspections, claims, factory profiles. No financial data.',
  viewer:               'Read-only access to dashboard and reports.',
  ceo:                  'Full operational access without system administration.',
  coo:                  'Same as CEO with additional document template access.',
  sales_rep:            'Sales pipeline and outreach. Factory costs, invoices, and payments are hidden.',
  project_manager:      'Cross-functional: orders, procurement, logistics, and documents.',
  accountant:           'Finance module, orders, reports, and analytics.',
  cashier:              'Payments and invoices only.',
  office_manager:       'Sales pipeline, products, and documents.',
  procurement_officer:  'Factories, products, purchase orders, logistics.',
  logistics_coordinator:'Shipments, packing lists, inspections, inventory.',
  qc_inspector:         'Inspections, claims, factory and product data.',
  customer_service:     'Customers, inquiries, orders, and claims.',
  compliance_officer:   'Factory compliance, inspections, shipments, claims, documents.',
}

const ROLE_COLORS = {
  admin:                'bg-red-100 text-red-800',
  manager:              'bg-purple-100 text-purple-800',
  ceo:                  'bg-indigo-100 text-indigo-800',
  coo:                  'bg-indigo-100 text-indigo-800',
  sales:                'bg-blue-100 text-blue-800',
  sales_rep:            'bg-blue-100 text-blue-800',
  office_manager:       'bg-blue-100 text-blue-800',
  customer_service:     'bg-cyan-100 text-cyan-800',
  operations:           'bg-orange-100 text-orange-800',
  project_manager:      'bg-orange-100 text-orange-800',
  procurement_officer:  'bg-amber-100 text-amber-800',
  logistics_coordinator:'bg-yellow-100 text-yellow-800',
  finance:              'bg-green-100 text-green-800',
  accountant:           'bg-green-100 text-green-800',
  cashier:              'bg-emerald-100 text-emerald-800',
  quality:              'bg-teal-100 text-teal-800',
  qc_inspector:         'bg-teal-100 text-teal-800',
  compliance_officer:   'bg-teal-100 text-teal-800',
  warehouse:            'bg-slate-100 text-slate-700',
  viewer:               'bg-slate-100 text-slate-700',
}

function roleLabel(role) {
  if (!role) return 'N/A'
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function userInitials(user) {
  const f = user.firstName?.[0] || user.name?.[0] || ''
  const l = user.lastName?.[0] || ''
  return (f + l).toUpperCase() || '?'
}

function formatLastLogin(dt) {
  if (!dt) return 'Never'
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Role Selector (dropdown used in both modals and quick-change) ─────────────
function RoleSelector({ value, onChange, roles }) {
  const [open, setOpen] = useState(false)

  const allGroups = ROLE_GROUPS.map((g) => ({
    ...g,
    roles: g.roles.filter((r) => roles.some((ro) => ro.value === r)),
  })).filter((g) => g.roles.length > 0)

  // also show any custom roles not in our groups
  const groupedRoles = ROLE_GROUPS.flatMap((g) => g.roles)
  const custom = roles.filter((r) => !groupedRoles.includes(r.value))

  const selectedLabel = roles.find((r) => r.value === value)?.label || roleLabel(value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[value] || 'bg-slate-100 text-slate-700'}`}>
          {selectedLabel}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {allGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 sticky top-0">
                {group.label}
              </div>
              {group.roles.map((r) => {
                const opt = roles.find((ro) => ro.value === r)
                if (!opt) return null
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { onChange(r); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${value === r ? 'bg-primary-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r] || 'bg-slate-100 text-slate-700'}`}>
                        {opt.label || roleLabel(r)}
                      </span>
                      {value === r && <span className="text-primary-600 text-xs">✓</span>}
                    </div>
                    {ROLE_DESCRIPTIONS[r] && (
                      <p className="text-xs text-slate-500 mt-0.5 pl-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {custom.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50">
                Custom
              </div>
              {custom.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${value === opt.value ? 'bg-primary-50' : ''}`}
                >
                  <span className="text-sm">{opt.label || roleLabel(opt.value)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}

// ─── User Modal (Add / Edit) ───────────────────────────────────────────────────
function UserModal({ user, roles, currentUserId, onClose, onSaved }) {
  const isEdit = Boolean(user)
  const [form, setForm] = useState({
    firstName: user?.firstName || (user?.name?.split(' ')[0] ?? ''),
    lastName:  user?.lastName  || (user?.name?.split(' ').slice(1).join(' ') ?? ''),
    email:     user?.email     || '',
    role:      user?.role      || 'viewer',
    isActive:  user?.isActive  ?? true,
    password:  '',
    confirmPassword: '',
    phone:     user?.phone     || '',
  })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'First name required'
    if (!form.lastName.trim())  e.lastName  = 'Last name required'
    if (!form.email.trim())     e.email     = 'Email required'
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.role)             e.role      = 'Role required'
    if (!isEdit && !form.password) e.password = 'Password required for new users'
    if (form.password && form.password.length < 6) e.password = 'Minimum 6 characters'
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    try {
      setSaving(true)
      const payload = {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim().toLowerCase(),
        role:      form.role,
        phone:     form.phone || undefined,
        isActive:  form.isActive,
      }
      if (form.password) payload.password = form.password

      if (isEdit) {
        await usersAPI.update(user.id, payload)
        toast.success('User updated')
      } else {
        await usersAPI.create(payload)
        toast.success('User created')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const isSelf = user?.id === currentUserId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.firstName ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="Jane"
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.lastName ? 'border-red-400' : 'border-slate-300'}`}
                placeholder="Smith"
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={isEdit} // email changes require separate flow
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-400' : 'border-slate-300'} ${isEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              placeholder="jane@sovernhouse.co"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            {isEdit && <p className="text-xs text-slate-400 mt-1">Email cannot be changed after creation.</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="+1 555 123 4567"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <RoleSelector value={form.role} onChange={(v) => set('role', v)} roles={roles} />
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
            {ROLE_DESCRIPTIONS[form.role] && (
              <p className="text-xs text-slate-500 mt-1.5 pl-1">{ROLE_DESCRIPTIONS[form.role]}</p>
            )}
          </div>

          {/* Active status (edit only, can't deactivate self) */}
          {isEdit && (
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Account Active</p>
                <p className="text-xs text-slate-500">Inactive users cannot log in.</p>
              </div>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isActive ? 'bg-green-500' : 'bg-slate-300'} ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Password */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {isEdit ? 'Reset Password (leave blank to keep current)' : 'Set Password'}
            </p>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-400' : 'border-slate-300'}`}
                placeholder={isEdit ? 'New password...' : 'Min. 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}

            {(form.password || !isEdit) && (
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.confirmPassword ? 'border-red-400' : 'border-slate-300'}`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Quick Role Change popover ─────────────────────────────────────────────────
function QuickRolePopover({ user, roles, onChanged, onClose }) {
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(user.role)

  const handleApply = async () => {
    if (selected === user.role) { onClose(); return }
    try {
      setSaving(true)
      await usersAPI.assignRole(user.id, selected)
      toast.success(`Role changed to ${roleLabel(selected)}`)
      onChanged()
    } catch {
      toast.error('Failed to change role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold text-slate-900 text-sm">Change Role</p>
            <p className="text-xs text-slate-500">{user.firstName} {user.lastName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <RoleSelector value={selected} onChange={setSelected} roles={roles} />
          {ROLE_DESCRIPTIONS[selected] && (
            <p className="text-xs text-slate-500 pl-1">{ROLE_DESCRIPTIONS[selected]}</p>
          )}
          <div className="flex space-x-2 pt-1">
            <button
              onClick={handleApply}
              disabled={saving}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState([])

  // Filters
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('') // '' | 'active' | 'inactive'

  // Modals
  const [modal, setModal] = useState(null) // { type: 'add'|'edit'|'role', user? }

  // Current user id (to prevent self-deactivation)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    api.get('/auth/me').then((r) => setCurrentUserId(r.data?.data?.id || r.data?.id || null)).catch(() => {})
    loadRoles()
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [search, filterRole, filterStatus])

  const loadRoles = async () => {
    try {
      const res = await api.get('/settings/role-permissions')
      const opts = (res.data?.data || res.data || []).map((r) => ({ value: r.role, label: r.label || roleLabel(r.role) }))
      if (opts.length > 0) {
        setRoles(opts)
        return
      }
    } catch {}
    // Fallback: use the built-in role list
    setRoles(
      ROLE_GROUPS.flatMap((g) =>
        g.roles.map((r) => ({ value: r, label: roleLabel(r) }))
      )
    )
  }

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search) params.search = search
      if (filterRole) params.role = filterRole
      if (filterStatus) params.status = filterStatus
      params.limit = 100
      const res = await usersAPI.getAll(params)
      setUsers(res.data?.data || res.data || [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, filterRole, filterStatus])

  const handleToggleActive = async (user) => {
    if (user.id === currentUserId) {
      toast.error('You cannot deactivate your own account')
      return
    }
    try {
      await usersAPI.toggleActive(user.id)
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`)
      fetchUsers()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const closeModal = () => setModal(null)
  const afterSave = () => { closeModal(); fetchUsers() }

  // All unique roles in current user list (for filter chip display)
  const usedRoles = [...new Set(users.map((u) => u.role).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''} total
            {filterStatus === 'active' ? ` · ${users.filter((u) => u.isActive).length} active shown` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/settings/role-permissions')}
            className="flex items-center space-x-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm"
            title="Manage what each role can access"
          >
            <Shield className="w-4 h-4" />
            <span>Manage Roles</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
          <button
            onClick={() => setModal({ type: 'add' })}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        {/* Search + status */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Search by name or email..."
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
            {[['', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Role filter chips */}
        {usedRoles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center">Filter by role:</span>
            {usedRoles.map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(filterRole === r ? '' : r)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  filterRole === r
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : `${ROLE_COLORS[r] || 'bg-slate-100 text-slate-700'} border-transparent hover:border-slate-300`
                }`}
              >
                {roleLabel(r)}
                {filterRole === r && <X className="inline-block w-3 h-3 ml-1" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No users found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Last Login</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = user.id === currentUserId
                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email
                return (
                  <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
                    {/* User */}
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {userInitials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {displayName}
                            {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role — click to quick-change */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setModal({ type: 'role', user })}
                        className={`group flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary-400 ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-700'}`}
                        title="Click to change role"
                      >
                        <span>{roleLabel(user.role)}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </button>
                    </td>

                    {/* Status toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot deactivate your own account' : user.isActive ? 'Click to deactivate' : 'Click to activate'}
                        className={`flex items-center space-x-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                          user.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {user.isActive
                          ? <><UserCheck className="w-3.5 h-3.5" /><span>Active</span></>
                          : <><UserX   className="w-3.5 h-3.5" /><span>Inactive</span></>
                        }
                      </button>
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                      {formatLastLogin(user.lastLogin)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => setModal({ type: 'edit', user })}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Edit user"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'role', user })}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Change role"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={isSelf}
                          className={`p-1.5 rounded transition-colors ${
                            isSelf
                              ? 'text-slate-200 cursor-default'
                              : user.isActive
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <UserModal
          user={modal.user || null}
          roles={roles}
          currentUserId={currentUserId}
          onClose={closeModal}
          onSaved={afterSave}
        />
      )}

      {modal?.type === 'role' && (
        <QuickRolePopover
          user={modal.user}
          roles={roles}
          onChanged={afterSave}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
