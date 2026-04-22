import React, { useState } from 'react'
import { MoreVertical, ChevronRight } from 'lucide-react'
import { useIsMobile } from '../utils/responsive'

export default function MobileNav({
  items = [],
  onItemClick,
  maxVisibleItems = 4,
  className = '',
}) {
  const [showMore, setShowMore] = useState(false)
  const isMobile = useIsMobile()

  if (!isMobile || items.length === 0) {
    return null
  }

  const visibleItems = items.slice(0, maxVisibleItems)
  const moreItems = items.slice(maxVisibleItems)

  const handleItemClick = (item) => {
    onItemClick?.(item)
    setShowMore(false)
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl z-20 ${className}`}
    >
      <div className="flex items-center justify-between h-16 px-2">
        {/* Main Navigation Tabs */}
        <div className="flex items-center justify-between flex-1 h-full">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                onClick={() => handleItemClick(item)}
                className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors ${
                  item.active
                    ? 'text-primary-600 border-t-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                title={item.label}
              >
                {Icon && <Icon size={24} className="mb-1" />}
                <span className="text-xs font-medium truncate">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* More Options Button */}
        {moreItems.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors ${
                showMore
                  ? 'text-primary-600 border-t-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="More options"
            >
              <MoreVertical size={24} className="mb-1" />
              <span className="text-xs font-medium">More</span>
            </button>

            {/* More Menu Dropdown */}
            {showMore && (
              <div className="absolute bottom-16 right-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-30">
                {moreItems.map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-100 last:border-0 ${
                        item.active
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {Icon && <Icon size={18} />}
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Mobile Overlay for Menu */}
            {showMore && (
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMore(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
