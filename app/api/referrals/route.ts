import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 let {data:code}=await supabase.from('referral_codes').select('*').eq('user_id',user.id).maybeSingle();
 if(!code){const value=(String(user.id).replaceAll('-','').slice(0,6)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase(); const r=await supabase.from('referral_codes').insert({user_id:user.id,code:value}).select().single();code=r.data;}
 const [{data:referrals},{data:rewards},{data:sub}]=await Promise.all([
  supabase.from('referrals').select('*').eq('referrer_user_id',user.id).order('created_at',{ascending:false}),
  supabase.from('referral_rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}),
  supabase.from('subscriptions').select('plan,status').eq('user_id',user.id).maybeSingle()
 ]);
 const plan=['starter','pro','team'].includes(sub?.plan||'')&&['active','trialing'].includes(sub?.status||'')?sub!.plan:'';
 const count=(referrals||[]).filter(r=>r.status==='qualified'||r.status==='rewarded').filter(r=>r.qualifying_plan===plan).length;
 const next=count<1?1:count<4?4:count+ (3-((count-1)%3));
 return NextResponse.json({code,link:new URL('/ref/'+code.code,req.url).toString(),plan,qualifiedCount:count,nextMilestone:next,referrals:referrals||[],rewards:rewards||[]});
}