import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications';

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
  const { data: before } = await supabase.from('quotes').select('id,quote_number,client_name,status').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  if (before.status === 'accepted' && status !== 'accepted') return NextResponse.json({ error: 'An accepted quote cannot be moved back to another status.' }, { status: 409, code: 'QUOTE_ACCEPTED_FINAL' });
  if (before.status === status) return NextResponse.json(before);

  const { data, error } = await supabase.from('quotes').update(patch).eq('id', id).eq('user_id', user.id).select('id,status,sent_at,accepted_at,quote_number,client_name').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const label = data.quote_number ? 'Quote #' + data.quote_number : 'Your quote';
  if (status === 'sent') await notifyUser(user.id, {
    title: 'Quote sent',
    body: label + (data.client_name ? ' for ' + data.client_name : '') + ' is now marked as sent.',
    type: 'quote_sent', link: '/workspace', tag: 'quote-sent', dedupeKey: 'quote-sent:' + id
  });
  if (status === 'accepted') await notifyUser(user.id, {
    title: 'Quote accepted 🎉',
    body: label + (data.client_name ? ' for ' + data.client_name : '') + ' was marked accepted.',
    type: 'quote_accepted', link: '/workspace', tag: 'quote-accepted', dedupeKey: 'quote-accepted:' + id
  });

  return NextResponse.json(data);
}
