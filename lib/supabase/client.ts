import { createBrowserClient } from '@supabase/ssr';
import { QUVOTO_SUPABASE_PUBLISHABLE_KEY, QUVOTO_SUPABASE_URL } from './public-config';

export function createClient() {
  return createBrowserClient(QUVOTO_SUPABASE_URL, QUVOTO_SUPABASE_PUBLISHABLE_KEY);
}
