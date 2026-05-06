import { useState, useEffect, useCallback, useRef } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { RotateCcw, Save, LayoutDashboard, ChevronDown, Plus, X } from 'lucide-react'
import { dashboardAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import RevenueWidget from '../../components/DashboardWidgets/RevenueWidget'
import OrderStatusWidget from '../../components/DashboardWidgets/OrderStatusWidget'
import PendingApprovalsWidget from '../../components/DashboardWidgets/PendingApprovalsWidget'
import RecentActivityWidget from '../../components/DashboardWidgets/RecentActivityWidget'
import KPICardWidget from '../../components/DashboardWidgets/KPICardWidget'
import QuickActionsWidget from '../../components/DashboardWidgets/QuickActionsWidget'
import AlertsWidget from '../../components/DashboardWidgets/AlertsWidget'
import toast from 'react-hot-toast'

const ResponsiveGridLayout = WidthProvider(Responsive)

// ─── Widget registry ──────────────────────────────────────────────────────────

const WIDGET_COMPONENTS = {
  revenue:   RevenueWidget,
  orders:    OrderStatusWidget,
  approvals: PendingApprovalsWidget,
  activity:  RecentActivityWidget,
  kpi:       KPICardWidget,
  actions:   QuickActionsWidget,
  alerts:    AlertsWidget,
}

const ALL_WIDGETS = [
  { id: 'revenue',   name: 'Revenue Summary',        type: 'revenue',   defaultW: 6, defaultH: 5 },
  { id: 'orders',    name: 'Order Status',            type: 'orders',    defaultW: 6, defaultH: 5 },
  { id: 'approvals', name: 'Pending Approvals',       type: 'approvals', defaultW: 4, defaultH: 4 },
  { id: 'activity',  name: 'Recent Activity',         type: 'activity',  defaultW: 8, defaultH: 4 },
  { id: 'kpi',       name: 'KPI Overview',            type: 'kpi',       defaultW: 4, defaultH: 4 },
  { id: 'actions',   name: 'Quick Actions',           type: 'actions',   defaultW: 4, defaultH: 3 },
  { id: 'alerts',    name: 'Alerts & Notifications',  type: 'alerts',    defaultW: 4, defaultH: 3 },
]

// ─── Per-role default layouts ─────────────────────────────────────────────────

const ROLE_DEFAULTS = {
  admin: [
    { i: 'revenue',   x: 0, y: 0,  w: 6, h: 5, type: 'revenue',   name: 'Revenue Summary' },
    { i: 'orders',    x: 6, y: 0,  w: 6, h: 5, type: 'orders',    name: 'Order Status' },
    { i: 'approvals', x: 0, y: 5,  w: 4, h: 4, type: 'approvals', name: 'Pending Approvals' },
    { i: 'activity',  x: 4, y: 5,  w: 8, h: 4, type: 'activity',  name: 'Recent Activity' },
    { i: 'actions',   x: 0, y: 9,  w: 6, h: 3, type: 'actions',   name: 'Quick Actions' },
    { i: 'alerts',    x: 6, y: 9,  w: 6, h: 3, type: 'alerts',    name: 'Alerts & Notifications' },
  ],
  sales: [
    { i: 'revenue',  x: 0, y: 0, w: 8, h: 5, type: 'revenue',  name: 'Revenue Summary' },
    { i: 'orders',   x: 8, y: 0, w: 4, h: 5, type: 'orders',   name: 'Order Status' },
    { i: 'activity', x: 0, y: 5, w: 8, h: 4, type: 'activity', name: 'Recent Activity' },
    { i: 'actions',  x: 8, y: 5, w: 4, h: 4, type: 'actions',  name: 'Quick Actions' },
  ],
  operations: [
    { i: 'orders',    x: 0, y: 0, w: 6, h: 5, type: 'orders',    name: 'Order Status' },
    { i: 'approvals', x: 6, y: 0, w: 6, h: 5, type: 'approvals', name: 'Pending Approvals' },
    { i: 'activity',  x: 0, y: 5, w: 8, h: 4, type: 'activity',  name: 'Recent Activity' },
    { i: 'alerts',    x: 8, y: 5, w: 4, h: 4, type: 'alerts',    name: 'Alerts & Notifications' },
  ],
  finance: [
    { i: 'revenue',   x: 0, y: 0, w: 8, h: 5, type: 'revenue',   name: 'Revenue Summary' },
    { i: 'kpi',       x: 8, y: 0, w: 4, h: 5, type: 'kpi',       name: 'KPI Overview' },
    { i: 'approvals', x: 0, y: 5, w: 6, h: 4, type: 'approvals', name: 'Pending Approvals' },
    { i: 'activity',  x: 6, y: 5, w: 6, h: 4, type: 'activity',  name: 'Recent Activity' },
  ],
  inspector: [
    { i: 'approvals', x: 0, y: 0, w: 8, h: 5, type: 'approvals', name: 'Pending Approvals' },
    { i: 'alerts',    x: 8, y: 0, w: 4, h: 5, type: 'alerts',    name: 'Alerts & Notifications' },
    { i: 'activity',  x: 0, y: 5, w: 12, h: 4, type: 'activity', name: 'Recent Activity' },
  ],
  customer: [
    { i: 'actions', x: 0, y: 0, w: 6, h: 4, type: 'actions', name: 'Quick Actions' },
    { i: 'alerts',  x: 6, y: 0, w: 6, h: 4, type: 'alerts',  name: 'Alerts & Notifications' },
  ],
  factory: [
    { i: 'orders', x: 0, y: 0, w: 8, h: 5, type: 'orders', name: 'Order Status' },
    { i: 'alerts', x: 8, y: 0, w: 4, h: 5, type: 'alerts', name: 'Alerts & Notifications' },
  ],
}

// ─── Widget size presets for configurator ─────────────────────────────────────

const SIZE_PRESETS = [
  { label: 'Small  (4 cols)',   w: 4,  h: 3 },
  { label: 'Medium (6 cols)',   w: 6,  h: 4 },
  { label: 'Wide   (8 cols)',   w: 8,  h: 4 },
  { label: 'Full   (12 cols)',  w: 12, h: 4 },
  { label: 'Tall   (6 cols)',   w: 6,  h: 6 },
]

function sizeLabel(item) {
  const match = SIZE_PRESETS.find(p => p.w === item.w && p.h === item.h)
  return match ? match.label : `${item.w} cols × ${item.h} rows`
}

// ─── Save debounce (2 s after last change) ────────────────────────────────────

function useDebouncedSave(delay = 2000) {
  const timer = useRef(null)
  return useCallback((layout) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await dashboardAPI.saveLayout({ layout })
      } catch (err) {
        console.error('Dashboard auto-save failed:', err)
      }
    }, delay)
  }, [delay])
}

// ─── Configurator panel ───────────────────────────────────────────────────────

function DashboardConfiguratorPanel({ layout, onApply, onReset, onClose }) {
  const activeIds = layout.map(item => item.i)
  const [selected, setSelected] = useState(new Set(activeIds))
  const [sizes, setSizes] = useState(() => {
    const map = {}
    layout.forEach(item => { map[item.i] = { w: item.w, h: item.h } })
    ALL_WIDGETS.forEach(w => {
      if (!map[w.id]) map[w.id] = { w: w.defaultW, h: w.defaultH }
    })
    return map
  })

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleApply = () => {
    // Build new layout — preserve existing positions for widgets already on board,
    // append new ones at the bottom.
    const existing = layout.filter(item => selected.has(item.i))
    const existingIds = new Set(existing.map(item => item.i))
    const maxY = existing.reduce((m, item) => Math.max(m, item.y + item.h), 0)
    let curX = 0, curY = maxY
    const added = []
    ALL_WIDGETS.forEach(w => {
      if (selected.has(w.id) && !existingIds.has(w.id)) {
        const { w: ww, h } = sizes[w.id]
        if (curX + ww > 12) { curX = 0; curY += h }
        added.push({ i: w.id, x: curX, y: curY, w: ww, h, type: w.type, name: w.name })
        curX += ww
      }
    })
    // Apply any size changes to existing items
    const updated = existing.map(item => ({
      ...item,
      w: sizes[item.i]?.w ?? item.w,
      h: sizes[item.i]?.h ?? item.h,
    }))
    onApply([...updated, ...added])
    onClose()
  }

  return (
    <div className="mb-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-slate-900">Customize Dashboard</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {ALL_WIDGETS.map(widget => (
          <div
            key={widget.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              selected.has(widget.id)
                ? 'border-green-300 bg-green-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              id={`w-${widget.id}`}
              checked={selected.has(widget.id)}
              onChange={() => toggle(widget.id)}
              className="mt-0.5 rounded cursor-pointer accent-green-700"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor={`w-${widget.id}`} className="block text-sm font-medium text-slate-900 cursor-pointer mb-1.5">
                {widget.name}
              </label>
              <select
                value={`${sizes[widget.id]?.w}-${sizes[widget.id]?.h}`}
                onChange={e => {
                  const [w, h] = e.target.value.split('-').map(Number)
                  setSizes(prev => ({ ...prev, [widget.id]: { w, h } }))
                }}
                className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-green-600"
              >
                {SIZE_PRESETS.map(p => (
                  <option key={`${p.w}-${p.h}`} value={`${p.w}-${p.h}`}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-5">
        <p className="text-xs text-blue-800">
          After applying, drag widgets to reorder them. Resize by dragging the bottom-right corner of any widget.
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => { onReset(); onClose() }}
          className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-[#1B2E1E] text-white rounded-lg hover:bg-green-900 transition-colors text-sm font-medium"
          >
            Apply Changes
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        {selected.size} of {ALL_WIDGETS.length} widgets selected
      </p>
    </div>
  )
}

// ─── Widget header (title + remove button) ────────────────────────────────────

function WidgetHeader({ title, onRemove, widgetId }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 drag-handle cursor-grab active:cursor-grabbing select-none">
      <span className="text-sm font-semibold text-slate-700">{title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(widgetId) }}
        className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded"
        title="Remove widget"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConfigurableDashboard() {
  const { user } = useAuth()
  const [layout, setLayout]           = useState([])
  const [isLoading, setIsLoading]     = useState(true)
  const [showConfig, setShowConfig]   = useState(false)
  const [isSaving, setIsSaving]       = useState(false)
  const debouncedSave = useDebouncedSave(2000)

  // ── Load layout from backend on mount ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await dashboardAPI.getLayout()
        const saved = res?.data?.layout ?? []
        if (saved.length > 0) {
          setLayout(saved)
        } else {
          const role = user?.role ?? 'admin'
          setLayout(ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.admin)
        }
      } catch (err) {
        console.error('Failed to load dashboard layout:', err)
        const role = user?.role ?? 'admin'
        setLayout(ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.admin)
        toast.error('Could not load saved layout — using default.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user?.role])

  // ── RGL layout change handler ──────────────────────────────────────────────
  // RGL gives us the pure { i, x, y, w, h } positions. We merge back our
  // `type` and `name` fields (which RGL doesn't touch) from the previous state.
  const handleLayoutChange = useCallback((newRGLLayout) => {
    setLayout(prev => {
      const merged = newRGLLayout.map(rglItem => {
        const meta = prev.find(p => p.i === rglItem.i) ?? {}
        return { ...rglItem, type: meta.type, name: meta.name }
      })
      debouncedSave(merged)
      return merged
    })
  }, [debouncedSave])

  // ── Remove a widget ────────────────────────────────────────────────────────
  const handleRemove = useCallback((widgetId) => {
    setLayout(prev => {
      const updated = prev.filter(item => item.i !== widgetId)
      debouncedSave(updated)
      return updated
    })
  }, [debouncedSave])

  // ── Apply configurator changes ─────────────────────────────────────────────
  const handleApplyConfig = useCallback((newLayout) => {
    setLayout(newLayout)
    debouncedSave(newLayout)
  }, [debouncedSave])

  // ── Reset to role default ──────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    const role = user?.role ?? 'admin'
    const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.admin
    setLayout(defaults)
    setIsSaving(true)
    try {
      await dashboardAPI.saveLayout({ layout: defaults })
      toast.success('Dashboard reset to default layout.')
    } catch {
      toast.error('Reset failed — please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [user?.role])

  // ── Manual save ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await dashboardAPI.saveLayout({ layout })
      toast.success('Dashboard layout saved.')
    } catch {
      toast.error('Save failed — please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [layout])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <LayoutDashboard className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Derive the RGL layout prop (pure geometry — no extra fields)
  const rglLayout = layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h, minW: 2, minH: 2 }))

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="p-6 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Drag to reorder. Resize from the bottom-right corner of any widget.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Layout'}
            </button>
            <button
              onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B2E1E] text-white rounded-lg hover:bg-green-900 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Customize
              <ChevronDown className={`w-4 h-4 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Configurator panel ── */}
        {showConfig && (
          <DashboardConfiguratorPanel
            layout={layout}
            onApply={handleApplyConfig}
            onReset={handleReset}
            onClose={() => setShowConfig(false)}
          />
        )}

        {/* ── Grid ── */}
        {layout.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border-2 border-dashed border-slate-300">
            <LayoutDashboard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2 font-medium">No widgets on this dashboard</p>
            <p className="text-sm text-slate-400">Click "Customize" above to add widgets.</p>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: rglLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            draggableHandle=".drag-handle"
            onLayoutChange={(_, allLayouts) => handleLayoutChange(allLayouts.lg ?? [])}
            margin={[16, 16]}
            containerPadding={[0, 0]}
          >
            {layout.map(item => {
              const WidgetComponent = WIDGET_COMPONENTS[item.type]
              return (
                <div
                  key={item.i}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
                >
                  <WidgetHeader
                    title={item.name}
                    widgetId={item.i}
                    onRemove={handleRemove}
                  />
                  <div className="flex-1 overflow-auto p-1">
                    {WidgetComponent
                      ? <WidgetComponent />
                      : <div className="p-4 text-sm text-slate-400">Widget unavailable</div>
                    }
                  </div>
                </div>
              )
            })}
          </ResponsiveGridLayout>
        )}

      </div>
    </div>
  )
}
