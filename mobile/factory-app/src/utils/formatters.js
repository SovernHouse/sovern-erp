import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const formatDate = (date, format = 'DD MMM YYYY') => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date, format = 'DD MMM YYYY, HH:mm') => {
  return dayjs(date).format(format);
};

export const formatTime = (time) => {
  return dayjs(time).format('HH:mm');
};

export const formatRelativeTime = (date) => {
  return dayjs(date).fromNow();
};

export const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  });
  return formatter.format(amount);
};

export const formatNumber = (number, decimals = 2) => {
  return parseFloat(number).toFixed(decimals);
};

export const formatQuantity = (quantity, unit = '') => {
  return `${formatNumber(quantity)} ${unit}`.trim();
};

export const formatWeight = (weight, unit = 'kg') => {
  return `${formatNumber(weight)} ${unit}`;
};

export const formatDimensions = (length, width, height, unit = 'cm') => {
  return `${formatNumber(length)} × ${formatNumber(width)} × ${formatNumber(height)} ${unit}`;
};

export const daysUntil = (date) => {
  return dayjs(date).diff(dayjs(), 'days');
};

export const isOverdue = (date) => {
  return dayjs(date).isBefore(dayjs());
};

export const isToday = (date) => {
  return dayjs(date).isSame(dayjs(), 'day');
};

export const isTomorrow = (date) => {
  return dayjs(date).isSame(dayjs().add(1, 'day'), 'day');
};

export const isThisWeek = (date) => {
  return dayjs(date).isSame(dayjs(), 'week');
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export const capitalizeWords = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
