import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'

/**
 * FloatingActionButton (FAB) Component
 * Primary action button for mobile with optional sub-actions
 *
 * Props:
 *  - onClick: () => void
 *  - icon: React.ReactNode (default: Plus icon)
 *  - label: string
 *  - subActions: array of { label, icon, onClick } (optional)
 *  - color: 'primary' | 'success' | 'danger' | 'warning' (default: 'primary')
 *  - size: 'sm' | 'md' | 'lg' (default: 'md')
 */
export default function FloatingActionButton({
  onClick,
  icon,
  label = 'Create',
  subActions = [],
  color = 'primary',
  size = 'md',
}) {
  const [expanded, setExpanded] = useState(false)

  const colorClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg hover:shadow-xl',
  }

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  }

  const iconSizes = {
    sm: 20,
    md: 24,
    lg: 28,
  }

  const subActionSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  }

  const subActionIconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  }

  const handleMainClick = () => {
    if (subActions.length > 0) {
      setExpanded(!expanded)
    } else {
      onClick?.()
    }
  }

  const handleSubAction = (action) => {
    action.onClick?.()
    setExpanded(false)
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
      {/* Sub-actions (if any) */}
      {expanded && subActions.length > 0 && (
        <div className="flex flex-col-reverse gap-3 mb-2">
          {subActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleSubAction(action)}
              className={`${subActionSizeClasses[size]} rounded-full transition-all duration-200 flex items-center justify-center gap-2 ${colorClasses[color]} group`}
              title={action.label}
            >
              <span className="text-xs font-medium hidden group-hover:inline whitespace-nowrap pr-2">
                {action.label}
              </span>
              {action.icon || <Plus size={subActionIconSizes[size]} />}
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleMainClick}
        className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-200 flex items-center justify-center font-semibold text-sm shadow-lg hover:shadow-xl active:scale-95 tap-target`}
        title={label}
      >
        {expanded ? (
          <X size={iconSizes[size]} />
        ) : icon ? (
          icon
        ) : (
          <Plus size={iconSizes[size]} />
        )}
      </button>

      {/* Label below FAB */}
      {!expanded && (
        <span className="text-xs font-medium text-gray-700 px-2 text-right">
          {label}
        </span>
      )}

      {/* Backdrop overlay when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
