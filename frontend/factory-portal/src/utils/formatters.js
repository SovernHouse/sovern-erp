import { format, parseISO } from 'date-fns';

export function formatDate(date, formatStr = 'MMM dd, yyyy') {
  if (!date) return '-';
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    return format(parsed, formatStr);
  } catch {
    return '-';
  }
}

export function formatDateTime(date, formatStr = 'MMM dd, yyyy HH:mm') {
  if (!date) return '-';
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    return format(parsed, formatStr);
  } catch {
    return '-';
  }
}

export function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value) {
  if (value === null || value === undefined) return '-';
  return `${parseFloat(value).toFixed(2)}%`;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatPhone(phone) {
  if (!phone) return '-';
  // Assuming 10 digit US phone number
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function truncateText(text, length = 50) {
  if (!text) return '-';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function capitalizeFirstLetter(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function formatStatus(status) {
  if (!status) return '-';
  return status
    .split('_')
    .map((word) => capitalizeFirstLetter(word))
    .join(' ');
}

export function getDaysUntil(date) {
  if (!date) return null;
  const today = new Date();
  const target = typeof date === 'string' ? parseISO(date) : date;
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getRelativeTime(date) {
  if (!date) return '-';
  const days = getDaysUntil(date);

  if (days === null) return '-';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < 0) return `${Math.abs(days)} days ago`;

  return formatDate(date);
}
