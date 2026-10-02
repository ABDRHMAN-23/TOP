import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
  const s=body?.subscription;
  if(!s?.endpoint||!s?.keys?.p256dh||!s?.keys?.auth)return NextResponse.json({error:'Invalid push subscription.'},{status:400});
  const {error}=await supabase.from('push_subscriptions').upsert({
    user_id:user.id,endpoint:String(s.endpoint),p256dh:String(s.keys.p256dh),auth:String(s.keys.auth),
    user_agent:req.headers.get('user-agent'),last_seen_at:new Date().toISOString()
  },{onConflict:'endpoint'});
  if(error)return NextResponse.json({error:'Could not save notification settings.'},{status:500});
  return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let body:any; try{body=await req.json()}catch{body={}};
  const endpoint=String(body?.endpoint||'');
  if(endpoint)await supabase.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',endpoint);
  return NextResponse.json({ok:true});
}