import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { QUVOTO_SUPABASE_PUBLISHABLE_KEY, QUVOTO_SUPABASE_URL } from './public-config';
import { runtimeEnv } from '@/lib/runtime-env';

export async function createClient() {
  const cookieStore = await cookies();
  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL') || QUVOTO_SUPABASE_URL;
  const key = runtimeEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || QUVOTO_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase is not configured in the Cloudflare runtime.');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}
