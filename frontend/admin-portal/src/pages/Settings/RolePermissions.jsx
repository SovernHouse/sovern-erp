import { useState, useEffect, useCallback } from 'react'
import { Plus, RotateCcw, Trash2, Lock, ChevronDown, ChevronUp, Save, Check } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

// ─── All permission modules with labels and grouping ─────────────────────────
const ALL_PERMISSIONS = [
  // Core
  { key: 'dashboard',      label: 'Dashboard',           group: 'Core' },
  { key: 'reports',        label: 'Reports',             group: 'Core' },
  { key: 'analytics',      label: 'Analytics',           group: 'Core' },
  { key: 'bi-dashboard',   label: 'BI Dashboard',        group: 'Core' },
  { key: 'documents',      label: 'Documents',           group: 'Core' },
  // Sales
  { key: 'customers',      label: 'Customers',           group: 'Sales' },
  { key: 'inquiries',      label: 'Inquiries',           group: 'Sales' },
  { key: 'quotations',     label: 'Quotations',          group: 'Sales' },
  { key: 'proforma',       label: 'Proforma Invoices',   group: 'Sales' },
  { key: 'orders',         label: 'Sales Orders',        group: 'Sales' },
  { key: 'outreach',       label: 'CRM / Outreach',      group: 'Sales' },
  // Procurement
  { key: 'factories',      label: 'Factories',           group: 'Procurement' },
  { key: 'products',       label: 'Products',            group: 'Procurement' },
  { key: 'purchase-orders',label: 'Purchase Orders',     group: 'Procurement' },
  // Logistics
  { key: 'packing-lists',  label: 'Packing Lists',       group: 'Logistics' },
  { key: 'shipments',      label: 'Shipments',           group: 'Logistics' },
  { key: 'inspections',    label: 'Inspections',         group: 'Logistics' },
  { key: 'inventory',      label: 'Inventory',           group: 'Logistics' },
  // Finance
  { key: 'invoices',       label: 'Invoices',            group: 'Finance' },
  { key: 'payments',       label: 'Payments',            group: 'Finance' },
  { key: 'claims',         label: 'Claims',              group: 'Finance' },
  // System
  { key: 'settings',       label: 'Settings (admin)',    group: 'System' },
]

const GROUPS = ['Core', 'Sales', 'Procurement', 'Logistics', 'Finance', 'System']

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hasPermission = (permissions, key) =>
  permissions.includes('*') || permissions.includes(key)

const isFullAccess = (permissions) => permissions.includes('*')

// ─── New Custom Role Modal ────────────────────────────────────────────────────
function NewRoleModal({ onSave, onClose }) {
  const [form, setForm] = useState({ role: '', label: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.role || !form.label) { setError('Role ID and display name are required.'); return }
    if (!/^[a-z0-9_]+$/.test(form.role)) {
      setError('Role ID: lowercase letters, numbers, underscores only.')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...form, permissions: ['dashboard'] })
      onClose()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create custom role</h3>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Role ID <span className="text-slate-400">(used internally, e.g. "trade_analyst")</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
              placeholder="e.g. trade_analyst"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. Trade Analyst"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description <span className="text-slate-400">(optional)</span></label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="What does this role do?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Permission row for a single role ────────────────────────────────────────
function RoleRow({ roleData, onSave, onDelete, onReset }) {
  const [permissions, setPermissions] = useState(roleData.permissions)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Keep in sync if parent refreshes
  useEffect(() => {
    setPermissions(roleData.permissions)
    setDirty(false)
  }, [roleData.permissions])

  const isAdmin = roleData.role === 'admin'
  const fullAccess = isFullAccess(permissions)

  const toggle = (key) => {
    if (isAdmin) return
    setPermissions(prev => {
      const next = prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
      setDirty(true)
      return next
    })
  }

  const toggleGroup = (group) => {
    if (isAdmin) return
    const groupKeys = ALL_PERMISSIONS.filter(p => p.group === group).map(p => p.key)
    const allOn = groupKeys.every(k => hasPermission(permissions, k))
    setPermissions(prev => {
      const next = allOn
        ? prev.filter(k => !groupKeys.includes(k))
        : [...new Set([...prev, ...groupKeys])]
      setDirty(true)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(roleData.role, permissions)
      setDirty(false)
      toast.success(`${roleData.label} permissions saved`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm(`Reset "${roleData.label}" permissions to system defaults?`)) return
    try {
      const fresh = await onReset(roleData.role)
      setPermissions(fresh)
      setDirty(false)
    } catch (e) {
      toast.error('Failed to reset')
    }
  }

  return (
    <div className={`border rounded-xl bg-white overflow-hidden transition-all ${dirty ? 'border-amber-300 shadow-sm' : 'border-slate-200'}`}>
      {/* Role header row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isAdmin ? 'bg-slate-900 text-white' :
            roleData.isCustom ? 'bg-violet-100 text-violet-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {roleData.label.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{roleData.label}</span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-slate-800 text-white rounded-full">
                  <Lock size={8} /> System
                </span>
              )}
              {roleData.isCustom && (
                <span className="text-[11px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">Custom</span>
              )}
              {dirty && (
                <span className="text-[11px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Unsaved changes</span>
              )}
            </div>
            {roleData.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{roleData.description}</p>
            )}
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0 ml-auto" /> : <ChevronDown size={16} className="text-slate-400 shrink-0 ml-auto" />}
        </button>

        {/* Permission count badge */}
        <span className="text-xs text-slate-400 shrink-0">
          {isAdmin ? 'All permissions' : `${permissions.length} / ${ALL_PERMISSIONS.length}`}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {dirty && !isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              <Save size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {!isAdmin && roleData.isSystem && (
            <button
              onClick={handleReset}
              title="Reset to defaults"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {!isAdmin && roleData.isCustom && (
            <button
              onClick={() => onDelete(roleData.role, roleData.label)}
              title="Delete role"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded permissions matrix */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          {isAdmin ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Lock size={14} className="text-slate-400" />
              Admin has full access to all modules. This cannot be changed.
            </div>
          ) : (
            <div className="space-y-4">
              {GROUPS.map(group => {
                const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group)
                const allOn = groupPerms.every(p => hasPermission(permissions, p.key))
                const someOn = groupPerms.some(p => hasPermission(permissions, p.key))
                return (
                  <div key={group}>
                    {/* Group header + toggle all */}
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          allOn ? 'bg-slate-800 border-slate-800' :
                          someOn ? 'bg-slate-200 border-slate-400' :
                          'border-slate-300 bg-white hover:border-slate-500'
                        }`}
                      >
                        {allOn && <Check size={10} className="text-white" strokeWidth={3} />}
                        {someOn && !allOn && <span className="w-1.5 h-0.5 bg-slate-500 rounded" />}
                      </button>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group}</span>
                    </div>
                    {/* Individual permissions */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5 ml-6">
                      {groupPerms.map(perm => {
                        const on = hasPermission(permissions, perm.key)
                        return (
                          <label key={perm.key} className="flex items-center gap-2 cursor-pointer group">
                            <div
                              onClick={() => toggle(perm.key)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                on ? 'bg-slate-800 border-slate-800' : 'border-slate-300 bg-white hover:border-slate-500'
                              }`}
                            >
                              {on && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <span
                              onClick={() => toggle(perm.key)}
                              className={`text-sm select-none ${on ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'}`}
                            >
                              {perm.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Save bar at bottom of expanded section */}
              {dirty && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Save size={14} /> {saving ? 'Saving…' : 'Save permissions'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RolePermissions() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewRole, setShowNewRole] = useState(false)
  const [filter, setFilter] = useState('active') // 'active' | 'legacy' | 'custom'

  const load = useCallback(async () => {
    try {
      const res = await api.get('/settings/role-permissions')
      setRoles(res.data?.data || [])
    } catch {
      toast.error('Failed to load role permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (role, permissions) => {
    await api.put(`/settings/role-permissions/${role}`, { permissions })
    await load()
  }

  const handleCreate = async (data) => {
    await api.post('/settings/role-permissions', data)
    toast.success(`Role "${data.label}" created`)
    await load()
  }

  const handleDelete = async (role, label) => {
    if (!window.confirm(`Delete the "${label}" role? Any users assigned this role will need to be reassigned.`)) return
    try {
      await api.delete(`/settings/role-permissions/${role}`)
      toast.success(`Role "${label}" deleted`)
      await load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete role')
    }
  }

  const handleReset = async (role) => {
    const res = await api.post(`/settings/role-permissions/${role}/reset`)
    await load()
    // L-045: interceptor unwraps; res.data is the role row directly.
    return (res.data?.data ?? res.data)?.permissions
  }

  const filteredRoles = roles.filter(r => {
    if (filter === 'active') return !r.role.match(/^(manager|sales|operations|finance|warehouse|quality)$/)
    if (filter === 'legacy') return r.role.match(/^(manager|sales|operations|finance|warehouse|quality)$/)
    if (filter === 'custom') return r.isCustom
    return true
  })

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Role Permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure what each staff role can access. Changes take effect on next login.
          </p>
        </div>
        <button
          onClick={() => setShowNewRole(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 shrink-0"
        >
          <Plus size={15} /> New role
        </button>
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        <strong>How this works:</strong> Each role has a set of module permissions. Tick a module to grant access, untick to remove it.
        Roles marked <strong>System</strong> can have their permissions edited but cannot be deleted.
        Use <strong>Reset to defaults</strong> (↺) to restore original settings.
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'active', label: 'Active roles' },
          { key: 'legacy', label: 'Legacy roles' },
          { key: 'custom', label: 'Custom roles' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
              filter === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {roles.filter(r => {
                if (tab.key === 'active') return !r.role.match(/^(manager|sales|operations|finance|warehouse|quality)$/)
                if (tab.key === 'legacy') return r.role.match(/^(manager|sales|operations|finance|warehouse|quality)$/)
                if (tab.key === 'custom') return r.isCustom
                return true
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* Role rows */}
      <div className="space-y-2">
        {filteredRoles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No {filter} roles found.</p>
            {filter === 'custom' && (
              <p className="text-xs mt-1">Click "New role" to create a custom role with its own permission set.</p>
            )}
          </div>
        ) : (
          filteredRoles.map(role => (
            <RoleRow
              key={role.role}
              roleData={role}
              onSave={handleSave}
              onDelete={handleDelete}
              onReset={handleReset}
            />
          ))
        )}
      </div>

      {/* New role modal */}
      {showNewRole && (
        <NewRoleModal onSave={handleCreate} onClose={() => setShowNewRole(false)} />
      )}
    </div>
  )
}
