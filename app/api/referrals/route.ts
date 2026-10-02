import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function nextAnnualMilestone(count:number){
 if(count<2)return 2;
 if(count<4)return 4;
 if(count<8)return 8;
 const offset=count-8;
 return offset%6===0?count+2:8+Math.ceil(offset/6)*6;
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