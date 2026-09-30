import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await req.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const subtotal = items.reduce((sum: number, item: { quantity?: number; price?: number }) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
  const vatRate = Number(body.vat_rate || 0);
  const vatAmount = subtotal * vatRate / 100;
  const discount = Number(body.discount || 0);
  const total = Math.max(0, subtotal + vatAmount - discount);

  const { data, error } = await supabase.from('quotes').insert({
    user_id: user.id,
    client_name: body.client_name ?? null,
    client_email: body.client_email ?? null,
    client_phone: body.client_phone ?? null,
    client_address: body.client_address ?? null,
    items,
    notes,
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    discount,
    total,
    currency: body.currency ?? 'GBP',
    template: body.template ?? 'modern',
    language: body.language ?? 'en',
    status: 'draft'
  }).select('id, quote_number, public_token, total').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const admin = createAdminClient();
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    const month = periodStart.toISOString().slice(0, 10);
    const { data: usage } = await admin.from('usage').select('quotes_count').eq('user_id', user.id).eq('period_start', month).maybeSingle();
    await admin.from('usage').upsert({
      user_id: user.id,
      period_start: month,
      quotes_count: Number(usage?.quotes_count || 0) + 1
    }, { onConflict: 'user_id,period_start' });
  } catch {
    // Quote creation must remain available even before the server secret is configured.
  }

  return NextResponse.json(data);
}
