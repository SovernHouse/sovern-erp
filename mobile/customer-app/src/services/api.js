import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      // Navigate to login (handled by navigation)
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authService = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
  logout: () =>
    api.post('/auth/logout'),
};

// Products endpoints
export const productService = {
  getAll: (params) =>
    api.get('/products', { params }),
  getById: (id) =>
    api.get(`/products/${id}`),
  getCategories: () =>
    api.get('/products/categories'),
  search: (query) =>
    api.get('/products/search', { params: { q: query } }),
};

// Orders endpoints
export const orderService = {
  getAll: (params) =>
    api.get('/orders', { params }),
  getById: (id) =>
    api.get(`/orders/${id}`),
  create: (orderData) =>
    api.post('/orders', orderData),
  getDocuments: (orderId) =>
    api.get(`/orders/${orderId}/documents`),
};

// Quotations endpoints
export const quotationService = {
  getAll: (params) =>
    api.get('/quotations', { params }),
  getById: (id) =>
    api.get(`/quotations/${id}`),
  create: (quotationData) =>
    api.post('/quotations', quotationData),
  accept: (id) =>
    api.post(`/quotations/${id}/accept`),
  reject: (id) =>
    api.post(`/quotations/${id}/reject`),
};

// Shipments endpoints
export const shipmentService = {
  getAll: (params) =>
    api.get('/shipments', { params }),
  getById: (id) =>
    api.get(`/shipments/${id}`),
  getTracking: (id) =>
    api.get(`/shipments/${id}/tracking`),
  getDocuments: (shipmentId) =>
    api.get(`/shipments/${shipmentId}/documents`),
};

// Claims endpoints
export const claimService = {
  getAll: (params) =>
    api.get('/claims', { params }),
  getById: (id) =>
    api.get(`/claims/${id}`),
  create: (claimData) =>
    api.post('/claims', claimData),
  uploadPhoto: (claimId, formData) =>
    api.post(`/claims/${claimId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// User/Profile endpoints
export const userService = {
  getProfile: () =>
    api.get('/user/profile'),
  updateProfile: (profileData) =>
    api.put('/user/profile', profileData),
  changePassword: (currentPassword, newPassword) =>
    api.post('/user/change-password', { currentPassword, newPassword }),
  getNotificationPreferences: () =>
    api.get('/user/notification-preferences'),
  updateNotificationPreferences: (preferences) =>
    api.put('/user/notification-preferences', preferences),
};

// Statistics endpoints
export const statsService = {
  getSummary: () =>
    api.get('/stats/summary'),
};

export default api;
