import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'node:crypto';

function verify(raw:string, signature:string){
 const secret=process.env.LEMON_SQUEEZY_WEBHOOK_SECRET; if(!secret) return false;
 const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
 return signature.length===expected.length && crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
export async function POST(req:Request){
 const raw=await req.text();
 if(!verify(raw,req.headers.get('x-signature')||'')) return NextResponse.json({error:'Invalid signature.'},{status:401});
 let body:any; try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const event=body?.meta?.event_name; const a=body?.data?.attributes||{}; const userEmail=a?.user_email || a?.customer_email || body?.meta?.custom_data?.email;
 const userId=body?.meta?.custom_data?.user_id;
 if(!userId && !userEmail) return NextResponse.json({ok:true});
 const admin=createAdminClient();
 let uid=userId;
 if(!uid && userEmail){const {data}=await admin.auth.admin.listUsers({page:1,perPage:1000});uid=data.users.find(u=>u.email?.toLowerCase()===String(userEmail).toLowerCase())?.id;}
 if(!uid) return NextResponse.json({ok:true});
 const variant=String(a.variant_id||''); const plan=variant===process.env.LEMON_SQUEEZY_TEAM_VARIANT_ID?'team':variant===process.env.LEMON_SQUEEZY_PRO_VARIANT_ID?'pro':variant===process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID?'starter':'free';
 const active=['subscription_created','subscription_updated','subscription_resumed','subscription_payment_success'].includes(event);
 const canceled=['subscription_cancelled','subscription_expired'].includes(event);
 const {data:existing}=await admin.from('subscriptions').select('current_period_start,current_period_end').eq('user_id',uid).maybeSingle();
 const nextPeriodStart=event==='subscription_created'
   ? (a.created_at?new Date(a.created_at).toISOString():null)
   : event==='subscription_payment_success'
     ? (existing?.current_period_end || existing?.current_period_start || null)
     : (existing?.current_period_start || (a.created_at?new Date(a.created_at).toISOString():null));
 const {error:upsertError}=await admin.from('subscriptions').upsert({
   user_id:uid,
   plan,
   status:active?'active':canceled?'expired':String(a.status||'active'),
   ls_subscription_id:String(body?.data?.id||''),
   ls_customer_id:String(a.customer_id||''),
   current_period_start:nextPeriodStart,
   current_period_end:a.renews_at?new Date(a.renews_at).toISOString():(existing?.current_period_end || null),
   cancel_at_period_end:Boolean(a.cancelled),
   trial_ends_at:a.trial_ends_at?new Date(a.trial_ends_at).toISOString():null,
   updated_at:new Date().toISOString()
 },{onConflict:'user_id'});
 if(upsertError) return NextResponse.json({error:'Could not update subscription.'},{status:500});
 return NextResponse.json({ok:true});
}
