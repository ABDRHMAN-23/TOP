import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLAN_CATALOG, normalizePlan } from '@/lib/billing/plans';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const [{ data: subscription }, { data: usage }] = await Promise.all([
    supabase.from('subscriptions').select('plan,status,current_period_end').eq('user_id', user.id).maybeSingle(),
    supabase.from('usage').select('quotes_count,period_start').eq('user_id', user.id).order('period_start', { ascending: false }).limit(1).maybeSingle()
  ]);

  const plan = normalizePlan(subscription?.status === 'active' || subscription?.status === 'trialing' ? subscription?.plan : 'free');
  const catalog = PLAN_CATALOG[plan];
  const used = Number(usage?.quotes_count || 0);
  const quota = Number.isFinite(catalog.quoteLimit) ? catalog.quoteLimit : null;

  return NextResponse.json({
    plan,
    billingConfigured: Boolean(process.env.LEMON_SQUEEZY_API_KEY && process.env.LEMON_SQUEEZY_STORE_ID),
    label: catalog.label,
    price: catalog.price,
    used,
    quota,
    remaining: quota === null ? null : Math.max(0, quota - used),
    periodStart: usage?.period_start || null,
    periodEnd: subscription?.current_period_end || null,
    templates: catalog.templates,
    currencies: catalog.currencies,
    languages: catalog.languages,
    features: catalog.features
  });
}