import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export const formatDate = (date) => {
  if (!date) return 'N/A'
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date
    return format(parsed, 'MMM dd, yyyy')
  } catch {
    return 'Invalid date'
  }
}

export const formatDateTime = (date) => {
  if (!date) return 'N/A'
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date
    return format(parsed, 'MMM dd, yyyy HH:mm')
  } catch {
    return 'Invalid date'
  }
}

export const formatTimeAgo = (date) => {
  if (!date) return 'N/A'
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date
    return formatDistanceToNow(parsed, { addSuffix: true })
  } catch {
    return 'N/A'
  }
}

export const formatNumber = (number) => {
  return new Intl.NumberFormat('en-US').format(number)
}

export const formatWeight = (kg) => {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(2)} MT`
  }
  return `${kg} kg`
}

export const formatDimensions = (width, height, length, unit = 'mm') => {
  return `${width}x${height}x${length} ${unit}`
}

export const formatProductCode = (code) => {
  return code.toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1)
}

export const truncateText = (text, maxLength = 50) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const formatOrderNumber = (id) => {
  return `ORD-${String(id).padStart(6, '0')}`
}

export const formatQuotationNumber = (id) => {
  return `QT-${String(id).padStart(6, '0')}`
}

export const formatClaimNumber = (id) => {
  return `CLM-${String(id).padStart(6, '0')}`
}

export const formatShipmentNumber = (id) => {
  return `SHP-${String(id).padStart(6, '0')}`
}

export const formatContainerNumber = (number) => {
  return number.toUpperCase()
}

export const calculateDaysRemaining = (targetDate) => {
  if (!targetDate) return 0
  try {
    const parsed = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate
    const today = new Date()
    const diffTime = parsed - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  } catch {
    return 0
  }
}

export const calculateProgress = (current, total) => {
  if (total === 0) return 0
  return Math.round((current / total) * 100)
}

export const formatPercentage = (value, decimals = 1) => {
  return `${value.toFixed(decimals)}%`
}

export const formatAddress = (address) => {
  if (!address) return ''
  const { street, city, state, zip, country } = address
  return [street, city, state, zip, country].filter(Boolean).join(', ')
}

export const formatPhoneNumber = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

export const getInitials = (name) => {
  if (!name) return '?'
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const getPriceDisplay = (price, onSale, originalPrice) => {
  if (onSale && originalPrice) {
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100)
    return {
      current: formatCurrency(price),
      original: formatCurrency(originalPrice),
      discount: `${discount}% OFF`,
    }
  }
  return {
    current: formatCurrency(price),
    original: null,
    discount: null,
  }
}

export const getStatusIcon = (status) => {
  const statusLower = status?.toLowerCase() || ''
  if (statusLower.includes('delivered')) return '✓'
  if (statusLower.includes('shipped') || statusLower.includes('transit')) return '→'
  if (statusLower.includes('production')) return '⚙'
  if (statusLower.includes('confirmed')) return '✓'
  if (statusLower.includes('rejected') || statusLower.includes('cancelled')) return '✗'
  return '•'
}
