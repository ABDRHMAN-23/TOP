import type { SupabaseClient } from '@supabase/supabase-js';

export async function qualifyFreeReferralAndReward(admin: SupabaseClient, referredUserId: string) {
  const { data: referral } = await admin
    .from('referrals')
    .select('id,referrer_user_id,free_qualified_at,free_rewarded_at,status')
    .eq('referred_user_id', referredUserId)
    .neq('status','revoked')
    .maybeSingle();

  if (!referral || referral.free_qualified_at) return;

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan,status')
    .eq('user_id', referredUserId)
    .maybeSingle();

  if (!subscription || subscription.plan !== 'free' || subscription.status !== 'active') return;

  const now = new Date().toISOString();
  const { error: markError } = await admin
    .from('referrals')
    .update({ free_qualified_at: now, updated_at: now })
    .eq('id', referral.id)
    .is('free_qualified_at', null);

  if (markError) return;

  const { data: qualified } = await admin
    .from('referrals')
    .select('id')
    .eq('referrer_user_id', referral.referrer_user_id)
    .not('free_qualified_at','is',null);

  const count = qualified?.length || 0;
  if (count < 10 || count % 10 !== 0) return;

  const { data: existing } = await admin
    .from('referral_rewards')
    .select('id')
    .eq('user_id', referral.referrer_user_id)
    .eq('plan','starter')
    .eq('billing_interval','month')
    .eq('milestone',count)
    .maybeSingle();

  if (existing) return;

  const { data: referrerSub } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', referral.referrer_user_id)
    .maybeSingle();

  const start = new Date();
  const currentEnd = referrerSub?.current_period_end ? new Date(referrerSub.current_period_end) : null;
  const base = currentEnd && currentEnd > start ? currentEnd : start;
  const end = new Date(base);
  end.setMonth(end.getMonth() + 1);

  let rewardStatus: 'applied' | 'earned' = 'applied';
  let scheduledFor: string | null = null;
  let appliedAt: string | null = now;

  if (referrerSub?.plan === 'pro' || referrerSub?.plan === 'team') {
    rewardStatus = 'earned';
    scheduledFor = referrerSub.current_period_end || null;
    appliedAt = null;
  } else if (referrerSub) {
    const payload = {
      plan: 'starter',
      status: 'active',
      billing_interval: 'month',
      current_period_start: referrerSub.current_period_start || start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
      updated_at: now
    };
    const { error } = await admin.from('subscriptions').update(payload).eq('user_id', referral.referrer_user_id);
    if (error) return;
  } else {
    const { error } = await admin.from('subscriptions').insert({
      user_id: referral.referrer_user_id,
      plan: 'starter',
      status: 'active',
      billing_interval: 'month',
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false
    });
    if (error) return;
  }

  const { error: rewardError } = await admin.from('referral_rewards').insert({
    user_id: referral.referrer_user_id,
    referral_id: referral.id,
    milestone: count,
    reward_type: 'free_month',
    plan: 'starter',
    status: rewardStatus,
    billing_interval: 'month',
    scheduled_for: scheduledFor,
    applied_at: appliedAt
  });

  if (rewardError) return;

  await admin
    .from('referrals')
    .update({ free_rewarded_at: now, updated_at: now })
    .eq('id', referral.id);

  await admin.from('referral_events').insert({
    referral_id: referral.id,
    event_type: 'free_activity_reward_earned',
    metadata: {
      milestone: count,
      reward_months: 1,
      plan: 'starter',
      billing_interval: 'month',
      trigger: 'referred_free_user_created_first_quote'
    }
  });
}
