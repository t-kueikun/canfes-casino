import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

export const setSupabaseAccessToken = (accessToken: string, refreshToken?: string) => {
  // Supabase requires both access and refresh tokens to set a session
  if (accessToken && refreshToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } else {
    // Without refresh token, skip to avoid invalid session state
    console.warn('setSupabaseAccessToken called without refreshToken; skipping setSession');
  }
};
