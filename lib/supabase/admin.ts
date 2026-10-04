import { createClient } from '@supabase/supabase-js';
import { runtimeEnv } from '@/lib/runtime-env';
import { QUVOTO_SUPABASE_URL } from './public-config';

export function createAdminClient() {
  const key = runtimeEnv('SUPABASE_SECRET_KEY') || runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Server Supabase secret is not configured.');

  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL') || QUVOTO_SUPABASE_URL;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
