import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function owner(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) return {error:NextResponse.json({error:'Authentication required'},{status:401})};
 const {data:sub}=await supabase.from('subscriptions').select('plan,status').eq('user_id',user.id).maybeSingle();
 if(sub?.plan!=='team'||!['active','trialing'].includes(sub.status||'')) return {error:NextResponse.json({error:'Team plan required.'},{status:403})};
 return {supabase,user};
}
export async function GET(){
 const a=await owner(); if(a.error)return a.error;
 const {data,error}=await a.supabase!.from('team_memberships').select('member_id,role,created_at').eq('owner_id',a.user!.id).order('created_at');
 if(error)return NextResponse.json({error:error.message},{status:500});
 const admin=createAdminClient(); const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
 const members=(data||[]).map(m=>({member_id:m.member_id,role:m.role,created_at:m.created_at,email:users.data.users.find(u=>u.id===m.member_id)?.email||'Unknown'}));
 return NextResponse.json({members});
}
export async function POST(req:Request){
 const a=await owner(); if(a.error)return a.error;
 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const email=String(body.email||'').trim().toLowerCase(); if(!email)return NextResponse.json({error:'Email is required.'},{status:400});
 if(email===String(a.user!.email||'').toLowerCase())return NextResponse.json({error:'The owner is already included.'},{status:400});
 const {count}=await a.supabase!.from('team_memberships').select('*',{count:'exact',head:true}).eq('owner_id',a.user!.id);
 if((count||0)>=2)return NextResponse.json({error:'Team includes up to 3 users total.'},{status:409});
 const admin=createAdminClient(); const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
 const target=users.data.users.find(u=>u.email?.toLowerCase()===email);
 if(!target)return NextResponse.json({error:'That email does not have a QUVOTO account yet. Ask them to create an account first.'},{status:404});
 const {error}=await admin.from('team_memberships').insert({owner_id:a.user!.id,member_id:target.id,role:'member'});
 if(error?.code==='23505')return NextResponse.json({error:'This user is already on the team.'},{status:409});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){
 const a=await owner(); if(a.error)return a.error;
 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const memberId=String(body.member_id||''); if(!memberId)return NextResponse.json({error:'Member is required.'},{status:400});
 const {error}=await a.supabase!.from('team_memberships').delete().eq('owner_id',a.user!.id).eq('member_id',memberId);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true});
}