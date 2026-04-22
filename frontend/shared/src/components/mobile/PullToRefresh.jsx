import React, { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * PullToRefresh Component
 * Pull-to-refresh wrapper for mobile content
 *
 * Props:
 *  - onRefresh: () => Promise<void>
 *  - children: React.ReactNode
 *  - threshold: number (default: 80) - pixels to pull before refresh
 *  - refreshDistance: number (default: 60) - distance to pull
 */
export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  refreshDistance = 60,
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef(null)
  const pullStart = useRef(0)

  const handleTouchStart = (e) => {
    const scroll = scrollRef.current
    if (scroll && scroll.scrollTop === 0) {
      pullStart.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e) => {
    if (refreshing || !scrollRef.current) return
    const scroll = scrollRef.current

    if (scroll.scrollTop === 0 && pullStart.current) {
      const pullDistance = e.touches[0].clientY - pullStart.current
      if (pullDistance > 0) {
        e.preventDefault()
        setPullDistance(Math.min(pullDistance, refreshDistance))
      }
    }
  }

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > threshold && onRefresh && !refreshing) {
      setRefreshing(true)
      setPullDistance(refreshDistance)

      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh error:', error)
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }

    pullStart.current = 0
  }, [pullDistance, threshold, onRefresh, refreshing, refreshDistance])

  const progress = Math.min(pullDistance / threshold, 1)
  const rotation = progress * 180

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-y-auto touch-pan-y"
      style={{ height: '100%' }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: `${pullDistance}px`,
          backgroundColor:
            progress > 0.5 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            transform: `scale(${Math.min(progress, 1)})`,
            opacity: progress,
          }}
        >
          <RefreshCw
            size={24}
            className={`text-blue-600 ${refreshing ? 'animate-spin' : ''}`}
            style={{
              transform: refreshing ? 'none' : `rotate(${rotation}deg)`,
              transition: refreshing ? 'none' : 'transform 0.2s ease-out',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: refreshing
            ? 'none'
            : pullDistance === 0
              ? 'transform 0.3s ease-out'
              : 'none',
        }}
      >
        {children}
      </div>

      {/* Refreshing state message */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 flex items-center justify-center h-16 bg-blue-50 border-b border-blue-200 text-sm font-medium text-blue-600">
          Refreshing...
        </div>
      )}
    </div>
  )
}
