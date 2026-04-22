import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-unwrap backend { success, data } envelope
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      if (body.pagination) {
        response.pagination = body.pagination;
      }
      response.data = body.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
      if (!isAuthRequest) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// Products endpoints
export const productsAPI = {
  list: (params) => api.get('/factory/products', { params }),
  get: (id) => api.get(`/factory/products/${id}`),
  create: (data) => api.post('/factory/products', data),
  update: (id, data) => api.put(`/factory/products/${id}`, data),
  delete: (id) => api.delete(`/factory/products/${id}`),
  uploadImages: (id, formData) =>
    api.post(`/factory/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Price management endpoints
export const pricesAPI = {
  list: (params) => api.get('/factory/prices', { params }),
  get: (id) => api.get(`/factory/prices/${id}`),
  update: (id, data) => api.put(`/factory/prices/${id}`, data),
  bulkUpdate: (data) => api.post('/factory/prices/bulk-update', data),
  getHistory: (productId) => api.get(`/factory/prices/history/${productId}`),
};

// Purchase Orders endpoints
export const poAPI = {
  list: (params) => api.get('/factory/purchase-orders', { params }),
  get: (id) => api.get(`/factory/purchase-orders/${id}`),
  confirm: (id, data) => api.post(`/factory/purchase-orders/${id}/confirm`, data),
  reject: (id, data) => api.post(`/factory/purchase-orders/${id}/reject`, data),
  updateItemStatus: (poId, itemId, data) =>
    api.put(`/factory/purchase-orders/${poId}/items/${itemId}`, data),
  addNotes: (id, notes) => api.post(`/factory/purchase-orders/${id}/notes`, { notes }),
};

// Alias for dashboard use
export const purchaseOrdersAPI = {
  getAll: (params) => api.get('/purchase-orders', { params }),
  list: (params) => api.get('/factory/purchase-orders', { params }),
  get: (id) => api.get(`/factory/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
};

// Production endpoints
export const productionAPI = {
  listByPO: (poId) => api.get(`/factory/production/po/${poId}`),
  updateProgress: (id, data) => api.put(`/factory/production/${id}`, data),
  getCalendar: (params) => api.get('/factory/production/calendar', { params }),
  addProductionNote: (id, note) =>
    api.post(`/factory/production/${id}/notes`, { note }),
  uploadProductionPhoto: (id, formData) =>
    api.post(`/factory/production/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Shipping endpoints
export const shippingAPI = {
  listShipments: (params) => api.get('/factory/shipments', { params }),
  getShipment: (id) => api.get(`/factory/shipments/${id}`),
  createShipment: (data) => api.post('/factory/shipments', data),
  updateShipment: (id, data) => api.put(`/factory/shipments/${id}`, data),
  uploadDocument: (shipmentId, documentType, formData) =>
    api.post(`/factory/shipments/${shipmentId}/documents/${documentType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteDocument: (shipmentId, documentId) =>
    api.delete(`/factory/shipments/${shipmentId}/documents/${documentId}`),
  updatePackingList: (shipmentId, data) =>
    api.post(`/factory/shipments/${shipmentId}/packing-list`, data),
};

// Inspection endpoints
export const inspectionsAPI = {
  getSchedule: (params) => api.get('/factory/inspections/schedule', { params }),
  confirmInspection: (id, data) =>
    api.post(`/factory/inspections/${id}/confirm`, data),
  getResults: (params) => api.get('/factory/inspections/results', { params }),
  getInspectionById: (id) => api.get(`/factory/inspections/${id}`),
  getPreparationChecklist: (id) => api.get(`/factory/inspections/${id}/checklist`),
  updateChecklistItem: (inspectionId, itemId, data) =>
    api.put(`/factory/inspections/${inspectionId}/checklist/${itemId}`, data),
};

// Documents endpoints
export const documentsAPI = {
  list: (params) => api.get('/factory/documents', { params }),
  upload: (data) =>
    api.post('/factory/documents', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id) => api.delete(`/factory/documents/${id}`),
  download: (id) => api.get(`/factory/documents/${id}/download`, {
    responseType: 'blob',
  }),
};

// Factory Profile endpoints
export const factoryAPI = {
  getProfile: () => api.get('/factory/profile'),
  updateProfile: (data) => api.put('/factory/profile', data),
  getCertifications: () => api.get('/factory/certifications'),
  uploadCertification: (formData) =>
    api.post('/factory/certifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteCertification: (id) => api.delete(`/factory/certifications/${id}`),
};

// Settings endpoints
export const settingsAPI = {
  getNotificationPreferences: () => api.get('/factory/settings/notifications'),
  updateNotificationPreferences: (data) =>
    api.put('/factory/settings/notifications', data),
  getTeamMembers: () => api.get('/factory/settings/team'),
  inviteTeamMember: (email, role) =>
    api.post('/factory/settings/team/invite', { email, role }),
  removeTeamMember: (userId) => api.delete(`/factory/settings/team/${userId}`),
};

// Dashboard endpoints
export const dashboardAPI = {
  getKPIs: () => api.get('/factory/dashboard/kpis'),
  getRevenueChart: (period) => api.get(`/factory/dashboard/revenue?period=${period}`),
  getPOStatusDistribution: () => api.get('/factory/dashboard/po-status-distribution'),
  getUpcomingDeadlines: () => api.get('/factory/dashboard/upcoming-deadlines'),
  getRecentPOs: () => api.get('/factory/dashboard/recent-pos'),
  getInspectionSchedule: () => api.get('/factory/dashboard/inspection-schedule'),
  getActionItems: () => api.get('/factory/dashboard/action-items'),
};

export default api;
