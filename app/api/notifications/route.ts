import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const [{data,error},{count:unreadCount,error:countError}]=await Promise.all([
    supabase.from('notifications').select('id,title,body,type,link,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
    supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null)
  ]);
  if(error||countError)return NextResponse.json({error:'Could not load notifications.'},{status:500});
  return NextResponse.json({notifications:data||[],unreadCount:unreadCount||0});
}

export async function PATCH(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}

  if(body?.all){
    const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
    if(error)return NextResponse.json({error:'Could not mark notifications as read.'},{status:500});
  } else if(body?.id){
    const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id);
    if(error)return NextResponse.json({error:'Could not mark notification as read.'},{status:500});
  }
  return NextResponse.json({ok:true});
}
