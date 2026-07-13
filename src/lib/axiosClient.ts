import axios from 'axios';

// Axios client with JWT bearer interceptors configuration
export const axiosClient = axios.create({
  baseURL: '/api',
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kib_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
