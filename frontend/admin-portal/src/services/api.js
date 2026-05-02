import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.headers['Content-Type'] = 'application/json'
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor — auto-unwrap backend { success, data } envelope
api.interceptors.response.use(
  (response) => {
    // Backend wraps all responses in:
    //   Simple: { success: true, message: '...', data: ... }
    //   Paginated: { success: true, data: [...], pagination: {...} }
    // Unwrap so callers get the actual payload directly
    const body = response.data
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      // Store pagination metadata on response for pages that need it
      if (body.pagination) {
        response.pagination = body.pagination
      }
      response.data = body.data
    }
    return response
  },
  (error) => {
    // Only redirect to login on 401 if it's NOT a login/auth request itself
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || ''
      const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register')
      if (!isAuthRequest) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
  getCurrentUser: () => api.get('/auth/me'),
}

// Customers endpoints
export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getOrders: (id) => api.get(`/customers/${id}/orders`),
  getQuotations: (id) => api.get(`/customers/${id}/quotations`),
  getInvoices: (id) => api.get(`/customers/${id}/invoices`),
  getClaims: (id) => api.get(`/customers/${id}/claims`),
}

// Factories endpoints
export const factoriesAPI = {
  getAll: (params) => api.get('/factories', { params }),
  getById: (id) => api.get(`/factories/${id}`),
  create: (data) => api.post('/factories', data),
  update: (id, data) => api.put(`/factories/${id}`, data),
  delete: (id) => api.delete(`/factories/${id}`),
  getProducts: (id) => api.get(`/factories/${id}/products`),
  getPurchaseOrders: (id) => api.get(`/factories/${id}/purchase-orders`),
  getPerformance: (id) => api.get(`/factories/${id}/performance`),
}

// Products endpoints
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getPriceHistory: (id) => api.get(`/products/${id}/price-history`),
  getOrderHistory: (id) => api.get(`/products/${id}/order-history`),
  uploadImage: (id, file) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post(`/products/${id}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Inquiries endpoints
export const inquiriesAPI = {
  getAll: (params) => api.get('/inquiries', { params }),
  getById: (id) => api.get(`/inquiries/${id}`),
  create: (data) => api.post('/inquiries', data),
  update: (id, data) => api.put(`/inquiries/${id}`, data),
  delete: (id) => api.delete(`/inquiries/${id}`),
  convertToQuotation: (id) => api.post(`/inquiries/${id}/convert-quotation`),
}

// Quotations endpoints
export const quotationsAPI = {
  getAll: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  send: (id) => api.post(`/quotations/${id}/send`),
  convertToPI: (id) => api.post(`/quotations/${id}/convert-to-pi`),
  duplicate: (id) => api.post(`/quotations/${id}/duplicate`),
  getPDF: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
}

// Proforma Invoices endpoints
export const proformaAPI = {
  getAll: (params) => api.get('/proforma-invoices', { params }),
  getById: (id) => api.get(`/proforma-invoices/${id}`),
  create: (data) => api.post('/proforma-invoices', data),
  update: (id, data) => api.put(`/proforma-invoices/${id}`, data),
  delete: (id) => api.delete(`/proforma-invoices/${id}`),
  send: (id) => api.post(`/proforma-invoices/${id}/send`),
  // data: { factoryId (required), estimatedDelivery? }
  convertToOrder: (id, data) => api.post(`/proforma-invoices/${id}/convert-order`, data),
  getPDF: (id) =>
    api.get(`/proforma-invoices/${id}/pdf`, { responseType: 'blob' }),
}

// Sales Orders endpoints
export const ordersAPI = {
  getAll: (params) => api.get('/sales-orders', { params }),
  getById: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post('/sales-orders', data),
  update: (id, data) => api.put(`/sales-orders/${id}`, data),
  delete: (id) => api.delete(`/sales-orders/${id}`),
  changeStatus: (id, status) =>
    api.patch(`/sales-orders/${id}/status`, { status }),
  createShipment: (id, data) => api.post(`/sales-orders/${id}/shipment`, data),
  createPO: (id, data) => api.post(`/sales-orders/${id}/purchase-order`, data),
  getTimeline: (id) => api.get(`/sales-orders/${id}/timeline`),
  createPackingList: (id) => api.post(`/sales-orders/${id}/create-packing-list`),
}

// Purchase Orders endpoints
export const purchaseOrdersAPI = {
  getAll: (params) => api.get('/purchase-orders', { params }),
  getById: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  changeStatus: (id, status) =>
    api.patch(`/purchase-orders/${id}/status`, { status }),
}

// Packing Lists endpoints
export const packingListsAPI = {
  getAll: (params) => api.get('/packing-lists', { params }),
  getById: (id) => api.get(`/packing-lists/${id}`),
  create: (data) => api.post('/packing-lists', data),
  update: (id, data) => api.put(`/packing-lists/${id}`, data),
  delete: (id) => api.delete(`/packing-lists/${id}`),
}

// Shipments endpoints
export const shipmentsAPI = {
  getAll: (params) => api.get('/shipments', { params }),
  getById: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post('/shipments', data),
  update: (id, data) => api.put(`/shipments/${id}`, data),
  delete: (id) => api.delete(`/shipments/${id}`),
  updateTracking: (id, data) =>
    api.patch(`/shipments/${id}/tracking`, data),
  getTimeline: (id) => api.get(`/shipments/${id}/timeline`),
}

// Inspections endpoints
export const inspectionsAPI = {
  getAll: (params) => api.get('/inspections', { params }),
  getById: (id) => api.get(`/inspections/${id}`),
  create: (data) => api.post('/inspections', data),
  update: (id, data) => api.put(`/inspections/${id}`, data),
  delete: (id) => api.delete(`/inspections/${id}`),
  uploadPhoto: (id, file) => {
    const formData = new FormData()
    formData.append('photo', file)
    return api.post(`/inspections/${id}/upload-photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Claims endpoints
export const claimsAPI = {
  getAll: (params) => api.get('/claims', { params }),
  getById: (id) => api.get(`/claims/${id}`),
  create: (data) => api.post('/claims', data),
  update: (id, data) => api.put(`/claims/${id}`, data),
  delete: (id) => api.delete(`/claims/${id}`),
  uploadEvidence: (id, file) => {
    const formData = new FormData()
    formData.append('evidence', file)
    return api.post(`/claims/${id}/upload-evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Invoices endpoints
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  recordPayment: (id, data) => api.post(`/invoices/${id}/payment`, data),
  createCreditNote: (id, data) =>
    api.post(`/invoices/${id}/credit-note`, data),
  getPDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
}

// Payments endpoints
export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
}

// Inventory endpoints
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  adjustStock: (id, data) => api.post(`/inventory/${id}/adjust`, data),
  getLowStockItems: () => api.get('/inventory/low-stock'),
}

// Reports endpoints
export const reportsAPI = {
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getPurchaseReport: (params) => api.get('/reports/purchase', { params }),
  getFinancialReport: (params) => api.get('/reports/financial', { params }),
  getInventoryReport: (params) => api.get('/reports/inventory', { params }),
  getCustomerReport: (params) => api.get('/reports/customer', { params }),
  getFactoryReport: (params) => api.get('/reports/factory', { params }),
  getProfitMargin: (params) => api.get('/reports/profit-margin', { params }),
  getPipeline: (params) => api.get('/reports/pipeline', { params }),
  getAging: (params) => api.get('/reports/aging', { params }),
  getPerformance: (params) => api.get('/reports/performance', { params }),
  getLogistics: (params) => api.get('/reports/logistics', { params }),
  exportReport: (type, params) => api.get(`/reports/${type}/export`, { params }),
}

// Dashboard endpoints
export const dashboardAPI = {
  getMetrics: () => api.get('/dashboard/admin'),
  getRevenueChart: (params) => api.get('/dashboard/revenue', { params }),
  getOrdersChart: () => api.get('/dashboard/recent-orders'),
  getTopCustomers: () => api.get('/dashboard/top-customers'),
  getRecentInquiries: () => api.get('/dashboard/recent-inquiries'),
  getRecentOrders: () => api.get('/dashboard/recent-orders'),
  getUpcomingShipments: () => api.get('/dashboard/upcoming-shipments'),
  getRoleConfig: (role) => api.get(`/dashboard/role/${role}`),
  getAvailableWidgets: () => api.get('/dashboard/widgets'),
  saveLayout: (data) => api.post('/dashboard/layout', data),
  getKPIs: () => api.get('/dashboard/kpi'),
}

// Users endpoints
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  assignRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
}

// Settings endpoints
export const settingsAPI = {
  getCompanySettings: () => api.get('/settings/company'),
  updateCompanySettings: (data) => api.put('/settings/company', data),
  getEmailTemplates: () => api.get('/settings/email-templates'),
  updateEmailTemplate: (id, data) =>
    api.put(`/settings/email-templates/${id}`, data),
  getSystemLogs: (params) => api.get('/settings/logs', { params }),
}

// Audit Logs endpoints
export const auditAPI = {
  getAll: (params) => api.get('/audit-logs', { params }),
  getByEntity: (entity, entityId) =>
    api.get(`/audit-logs/entity/${entity}/${entityId}`),
  getUserActivity: (userId) => api.get(`/audit-logs/user/${userId}`),
  getStats: (params) => api.get('/audit-logs/stats', { params }),
  getRecent: (params) => api.get('/audit-logs/recent', { params }),
  exportCSV: (params) => api.get('/audit-logs/export', { params, responseType: 'blob' }),
}

// Currency endpoints
export const currencyAPI = {
  getRates: () => api.get('/currencies/rates'),
  convert: (amount, fromCurrency, toCurrency) =>
    api.post('/currencies/convert', { amount, fromCurrency, toCurrency }),
  getHistory: (currency, params) =>
    api.get(`/currencies/${currency}/history`, { params }),
  update: (currency, data) => api.put(`/currencies/${currency}`, data),
}

// Backup endpoints
export const backupAPI = {
  create: (data) => api.post('/backups', data),
  list: (params) => api.get('/backups', { params }),
  restore: (id) => api.post(`/backups/${id}/restore`),
  getLatest: () => api.get('/backups/latest'),
  getSchedule: () => api.get('/backups/schedule'),
  setSchedule: (data) => api.put('/backups/schedule', data),
}

// Analytics endpoints
export const analyticsAPI = {
  getRevenueTrend: (params) => api.get('/analytics/revenue-trend', { params }),
  getOrderFunnel: (params) => api.get('/analytics/order-funnel', { params }),
  getTopProducts: (params) => api.get('/analytics/top-products', { params }),
  getCustomerSegments: (params) => api.get('/analytics/customer-segments', { params }),
  getFactoryPerformance: (params) => api.get('/analytics/factory-performance', { params }),
  getPaymentAging: (params) => api.get('/analytics/payment-aging', { params }),
  getShipmentTimeline: (params) => api.get('/analytics/shipment-timeline', { params }),
  getProfitMargins: (params) => api.get('/analytics/profit-margins', { params }),
  getForecast: (params) => api.get('/analytics/forecast', { params }),
}

// GRN (Goods Received Notes) endpoints
export const grnAPI = {
  getAll: (params) => api.get('/grns', { params }),
  getById: (id) => api.get(`/grns/${id}`),
  create: (data) => api.post('/grns', data),
  update: (id, data) => api.put(`/grns/${id}`, data),
  delete: (id) => api.delete(`/grns/${id}`),
  accept: (id) => api.post(`/grns/${id}/accept`),
  reject: (id, data) => api.post(`/grns/${id}/reject`, data),
}

// Product Specifications endpoints
export const productSpecsAPI = {
  getSpecs: (productId) => api.get(`/product-specs/${productId}/specs`),
  createSpecs: (productId, data) => api.post(`/product-specs/${productId}/specs`, data),
  updateSpecs: (productId, data) => api.put(`/product-specs/${productId}/specs`, data),
  filterBySpecs: (params) => api.get('/product-specs/specs/filter', { params }),
  compareSpecs: (productIds) => api.post('/product-specs/specs/compare', { productIds }),
  // Spec templates
  getTemplates: (params) => api.get('/product-specs/templates', { params }),
  getTemplate: (id) => api.get(`/product-specs/templates/${id}`),
  createTemplate: (data) => api.post('/product-specs/templates', data),
  updateTemplate: (id, data) => api.put(`/product-specs/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/product-specs/templates/${id}`),
  applyTemplate: (id, productId) => api.post(`/product-specs/templates/${id}/apply`, { productId }),
}

// Document Template endpoints (enhanced)
export const documentTemplatesAPI = {
  getAll: (params) => api.get('/personalization/templates', { params }),
  getById: (id) => api.get(`/personalization/templates/${id}`),
  create: (data) => api.post('/personalization/templates', data),
  update: (id, data) => api.put(`/personalization/templates/${id}`, data),
  delete: (id) => api.delete(`/personalization/templates/${id}`),
  duplicate: (id) => api.post(`/personalization/templates/${id}/duplicate`),
  preview: (id, data) => api.post(`/personalization/templates/${id}/preview`, data),
  generate: (id, data) => api.post(`/personalization/templates/${id}/generate`, data, { responseType: 'blob' }),
  uploadAnalyze: (formData) => api.post('/personalization/templates/upload-analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getDocumentTypes: () => api.get('/personalization/templates/document-types'),
  getFields: (documentType) => api.get(`/personalization/templates/fields/${documentType}`),
  getHistory: (params) => api.get('/personalization/templates/generations/history', { params }),
}

// Personalization endpoints
export const personalizationAPI = {
  // Notification preferences
  getNotificationPreferences: (userId) =>
    api.get(`/personalization/notification-preferences/${userId}`),
  updateNotificationPreferences: (userId, data) =>
    api.put(`/personalization/notification-preferences/${userId}`, data),

  // Commission routes
  getCommissionRules: () => api.get('/personalization/commissions/rules'),
  createCommissionRule: (data) =>
    api.post('/personalization/commissions/rules', data),
  getMyCommissions: () => api.get('/personalization/commissions/my'),
  getAllCommissions: (params) =>
    api.get('/personalization/commissions', { params }),

  // Filter presets
  getFilterPresets: (params) => api.get('/personalization/filter-presets', { params }),
  createFilterPreset: (data) =>
    api.post('/personalization/filter-presets', data),
  updateFilterPreset: (id, data) =>
    api.put(`/personalization/filter-presets/${id}`, data),
  deleteFilterPreset: (id) =>
    api.delete(`/personalization/filter-presets/${id}`),
  getSharedFilterPreset: (shareToken) =>
    api.get(`/personalization/filter-presets/shared/${shareToken}`),
}

// Document Approval endpoints
export const approvalAPI = {
  generate: (data) => api.post('/approvals/generate', data),
  getAll: (params) => api.get('/approvals', { params }),
  getById: (id) => api.get(`/approvals/${id}`),
  // Public (token-based) — no auth required, called from the public approval page
  getByToken: (token) => api.get(`/approvals/public/${token}`),
  approve: (token, data) => api.post(`/approvals/public/${token}/approve`, data),
  reject: (token, data) => api.post(`/approvals/public/${token}/reject`, data),
}

// Chatter (polymorphic message thread on any record)
export const chatterAPI = {
  getMessages: (entityType, entityId) =>
    api.get(`/chatter/${entityType}/${entityId}`),
  postMessage: (entityType, entityId, data) =>
    api.post(`/chatter/${entityType}/${entityId}`, data),
  deleteMessage: (entityType, entityId, messageId) =>
    api.delete(`/chatter/${entityType}/${entityId}/${messageId}`),
}

// Internal Approvals (manager sign-off)
export const internalApprovalAPI = {
  getAll: (params) => api.get('/internal-approvals', { params }),
  getById: (id) => api.get(`/internal-approvals/${id}`),
  getForEntity: (entityType, enti