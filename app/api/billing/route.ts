import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runtimeEnv } from '@/lib/runtime-env';
import { PLAN_CATALOG, normalizePlan } from '@/lib/billing/plans';

function errorResponse(stage: string, error: unknown) {
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Billing request failed.',
    stage,
  }, { status: 500 });
}

export async function GET() {
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (error) {
      return errorResponse('supabase_client', error);
    }

    let user;
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      if (result.error && !user) {
        return NextResponse.json(
          { error: 'Authentication required', stage: 'auth' },
          { status: 401 }
        );
      }
    } catch (error) {
      return errorResponse('auth', error);
    }

    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    let membership: { owner_id: string } | null = null;
    try {
      const result = await supabase
        .from('team_memberships')
        .select('owner_id')
        .eq('member_id', user.id)
        .neq('owner_id', user.id)
        .maybeSingle();
      if (result.error) return errorResponse('team_memberships', result.error);
      membership = result.data;
    } catch (error) {
      return errorResponse('team_memberships', error);
    }

    const billingOwnerId = membership?.owner_id || user.id;

    let subscription = null;
    let usage = null;
    try {
      const [subscriptionResult, usageResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('plan,status,current_period_end,billing_interval')
          .eq('user_id', billingOwnerId)
          .maybeSingle(),
        supabase
          .from('usage')
          .select('quotes_count,period_start')
          .eq('user_id', billingOwnerId)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (subscriptionResult.error) return errorResponse('subscriptions', subscriptionResult.error);
      if (usageResult.error) return errorResponse('usage', usageResult.error);

      subscription = subscriptionResult.data;
      usage = usageResult.data;
    } catch (error) {
      return errorResponse('billing_queries', error);
    }

    const plan = normalizePlan(
      subscription?.status === 'active' || subscription?.status === 'trialing'
        ? subscription?.plan
        : 'free'
    );
    const catalog = PLAN_CATALOG[plan];
    const used = Number(usage?.quotes_count || 0);
    const quota = Number.isFinite(catalog.quoteLimit) ? catalog.quoteLimit : null;

    return NextResponse.json({
      plan,
      billingConfigured: Boolean(
        runtimeEnv('LEMON_SQUEEZY_API_KEY') && runtimeEnv('LEMON_SQUEEZY_STORE_ID')
      ),
      label: catalog.label,
      price: subscription?.billing_interval === 'year' ? catalog.annualPrice : catalog.price,
      monthlyPrice: catalog.price,
      annualPrice: catalog.annualPrice,
      billingInterval: subscription?.billing_interval || null,
      used,
      quota,
      remaining: quota === null ? null : Math.max(0, quota - used),
      periodStart: usage?.period_start || null,
      periodEnd: subscription?.current_period_end || null,
      templates: catalog.templates,
      currencies: catalog.currencies,
      languages: catalog.languages,
      features: catalog.features,
    });
  } catch (error) {
    return errorResponse('unexpected', error);
  }
}
