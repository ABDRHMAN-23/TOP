import { createClient } from '@supabase/supabase-js';
import { runtimeEnv } from '@/lib/runtime-env';
import { QUVOTO_SUPABASE_URL } from './public-config';

export function createAdminClient() {
  const key = runtimeEnv('SUPABASE_SECRET_KEY') || runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Server Supabase secret is not configured.');

  return createClient(QUVOTO_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
