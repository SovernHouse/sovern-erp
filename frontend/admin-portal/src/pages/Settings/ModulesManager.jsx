/**
 * ModulesManager — Admin-only page for enabling/disabling ERP modules.
 * Accessible at /settings/modules.
 * Modelled after the Odoo Apps/Modules interface.
 */
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Package, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Lock, ChevronRight, Layers,
} from 'lucide-react'
import api from '../../services/api'

// Human-readable labels and icons for known modules
const MODULE_META = {
  core:              { label: 'Core',               icon: '⚙️',  category: 'Foundation',  alwaysOn: true,  desc: 'Authentication, users, permissions, notifications. Required by all modules.' },
  crm:               { label: 'CRM',                icon: '👥',  category: 'Sales',        desc: 'Leads, contacts, deals, campaigns, and activity tracking.' },
  sales:             { label: 'Sales',              icon: '📄',  category: 'Sales',        desc: 'Quotations, proforma invoices, and sales orders.' },
  procurement:       { label: 'Procurement',        icon: '🛒',  category: 'Operations',   desc: 'Purchase orders, supplier management, and goods received notes.' },
  finance:           { label: 'Finance',            icon: '💰',  category: 'Finance',      desc: 'Invoices, payments, cash flow, and currency exchange.' },
  logistics:         { label: 'Logistics',          icon: '🚢',  category: 'Operations',   desc: 'Shipments, packing lists, and shipping documents.' },
  quality:           { label: 'Quality',            icon: '🔍',  category: 'Operations',   desc: 'Inspections, sample requests, and customer claims.' },
  products:          { label: 'Products',           icon: '📦',  category: 'Catalogue',    desc: 'Product catalogue, categories, specifications, and pricing.' },
  analytics:         { label: 'Analytics',          icon: '📊',  category: 'Intelligence', desc: 'Dashboard metrics, pipeline reports, and BI views.' },
  documents:         { label: 'Documents',          icon: '📑',  category: 'Foundation',   desc: 'Document templates, PDF generation, and versioning.' },
  tradeFinance:      { label: 'Trade Finance',      icon: '🏦',  category: 'Finance',      desc: 'Letters of credit and landed cost calculations.' },
  sampleManagement:  { label: 'Sample Management',  icon: '🧪',  category: 'Operations',   desc: 'Sample requests, shipment tracking, and buyer feedback.' },
  chatter:           { label: 'Chatter',            icon: '💬',  category: 'Foundation',   desc: 'Polymorphic message thread and audit trail on every record.' },
  internalApprovals: { label: 'Internal Approvals', icon: '✅',  category: 'Foundation',   desc: 'Manager sign-off workflow for staff actions — quotations, SOs, POs, stage changes.' },
  compliance:        { label: 'Compliance',         icon: '🛡️',  category: 'Compliance',   desc: 'Sanctions screening, export controls, and compliance records.' },
  warehouse:         { label: 'Warehouse',          icon: '🏭',  category: 'Operations',   desc: 'Warehouse locations, stock counts, and inventory transactions.' },
  batchTracking:     { label: 'Batch Tracking',     icon: '🔢',  category: 'Operations',   desc: 'Product batch management and allocation tracking.' },
  containerLoading:  { label: 'Container Loading',  icon: '📐',  category: 'Operations',   desc: 'Container configuration and loading optimisation.' },
  landedCost:        { label: 'Landed Cost',        icon: '🧮',  category: 'Finance',      desc: 'Landed cost templates and calculation tools.' },
  productSpecs:      { label: 'Product Specs',      icon: '📋',  category: 'Catalogue',    desc: 'Detailed product specifications and templates.' },
}

const CATEGORY_ORDER = ['Foundation', 'Sales', 'Finance', 'Operations', 'Catalogue', 'Intelligence', 'Compliance']

const CATEGORY_COLORS = {
  Foundation:   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200' },
  Sales:        { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  Finance:      { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
  Operations:   { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  Catalogue:    { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200' },
  Intelligence: { bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  Compliance:   { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
}

function ModuleCard({ module, onToggle, toggling }) {
  const meta   = MODULE_META[module.name] || { label: module.name, icon: '🔌', category: 'Other', desc: module.description }
  const catClr = CATEGORY_COLORS[meta.category] || CATEGORY_COLORS.Foundation
  const isCore = meta.alwaysOn || module.name === 'core'
  const deps   = module.dependencies?.filter(d => d !== 'core') || []

  return (
    <div className={`bg-white rounded-xl border ${module.enabled ? 'border-slate-200' : 'border-slate-100'} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{meta.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{meta.label}</h3>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${catClr.bg} ${catClr.text}`}>
              {meta.category}
            </span>
          </div>
        </div>

        {/* Toggle */}
        {isCore ? (
          <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0 pt-0.5">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-xs">Always on</span>
          </div>
        ) : (
          <button
            onClick={() => onToggle(module.name, !module.enabled)}
            disabled={toggling === module.name}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1
              ${module.enabled
                ? 'border-forest-600 bg-forest-600 focus:ring-forest-500'
                : 'border-slate-300 bg-slate-200 focus:ring-slate-400'
              }
              ${toggling === module.name ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
            `}
            style={{ '--tw-ring-color': '#2D5A27' }}
            title={module.enabled ? 'Click to disable' : 'Click to enable'}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200
                ${module.enabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 leading-relaxed">{meta.desc || module.description}</p>

      {/* Footer: version + deps */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-auto">
        <span className="text-xs text-slate-400">v{module.version || '1.0.0'}</span>
        {deps.length > 0 && (
          <div className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-xs text-slate-400">{deps.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Status pill */}
      <div className={`flex items-center gap-1.5 text-xs font-medium ${module.enabled ? 'text-green-600' : 'text-slate-400'}`}>
        {toggling === module.name ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : module.enabled ? (
          <CheckCircle className="w-3.5 h-3.5" />
        ) : (
          <XCircle className="w-3.5 h-3.5" />
        )}
        {toggling === module.name ? 'Updating…' : module.enabled ? 'Installed' : 'Not installed'}
      </div>
    </div>
  )
}

export default function ModulesManager() {
  const [modules, setModules]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [toggling, setToggling] = useState(null)  // module name currently being toggled
  const [filter, setFilter]     = useState('all') // 'all' | 'installed' | 'not_installed'
  const [search, setSearch]     = useState('')

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/api/modules')
      setModules(res.data?.data || res.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load modules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(name, enable) {
    setToggling(name)
    try {
      await api.post(`/api/modules/${name}/${enable ? 'enable' : 'disable'}`)
      setModules(prev => prev.map(m => m.name === name ? { ...m, enabled: enable } : m))
      toast.success(`${MODULE_META[name]?.label || name} ${enable ? 'enabled' : 'disabled'}. Restart the server to apply route changes.`, { duration: 5000 })
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update module')
    } finally {
      setToggling(null)
    }
  }

  // Group by category
  const visible = modules.filter(m => {
    const meta = MODULE_META[m.name] || {}
    const label = meta.label || m.name
    const matchesSearch = !search || label.toLowerCase().includes(search.toLowerCase()) || m.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'installed' && m.enabled) || (filter === 'not_installed' && !m.enabled)
    return matchesSearch && matchesFilter
  })

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const inCat = visible.filter(m => (MODULE_META[m.name]?.category || 'Other') === cat)
    if (inCat.length) acc[cat] = inCat
    return acc
  }, {})
  // Catch any uncategorised
  const other = visible.filter(m => !MODULE_META[m.name])
  if (other.length) grouped['Other'] = other

  const totalEnabled   = modules.filter(m => m.enabled).length
  const totalInstalled = modules.length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Layers className="w-8 h-8 text-forest-700" style={{ color: '#2D5A27' }} />
            Modules
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Enable or disable feature modules. Changes take effect on next server restart.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total modules',    value: totalInstalled, color: 'text-slate-900' },
          { label: 'Installed',        value: totalEnabled,   color: 'text-green-700' },
          { label: 'Not installed',    value: totalInstalled - totalEnabled, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Restart warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Toggling a module updates the in-memory flag immediately. For route changes to take full effect,
          restart the ERP server: <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">pm2 restart sovern-erp</code>
        </p>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search modules…"
          className="flex-1 min-w-48 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
        />
        {['all', 'installed', 'not_installed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              filter === f
                ? 'border-forest-600 text-white font-medium'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            style={filter === f ? { backgroundColor: '#2D5A27', borderColor: '#2D5A27' } : {}}
          >
            {f === 'all' ? 'All' : f === 'installed' ? 'Installed' : 'Not installed'}
          </button>
        ))}
      </div>

      {/* Module grid grouped by category */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No modules match your search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, mods]) => {
            const clr = CATEGORY_COLORS[category] || CATEGORY_COLORS.Foundation
            return (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${clr.bg} ${clr.text}`}>
                    {category}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{mods.length} module{mods.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {mods.map(m => (
                    <ModuleCard
                      key={m.name}
                      module={m}
                      onToggle={handleToggle}
                      toggling={toggling}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
