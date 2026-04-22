import React from 'react'
import {
  ORDER_STATUS_COLORS,
  QUOTATION_STATUS_COLORS,
  CLAIM_STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
} from '../utils/constants'

const BADGE_STYLES = {
  order: ORDER_STATUS_COLORS,
  quotation: QUOTATION_STATUS_COLORS,
  claim: CLAIM_STATUS_COLORS,
  payment: PAYMENT_STATUS_COLORS,
}

export default function StatusBadge({ status, type = 'order', className = '', size = 'md' }) {
  const styles = BADGE_STYLES[type] || ORDER_STATUS_COLORS
  const statusKey = status?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN'
  const badgeClass = styles[statusKey] || 'bg-gray-100 text-gray-800 border-gray-300'

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${
        sizeClasses[size]
      } ${badgeClass} ${className}`}
    >
      {status || 'Unknown'}
    </span>
  )
}
