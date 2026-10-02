import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED = new Set(['draft','sent','accepted']);

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const status = String(body.status || '');
  const id = String(body.id || '');
  if (!id || !ALLOWED.has(status)) return NextResponse.json({ error: 'Invalid quote status.' }, { status: 400 });
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === 'sent') patch.sent_at = new Date().toISOString();
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  const { data, error } = await supabase.from('quotes').update(patch).eq('id', id).eq('user_id', user.id).select('id,status,sent_at,accepted_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
