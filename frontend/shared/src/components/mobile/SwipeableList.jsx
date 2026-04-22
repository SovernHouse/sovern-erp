import React, { useState, useRef } from 'react'
import { Trash2, Edit, X } from 'lucide-react'

/**
 * SwipeableList Component
 * List items with swipe-to-action functionality
 * Swipe left = delete action
 * Swipe right = edit action
 *
 * Props:
 *  - items: array of { id, content: React.ReactNode, ...other }
 *  - onEdit: (item) => void
 *  - onDelete: (item) => void
 *  - renderItem: (item) => React.ReactNode
 *  - threshold: number (default: 50) - pixels to swipe before action triggers
 */
export default function SwipeableList({
  items = [],
  onEdit,
  onDelete,
  renderItem,
  threshold = 50,
}) {
  const [swiped, setSwiped] = useState(null)
  const startX = useRef(0)
  const currentX = useRef(0)

  const handleTouchStart = (e, itemId) => {
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    currentX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e, item) => {
    const diff = startX.current - currentX.current
    const absDiff = Math.abs(diff)

    if (absDiff > threshold) {
      if (diff > 0) {
        // Swiped left - delete
        setSwiped(item.id)
      } else {
        // Swiped right - edit
        setSwiped(null)
        onEdit?.(item)
      }
    }

    startX.current = 0
    currentX.current = 0
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="relative">
          {/* Action buttons background (revealed on swipe) */}
          <div className="absolute inset-y-0 right-0 left-0 flex items-center justify-between px-4 bg-red-50 rounded-lg">
            <button
              onClick={() => {
                onEdit?.(item)
                setSwiped(null)
              }}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Edit size={18} />
              <span className="text-sm font-medium">Edit</span>
            </button>

            <button
              onClick={() => {
                onDelete?.(item)
                setSwiped(null)
              }}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
            >
              <Trash2 size={18} />
              <span className="text-sm font-medium">Delete</span>
            </button>
          </div>

          {/* List item */}
          <div
            onTouchStart={(e) => handleTouchStart(e, item.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, item)}
            className={`relative bg-white rounded-lg border border-gray-200 p-4 cursor-grab active:cursor-grabbing transition-all duration-200 ${
              swiped === item.id ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {renderItem ? renderItem(item) : item.content}
          </div>

          {/* Swipe action confirmation */}
          {swiped === item.id && (
            <div className="absolute inset-0 bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between animate-pulse">
              <p className="text-sm font-medium text-gray-900">
                Confirm delete?
              </p>
              <button
                onClick={() => setSwiped(null)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
