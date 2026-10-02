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

  if(body?.all){
    const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
    if(error)return NextResponse.json({error:'Could not mark notifications as read.'},{status:500});
  } else if(body?.id){
    const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id);
    if(error)return NextResponse.json({error:'Could not mark notification as read.'},{status:500});
  }
  return NextResponse.json({ok:true});
}

export async function POST(req:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}

  const title=typeof body?.title==='string'?body.title.trim():'';
  const message=typeof body?.body==='string'?body.body.trim():'';
  const link=typeof body?.link==='string'?body.link.trim():'';
  const type=typeof body?.type==='string'?body.type.trim():'account';
  if(!title||!message)return NextResponse.json({error:'Title and body are required.'},{status:400});
  if(link && !link.startsWith('/'))return NextResponse.json({error:'Link must be an internal path.'},{status:400});

  const {data,error}=await supabase.from('notifications').insert({user_id:user.id,title,body:message,link:link||null,type}).select('id,title,body,type,link,read_at,created_at').single();
  if(error)return NextResponse.json({error:'Could not create notification.'},{status:500});
  return NextResponse.json({notification:data});
}