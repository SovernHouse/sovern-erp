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
  getProfitability: (id, params) => api.get(`/customers/${id}/profitability`, { params }),
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

// CRM Leads endpoints (used by quote/invoice forms to link a quotation back
// to its originating lead). The CRM module also has its own per-page api.get
// calls — this is the canonical helper.
export const leadsAPI = {
  getAll: (params) => api.get('/crm/leads', { params }),
  getById: (id) => api.get(`/crm/leads/${id}`),
  create: (data) => api.post('/crm/leads', data),
  update: (id, data) => api.put(`/crm/leads/${id}`, data),
  delete: (id) => api.delete(`/crm/leads/${id}`),
}

// Products endpoints
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getPriceHistory: (id) => api.get(`/products/${id}/price-history`),
  createPrice: (id, data) => api.post(`/products/${id}/prices`, data),
  updatePrice: (id, priceId, data) => api.put(`/products/${id}/prices/${priceId}`, data),
  deletePrice: (id, priceId) => api.delete(`/products/${id}/prices/${priceId}`),
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
// Phase 3, C11: every endpoint accepts an optional { brandCode } param.
// The backend resolves: ?brandCode=X narrows multi-brand users to that
// brand; omitted means "use my accessibleBrands scope".
export const dashboardAPI = {
  getMetrics: (params) => api.get('/dashboard/admin', { params }),
  getRevenueChart: (params) => api.get('/dashboard/revenue', { params }),
  getOrdersChart: (params) => api.get('/dashboard/recent-orders', { params }),
  getTopCustomers: (params) => api.get('/dashboard/top-customers', { params }),
  getRecentInquiries: (params) => api.get('/dashboard/recent-inquiries', { params }),
  getRecentOrders: (params) => api.get('/dashboard/recent-orders', { params }),
  getUpcomingShipments: (params) => api.get('/dashboard/upcoming-shipments', { params }),
  getRoleConfig: (role) => api.get(`/dashboard/role/${role}`),
  getAvailableWidgets: () => api.get('/dashboard/widgets'),
  saveLayout: (data) => api.post('/dashboard/layout', data),
  getLayout: () => api.get('/dashboard/layout'),
  getKPIs: () => api.get('/dashboard/kpi'),
}

// Calendar endpoints
export const calendarAPI = {
  getEvents: (params) => api.get('/calendar/events', { params }),
  getEvent: (id) => api.get(`/calendar/events/${id}`),
  getToday: () => api.get('/calendar/today'),
  linkLead: (id, leadId) => api.patch(`/calendar/events/${id}/link-lead`, { leadId }),
}

// Users endpoints
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  assignRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  toggleActive: (id) => api.patch(`/users/${id}/activate`),
  resetPassword: (id, password) => api.patch(`/users/${id}/reset-password`, { password }),
}

// Settings endpoints
export const settingsAPI = {
  getCompanySettings: () => api.get('/settings/company'),
  updateCompanySettings: (data) => api.put('/settings/company', data),
  getEmailTemplates: () => api.get('/settings/email-templates'),
  updateEmailTemplate: (id, data) =>
    api.put(`/settings/email-templates/${id}`, data),
  getSystemLogs: (params) => api.get('/settings/logs', { params }),
  getFrontendErrors: (params) => api.get('/settings/frontend-errors', { params }),
  clearFrontendErrors: () => api.delete('/settings/frontend-errors'),
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
  getForEntity: (entityType, entityId) =>
    api.get(`/internal-approvals/entity/${entityType}/${entityId}`),
  getPendingCount: () => api.get('/internal-approvals/pending-count'),
  request: (data) => api.post('/internal-approvals', data),
  approve: (id, data) => api.post(`/internal-approvals/${id}/approve`, data),
  reject: (id, data) => api.post(`/internal-approvals/${id}/reject`, data),
  cancel: (id) => api.post(`/internal-approvals/${id}/cancel`),
}

export const activitiesAPI = {
  getMy:           ()           => api.get('/scheduled-activities/my'),
  getForEntity:    (type, id)   => api.get(`/scheduled-activities/entity/${type}/${id}`),
  create:          (data)       => api.post('/scheduled-activities', data),
  markDone:        (id, data)   => api.put(`/scheduled-activities/${id}/done`, data || {}),
  reschedule:      (id, data)   => api.put(`/scheduled-activities/${id}/reschedule`, data),
  cancel:          (id)         => api.delete(`/scheduled-activities/${id}`),
}

// Internal Chat (omnichannel inbox)
export const chatAPI = {
  // Utility
  listUsers:          (params)        => api.get('/chat/users', { params }),

  // Rooms
  listRooms:          ()              => api.get('/chat/rooms'),
  createRoom:         (data)          => api.post('/chat/rooms', data),
  getOrCreateDM:      (userId)        => api.post('/chat/rooms/dm', { userId }),
  getRoom:            (id)            => api.get(`/chat/rooms/${id}`),
  updateRoom:         (id, data)      => api.patch(`/chat/rooms/${id}`, data),
  deleteRoom:         (id)            => api.delete(`/chat/rooms/${id}`),

  // Members
  listMembers:        (id)            => api.get(`/chat/rooms/${id}/members`),
  addMembers:         (id, userIds)   => api.post(`/chat/rooms/${id}/members`, { userIds }),
  removeMember:       (id, uid)       => api.delete(`/chat/rooms/${id}/members/${uid}`),

  // Messages
  listMessages:       (id, params)    => api.get(`/chat/rooms/${id}/messages`, { params }),
  sendMessage:        (id, data)      => api.post(`/chat/rooms/${id}/messages`, data),
  editMessage:        (id, mid, data) => api.patch(`/chat/rooms/${id}/messages/${mid}`, data),
  deleteMessage:      (id, mid)       => api.delete(`/chat/rooms/${id}/messages/${mid}`),
  toggleReaction:     (id, mid, emoji)=> api.post(`/chat/rooms/${id}/messages/${mid}/react`, { emoji }),

  // Read receipts
  markRead:           (id)            => api.post(`/chat/rooms/${id}/read`),
}

export const googleAPI = {
  // OAuth — initiates consent flow, returns { authUrl }
  initOAuth:        ()   => api.get('/google/oauth/init'),

  // Connected account management (admin only)
  listAccounts:     ()   => api.get('/google/accounts'),
  disconnectAccount:(id) => api.delete(`/google/accounts/${id}`),
  toggleAccount:    (id) => api.patch(`/google/accounts/${id}/toggle`),

  // Minimal account list for feature pages (Drive/Calendar/Gmail pickers)
  // — available to any authenticated user. Optional `scope` filter narrows
  // to accounts that have the named scope (substring match: 'drive',
  // 'gmail', 'calendar').
  listAvailable:    (scope) => api.get('/google/accounts/available', { params: scope ? { scope } : {} }),
}

export const driveAPI = {
  listFiles:   (params) => api.get('/drive/files', { params }),
  getFile:     (fileId, accountId) => api.get(`/drive/files/${fileId}`, { params: { accountId } }),
  search:      (params) => api.get('/drive/search', { params }),
  breadcrumb:  (params) => api.get('/drive/breadcrumb', { params }),
}

// AI Assistant
export const aiAPI = {
  // AI replies can take 30-240s (claude -p subprocess + MCP tool chain +
  // optional WebSearch/WebFetch). Must exceed backend kill timer (240s) but
  // stay under nginx proxy_read_timeout (270s).
  chat:                 (data)        => api.post('/ai/chat', data, { timeout: 260000 }),
  listConversations:    ()            => api.get('/ai/conversations'),
  getConversation:      (id)          => api.get(`/ai/conversations/${id}`),
  renameConversation:   (id, title)   => api.patch(`/ai/conversations/${id}`, { title }),
  deleteConversation:   (id)          => api.delete(`/ai/conversations/${id}`),
  clearConversation:    (id)          => api.post(`/ai/conversations/${id}/clear`),
  // Upload one file (image / PDF / Word / Excel / text) to the user's Drive
  // for use as a chat attachment. Returns { driveFileId, name, mimeType, ... }.
  // 60s timeout (Drive upload + optional thumbnail generation).
  uploadAttachment:     (file)        => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/ai/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
}

// Dev Mode (super_admin only) — sandboxed AI code-change runs.
// startRun returns 202 immediately; the run completes in the background
// and the client should poll getRun (or react to a Notification row).
export const devModeAPI = {
  startRun:              (prompt)               => api.post('/dev-mode/runs', { prompt }),
  listRuns:              (params)               => api.get('/dev-mode/runs', { params }),
  getRun:                (id)                   => api.get(`/dev-mode/runs/${id}`),
  answerClarification:   (id, answer)           => api.post(`/dev-mode/runs/${id}/answer`, { answer }),
  abortRun:              (id)                   => api.post(`/dev-mode/runs/${id}/abort`),
}

// AI Research — Tier 2 background sourcing tasks. startTask returns 202
// and the runner notifies via Notification row + appended chat message
// when done. listTasks/getTask are read; cancelTask SIGTERMs the subprocess.
export const researchAPI = {
  startTask:  (mode, brief, conversationId) => api.post('/research/tasks', { mode, brief, conversationId }),
  listTasks:  (params)                      => api.get('/research/tasks', { params }),
  getTask:    (id)                          => api.get(`/research/tasks/${id}`),
  cancelTask: (id)                          => api.post(`/research/tasks/${id}/cancel`),
}

// Multi-brand (Phase 1 Commit 4) — list brands and the caller's brand scope.
// BrandsContext consumes these on app boot. brandOverride is super_admin-only;
// frontend hides the UI but backend re-checks.
export const brandsAPI = {
  list:           ()                => api.get('/brands'),
  me:             ()                => api.get('/brands/me'),
  get:            (code)            => api.get(`/brands/${code}`),
  update:         (code, data)      => api.put(`/brands/${code}`, data),
  override:       (body)            => api.patch('/admin/brand-override', body), // { entityType, entityId, newBrandCode, reason }
}

// Expenses module (item 4) — used by the /expense, /expenses, /expense-report
// slash commands plus the admin expenses page. Mounted at /api so paths are
// /api/expenses, /api/expense-offices, /api/expense-trips, /api/expense-submissions.
export const expensesAPI = {
  // Expense CRUD
  list:               (params)              => api.get('/expenses', { params }),
  get:                (id)                  => api.get(`/expenses/${id}`),
  create:             (data)                => api.post('/expenses', data),
  update:             (id, data)            => api.patch(`/expenses/${id}`, data),
  remove:             (id)                  => api.delete(`/expenses/${id}`),
  extractFromReceipt: (driveFileId)         => api.post('/expenses/extract-from-receipt', { driveFileId }, { timeout: 90000 }),
  // Office CRUD
  listOffices:        (params)              => api.get('/expense-offices', { params }),
  createOffice:       (data)                => api.post('/expense-offices', data),
  updateOffice:       (id, data)            => api.patch(`/expense-offices/${id}`, data),
  removeOffice:       (id)                  => api.delete(`/expense-offices/${id}`),
  // Trip CRUD
  listTrips:          ()                    => api.get('/expense-trips'),
  createTrip:         (data)                => api.post('/expense-trips', data),
  updateTrip:         (id, data)            => api.patch(`/expense-trips/${id}`, data),
  removeTrip:         (id)                  => api.delete(`/expense-trips/${id}`),
  // Submissions + reports
  listSubmissions:    (params)              => api.get('/expense-submissions', { params }),
  createSubmission:   (data)                => api.post('/expense-submissions', data),
  updateSubmission:   (id, data)            => api.patch(`/expense-submissions/${id}`, data),
  generateReport:     (id)                  => api.post(`/expense-submissions/${id}/generate-report`, {}, { timeout: 60000 }),
}

// Expo push tokens — admin portal doesn't push but this is here for
// completeness / future web-push.
export const pushTokensAPI = {
  register:    (token, opts) => api.post('/push-tokens/register', { token, ...(opts || {}) }),
  unregister:  (token)       => api.post('/push-tokens/unregister', { token }),
  listMine:    ()            => api.get('/push-tokens/me'),
}

export default api
