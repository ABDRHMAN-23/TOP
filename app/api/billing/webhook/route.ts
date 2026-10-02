import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'node:crypto';

function verify(raw:string, signature:string){
 const secret=process.env.LEMON_SQUEEZY_WEBHOOK_SECRET; if(!secret) return false;
 const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
 return signature.length===expected.length && crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
function addMonths(value:string|null, months:number){const d=value?new Date(value):new Date();d.setMonth(d.getMonth()+months);return d.toISOString();}
function isAnnualVariant(variant:string){return [process.env.LEMON_SQUEEZY_STARTER_ANNUAL_VARIANT_ID,process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID,process.env.LEMON_SQUEEZY_TEAM_ANNUAL_VARIANT_ID].filter(Boolean).includes(variant);}

// Annual referral milestones: 2 => +12 months, 4 total => +6 months, 8 total => +12 months, then repeat.
function annualRewardMonthsForCount(count:number){
 if(count===2)return 12;
 if(count===4)return 6;
 if(count>=8 && (count-8)%6===0)return 12;
 if(count>=10 && (count-10)%6===0)return 6;
 return 0;
}
// Monthly referral milestones: 1 => +1 month, then every 3 additional qualified referrals.
function monthlyRewardMonthsForCount(count:number){
 return count>=1 && (count-1)%3===0 ? 1 : 0;
}

async function applyPendingRewards(admin:any, uid:string, plan:string, interval:string){
 if(!['month','year'].includes(interval))return;
 const {data:pending}=await admin.from('referral_rewards').select('*')
   .eq('user_id',uid).eq('status','scheduled').eq('redemption_interval',interval)
   .order('earned_at',{ascending:true});
 if(!pending?.length)return;
 const {data:sub}=await admin.from('subscriptions').select('current_period_end').eq('user_id',uid).maybeSingle();
 if(!sub)return;
 for(const reward of pending){
   if(reward.plan!==plan)continue;
   const months=reward.reward_type==='free_year'?12:reward.reward_type==='free_6_months'?6:1;
   const now=new Date().toISOString();
   const {data:claimed}=await admin.from('referral_rewards').update({
     status:'applied',
     applied_at:now
   }).eq('id',reward.id).eq('user_id',uid).eq('status','scheduled').select('id').maybeSingle();
   if(!claimed)continue;
   const {error}=await admin.from('subscriptions').update({
     current_period_end:addMonths(sub.current_period_end,months),
     updated_at:now
   }).eq('user_id',uid);
   if(error){
     await admin.from('referral_rewards').update({status:'scheduled',applied_at:null}).eq('id',reward.id).eq('user_id',uid);
     continue;
   }
   sub.current_period_end=addMonths(sub.current_period_end,months);
   await admin.from('referral_events').insert({
     referral_id:reward.referral_id,
     event_type:'reward_applied',
     metadata:{reward_id:reward.id,reward_months:months,redemption_interval:interval}
   });
 }
}

async function qualifyForUser(admin:any, uid:string){
 const {data:refs}=await admin.from('referrals').select('*').or('referrer_user_id.eq.'+uid+',referred_user_id.eq.'+uid).in('status',['signed_up','subscribed','paid','qualified','rewarded']);
 for(const ref of refs||[]){
  const [{data:referrerSub},{data:referredSub}]=await Promise.all([
   admin.from('subscriptions').select('plan,status,billing_interval,current_period_end').eq('user_id',ref.referrer_user_id).maybeSingle(),
   admin.from('subscriptions').select('plan,status,billing_interval,current_period_end').eq('user_id',ref.referred_user_id).maybeSingle()
  ]);

  const referrerActive=referrerSub&&referrerSub.status==='active'&&['starter','pro','team'].includes(referrerSub.plan);
  const referredActive=referredSub&&referredSub.status==='active'&&['starter','pro','team'].includes(referredSub.plan);
  if(!referrerActive||!referredActive||referrerSub.plan!==referredSub.plan||referrerSub.billing_interval!==referredSub.billing_interval)continue;

  const interval=referrerSub.billing_interval;
  if(interval!=='month'&&interval!=='year')continue;

  if(ref.status!=='qualified'&&ref.status!=='rewarded'){
   await admin.from('referrals').update({
    status:'qualified',
    qualifying_plan:referrerSub.plan,
    qualifying_interval:interval,
    qualified_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
   }).eq('id',ref.id);
  }

  const {count}=await admin.from('referrals').select('id',{count:'exact',head:true})
   .eq('referrer_user_id',ref.referrer_user_id)
   .eq('qualifying_plan',referrerSub.plan)
   .eq('qualifying_interval',interval)
   .in('status',['qualified','rewarded']);

  const qualifiedCount=count||0;
  const rewardMonths=interval==='year'
   ? annualRewardMonthsForCount(qualifiedCount)
   : monthlyRewardMonthsForCount(qualifiedCount);

  if(!rewardMonths)continue;

  const {data:existing}=await admin.from('referral_rewards').select('id')
   .eq('user_id',ref.referrer_user_id)
   .eq('plan',referrerSub.plan)
   .eq('billing_interval',interval)
   .eq('milestone',qualifiedCount)
   .maybeSingle();

  if(existing)continue;

  const now=new Date().toISOString();
  const rewardType=interval==='year'
   ? (rewardMonths===12?'free_year':'free_6_months')
   : 'free_month';

  const {error:rewardError}=await admin.from('referral_rewards').insert({
   user_id:ref.referrer_user_id,
   referral_id:ref.id,
   milestone:qualifiedCount,
   reward_type:rewardType,
   plan:referrerSub.plan,
   billing_interval:interval,
   status:'earned',
   earned_at:now
  });
  if(rewardError)continue;

  await admin.from('subscriptions').update({
   current_period_end:addMonths(referrerSub.current_period_end,rewardMonths),
   updated_at:now
  }).eq('user_id',ref.referrer_user_id);

  await admin.from('referrals').update({status:'rewarded',updated_at:now}).eq('id',ref.id);
  await admin.from('referral_events').insert({
   referral_id:ref.id,
   event_type:'reward_earned',
   metadata:{
    milestone:qualifiedCount,
    reward_months:rewardMonths,
    plan:referrerSub.plan,
    billing_interval:interval
   }
  });
 }
}
export async function POST(req:Request){
 const raw=await req.text(); if(!verify(raw,req.headers.get('x-signature')||''))return NextResponse.json({error:'Invalid signature.'},{status:401});
 let body:any;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const event=String(body?.meta?.event_name||'');const a=body?.data?.attributes||{};const userEmail=a?.user_email||a?.customer_email||body?.meta?.custom_data?.email;const userId=body?.meta?.custom_data?.user_id;if(!userId&&!userEmail)return NextResponse.json({ok:true});
 const admin=createAdminClient();let uid=userId;if(!uid&&userEmail){const {data}=await admin.auth.admin.listUsers({page:1,perPage:1000});uid=data.users.find((u:any)=>u.email?.toLowerCase()===String(userEmail).toLowerCase())?.id;}if(!uid)return NextResponse.json({ok:true});
 const variant=String(a.variant_id||'');const plan=variant===process.env.LEMON_SQUEEZY_TEAM_VARIANT_ID||variant===process.env.LEMON_SQUEEZY_TEAM_ANNUAL_VARIANT_ID?'team':variant===process.env.LEMON_SQUEEZY_PRO_VARIANT_ID||variant===process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID?'pro':variant===process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID||variant===process.env.LEMON_SQUEEZY_STARTER_ANNUAL_VARIANT_ID?'starter':'free';const billingInterval=isAnnualVariant(variant)?'year':'month';
 const active=['subscription_created','subscription_updated','subscription_resumed','subscription_payment_success'].includes(event);const canceled=['subscription_cancelled','subscription_expired'].includes(event);const paymentSuccess=event==='subscription_payment_success';const refundOrFailure=event.includes('refund')||event.includes('failed');
 const {data:existing}=await admin.from('subscriptions').select('current_period_start,current_period_end,billing_interval').eq('user_id',uid).maybeSingle();
 const nextPeriodStart=event==='subscription_created'?(a.created_at?new Date(a.created_at).toISOString():null):paymentSuccess?(existing?.current_period_end||existing?.current_period_start||null):(existing?.current_period_start||(a.created_at?new Date(a.created_at).toISOString():null));
 const {error:upsertError}=await admin.from('subscriptions').upsert({user_id:uid,plan,status:active?'active':canceled?'expired':String(a.status||'active'),billing_interval:billingInterval,ls_subscription_id:String(body?.data?.id||''),ls_customer_id:String(a.customer_id||''),current_period_start:nextPeriodStart,current_period_end:a.renews_at?new Date(a.renews_at).toISOString():(existing?.current_period_end||null),cancel_at_period_end:Boolean(a.cancelled),trial_ends_at:a.trial_ends_at?new Date(a.trial_ends_at).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(upsertError)return NextResponse.json({error:'Could not update subscription.'},{status:500});
 if(paymentSuccess)await qualifyForUser(admin,uid);
 await applyPendingRewards(admin,uid,plan,billingInterval);if(refundOrFailure)await admin.from('referrals').update({status:'under_review',updated_at:new Date().toISOString()}).eq('referred_user_id',uid).in('status',['qualified','rewarded']);return NextResponse.json({ok:true});
}