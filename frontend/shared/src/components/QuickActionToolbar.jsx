import { Plus, Search, X, FileText, ShoppingCart, Users, Box, Truck, CheckSquare, TrendingUp, Eye, Package } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * QuickActionToolbar - Floating action button with role-aware actions
 */
export default function QuickActionToolbar({ userRole = 'admin' }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Role-based actions
  const getActions = () => {
    const actionMap = {
      admin: [
        { label: 'New Order', icon: ShoppingCart, action: () => navigate('/orders/new') },
        { label: 'New Quote', icon: FileText, action: () => navigate('/quotations/new') },
        { label: 'New Customer', icon: Users, action: () => navigate('/customers/new') },
        { label: 'New Product', icon: Box, action: () => navigate('/products/new') }
      ],
      sales: [
        { label: 'New Quote', icon: FileText, action: () => navigate('/quotations/new') },
        { label: 'New Order', icon: ShoppingCart, action: () => navigate('/orders/new') },
        { label: 'Follow-up Tasks', icon: CheckSquare, action: () => navigate('/tasks') }
      ],
      operations: [
        { label: 'New Shipment', icon: Truck, action: () => navigate('/shipments/new') },
        { label: 'Update Production', icon: TrendingUp, action: () => navigate('/production') },
        { label: 'View GRNs', icon: Package, action: () => navigate('/grn') }
      ],
      customer: [
        { label: 'New Quote Request', icon: FileText, action: () => navigate('/quotations/request') },
        { label: 'Track Order', icon: Eye, action: () => navigate('/orders') },
        { label: 'View Invoices', icon: ShoppingCart, action: () => navigate('/invoices') }
      ],
      factory: [
        { label: 'View POs', icon: FileText, action: () => navigate('/purchase-orders') },
        { label: 'Update Production', icon: TrendingUp, action: () => navigate('/production') },
        { label: 'Upload Documents', icon: Package, action: () => navigate('/documents') }
      ]
    }

    return actionMap[userRole] || actionMap.admin
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(!showSearch)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showSearch])

  const actions = getActions()

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Search Overlay */}
      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowSearch(false)} />
      )}

      {/* Quick Search / Command Palette */}
      {showSearch && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl w-96 z-50">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-2">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search actions, pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent flex-1 outline-none text-slate-900"
              />
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="p-4 max-h-80 overflow-y-auto">
            {actions.length > 0 ? (
              <div className="space-y-2">
                {actions.map((action, idx) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        action.action()
                        setShowSearch(false)
                      }}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-medium text-slate-900">{action.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center py-6">No actions found</p>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>Quick search powered by AI</span>
            <button
              onClick={() => setShowSearch(false)}
              className="px-2 py-1 rounded hover:bg-slate-100"
            >
              Esc
            </button>
          </div>
        </div>
      )}

      {/* Expanded Menu */}
      {isOpen && (
        <div className="mb-4 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-4 bg-blue-50 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-900">Quick Actions</p>
            <p className="text-xs text-slate-600 mt-1">
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Actions
            </p>
          </div>

          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {actions.map((action, idx) => {
              const Icon = action.icon
              return (
                <button
                  key={idx}
                  onClick={() => {
                    action.action()
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-100 transition-colors text-left"
                >
                  <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-900">{action.label}</span>
                </button>
              )
            })}
          </div>

          {/* Keyboard Shortcut Info */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <p>Press <kbd className="px-2 py-1 bg-white rounded border text-xs mx-1">Ctrl+K</kbd> for quick search</p>
          </div>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
        title="Quick actions"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>

      {/* Floating Helper */}
      {!isOpen && (
        <div className="absolute bottom-20 right-0 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
          Press <kbd className="px-2 py-0.5 bg-slate-800 rounded mx-1">Ctrl+K</kbd>
        </div>
      )}
    </div>
  )
}
