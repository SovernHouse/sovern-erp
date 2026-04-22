import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
};

export const formatDate = (date, format = 'MMM DD, YYYY') => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date, format = 'MMM DD, YYYY HH:mm') => {
  return dayjs(date).format(format);
};

export const formatRelativeTime = (date) => {
  return dayjs(date).fromNow();
};

export const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

export const calculateDaysRemaining = (targetDate) => {
  const today = dayjs();
  const target = dayjs(targetDate);
  return target.diff(today, 'day');
};

export const formatDaysRemaining = (targetDate) => {
  const days = calculateDaysRemaining(targetDate);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
};

export const truncateText = (text, length = 50) => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

export const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last;
};

export const formatOrderNumber = (id) => {
  return `ORD-${id.toString().padStart(6, '0')}`;
};

export const formatShipmentNumber = (id) => {
  return `SHIP-${id.toString().padStart(6, '0')}`;
};

export const formatClaimNumber = (id) => {
  return `CLAIM-${id.toString().padStart(5, '0')}`;
};

export const formatQuotationNumber = (id) => {
  return `QUOTE-${id.toString().padStart(5, '0')}`;
};
