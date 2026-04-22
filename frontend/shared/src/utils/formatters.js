import dayjs from 'dayjs'

// Date formatting
export const formatDate = (date, format = 'MMM DD, YYYY') => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatDateTime = (date, format = 'MMM DD, YYYY HH:mm') => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatTime = (date, format = 'HH:mm:ss') => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatRelativeTime = (date) => {
  if (!date) return ''
  return dayjs(date).fromNow()
}

// Currency formatting
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  if (amount === null || amount === undefined) return ''
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

// Number formatting
export const formatNumber = (number, decimals = 0) => {
  if (number === null || number === undefined) return ''
  return Number(number).toFixed(decimals)
}

export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return ''
  return `${Number(value).toFixed(decimals)}%`
}

export const formatThousands = (number, locale = 'en-US') => {
  if (number === null || number === undefined) return ''
  return Number(number).toLocaleString(locale)
}

// File size formatting
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes, k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Text formatting
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const capitalizeFirst = (text) => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const capitalizeWords = (text) => {
  if (!text) return ''
  return text
    .split(' ')
    .map((word) => capitalizeFirst(word))
    .join(' ')
}

export const slugify = (text) => {
  if (!text) return ''
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Phone formatting
export const formatPhone = (phone, countryCode = '+1') => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `${countryCode} (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// URL formatting
export const formatUrl = (url) => {
  if (!url) return ''
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
