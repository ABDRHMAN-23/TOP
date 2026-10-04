import { createServerClient } from '@supabase/ssr';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const { env } = getCloudflareContext();
    const runtimeEnv = env as unknown as Record<string, string | undefined>;
    supabaseUrl = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
    supabasePublishableKey =
      runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || supabasePublishableKey;
  } catch {}

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
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
    },
  );

  try {
    await supabase.auth.getClaims();
  } catch {}

  return response;
}
