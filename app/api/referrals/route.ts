import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function rewardMonths(count:number){
 if(count===2)return 12;
 if(count===4)return 6;
 if(count>=8 && (count-8)%6===0)return 12;
 if(count>=10 && (count-10)%6===0)return 6;
 return 0;
}
function nextAnnualMilestone(count:number){
 for(let n=count+1;n<=count+100;n++)if(rewardMonths(n)>0)return n;
 return null;
}
export async function GET(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 let {data:code}=await supabase.from('referral_codes').select('*').eq('user_id',user.id).maybeSingle();
 if(!code){const value=(String(user.id).replaceAll('-','').slice(0,6)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();const r=await supabase.from('referral_codes').insert({user_id:user.id,code:value}).select().single();code=r.data;}
 const [{data:referrals},{data:rewards},{data:sub}]=await Promise.all([
  supabase.from('referrals').select('*').eq('referrer_user_id',user.id).order('created_at',{ascending:false}),
  supabase.from('referral_rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}),
  supabase.from('subscriptions').select('plan,status,billing_interval').eq('user_id',user.id).maybeSingle()
 ]);
 const isAnnualPaid=!!sub&&['starter','pro','team'].includes(sub.plan||'')&&sub.status==='active'&&sub.billing_interval==='year';
 const plan=isAnnualPaid?sub!.plan:'';
 const count=(referrals||[]).filter(r=>(r.status==='qualified'||r.status==='rewarded')&&r.qualifying_plan===plan&&r.qualifying_interval==='year').length;
 return NextResponse.json({code,link:new URL('/ref/'+code.code,req.url).toString(),plan,qualifiedCount:count,nextMilestone:isAnnualPaid?nextAnnualMilestone(count):null,annualOnly:true,referrals:referrals||[],rewards:rewards||[]});
}