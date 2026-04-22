import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('userToken');
      // Trigger logout in app
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (factoryId, password) =>
    api.post('/auth/factory-login', { factoryId, password }),
  logout: () =>
    api.post('/auth/logout'),
  refreshToken: () =>
    api.post('/auth/refresh-token'),
};

// Purchase Orders
export const poAPI = {
  getAll: (params = {}) =>
    api.get('/purchase-orders', { params }),
  getById: (poId) =>
    api.get(`/purchase-orders/${poId}`),
  confirmPO: (poId, deliveryDate, notes) =>
    api.put(`/purchase-orders/${poId}/confirm`, { deliveryDate, notes }),
  rejectPO: (poId, reason) =>
    api.put(`/purchase-orders/${poId}/reject`, { reason }),
  updateNotes: (poId, notes) =>
    api.put(`/purchase-orders/${poId}/notes`, { notes }),
};

// Production
export const productionAPI = {
  getAll: (params = {}) =>
    api.get('/production', { params }),
  getById: (productionId) =>
    api.get(`/production/${productionId}`),
  updateStatus: (productionId, percentComplete, status, notes) =>
    api.put(`/production/${productionId}`, { percentComplete, status, notes }),
  uploadPhoto: (productionId, photo) => {
    const formData = new FormData();
    formData.append('photo', {
      uri: photo.uri,
      type: 'image/jpeg',
      name: photo.fileName || 'production-photo.jpg',
    });
    return api.post(`/production/${productionId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  completeItem: (productionId, itemId) =>
    api.put(`/production/${productionId}/items/${itemId}/complete`),
};

// Shipments
export const shipmentAPI = {
  getAll: (params = {}) =>
    api.get('/shipments', { params }),
  getById: (shipmentId) =>
    api.get(`/shipments/${shipmentId}`),
  create: (data) =>
    api.post('/shipments', data),
  update: (shipmentId, data) =>
    api.put(`/shipments/${shipmentId}`, data),
  uploadDocument: (shipmentId, documentType, file) => {
    const formData = new FormData();
    formData.append('document', {
      uri: file.uri,
      type: file.type || 'application/pdf',
      name: file.name || `${documentType}.pdf`,
    });
    formData.append('documentType', documentType);
    return api.post(`/shipments/${shipmentId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getDocuments: (shipmentId) =>
    api.get(`/shipments/${shipmentId}/documents`),
};

// Packing Lists
export const packingListAPI = {
  getByShipment: (shipmentId) =>
    api.get(`/packing-lists/shipment/${shipmentId}`),
  create: (shipmentId, items) =>
    api.post('/packing-lists', { shipmentId, items }),
  update: (packingListId, items) =>
    api.put(`/packing-lists/${packingListId}`, { items }),
};

// Products
export const productAPI = {
  getAll: (params = {}) =>
    api.get('/products', { params }),
  getById: (productId) =>
    api.get(`/products/${productId}`),
  create: (data) =>
    api.post('/products', data),
  update: (productId, data) =>
    api.put(`/products/${productId}`, data),
  uploadImage: (productId, image) => {
    const formData = new FormData();
    formData.append('image', {
      uri: image.uri,
      type: 'image/jpeg',
      name: image.fileName || 'product-image.jpg',
    });
    return api.post(`/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Prices
export const priceAPI = {
  getAll: (params = {}) =>
    api.get('/prices', { params }),
  updatePrice: (productId, price, effectiveDate) =>
    api.put(`/prices/${productId}`, { price, effectiveDate }),
  updateMultiplePrices: (updates) =>
    api.post('/prices/batch', { updates }),
};

// Inspections
export const inspectionAPI = {
  getAll: (params = {}) =>
    api.get('/inspections', { params }),
  getById: (inspectionId) =>
    api.get(`/inspections/${inspectionId}`),
  complete: (inspectionId, results, photos) => {
    const formData = new FormData();
    formData.append('results', JSON.stringify(results));
    photos.forEach((photo, index) => {
      formData.append(`photo_${index}`, {
        uri: photo.uri,
        type: 'image/jpeg',
        name: photo.fileName || `inspection-${index}.jpg`,
      });
    });
    return api.post(`/inspections/${inspectionId}/complete`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Factory Profile
export const factoryAPI = {
  getProfile: () =>
    api.get('/factory/profile'),
  updateProfile: (data) =>
    api.put('/factory/profile', data),
  getCertifications: () =>
    api.get('/factory/certifications'),
  updateCertifications: (certifications) =>
    api.put('/factory/certifications', { certifications }),
  getTeam: () =>
    api.get('/factory/team'),
  addTeamMember: (member) =>
    api.post('/factory/team', member),
  removeTeamMember: (memberId) =>
    api.delete(`/factory/team/${memberId}`),
};

// Dashboard
export const dashboardAPI = {
  getStats: () =>
    api.get('/dashboard/stats'),
  getUrgentItems: () =>
    api.get('/dashboard/urgent-items'),
  getRecentPOs: (limit = 10) =>
    api.get(`/dashboard/recent-pos?limit=${limit}`),
};

// Notifications
export const notificationAPI = {
  getAll: (params = {}) =>
    api.get('/notifications', { params }),
  markAsRead: (notificationId) =>
    api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () =>
    api.put('/notifications/read-all'),
};

export default api;
