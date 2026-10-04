import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { QUVOTO_SUPABASE_PUBLISHABLE_KEY, QUVOTO_SUPABASE_URL } from './public-config';
import { runtimeEnv } from '../runtime-env';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL') || QUVOTO_SUPABASE_URL;
  const supabasePublishableKey =
    runtimeEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || QUVOTO_SUPABASE_PUBLISHABLE_KEY;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {}

  return response;
}
