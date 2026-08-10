import { create } from 'zustand';
import { type User } from '../types';
import { supabase } from '../lib/supabase';
import { axiosClient } from '../lib/axiosClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Sign in via Supabase Auth, then fetch the app user (role) from the backend. */
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  /** Restore session on app boot (Supabase persists the session). */
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (user: User | null, token: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured. Add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to kib-ERP/.env' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const token = data.session?.access_token ?? null;

      // Fetch the app user (with role) from the backend using the JWT.
      let appUser: User | null = null;
      try {
        const res = await axiosClient.get<{ user: User }>('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        appUser = res.data.user;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 403 || status === 404) {
          // Token is valid but the Prisma profile is missing / inactive.
          return {
            success: false,
            message: 'Signed in with Supabase, but no app profile was found. Run the backend seed script (pnpm db:seed).',
          };
        }
        // Anything else is a network / server problem — surface the real cause.
        return {
          success: false,
          message: `Could not reach the backend at ${axiosClient.defaults.baseURL}. ${err?.message || 'Network error'}`,
        };
      }

      set({
        user: appUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      localStorage.setItem('kib_auth_token', token ?? '');
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Login failed' };
    }
  },

  initialize: async () => {
    if (!supabase) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const res = await axiosClient.get<{ user: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ user: res.data.user, token, isAuthenticated: true, isLoading: false });
      localStorage.setItem('kib_auth_token', token);
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  logout: async () => {
    await supabase?.auth.signOut();
    localStorage.removeItem('kib_auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setSession: (user, token) => {
    if (token) localStorage.setItem('kib_auth_token', token);
    else localStorage.removeItem('kib_auth_token');
    set({ user, token, isAuthenticated: !!user });
  },

  clearSession: () => {
    localStorage.removeItem('kib_auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
