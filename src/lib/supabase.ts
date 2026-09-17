import { createClient } from '@supabase/supabase-js';

type AuthErrorLike = { message: string };
type AuthSession = { access_token: string; refresh_token: string };
type AuthUser = { id: string };
type SupabaseAuth = {
  getUser: () => Promise<{ data: { user: AuthUser | null }; error: AuthErrorLike | null }>;
  getSession: () => Promise<{ data: { session: AuthSession | null }; error: AuthErrorLike | null }>;
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
    data: { session: AuthSession | null };
    error: AuthErrorLike | null;
  }>;
  setSession: (session: AuthSession) => Promise<{ error: AuthErrorLike | null }>;
  signOut: () => Promise<{ error: AuthErrorLike | null }>;
};
type SupabaseClient = { auth: SupabaseAuth };

const createSupabaseClient = createClient as unknown as (url: string, key: string) => SupabaseClient;

const supabaseUrl =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client is not configured. Set NEXT_PUBLIC_CANFES_SUPABASE_URL and NEXT_PUBLIC_CANFES_SUPABASE_PUBLISHABLE_KEY.');
  }
  supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);
  return supabaseClient;
};

export const setSupabaseAccessToken = (accessToken: string, refreshToken?: string) => {
  // Supabase requires both access and refresh tokens to set a session
  if (accessToken && refreshToken) {
    getSupabaseClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } else {
    // Without refresh token, skip to avoid invalid session state
    console.warn('setSupabaseAccessToken called without refreshToken; skipping setSession');
  }
};
