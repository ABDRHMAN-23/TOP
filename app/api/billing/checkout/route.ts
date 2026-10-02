import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VARIANTS: Record<string,string|undefined> = {
 starter: process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID,
 pro: process.env.LEMON_SQUEEZY_PRO_VARIANT_ID,
 team: process.env.LEMON_SQUEEZY_TEAM_VARIANT_ID
};
const ANNUAL_VARIANTS: Record<string,string|undefined> = {
 starter: process.env.LEMON_SQUEEZY_STARTER_ANNUAL_VARIANT_ID,
 pro: process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID,
 team: process.env.LEMON_SQUEEZY_TEAM_ANNUAL_VARIANT_ID
};

export async function POST(req: Request) {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:'Authentication required'},{status:401});
 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const plan=String(body.plan||'');
 const interval=body.interval==='year'?'year':'month';
 const variant=(interval==='year'?ANNUAL_VARIANTS:VARIANTS)[plan];
 if(!['starter','pro','team'].includes(plan)||!variant||!process.env.LEMON_SQUEEZY_API_KEY||!process.env.LEMON_SQUEEZY_STORE_ID)return NextResponse.json({error:'Billing checkout is not configured for this plan yet.'},{status:503});
 const origin=new URL(req.url).origin;
 const res=await fetch('https://api.lemonsqueezy.com/v1/checkouts',{method:'POST',headers:{Authorization:'Bearer '+process.env.LEMON_SQUEEZY_API_KEY,'Content-Type':'application/vnd.api+json','Accept':'application/vnd.api+json'},body:JSON.stringify({data:{type:'checkouts',attributes:{checkout_data:{email:user.email,custom:{user_id:user.id,email:user.email,plan,interval}},product_options:{redirect_url:origin+'/dashboard',receipt_button_text:'Return to QUVOTO'},checkout_options:{embed:false}},relationships:{store:{data:{type:'stores',id:String(process.env.LEMON_SQUEEZY_STORE_ID)}},variant:{data:{type:'variants',id:String(variant)}}}}})});
 if(!res.ok)return NextResponse.json({error:'Could not create checkout.'},{status:502});
 const data=await res.json();const url=data?.data?.attributes?.url;
 if(!url)return NextResponse.json({error:'Checkout URL was not returned.'},{status:502});
 return NextResponse.json({url});
}