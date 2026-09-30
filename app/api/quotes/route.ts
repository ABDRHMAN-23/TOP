import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabase.from('quotes').insert({
    user_id: user.id,
    client_name: body.client_name ?? null,
    client_email: body.client_email ?? null,
    client_phone: body.client_phone ?? null,
    client_address: body.client_address ?? null,
    items: Array.isArray(body.items) ? body.items : [],
    notes: Array.isArray(body.notes) ? body.notes : [],
    currency: body.currency ?? 'GBP',
    template: body.template ?? 'modern',
    language: body.language ?? 'en',
    status: 'draft'
  }).select('id, quote_number, public_token').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
