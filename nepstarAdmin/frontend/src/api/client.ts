import axios from 'axios';
import router from '@/router';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD
    ? '/api/v1'
    : `${window.location.protocol}//${window.location.hostname}:8000/api/v1`);

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const lang = localStorage.getItem('lang') || 'zh-CN';
  config.headers['Accept-Language'] = lang;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      router.push('/login');
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
