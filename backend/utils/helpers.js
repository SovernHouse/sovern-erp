const dayjs = require('dayjs');

const getPagination = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit };
};

const getPaginatedResponse = (data, count, page, limit) => {
  const totalPages = Math.ceil(count / limit);
  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount: count,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
};

const getSuccessResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

/**
 * Build a standardised error response body.
 * Shape: { success: false, message: string, error?: string }
 * The optional `error` field carries raw error detail (e.g. err.message) for
 * development-time debugging — omit or pass null to suppress it.
 */
const getErrorResponse = (message = 'An error occurred', error = null) => {
  const response = { success: false, message };
  if (error && process.env.NODE_ENV !== 'production') {
    response.error = typeof error === 'string' ? error : error.message;
  }
  return response;
};

const calculateTotals = (items) => {
  let subtotal = 0;
  items.forEach(item => {
    subtotal += parseFloat(item.total || 0);
  });
  return { subtotal };
};

const calculateDiscountedTotal = (subtotal, discount, discountType = 'fixed') => {
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discount) / 100;
  } else {
    discountAmount = discount;
  }
  return {
    discountAmount,
    afterDiscount: Math.max(0, subtotal - discountAmount)
  };
};

const calculateTax = (amount, taxRate = 0) => {
  const tax = (amount * taxRate) / 100;
  return {
    tax,
    total: amount + tax
  };
};

const generateDocumentNumber = (prefix, date = new Date()) => {
  const dateStr = dayjs(date).format('YYYYMMDD');
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
};

const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  });
  return formatter.format(amount);
};

const calculateDaysFromNow = (date) => {
  return dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day');
};

const isDateInPast = (date) => {
  return dayjs(date).isBefore(dayjs());
};

const isDateInFuture = (date) => {
  return dayjs(date).isAfter(dayjs());
};

const getDateRange = (period = 'month') => {
  let startDate, endDate = dayjs();

  switch (period) {
    case 'week':
      startDate = endDate.subtract(7, 'day');
      break;
    case 'month':
      startDate = endDate.subtract(1, 'month');
      break;
    case 'quarter':
      startDate = endDate.subtract(3, 'month');
      break;
    case 'year':
      startDate = endDate.subtract(1, 'year');
      break;
    default:
      startDate = endDate.subtract(1, 'month');
  }

  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate()
  };
};

const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

const sanitizeObject = (obj, allowedFields = []) => {
  const sanitized = {};
  allowedFields.forEach(field => {
    if (field in obj) {
      sanitized[field] = obj[field];
    }
  });
  return sanitized;
};

const mergeObjects = (target, source) => {
  return Object.assign({}, target, source);
};

module.exports = {
  getPagination,
  getPaginatedResponse,
  getSuccessResponse,
  getErrorResponse,
  calculateTotals,
  calculateDiscountedTotal,
  calculateTax,
  generateDocumentNumber,
  formatCurrency,
  calculateDaysFromNow,
  isDateInPast,
  isDateInFuture,
  getDateRange,
  calculatePercentageChange,
  sanitizeObject,
  mergeObjects
};
