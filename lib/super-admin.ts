import { createClient } from '@/lib/supabase/server';

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false };
  const configuredId = process.env.QUVOTO_SUPER_ADMIN_USER_ID;
  const configuredEmail = process.env.QUVOTO_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const allowed = Boolean(
    (configuredId && user.id === configuredId) ||
    (configuredEmail && user.email?.toLowerCase() === configuredEmail)
  );
  return { supabase, user, allowed };
}
