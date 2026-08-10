import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase client for Auth + Realtime on the frontend.
// Env vars in kib-ERP/.env (see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
} else {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — Auth & Realtime disabled. Add them to kib-ERP/.env'
  );
}

export { supabase };

/**
 * Returns the current access token (JWT) to send to the Express API
 * as `Authorization: Bearer <token>` (see src/lib/axiosClient.ts).
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
