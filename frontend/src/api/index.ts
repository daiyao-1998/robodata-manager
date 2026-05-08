import axios from 'axios';

// 使用环境变量中的 API 地址，如果没有则回退到动态获取当前 IP
const apiBaseUrl = import.meta.env.VITE_API_URL;
const baseURL = apiBaseUrl 
  ? `${apiBaseUrl}/api/v1` 
  : `http://${window.location.hostname}:8000/api/v1`;

const api = axios.create({
  baseURL: baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
