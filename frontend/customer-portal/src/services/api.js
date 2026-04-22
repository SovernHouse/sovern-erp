import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

api.interceptors.response.use(
  (response) => {
    // Auto-unwrap backend { success, data } envelope
    const body = response.data
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      if (body.pagination) {
        response.pagination = body.pagination
      }
      response.data = body.data
    }
    return response
  },
  (error) => {
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
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}

// Products endpoints
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  categories: () => api.get('/products/categories'),
  search: (query) => api.get('/products/search', { params: { q: query } }),
}

// Quotations endpoints
export const quotationsAPI = {
  list: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  accept: (id) => api.post(`/quotations/${id}/accept`),
  reject: (id) => api.post(`/quotations/${id}/reject`),
  requestRevision: (id, data) => api.post(`/quotations/${id}/revision`, data),
  downloadPDF: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
}

// Orders endpoints
export const ordersAPI = {
  list: (params) => api.get('/sales-orders', { params }),
  getAll: (params) => api.get('/sales-orders', { params }),
  getById: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post('/sales-orders', data),
  getDocuments: (id) => api.get(`/sales-orders/${id}/documents`),
  downloadDocument: (orderId, docId) => api.get(`/sales-orders/${orderId}/documents/${docId}`, { responseType: 'blob' }),
  getShipments: (id) => api.get(`/sales-orders/${id}/shipments`),
}

// Shipments endpoints
export const shipmentsAPI = {
  getById: (id) => api.get(`/shipments/${id}`),
  track: (trackingNumber) => api.get('/shipments/track', { params: { number: trackingNumber } }),
  list: (params) => api.get('/shipments', { params }),
}

// Claims endpoints
export const claimsAPI = {
  list: (params) => api.get('/claims', { params }),
  getById: (id) => api.get(`/claims/${id}`),
  create: (data) => api.post('/claims', data),
  update: (id, data) => api.put(`/claims/${id}`, data),
  uploadAttachment: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/claims/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  addComment: (id, comment) => api.post(`/claims/${id}/comments`, { comment }),
}

// Invoices endpoints
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  list: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  downloadPDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
}

// Samples endpoints
export const samplesAPI = {
  getAll: (params) => api.get('/samples', { params }),
  getById: (id) => api.get(`/samples/${id}`),
  create: (data) => api.post('/samples', data),
  update: (id, data) => api.put(`/samples/${id}`, data),
  updateStatus: (id, status) => api.patch(`/samples/${id}/status`, { status }),
  provideFeedback: (id, feedback) => api.post(`/samples/${id}/feedback`, feedback),
  approveFeedback: (id) => api.post(`/samples/${id}/approve-for-order`),
  getAddressBook: () => api.get('/customers/address-book'),
}

// Notifications endpoints
export const notificationsAPI = {
  list: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
}

// Dashboard endpoints
export const dashboardAPI = {
  getCustomerDashboard: () => api.get('/dashboard/customer'),
  getRoleConfig: (role) => api.get(`/dashboard/role/${role}`),
  getKPIs: () => api.get('/dashboard/kpi'),
}

export default api
