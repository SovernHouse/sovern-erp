import React, { useState } from 'react'
import { useIsMobile, useIsTablet } from '../../utils/responsive'
import { MoreHorizontal } from 'lucide-react'

/**
 * ResponsiveNav Component
 * Desktop: vertical sidebar navigation
 * Mobile: bottom tab bar with icons (max 5 items) + "More" overflow
 *
 * Props:
 *  - items: array of { label, icon: JSX, path, active: bool }
 *  - onNavigate: (path) => void
 *  - maxVisibleItems: number (default 4, reserving space for "More")
 */
export default function ResponsiveNav({
  items = [],
  onNavigate,
  maxVisibleItems = 4,
  variant = 'sidebar', // 'sidebar' or 'bottom-bar'
}) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [showMore, setShowMore] = useState(false)

  // Determine layout based on screen size
  const useBottomBar = isMobile && variant !== 'sidebar-only'
  const useSidebar = !useBottomBar || variant === 'sidebar-only'

  if (!items || items.length === 0) {
    return null
  }

  // Split items for bottom bar
  const visibleItems = useBottomBar ? items.slice(0, maxVisibleItems) : items
  const moreItems = useBottomBar ? items.slice(maxVisibleItems) : []

  // ============= MOBILE BOTTOM BAR =============
  if (useBottomBar) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-area-bottom">
        <div className="flex items-center justify-between h-16 px-2">
          {/* Visible nav items */}
          {visibleItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                onNavigate?.(item.path)
                setShowMore(false)
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 tap-target transition-colors ${
                item.active
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title={item.label}
            >
              <div className="flex items-center justify-center h-6 w-6 mb-1">
                {typeof item.icon === 'string' ? (
                  <span className="text-xl">{item.icon}</span>
                ) : (
                  item.icon
                )}
              </div>
              <span className="text-xs text-center truncate">{item.label}</span>
              {item.active && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />
              )}
            </button>
          ))}

          {/* More button (if additional items exist) */}
          {moreItems.length > 0 && (
            <div className="relative flex-1">
              <button
                onClick={() => setShowMore(!showMore)}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 tap-target transition-colors ${
                  showMore
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="More options"
              >
                <div className="flex items-center justify-center h-6 w-6 mb-1">
                  <MoreHorizontal size={20} />
                </div>
                <span className="text-xs text-center">More</span>
                {showMore && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />
                )}
              </button>

              {/* Dropdown menu for "More" items */}
              {showMore && (
                <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-max">
                  {moreItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        onNavigate?.(item.path)
                        setShowMore(false)
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-2 transition-colors ${
                        item.active
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center h-5 w-5">
                        {typeof item.icon === 'string' ? (
                          <span>{item.icon}</span>
                        ) : (
                          item.icon
                        )}
                      </div>
                      <span className="text-sm">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    )
  }

  // ============= DESKTOP/TABLET SIDEBAR =============
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => onNavigate?.(item.path)}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            item.active
              ? 'bg-blue-600 text-white font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center h-5 w-5 flex-shrink-0">
            {typeof item.icon === 'string' ? (
              <span>{item.icon}</span>
            ) : (
              item.icon
            )}
          </div>
          <span className="text-sm flex-1 text-left truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
