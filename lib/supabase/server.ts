import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

async function getSupabaseRuntimeEnv() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as Record<string, string | undefined>;
    url = env.NEXT_PUBLIC_SUPABASE_URL || url;
    key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || key;
  } catch {}

  return { url, key };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = await getSupabaseRuntimeEnv();

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
