import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function annualRewardMonths(count:number){
  if(count===2)return 12;
  if(count===4)return 6;
  if(count>=8 && (count-8)%6===0)return 12;
  if(count>=10 && (count-10)%6===0)return 6;
  return 0;
}
function nextMilestoneFor(count:number, rewardFn:(n:number)=>number){
  for(let n=count+1;n<=count+100;n++) if(rewardFn(n)>0) return n;
  return null;
}
function monthlyReward(count:number){
  return count>=1 && (count-1)%3===0 ? 1 : 0;
}

export async function GET(req:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});

 let {data:code}=await supabase.from('referral_codes').select('*').eq('user_id',user.id).maybeSingle();
 if(!code){
   const value=(String(user.id).replaceAll('-','').slice(0,6)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();
   const r=await supabase.from('referral_codes').insert({user_id:user.id,code:value}).select().single();
   code=r.data;
 }

 const [{data:referrals},{data:rewards},{data:sub}]=await Promise.all([
  supabase.from('referrals').select('*').eq('referrer_user_id',user.id).order('created_at',{ascending:false}),
  supabase.from('referral_rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}),
  supabase.from('subscriptions').select('plan,status,billing_interval').eq('user_id',user.id).maybeSingle()
 ]);

 const activePaid=!!sub&&['starter','pro','team'].includes(sub.plan||'')&&sub.status==='active';
 const plan=activePaid?sub!.plan:'';
 const interval=activePaid?sub!.billing_interval:'';

 const annualCount=(referrals||[]).filter(r=>
   ['qualified','rewarded'].includes(r.status) &&
   r.qualifying_plan===plan &&
   r.qualifying_interval==='year'
 ).length;

 const monthlyCount=(referrals||[]).filter(r=>
   ['qualified','rewarded'].includes(r.status) &&
   r.qualifying_plan===plan &&
   r.qualifying_interval==='month'
 ).length;

 const freeCount=(referrals||[]).filter(r=>!!r.free_qualified_at).length;
 const freeNext=freeCount>0 && freeCount%10===0 ? freeCount+10 : Math.ceil((freeCount+1)/10)*10;

 return NextResponse.json({
   code,
   link:code?.code?new URL('/ref/'+code.code,req.url).toString():null,
   plan,
   interval,
   freeCount,
   nextFreeMilestone:freeNext,
   monthlyCount,
   nextMonthlyMilestone:activePaid&&interval==='month'?nextMilestoneFor(monthlyCount,monthlyReward):null,
   qualifiedCount:annualCount,
   nextMilestone:activePaid&&interval==='year'?nextMilestoneFor(annualCount,annualRewardMonths):null,
   referrals:referrals||[],
   rewards:rewards||[]
 });
}
