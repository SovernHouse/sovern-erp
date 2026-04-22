import dayjs from 'dayjs'

export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export const formatRelativeTime = (date) => {
  if (!date) return '-'
  return dayjs(date).fromNow()
}

export const formatPhoneNumber = (phone) => {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export const formatWeight = (kg) => {
  if (!kg) return '-'
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(2)} MT`
  }
  return `${formatNumber(kg, 2)} kg`
}

export const formatVolume = (cbm) => {
  if (!cbm) return '-'
  return `${formatNumber(cbm, 2)} CBM`
}

export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return '-'
  return `${formatNumber(value * 100, decimals)}%`
}

export const truncateText = (text, length = 50) => {
  if (!text) return '-'
  return text.length > length ? `${text.substring(0, length)}...` : text
}

export const capitalize = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substr(2, 5).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

export const calculateDaysDifference = (date1, date2) => {
  if (!date1 || !date2) return null
  return dayjs(date2).diff(dayjs(date1), 'day')
}

export const isOverdue = (dueDate) => {
  if (!dueDate) return false
  return dayjs().isAfter(dayjs(dueDate))
}

export const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null
  const days = dayjs(dueDate).diff(dayjs(), 'day')
  return days
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export const getInitials = (name) => {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
