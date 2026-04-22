import { Plus, ShoppingCart, Users, FileText, Box, DollarSign } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * QuickActionsWidget - Common action buttons for dashboard
 */
export default function QuickActionsWidget() {
  const navigate = useNavigate()

  const actions = [
    {
      id: 1,
      label: 'New Order',
      icon: ShoppingCart,
      action: () => navigate('/orders/new'),
      color: 'bg-blue-100 text-blue-600 hover:bg-blue-200'
    },
    {
      id: 2,
      label: 'New Quote',
      icon: FileText,
      action: () => navigate('/quotations/new'),
      color: 'bg-purple-100 text-purple-600 hover:bg-purple-200'
    },
    {
      id: 3,
      label: 'New Customer',
      icon: Users,
      action: () => navigate('/customers/new'),
      color: 'bg-green-100 text-green-600 hover:bg-green-200'
    },
    {
      id: 4,
      label: 'New Product',
      icon: Box,
      action: () => navigate('/products/new'),
      color: 'bg-orange-100 text-orange-600 hover:bg-orange-200'
    },
    {
      id: 5,
      label: 'Record Payment',
      icon: DollarSign,
      action: () => navigate('/payments/new'),
      color: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
    },
    {
      id: 6,
      label: 'Create Invoice',
      icon: FileText,
      action: () => navigate('/invoices/new'),
      color: 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
    }
  ]

  return (
    <div>
      <p className="text-sm text-slate-600 font-medium mb-4">Common Actions</p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              onClick={action.action}
              className={`p-4 rounded-lg border border-slate-200 transition-all hover:shadow-md ${action.color} flex flex-col items-center justify-center space-y-2`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-600 mb-2">
          💡 Tip: Use <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl+K</kbd> for quick search
        </p>
      </div>
    </div>
  )
}
