import axios from 'axios';

// Відносний '/api' → ходить через nginx-проксі (працює на будь-якому хості/IP)
const API_URL = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use((response) => response, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') window.location.href = '/login';
  }
  return Promise.reject(error);
});

export const authAPI = {
  login: (c) => api.post('/auth/login', c),
  getMe: () => api.get('/auth/me'),
  changePassword: (d) => api.post('/auth/change-password', d),
};

export const assetsAPI = {
  getAll: (p) => api.get('/assets', { params: p }),
  getById: (id) => api.get(`/assets/${id}`),
  update: (id, d) => api.put(`/assets/${id}`, d),
  remove: (id) => api.delete(`/assets/${id}`),
};

export const usageAPI = {
  list: (assetId) => api.get(`/assets/${assetId}/usage`),
  add: (assetId, d) => api.post(`/assets/${assetId}/usage`, d),
  remove: (assetId, usageId) => api.delete(`/assets/${assetId}/usage/${usageId}`),
};

export const actsAPI = {
  getAll: (p) => api.get('/acts', { params: p }),
  getById: (id) => api.get(`/acts/${id}`),
  introduction: (d) => api.post('/acts/introduction', d),
  transfer: (d) => api.post('/acts/transfer', d),
  extension: (d) => api.post('/acts/extension', d),
  writeOff: (d) => api.post('/acts/write-off', d),
  remove: (id) => api.delete(`/acts/${id}`),
};

export const assetTypesAPI = {
  getAll: () => api.get('/asset-types'),
  create: (d) => api.post('/asset-types', d),
  update: (id, d) => api.put(`/asset-types/${id}`, d),
  remove: (id) => api.delete(`/asset-types/${id}`),
};

export const departmentsAPI = {
  getAll: () => api.get('/departments'),
  create: (d) => api.post('/departments', d),
  update: (id, d) => api.put(`/departments/${id}`, d),
  remove: (id) => api.delete(`/departments/${id}`),
};

export const locationsAPI = {
  getAll: () => api.get('/locations'),
  create: (d) => api.post('/locations', d),
  update: (id, d) => api.put(`/locations/${id}`, d),
  remove: (id) => api.delete(`/locations/${id}`),
  assets: (id) => api.get(`/locations/${id}/assets`),
};

export const usersAPI = {
  getAll: (p) => api.get('/users', { params: p }),
  getById: (id) => api.get(`/users/${id}`),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.put(`/users/${id}`, d),
  remove: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};

export const logsAPI = {
  getAll: (p) => api.get('/logs', { params: p }),
};

export const healthCheck = () => axios.get(`${API_URL}/health`);

export default api;
