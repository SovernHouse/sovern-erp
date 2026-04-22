import React, { useState, useRef, useEffect } from 'react'
import { useIsMobile, useIsTablet } from '../utils/responsive'

export default function ResponsiveChart({
  children,
  title,
  subtitle,
  showLegend = true,
  legendPosition = 'bottom',
  simplifyOnMobile = true,
  containerHeight = 'h-96',
  className = '',
}) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    handleResize()
    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Get responsive chart dimensions
  const getChartConfig = () => {
    if (isMobile) {
      return {
        width: containerWidth,
        height: 300,
        margin: { top: 10, right: 10, left: -20, bottom: 10 },
        legendPosition: 'bottom',
        tooltipPosition: 'cursor',
        fontSize: 12,
      }
    }

    if (isTablet) {
      return {
        width: containerWidth,
        height: 350,
        margin: { top: 20, right: 20, left: 0, bottom: 20 },
        legendPosition: legendPosition,
        tooltipPosition: 'cursor',
        fontSize: 13,
      }
    }

    return {
      width: containerWidth,
      height: 400,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
      legendPosition: legendPosition,
      tooltipPosition: 'cursor',
      fontSize: 14,
    }
  }

  const config = getChartConfig()

  // Provide config via React context or data attributes
  const chartProps = {
    width: config.width,
    height: config.height,
    margin: config.margin,
    'data-mobile': isMobile,
    'data-tablet': isTablet,
  }

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-lg shadow p-4 md:p-6 w-full ${className}`}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-4 md:mb-6">
          {title && (
            <h3 className="text-base md:text-lg font-semibold text-gray-900">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs md:text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div
        className={`w-full overflow-x-auto touch-pan-x ${containerHeight}`}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="w-full h-full flex items-center justify-center">
          {React.cloneElement(children, {
            ...chartProps,
            responsiveContainer: true,
          })}
        </div>
      </div>

      {/* Legend Info (Mobile) */}
      {isMobile && showLegend && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Scroll horizontally for more details
          </p>
        </div>
      )}
    </div>
  )
}

// Chart Wrapper for Recharts compatibility
export function ResponsiveChartWrapper({
  children,
  isMobile,
}) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth)
      }
    }

    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  // Get responsive dimensions
  const getHeight = () => {
    if (isMobile) return 300
    return 400
  }

  const getMargin = () => {
    if (isMobile) {
      return { top: 10, right: 10, left: -20, bottom: 10 }
    }
    return { top: 20, right: 30, left: 20, bottom: 20 }
  }

  return (
    <div ref={containerRef} className="w-full h-auto">
      {React.cloneElement(children, {
        width: Math.max(width, 300),
        height: getHeight(),
        margin: getMargin(),
      })}
    </div>
  )
}

// Touch-friendly tooltip wrapper
export function ResponsiveTooltip({
  active,
  payload,
  label,
  isMobile,
  formatter,
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-gray-200 z-10 ${
        isMobile ? 'p-2 text-xs' : 'p-3 text-sm'
      }`}
    >
      <p className="font-semibold text-gray-900">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="mt-1">
          {entry.name}:{' '}
          {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}
