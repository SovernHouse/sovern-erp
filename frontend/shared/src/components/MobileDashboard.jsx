import React, { useState, useRef, useEffect } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useIsMobile } from '../utils/responsive'

export default function MobileDashboard({
  cards = [],
  onRefresh,
  refreshing = false,
  pullToRefreshEnabled = true,
  className = '',
}) {
  const isMobile = useIsMobile()
  const scrollContainerRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const touchStartY = useRef(0)

  // Check scroll position
  const checkScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return

    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    )
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll)
      return () => container.removeEventListener('scroll', checkScroll)
    }
  }, [])

  // Scroll handlers
  const scroll = (direction) => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = 300
    const targetScroll =
      container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount)

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    })
  }

  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
    setPullDistance(0)
  }

  const handleTouchMove = (e) => {
    if (!pullToRefreshEnabled) return

    const container = scrollContainerRef.current
    if (!container || container.scrollTop !== 0) {
      setIsPulling(false)
      return
    }

    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY.current

    if (distance > 0) {
      setIsPulling(true)
      setPullDistance(Math.min(distance, 100))
    }
  }

  const handleTouchEnd = () => {
    if (pullDistance > 60 && onRefresh && !refreshing) {
      onRefresh()
    }
    setIsPulling(false)
    setPullDistance(0)
  }

  if (!isMobile) {
    // Desktop Grid Layout
    return (
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
      >
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{card.title}</h3>
              {card.icon && (
                <div className="p-2 bg-primary-50 rounded-lg">
                  {card.icon}
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {card.value}
              </span>
              {card.unit && (
                <span className="text-sm text-gray-600">{card.unit}</span>
              )}
            </div>
            {card.subtitle && (
              <p className="text-sm text-gray-600 mt-2">{card.subtitle}</p>
            )}
            {card.trend && (
              <div className={`mt-3 text-sm font-medium ${
                card.trend.positive ? 'text-green-600' : 'text-red-600'
              }`}>
                {card.trend.positive ? '↑' : '↓'} {card.trend.percentage}%
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Mobile Swipeable Layout
  return (
    <div
      className={`relative bg-white rounded-lg shadow overflow-hidden ${className}`}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullToRefreshEnabled && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-primary-50 z-10 transition-all"
          style={{
            height: `${Math.max(40, pullDistance)}px`,
            opacity: Math.min(1, pullDistance / 60),
          }}
        >
          {pullDistance > 60 && !refreshing && (
            <span className="text-sm font-medium text-primary-600">
              Release to refresh
            </span>
          )}
          {refreshing && (
            <RefreshCw className="animate-spin text-primary-600" size={20} />
          )}
        </div>
      )}

      {/* Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto snap-x snap-mandatory scroll-smooth"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-4 p-4 min-w-min">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 flex-shrink-0 w-72 snap-center border border-primary-200"
              onClick={card.onClick}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {card.title}
                </h3>
                {card.icon && (
                  <div className="text-primary-600">{card.icon}</div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="text-xs text-gray-600">{card.unit}</span>
                  )}
                </div>
              </div>

              {card.subtitle && (
                <p className="text-xs text-gray-700 mb-2">{card.subtitle}</p>
              )}

              {card.trend && (
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    card.trend.positive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {card.trend.positive ? '↑' : '↓'} {card.trend.percentage}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Navigation Buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-r-lg p-2 shadow z-10 transition-all"
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-l-lg p-2 shadow z-10 transition-all"
          aria-label="Scroll right"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="absolute bottom-4 right-4 p-2 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed z-10 transition-all"
          aria-label="Refresh"
        >
          <RefreshCw
            size={20}
            className={refreshing ? 'animate-spin' : ''}
          />
        </button>
      )}
    </div>
  )
}
