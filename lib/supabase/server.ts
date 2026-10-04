import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

async function getSupabaseRuntimeEnv() {
  const context = await getCloudflareContext({ async: true });
  const env = context.env as unknown as Record<string, string | undefined>;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = await getSupabaseRuntimeEnv();

  if (!url || !key) {
    throw new Error('Supabase is not configured in the Cloudflare runtime.');
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
