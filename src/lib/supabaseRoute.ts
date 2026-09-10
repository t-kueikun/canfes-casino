import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, AuthError, User } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_CANFES_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey =
  process.env.CANFES_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabaseRoute] Missing Supabase URL or publishable key');
}
if (!supabaseServiceKey) {
  console.warn('[supabaseRoute] Missing Supabase service key; some APIs require it.');
}

const BEARER_PATTERN = /^bearer\s+/i;

const extractBearer = (request?: Request): string | null => {
  if (!request) return null;
  const raw = request.headers.get('authorization');
  if (!raw) return null;
  if (!BEARER_PATTERN.test(raw)) return null;
  const token = raw.replace(BEARER_PATTERN, '').trim();
  return token || null;
};

export const getSupabaseRouteClient = async (request?: Request) => {
  const cookieStore = await cookies();
  const bearer = extractBearer(request);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name) {
        cookieStore.delete(name);
      },
    },
    global: bearer
      ? {
          headers: {
            Authorization: `Bearer ${bearer}`,
          },
        }
      : undefined,
  });
};

let serviceClient: SupabaseClient | null = null;

export const getSupabaseServiceClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[supabaseRoute] service client requires a Supabase service key');
  }
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serviceClient;
};

type RouteAuthResult = {
  user: User | null;
  error: AuthError | null;
};

export const resolveRouteAuth = async (
  request: Request,
  supabase: SupabaseClient,
): Promise<RouteAuthResult> => {
  const {
    data: { user: cookieUser },
    error: cookieError,
  } = await supabase.auth.getUser();

  if (cookieUser) {
    return { user: cookieUser, error: cookieError ?? null };
  }

  const token = extractBearer(request);
  if (!token) {
    return { user: null, error: cookieError ?? null };
  }

  const {
    data: { user: headerUser },
    error: headerError,
  } = await supabase.auth.getUser(token);

  if (headerUser) {
    return { user: headerUser, error: headerError ?? null };
  }

  return { user: null, error: headerError ?? cookieError ?? null };
};
