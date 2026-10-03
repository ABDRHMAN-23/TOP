import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function annualRewardMonths(count:number){
  if(count===2)return 12;
  if(count>=8 && count%4===0)return 12;
  if(count>=4 && count%2===0)return 6;
  return 0;
}
function nextMilestoneFor(count:number, rewardFn:(n:number)=>number){
  for(let n=count+1;n<=count+100;n++) if(rewardFn(n)>0) return n;
  return null;
}
function monthlyReward(count:number){
  return count>=1 && count%2===1 ? 1 : 0;
}

export async function POST(req:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:'Authentication required'},{status:401});

    let body:any;
    try{body=await req.json()}catch{
      return NextResponse.json({error:'Invalid JSON.'},{status:400});
    }

    const action=String(body?.action||'');

    if(action==='select_challenge'){
      const requested=String(body?.challenge||'');
      if(!['free','monthly','annual'].includes(requested)){
        return NextResponse.json({error:'Invalid reward challenge.'},{status:400});
      }

      const [{data:current},{data:referrals}]=await Promise.all([
        supabase.from('referral_challenge_state').select('*').eq('user_id',user.id).maybeSingle(),
        supabase.from('referrals').select('*').eq('referrer_user_id',user.id)
      ]);

      const active=current?.active_challenge||'free';
      if(active===requested)return NextResponse.json({ok:true,challenge:active});

      const {data:sub}=await supabase.from('subscriptions')
        .select('plan,status,billing_interval')
        .eq('user_id',user.id)
        .maybeSingle();

      const activePaid=!!sub&&sub.status==='active'&&['starter','pro','team'].includes(sub.plan||'');
      const plan=activePaid?sub!.plan:'';
      const rows=referrals||[];

      const freeCount=rows.filter((r:any)=>!!r.free_qualified_at).length;
      const monthlyCount=rows.filter((r:any)=>
        ['qualified','rewarded'].includes(r.status)&&r.qualifying_interval==='month'
      ).length;
      const annualCount=rows.filter((r:any)=>
        ['qualified','rewarded'].includes(r.status)&&r.qualifying_interval==='year'
      ).length;

      const {data:earnedRewards}=await supabase.from('referral_rewards')
        .select('id,milestone,status,plan,billing_interval')
        .eq('user_id',user.id)
        .in('status',['earned','applied','scheduled']);

      const rewardRows=earnedRewards||[];

      const freeCompleted=freeCount>=10&&rewardRows.some((r:any)=>
        r.plan==='starter'&&r.billing_interval==='month'&&Number(r.milestone)>=10&&Number(r.milestone)%10===0
      );
      const monthlyCompleted=activePaid&&monthlyCount>=1&&rewardRows.some((r:any)=>
        r.billing_interval==='month'&&Number(r.milestone)>=1&&Number(r.milestone)%2===1
      );
      const annualCompleted=activePaid&&annualCount>=2&&rewardRows.some((r:any)=>
        r.billing_interval==='year'&&Number(r.milestone)>=2&&Number(r.milestone)%2===0
      );

      const completed=active==='free'?freeCompleted:active==='monthly'?monthlyCompleted:annualCompleted;
      if(!completed){
        return NextResponse.json(
          {error:'Complete the active challenge and unlock its real reward before choosing another.'},
          {status:409}
        );
      }

      const now=new Date().toISOString();
      const {error:stateError}=await supabase.from('referral_challenge_state')
        .upsert(
          {user_id:user.id,active_challenge:requested,completed_at:null,updated_at:now},
          {onConflict:'user_id'}
        );

      if(stateError)return NextResponse.json({error:'Could not save your challenge choice.'},{status:500});
      return NextResponse.json({ok:true,challenge:requested});
    }

    const rewardId=String(body?.rewardId||'');
    if(!rewardId)return NextResponse.json({error:'Reward not found.'},{status:400});

    const {data:reward,error:rewardError}=await supabase.from('referral_rewards')
      .select('*')
      .eq('id',rewardId)
      .eq('user_id',user.id)
      .maybeSingle();

    if(rewardError||!reward)return NextResponse.json({error:'Reward not found.'},{status:404});
    if(reward.status!=='earned'){
      return NextResponse.json({error:'This reward is no longer available.'},{status:409});
    }

    const admin=createAdminClient();
    const {data:result,error:applyError}=await admin.rpc('apply_referral_reward',{
      p_reward_id:rewardId,
      p_user_id:user.id
    });

    if(applyError){
      const msg=String(applyError.message||'');
      if(msg.includes('ACTIVE_PAID_SUBSCRIPTION_REQUIRED')){
        return NextResponse.json(
          {error:'Your reward is unlocked, but you need an active paid subscription before it can be applied.'},
          {status:409}
        );
      }
      if(msg.includes('REWARD_NOT_AVAILABLE')){
        return NextResponse.json({error:'This reward is no longer available.'},{status:409});
      }
      if(msg.includes('REWARD_NOT_FOUND')){
        return NextResponse.json({error:'Reward not found.'},{status:404});
      }
      return NextResponse.json({error:'Your reward could not be applied.'},{status:500});
    }

    const months=Number(result?.months||0);
    return NextResponse.json({
      ok:true,
      message:months===12
        ?'Your free year was applied to your current plan.'
        :months===6
          ?'Your 6 free months were applied to your current plan.'
          :'Your free month was applied to your current plan.'
    });
  }catch(error){
    console.error('Rewards API POST failed',error);
    return NextResponse.json(
      {error:'Rewards service is temporarily unavailable. Please try again.'},
      {status:500}
    );
  }
}

export async function GET(req:Request){
 try{
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError) return NextResponse.json({error:'Authentication check failed.'},{status:500});
  if(!user)return NextResponse.json({error:'Authentication required'},{status:401});

  let {data:code,error:codeError}=await supabase.from('referral_codes').select('*').eq('user_id',user.id).maybeSingle();
  if(codeError) return NextResponse.json({error:'Could not load your referral code.'},{status:500});
  if(!code){
    const value=(String(user.id).replaceAll('-','').slice(0,6)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();
    const inserted=await supabase.from('referral_codes').insert({user_id:user.id,code:value}).select().single();
    if(inserted.error||!inserted.data) return NextResponse.json({error:'Could not create your referral code.'},{status:500});
    code=inserted.data;
  }

  let challenge='free';
  const {data:challengeState}=await supabase.from('referral_challenge_state').select('active_challenge').eq('user_id',user.id).maybeSingle();
  if(challengeState?.active_challenge) challenge=challengeState.active_challenge;
  if(!challengeState){
    const now=new Date().toISOString();
    const {data:createdChallenge}=await supabase.from('referral_challenge_state').insert({user_id:user.id,active_challenge:'free',updated_at:now,created_at:now}).select('active_challenge').single();
    if(createdChallenge?.active_challenge) challenge=createdChallenge.active_challenge;
  }

  const [referralsResult,rewardsResult,subResult]=await Promise.all([
    supabase.from('referrals').select('*').eq('referrer_user_id',user.id).order('created_at',{ascending:false}),
    supabase.from('referral_rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}),
    supabase.from('subscriptions').select('plan,status,billing_interval').eq('user_id',user.id).maybeSingle()
  ]);
  if(referralsResult.error||rewardsResult.error||subResult.error){
    return NextResponse.json({error:'Could not load your Rewards data.'},{status:500});
  }
  const {data:referrals}=referralsResult;
  const {data:rewards}=rewardsResult;
  const {data:sub}=subResult;

 const activePaid=!!sub&&['starter','pro','team'].includes(sub.plan||'')&&sub.status==='active';
 const plan=activePaid?sub!.plan:'';
 const interval=activePaid?sub!.billing_interval:'';

 const paidPlans=['starter','pro','team'] as const;
 const monthlyCounts=Object.fromEntries(paidPlans.map(p=>[p,(referrals||[]).filter(r=>['qualified','rewarded'].includes(r.status)&&r.qualifying_plan===p&&r.qualifying_interval==='month').length])) as Record<string,number>;
 const annualCounts=Object.fromEntries(paidPlans.map(p=>[p,(referrals||[]).filter(r=>['qualified','rewarded'].includes(r.status)&&r.qualifying_plan===p&&r.qualifying_interval==='year').length])) as Record<string,number>;
 const annualCount=Object.values(annualCounts).reduce((a,b)=>a+b,0);
 const monthlyCount=Object.values(monthlyCounts).reduce((a,b)=>a+b,0);
 const freeCount=(referrals||[]).filter(r=>!!r.free_qualified_at).length;
 const freeNext=Math.max(10,Math.ceil((freeCount+1)/10)*10);
 const monthlyNext=activePaid?nextMilestoneFor(monthlyCount,monthlyReward):null;
 const annualNext=activePaid?nextMilestoneFor(annualCount,annualRewardMonths):null;
 const nudgeCandidates:any[]=[];
 if(freeCount<freeNext) nudgeCandidates.push({id:'free',track:'free',title:freeNext-freeCount===1?'One more Free user.':'You are close to your Free-user reward.',detail:`${freeNext-freeCount} more qualified Free ${freeNext-freeCount===1?'user':'users'} to unlock ${'1 free Starter month'}.`,remaining:freeNext-freeCount,next:freeNext,count:freeCount});
 if(activePaid&&monthlyNext!=null&&monthlyNext-monthlyCount<=2) nudgeCandidates.push({id:'monthly',track:'monthly',title:monthlyNext-monthlyCount===1?'One paid referral away.':'Your Monthly reward is getting close.',detail:`${monthlyNext-monthlyCount} more same-plan monthly ${monthlyNext-monthlyCount===1?'referral':'referrals'} to unlock 1 free month.`,remaining:monthlyNext-monthlyCount,next:monthlyNext,count:monthlyCount});
 if(activePaid&&annualNext!=null&&annualNext-annualCount<=2) nudgeCandidates.push({id:'annual',track:'annual',title:annualNext-annualCount===1?'One annual referral away.':'Your Annual reward is getting close.',detail:`${annualNext-annualCount} more same-plan annual ${annualNext-annualCount===1?'referral':'referrals'} to unlock your next Annual reward.`,remaining:annualNext-annualCount,next:annualNext,count:annualCount});
 const nudges=nudgeCandidates.sort((a,b)=>a.remaining-b.remaining).slice(0,3);
 const badges=[
   {id:'first-share',label:'First Share',description:'Your referral link is ready.',unlocked:true,icon:'↗'},
   {id:'free-builder',label:'Free Builder',description:'10 active Free users.',unlocked:freeCount>=10,icon:'★'},
   {id:'monthly-spark',label:'Monthly Spark',description:'1 qualified same-plan monthly referral.',unlocked:monthlyCount>=1,icon:'◆'},
   {id:'monthly-engine',label:'Monthly Engine',description:'4 qualified same-plan monthly referrals.',unlocked:monthlyCount>=4,icon:'◆'},
   {id:'annual-launch',label:'Annual Launch',description:'2 qualified same-plan annual referrals.',unlocked:annualCount>=2,icon:'✦'},
   {id:'annual-elite',label:'Annual Elite',description:'8 qualified same-plan annual referrals.',unlocked:annualCount>=8,icon:'✦'},
   {id:'referral-legend',label:'Referral Legend',description:'10+ qualified paid referrals across your active plan.',unlocked:(monthlyCount+annualCount)>=10,icon:'♛'}
 ];
 const timeline=(referrals||[]).flatMap((r:any)=>{
   const items:any[]=[{id:r.id+'-signup',type:'signup',title:'Referral joined QUVOTO',detail:'A new contractor signed up through your referral link.',at:r.signed_up_at||r.created_at}];
   if(r.free_qualified_at) items.push({id:r.id+'-free',type:'free',title:'Free referral qualified',detail:'They created a real quote while staying on Free.',at:r.free_qualified_at});
   if(r.qualified_at) items.push({id:r.id+'-paid',type:r.qualifying_interval==='year'?'annual':'monthly',title:r.qualifying_interval==='year'?'Annual referral qualified':'Monthly referral qualified',detail:'Same-plan paid referral reached the qualification point.',at:r.qualified_at});
   return items;
 }).sort((a:any,b:any)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,20);
 const totalPaid=monthlyCount+annualCount;
 const totalQualified=freeCount+totalPaid;
 const loyaltyLevel=totalQualified>=50?{name:'QUVOTO Legend',next:null}:totalQualified>=25?{name:'QUVOTO Champion',next:50}:totalQualified>=10?{name:'QUVOTO Builder',next:25}:{name:'QUVOTO Starter',next:10};
 const loyaltyProgress=loyaltyLevel.next?Math.min(100,(totalQualified/loyaltyLevel.next)*100):100;
 const nextLoyalty=loyaltyLevel.next?Math.max(0,loyaltyLevel.next-totalQualified):0;
 const activeTrack=challenge;
 const activeNext=activeTrack==='annual'?annualNext:activeTrack==='monthly'?monthlyNext:freeNext;
 const activeCount=activeTrack==='annual'?annualCount:activeTrack==='monthly'?monthlyCount:freeCount;
 const activeCounts=activeTrack==='annual'?annualCounts:activeTrack==='monthly'?monthlyCounts:{starter:freeCount,pro:0,team:0};
 const activeReward=activeTrack==='annual'
   ? (annualNext==null?'next reward':annualRewardMonths(annualNext)===12?'1 free year':annualRewardMonths(annualNext)===6?'6 free months':'next reward')
   : activeTrack==='monthly'?'1 free month':'1 free Starter month';
 const rewardRows=rewards||[];
 const freeCompleted=freeCount>=10 && rewardRows.some((r:any)=>['earned','applied','scheduled'].includes(r.status)&&r.plan==='starter'&&r.billing_interval==='month'&&Number(r.milestone)>=10&&Number(r.milestone)%10===0);
 const monthlyCompleted=activePaid && monthlyCount>=1 && rewardRows.some((r:any)=>['earned','applied','scheduled'].includes(r.status)&&r.plan===plan&&r.billing_interval==='month'&&Number(r.milestone)>=1&&Number(r.milestone)%2===1);
 const annualCompleted=activePaid && annualCount>=2 && rewardRows.some((r:any)=>['earned','applied','scheduled'].includes(r.status)&&r.plan===plan&&r.billing_interval==='year'&&Number(r.milestone)>=2&&Number(r.milestone)%2===0);
 const activeChallengeCompleted=activeTrack==='free'?freeCompleted:activeTrack==='monthly'?monthlyCompleted:annualCompleted;

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
   challenge,
   activeTrack,
   activeCount,
   activeNext,
   activeReward,
   activeCounts,
   monthlyCounts,
   annualCounts,
   activeChallengeCompleted,
   badges,
   referrals:referrals||[],
   rewards:rewards||[],
   timeline,
   nudges,
   loyalty:{level:loyaltyLevel.name,totalQualified,next:loyaltyLevel.next,remaining:nextLoyalty,progress:loyaltyProgress}
 });
 }catch(error){
   console.error('Rewards API GET failed',error);
   return NextResponse.json({error:'Rewards service is temporarily unavailable. Please try again.'},{status:500});
 }
}