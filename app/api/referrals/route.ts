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

export async function POST(req:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 let body:any;
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const rewardId=String(body?.rewardId||'');
 const redemptionInterval=String(body?.redemptionInterval||'');
 if(!rewardId||!['month','year'].includes(redemptionInterval)){
   return NextResponse.json({error:'Choose Monthly or Annual.'},{status:400});
 }
 const {data:reward,error:rewardError}=await supabase.from('referral_rewards')
   .select('*').eq('id',rewardId).eq('user_id',user.id).maybeSingle();
 if(rewardError||!reward)return NextResponse.json({error:'Reward not found.'},{status:404});
 if(!['earned','scheduled'].includes(reward.status)){
   return NextResponse.json({error:'This reward is no longer available for selection.'},{status:409});
 }
 if(reward.status==='scheduled' && reward.redemption_interval && reward.redemption_interval===redemptionInterval){
   return NextResponse.json({ok:true,message:'Your reward is already scheduled for this billing track.'});
 }
 const now=new Date().toISOString();
 const {error:updateError}=await supabase.from('referral_rewards').update({
   redemption_interval:redemptionInterval,
   selected_at:now,
   status:'scheduled'
 }).eq('id',rewardId).eq('user_id',user.id).in('status',['earned','scheduled']);
 if(updateError)return NextResponse.json({error:'Could not save your reward choice.'},{status:500});
 return NextResponse.json({
   ok:true,
   message:redemptionInterval==='year'
     ? 'Reward saved for Annual billing. You can choose Monthly for your next unlocked reward.'
     : 'Reward saved for Monthly billing. You can choose Annual for your next unlocked reward.'
 });
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
 const freeNext=Math.max(10,Math.ceil((freeCount+1)/10)*10);
 const monthlyNext=activePaid&&interval==='month'?nextMilestoneFor(monthlyCount,monthlyReward):null;
 const annualNext=activePaid&&interval==='year'?nextMilestoneFor(annualCount,annualRewardMonths):null;
 const badges=[
   {id:'first-share',label:'First Share',description:'Your referral link is ready.',unlocked:true,icon:'↗'},
   {id:'free-builder',label:'Free Builder',description:'10 active Free users.',unlocked:freeCount>=10,icon:'★'},
   {id:'monthly-spark',label:'Monthly Spark',description:'1 qualified same-plan monthly referral.',unlocked:monthlyCount>=1,icon:'◆'},
   {id:'monthly-engine',label:'Monthly Engine',description:'4 qualified same-plan monthly referrals.',unlocked:monthlyCount>=4,icon:'◆'},
   {id:'annual-launch',label:'Annual Launch',description:'2 qualified same-plan annual referrals.',unlocked:annualCount>=2,icon:'✦'},
   {id:'annual-elite',label:'Annual Elite',description:'8 qualified same-plan annual referrals.',unlocked:annualCount>=8,icon:'✦'},
   {id:'referral-legend',label:'Referral Legend',description:'10+ qualified paid referrals across your active plan.',unlocked:(monthlyCount+annualCount)>=10,icon:'♛'}
 ];
 const activeTrack=activePaid&&interval==='year'?'annual':activePaid&&interval==='month'?'monthly':'free';
 const activeNext=activeTrack==='annual'?annualNext:activeTrack==='monthly'?monthlyNext:freeNext;
 const activeCount=activeTrack==='annual'?annualCount:activeTrack==='monthly'?monthlyCount:freeCount;
 const activeReward=activeTrack==='annual'?(annualNext===2?'1 free year':annualNext===4?'6 free months':annualNext&&annualNext%2===0?'1 free year':'next reward') : activeTrack==='monthly'?'1 free month':'1 free Starter month';

 return NextResponse.json({
   code,
   link:code?.code?new URL('/ref/'+code.code,req.url).toString():null,
   plan,
   interval,
   freeCount,
   nextFreeMilestone:freeNext,
   monthlyCount,
   nextMonthlyMilestone:monthlyNext,
   qualifiedCount:annualCount,
   nextMilestone:annualNext,
   activeTrack,
   activeCount,
   activeNext,
   activeReward,
   badges,
   referrals:referrals||[],
   rewards:rewards||[]
 });
}
