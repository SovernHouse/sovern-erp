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

// Phase 3 follow-up: L-042 says every user-facing timestamp renders in
// Asia/Taipei. The dayjs.format() default uses browser-local time, which
// produces stale displays for an off-Taiwan operator. dayjs has a built-in
// `tz()` method when the timezone plugin is loaded; we use the native
// Intl.DateTimeFormat path because the bundle may or may not include the
// dayjs-timezone plugin.
//
// The `format` arg is kept on the signature for backwards compatibility
// but only the default formats are honored. Callers passing custom
// dayjs format strings will get the localized output instead — acceptable
// because all known consumers use the defaults.
const TAIPEI = 'Asia/Taipei'

export const formatDate = (date) => {
  if (!date) return '-'
  // YYYY-MM-DD shape, Asia/Taipei zone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(date))
}

export const formatDateTime = (date) => {
  if (!date) return '-'
  // YYYY-MM-DD HH:mm shape, Asia/Taipei zone, 24h.
  const d = new Date(date)
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: TAIPEI,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${datePart} ${timePart}`
}

// Phase 3, C11: per L-042 every user-facing timestamp renders in
// Asia/Taipei (UTC+8). The global formatDate / formatDateTime above use
// the browser's local time, which is the long-standing legacy and not
// safe to change mid-phase. Phase 3 dashboard and audit-log code should
// switch to these helpers explicitly; broader migration is a follow-up.
export const formatDateTaipei = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Taipei',
  })
}

export const formatDateTimeTaipei = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Taipei',
  })
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
