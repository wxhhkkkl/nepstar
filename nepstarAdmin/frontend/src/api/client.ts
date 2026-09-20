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
  (response) => {
    const body = response.data;
    // 后端用统一响应体表达业务失败（例如 HTTP 200 + { code: 409 }）。
    // Axios 只会因 HTTP 状态失败而 reject，因此这里必须把业务失败也转为异常，
    // 否则删除未完成时页面仍会继续显示“删除成功”。
    if (body && typeof body === 'object' && 'code' in body && body.code !== 200) {
      const error = new Error(body.message || 'common.operationFailed');
      Object.assign(error, { code: body.code, response: body });
      return Promise.reject(error);
    }
    return body;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      router.push('/login');
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
