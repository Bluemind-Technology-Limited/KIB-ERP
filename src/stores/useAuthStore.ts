import { create } from 'zustand';
import { type User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  setSession: (user: User | null, token: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setSession: (user, token) => {
    if (token) localStorage.setItem('kib_auth_token', token);
    else localStorage.removeItem('kib_auth_token');
    set({ user, token });
  },
  clearSession: () => {
    localStorage.removeItem('kib_auth_token');
    set({ user: null, token: null });
  },
}));
