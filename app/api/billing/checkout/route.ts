import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runtimeEnv } from '@/lib/runtime-env';
import { createAdminClient } from '@/lib/supabase/admin';

const LEGAL_VERSION='2026-10-02';
export async function POST(req: Request) {
 const VARIANTS: Record<string,string|undefined> = {
  starter: runtimeEnv('LEMON_SQUEEZY_STARTER_VARIANT_ID'),
  pro: runtimeEnv('LEMON_SQUEEZY_PRO_VARIANT_ID'),
  team: runtimeEnv('LEMON_SQUEEZY_TEAM_VARIANT_ID')
 };
 const ANNUAL_VARIANTS: Record<string,string|undefined> = {
  starter: runtimeEnv('LEMON_SQUEEZY_STARTER_ANNUAL_VARIANT_ID'),
  pro: runtimeEnv('LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID'),
  team: runtimeEnv('LEMON_SQUEEZY_TEAM_ANNUAL_VARIANT_ID')
 };

 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:'Authentication required'},{status:401});

 const admin=createAdminClient();
 const {data:consent}=await admin.from('legal_consents').select('id').eq('user_id',user.id).eq('terms_version',LEGAL_VERSION).eq('privacy_version',LEGAL_VERSION).order('accepted_at',{ascending:false}).limit(1).maybeSingle();
 if(!consent)return NextResponse.json({error:'Please accept the current Terms of Service and acknowledge the Privacy Policy before purchasing.'},{status:403});

 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const plan=String(body.plan||'');
 const interval=body.interval==='year'?'year':'month';
 const variant=(interval==='year'?ANNUAL_VARIANTS:VARIANTS)[plan];
 if(!['starter','pro','team'].includes(plan)||!variant||!runtimeEnv('LEMON_SQUEEZY_API_KEY')||!runtimeEnv('LEMON_SQUEEZY_STORE_ID'))return NextResponse.json({error:'Billing checkout is not configured for this plan yet.'},{status:503});

 const rawCode=String(body.discountCode||'').trim().toUpperCase();
 let discount:any=null;
 if(rawCode){
  const {data:d,error}=await admin.from('discount_codes').select('*').eq('code',rawCode).eq('active',true).maybeSingle();
  if(error)return NextResponse.json({error:'Could not validate the discount code.'},{status:500});
  if(!d)return NextResponse.json({error:'Invalid or inactive discount code.'},{status:400});
  const now=Date.now();
  if(d.starts_at&&new Date(d.starts_at).getTime()>now)return NextResponse.json({error:'This discount is not active yet.'},{status:400});
  if(d.expires_at&&new Date(d.expires_at).getTime()<=now)return NextResponse.json({error:'This discount has expired.'},{status:400});
  if(!d.applies_to_plans.includes(plan)||!d.applies_to_intervals.includes(interval))return NextResponse.json({error:'This discount does not apply to the selected plan or billing interval.'},{status:400});
  if(d.max_redemptions!==null){
   const {count}=await admin.from('discount_redemptions').select('id',{count:'exact',head:true}).eq('discount_id',d.id);
   if((count||0)>=d.max_redemptions)return NextResponse.json({error:'This discount has reached its redemption limit.'},{status:400});
  }
  if(d.max_redemptions_per_user!==null){
   const {count}=await admin.from('discount_redemptions').select('id',{count:'exact',head:true}).eq('discount_id',d.id).eq('user_id',user.id);
   if((count||0)>=d.max_redemptions_per_user)return NextResponse.json({error:'You have already used this discount the maximum allowed times.'},{status:400});
  }
  discount=d;
 }

 const origin=new URL(req.url).origin;
 const checkoutData:any={email:user.email,custom:{user_id:user.id,email:user.email,plan,interval,...(discount?{discount_code:discount.code,discount_id:discount.id}:{})}};
 if(discount)checkoutData.discount_code=discount.code;
 const res=await fetch('https://api.lemonsqueezy.com/v1/checkouts',{method:'POST',headers:{Authorization:'Bearer '+runtimeEnv('LEMON_SQUEEZY_API_KEY'),'Content-Type':'application/vnd.api+json','Accept':'application/vnd.api+json'},body:JSON.stringify({data:{type:'checkouts',attributes:{checkout_data:checkoutData,product_options:{redirect_url:origin+'/dashboard',receipt_button_text:'Return to QUVOTO'},checkout_options:{embed:false}},relationships:{store:{data:{type:'stores',id:String(runtimeEnv('LEMON_SQUEEZY_STORE_ID'))}},variant:{data:{type:'variants',id:String(variant)}}}}})});
 if(!res.ok){
  const errorBody=await res.json().catch(()=>null);
  return NextResponse.json({error:errorBody?.errors?.[0]?.detail||'Could not create checkout.'},{status:502});
 }
 const data=await res.json();const url=data?.data?.attributes?.url;
 if(!url)return NextResponse.json({error:'Checkout URL was not returned.'},{status:502});
 return NextResponse.json({url});
}