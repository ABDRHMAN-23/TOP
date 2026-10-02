import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
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
function hashToken(token:string){return crypto.createHash('sha256').update(token).digest('hex')}
async function sendInviteEmail(to:string,inviteUrl:string){
 const key=process.env.RESEND_API_KEY; const from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from) return false;
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({
   from,to,subject:'You’ve been invited to a QUVOTO team',
   html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#0A1E3D"><h1 style="margin:0 0 12px">QUVOTO</h1><p>You’ve been invited to join a QUVOTO Team workspace.</p><p>Open the invitation to join the shared quoting workspace:</p><p><a href="'+inviteUrl+'" style="display:inline-block;background:#1769E0;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Accept invitation</a></p><p style="color:#64748b;font-size:13px">This invitation expires in 7 days.</p></div>'
 })});
 return response.ok;
}
export async function GET(){
 const a=await owner(); if(a.error)return a.error;
 const {data,error}=await a.supabase!.from('team_memberships').select('member_id,role,created_at').eq('owner_id',a.user!.id).order('created_at');
 if(error)return NextResponse.json({error:error.message},{status:500});
 const {data:invites}=await a.supabase!.from('team_invites').select('id,email,expires_at,created_at').eq('owner_id',a.user!.id).is('accepted_at',null).gt('expires_at',new Date().toISOString()).order('created_at');
 const admin=createAdminClient(); const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
 const members=(data||[]).map(m=>({member_id:m.member_id,role:m.role,created_at:m.created_at,email:users.data.users.find(u=>u.id===m.member_id)?.email||'Unknown'}));
 return NextResponse.json({members,pending_invites:invites||[]});
}
export async function POST(req:Request){
 const a=await owner(); if(a.error)return a.error;
 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const email=String(body.email||'').trim().toLowerCase(); if(!email)return NextResponse.json({error:'Email is required.'},{status:400});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});
 if(email===String(a.user!.email||'').toLowerCase())return NextResponse.json({error:'The owner is already included.'},{status:400});
 const {count}=await a.supabase!.from('team_memberships').select('*',{count:'exact',head:true}).eq('owner_id',a.user!.id);
 const {count:inviteCount}=await a.supabase!.from('team_invites').select('*',{count:'exact',head:true}).eq('owner_id',a.user!.id).is('accepted_at',null).gt('expires_at',new Date().toISOString());
 if((count||0)+(inviteCount||0)>=2)return NextResponse.json({error:'Your Team can have up to 3 users total, including pending invitations.'},{status:409});
 const admin=createAdminClient(); const users=await admin.auth.admin.listUsers({page:1,perPage:1000});
 const target=users.data.users.find(u=>u.email?.toLowerCase()===email);
 if(target){
   const {error}=await admin.from('team_memberships').insert({owner_id:a.user!.id,member_id:target.id,role:'member'});
   if(error?.code==='23505')return NextResponse.json({error:'This user is already on the team.'},{status:409});
   if(error)return NextResponse.json({error:error.message},{status:500});
   return NextResponse.json({ok:true,mode:'member'});
 }
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return NextResponse.json({error:'This person does not have a QUVOTO account yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL to enable email invitations.'},{status:503});
 const {data:existingInvite}=await a.supabase!.from('team_invites').select('id').eq('owner_id',a.user!.id).eq('email',email).is('accepted_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(existingInvite)return NextResponse.json({error:'A pending invitation already exists for this email.'},{status:409});
 const token=crypto.randomBytes(32).toString('hex');
 const inviteUrl=new URL('/team/invite/'+token,req.url).toString();
 const {error:insertError}=await a.supabase!.from('team_invites').insert({owner_id:a.user!.id,email,token_hash:hashToken(token),expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()});
 if(insertError)return NextResponse.json({error:insertError.message},{status:500});
 const sent=await sendInviteEmail(email,inviteUrl);
 if(!sent){await a.supabase!.from('team_invites').delete().eq('owner_id',a.user!.id).eq('email',email).is('accepted_at',null);return NextResponse.json({error:'The invitation could not be sent. Check your Resend configuration.'},{status:502})}
 return NextResponse.json({ok:true,mode:'invite'});
}
export async function DELETE(req:Request){
 const a=await owner(); if(a.error)return a.error;
 let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const memberId=String(body.member_id||''); const inviteId=String(body.invite_id||'');
 if(!memberId&&!inviteId)return NextResponse.json({error:'Member or invitation is required.'},{status:400});
 const {error}=memberId
   ? await a.supabase!.from('team_memberships').delete().eq('owner_id',a.user!.id).eq('member_id',memberId)
   : await a.supabase!.from('team_invites').delete().eq('owner_id',a.user!.id).eq('id',inviteId);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true});
}