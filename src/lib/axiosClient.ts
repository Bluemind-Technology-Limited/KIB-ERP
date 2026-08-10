import axios from 'axios';
import { getAccessToken } from './supabase';

// Axios client pointing at the KIB ERP backend (backend/App, Express + TS).
// baseURL: VITE_API_URL may be set to the backend origin (http://localhost:3002)
// or the full /api base. Normalize so requests always hit the mounted /api routes.
const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';
const API_BASE = rawBase.replace(/\/+$/, '') + (rawBase.includes('/api') ? '' : '/api');

export const axiosClient = axios.create({
  baseURL: API_BASE,
});

axiosClient.interceptors.request.use(
  async (config) => {
    // Use the live Supabase session token (JWT) for backend authorization.
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
