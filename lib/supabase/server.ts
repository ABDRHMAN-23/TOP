import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  QUVOTO_SUPABASE_PUBLISHABLE_KEY,
  QUVOTO_SUPABASE_URL,
} from './public-config';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    QUVOTO_SUPABASE_URL,
    QUVOTO_SUPABASE_PUBLISHABLE_KEY,
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
