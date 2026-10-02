import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const {data,error}=await supabase.from('notifications').select('id,title,body,type,link,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
  if(error)return NextResponse.json({error:'Could not load notifications.'},{status:500});
  return NextResponse.json({notifications:data||[]});
}
export async function PATCH(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
  if(body?.all){await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);}
  else if(body?.id){await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id);}
  return NextResponse.json({ok:true});
}