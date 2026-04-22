import { Package } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Package,
  title = 'No data found',
  description = 'There is no data to display.',
  action,
  actionLabel = 'Create New',
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-slate-100 rounded-full p-4 mb-4">
        <Icon className="w-8 h-8 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 text-center mb-6">{description}</p>
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
