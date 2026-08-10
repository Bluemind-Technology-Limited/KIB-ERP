import { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';

/**
 * Auth hook: restores the Supabase session on mount and keeps the store in
 * sync with Supabase auth state changes (sign-in, sign-out, token refresh).
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();

    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Re-fetch the app user whenever Supabase session state changes.
      initialize();
    });
    return () => sub.subscription.unsubscribe();
  }, [initialize]);

  return { user, token, isLoading, isAuthenticated, login, logout };
}
