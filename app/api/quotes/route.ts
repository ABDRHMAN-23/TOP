import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { qualifyFreeReferralAndReward } from '@/lib/free-referrals';
import { notifyUser } from '@/lib/notifications';

function mapQuoteError(message: string) {
  if (message.startsWith('QUOTE_LIMIT:')) {
    const [, plan, used, quota] = message.split(':');
    return NextResponse.json(
      { error: 'You have reached your ' + plan + ' plan limit of ' + quota + ' quotes this month.', code: 'QUOTE_LIMIT', used: Number(used), quota: Number(quota), plan },
      { status: 402 }
    );
  }
  if (message.startsWith('FEATURE_TEMPLATE_LOCKED:')) return NextResponse.json({ error: 'That PDF template is not included in your current plan.', code: 'FEATURE_TEMPLATE_LOCKED' }, { status: 402 });
  if (message.startsWith('FEATURE_CURRENCY_LOCKED:')) return NextResponse.json({ error: 'That currency is not included in your current plan.', code: 'FEATURE_CURRENCY_LOCKED' }, { status: 402 });
  if (message.startsWith('FEATURE_LANGUAGE_LOCKED:')) return NextResponse.json({ error: 'That language is not included in your current plan.', code: 'FEATURE_LANGUAGE_LOCKED' }, { status: 402 });
  return NextResponse.json({ error: message || 'Could not create quote.' }, { status: 400 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const items = Array.isArray(body.items) ? body.items : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const vatRate = Number(body.vat_rate || 0);
  const discount = Number(body.discount || 0);

  const { data, error } = await supabase.rpc('create_quote', {
    p_client_name: body.client_name ?? null,
    p_client_email: body.client_email ?? null,
    p_client_phone: body.client_phone ?? null,
    p_client_address: body.client_address ?? null,
    p_items: items,
    p_notes: notes,
    p_currency: body.currency ?? 'GBP',
    p_template: body.template ?? 'modern',
    p_language: body.language ?? 'en',
    p_vat_rate: Number.isFinite(vatRate) ? vatRate : 0,
    p_discount: Number.isFinite(discount) ? discount : 0
  }).single();

  if (error) {
    if (error.message.includes('AUTH_REQUIRED')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    return mapQuoteError(error.message);
  }

  try { await qualifyFreeReferralAndReward(createAdminClient(), user.id); } catch { /* referral rewards must never block quote creation */ }

  await notifyUser(user.id, {
    title: 'Quote ready',
    body: data?.quote_number ? 'Quote #' + data.quote_number + ' is ready for your review.' : 'Your new quote is ready for review.',
    type: 'quote_created',
    link: '/workspace',
    tag: 'quote-created',
    dedupeKey: 'quote-created:' + String(data?.id || data?.quote_number || crypto.randomUUID())
  });

  return NextResponse.json(data);
}