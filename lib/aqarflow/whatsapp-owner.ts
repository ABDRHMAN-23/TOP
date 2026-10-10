import { createClient } from '@/lib/supabase/server';

export type OwnerAccess =
  | { ok: true; ownerUserId: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

export async function requireOwnerAccount(): Promise<OwnerAccess> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch { return { ok: false, status: 503, message: 'Authentication service unavailable.' }; }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, message: 'Authentication required.' };

  const { data: memberships, error: membershipError } = await supabase
    .from('team_memberships').select('owner_id').eq('member_id', data.user.id)
    .neq('owner_id', data.user.id).limit(1);
  if (membershipError) return { ok: false, status: 503, message: 'Workspace membership could not be verified.' };
  if ((memberships || []).length > 0) {
    return { ok: false, status: 403, message: 'Only the workspace owner can configure or send WhatsApp messages in this initial integration.' };
  }
  return { ok: true, ownerUserId: data.user.id };
}
