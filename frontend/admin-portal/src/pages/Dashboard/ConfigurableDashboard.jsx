import { useState, useEffect } from 'react'
import DashboardConfigurator from '../../components/DashboardWidgets/DashboardConfigurator'
import WidgetContainer from '../../components/DashboardWidgets/WidgetContainer'
import RevenueWidget from '../../components/DashboardWidgets/RevenueWidget'
import OrderStatusWidget from '../../components/DashboardWidgets/OrderStatusWidget'
import PendingApprovalsWidget from '../../components/DashboardWidgets/PendingApprovalsWidget'
import RecentActivityWidget from '../../components/DashboardWidgets/RecentActivityWidget'
import KPICardWidget from '../../components/DashboardWidgets/KPICardWidget'
import QuickActionsWidget from '../../components/DashboardWidgets/QuickActionsWidget'
import AlertsWidget from '../../components/DashboardWidgets/AlertsWidget'

/**
 * ConfigurableDashboard - Main dashboard page with drag-and-drop widgets
 */
export default function ConfigurableDashboard() {
  const [widgets, setWidgets] = useState([])
  const [draggedWidget, setDraggedWidget] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Widget component mapping
  const widgetComponentMap = {
    revenue: RevenueWidget,
    orders: OrderStatusWidget,
    approvals: PendingApprovalsWidget,
    activity: RecentActivityWidget,
    kpi: KPICardWidget,
    actions: QuickActionsWidget,
    alerts: AlertsWidget
  }

  // Load dashboard layout from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout')
    if (savedLayout) {
      try {
        setWidgets(JSON.parse(savedLayout))
      } catch (error) {
        console.error('Failed to load dashboard layout:', error)
        loadDefaultLayout()
      }
    } else {
      loadDefaultLayout()
    }
    setIsLoading(false)
  }, [])

  // Default layout
  const loadDefaultLayout = () => {
    const defaultWidgets = [
      { id: 'revenue', name: 'Revenue Summary', type: 'revenue', size: 'medium', position: 0 },
      { id: 'orders', name: 'Order Status', type: 'orders', size: 'medium', position: 1 },
      { id: 'approvals', name: 'Pending Approvals', type: 'approvals', size: 'medium', position: 2 },
      { id: 'activity', name: 'Recent Activity', type: 'activity', size: 'large', position: 3 },
      { id: 'actions', name: 'Quick Actions', type: 'actions', size: 'medium', position: 4 },
      { id: 'alerts', name: 'Alerts & Notifications', type: 'alerts', size: 'medium', position: 5 }
    ]
    setWidgets(defaultWidgets)
  }

  // Save layout to localStorage
  const saveLayout = (newWidgets) => {
    localStorage.setItem('dashboardLayout', JSON.stringify(newWidgets))
  }

  // Handle widget removal
  const handleRemoveWidget = (widgetId) => {
    const updated = widgets.filter(w => w.id !== widgetId)
    setWidgets(updated)
    saveLayout(updated)
  }

  // Handle configuration apply
  const handleApplyConfiguration = (newLayout) => {
    setWidgets(newLayout)
    saveLayout(newLayout)
  }

  // Drag and drop handlers
  const handleDragStart = (e, widgetId) => {
    setDraggedWidget(widgetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()

    if (!draggedWidget || draggedWidget === targetId) {
      setDraggedWidget(null)
      return
    }

    // Reorder widgets
    const draggedIndex = widgets.findIndex(w => w.id === draggedWidget)
    const targetIndex = widgets.findIndex(w => w.id === targetId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const updated = [...widgets]
      const [removed] = updated.splice(draggedIndex, 1)
      updated.splice(targetIndex, 0, removed)

      setWidgets(updated)
      saveLayout(updated)
    }

    setDraggedWidget(null)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Configurable Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Drag widgets to reorder them. Click "Customize Dashboard" to add or remove widgets.
          </p>
        </div>

        {/* Configurator */}
        <DashboardConfigurator
          currentWidgets={widgets}
          onApply={handleApplyConfiguration}
          onReset={loadDefaultLayout}
        />

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {widgets.length > 0 ? (
            widgets.map((widget) => {
              const WidgetComponent = widgetComponentMap[widget.type]
              return (
                <WidgetContainer
                  key={widget.id}
                  id={widget.id}
                  title={widget.name}
                  type={widget.type}
                  size={widget.size}
                  position={widget.position}
                  isDragging={draggedWidget === widget.id}
                  onRemove={handleRemoveWidget}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {WidgetComponent && <WidgetComponent />}
                </WidgetContainer>
              )
            })
          ) : (
            <div className="col-span-full p-12 text-center bg-white rounded-lg border-2 border-dashed border-slate-300">
              <p className="text-slate-600 mb-4">No widgets selected</p>
              <p className="text-sm text-slate-500">Click "Customize Dashboard" to add widgets</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-white rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Dashboard Tips</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>✓ Drag widgets to reorder them - your layout is automatically saved</li>
            <li>✓ Click the trash icon to remove a widget from the dashboard</li>
            <li>✓ Use the Customize button to change widget sizes or add more widgets</li>
            <li>✓ Click "Minimize" to collapse widget content and save screen space</li>
            <li>✓ Your dashboard configuration is stored in your browser</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
