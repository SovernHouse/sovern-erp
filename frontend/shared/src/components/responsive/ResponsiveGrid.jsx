import React from 'react'
import { useBreakpoint } from '../../utils/responsive'

/**
 * ResponsiveGrid Component
 * Adjusts number of columns based on screen size
 * Mobile: 1 column
 * Tablet: 2 columns
 * Desktop: 3-4 columns
 *
 * Props:
 *  - children: React.ReactNode
 *  - cols: { mobile, tablet, desktop } | number (default: { mobile: 1, tablet: 2, desktop: 3 })
 *  - gap: string (default: '1rem')
 *  - className: string
 */
export default function ResponsiveGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = '1rem',
  className = '',
}) {
  const breakpoint = useBreakpoint()

  // Handle both number and object col specifications
  let mobileColumns = 1
  let tabletColumns = 2
  let desktopColumns = 3

  if (typeof cols === 'number') {
    mobileColumns = 1
    tabletColumns = 2
    desktopColumns = cols
  } else {
    mobileColumns = cols.mobile || 1
    tabletColumns = cols.tablet || 2
    desktopColumns = cols.desktop || 3
  }

  // Determine current columns based on breakpoint
  let currentColumns = mobileColumns
  if (breakpoint === 'md') {
    currentColumns = tabletColumns
  } else if (['lg', 'xl', '2xl'].includes(breakpoint)) {
    currentColumns = desktopColumns
  }

  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))`,
        gap: gap,
      }}
    >
      {children}
    </div>
  )
}
