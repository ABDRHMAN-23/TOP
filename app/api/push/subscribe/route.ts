import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_FIELD = 4096;

function validString(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FIELD;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const s = body?.subscription;
  if (!validString(s?.endpoint) || !validString(s?.keys?.p256dh) || !validString(s?.keys?.auth)) {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  }

  const endpoint = String(s.endpoint);
  const p256dh = String(s.keys.p256dh);
  const auth = String(s.keys.auth);

  try {
    new URL(endpoint);
  } catch {
    return NextResponse.json({ error: 'Invalid push endpoint.' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: req.headers.get('user-agent'),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ error: 'Could not save notification settings.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const endpoint = body?.endpoint;
  if (!validString(endpoint)) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) return NextResponse.json({ error: 'Could not remove notification settings.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
