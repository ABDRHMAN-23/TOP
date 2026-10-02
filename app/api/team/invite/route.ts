import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
function hashToken(token:string){return crypto.createHash('sha256').update(token).digest('hex')}
export async function POST(req:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in to accept this invitation.'},{status:401});
 const token=String((await req.json().catch(()=>({})))?.token||'').trim();
 if(!token)return NextResponse.json({error:'Invitation token is required.'},{status:400});
 const admin=createAdminClient();
 const {data:invite,error}=await admin.from('team_invites').select('id,owner_id,email,expires_at,accepted_at').eq('token_hash',hashToken(token)).maybeSingle();
 if(error||!invite)return NextResponse.json({error:'This invitation is invalid or no longer available.'},{status:404});
 if(invite.accepted_at)return NextResponse.json({error:'This invitation has already been accepted.'},{status:409});
 if(new Date(invite.expires_at).getTime()<Date.now())return NextResponse.json({error:'This invitation has expired.'},{status:410});
 if(String(user.email||'').toLowerCase()!==String(invite.email||'').toLowerCase())return NextResponse.json({error:'Sign in with the email address that received this invitation.'},{status:403});
 if(user.id===invite.owner_id)return NextResponse.json({error:'The owner cannot join their own team as a member.'},{status:400});
 const {data:ownerSub}=await admin.from('subscriptions').select('plan,status').eq('user_id',invite.owner_id).maybeSingle();
 if(ownerSub?.plan!=='team'||!['active','trialing'].includes(ownerSub.status||''))return NextResponse.json({error:'This Team invitation is no longer active.'},{status:410});
 const {count}=await admin.from('team_memberships').select('*',{count:'exact',head:true}).eq('owner_id',invite.owner_id);
 if((count||0)>=2)return NextResponse.json({error:'This Team already has three users.'},{status:409});
 const {error:insertError}=await admin.from('team_memberships').insert({owner_id:invite.owner_id,member_id:user.id,role:'member'});
 if(insertError?.code==='23505'){await admin.from('team_invites').update({accepted_at:new Date().toISOString()}).eq('id',invite.id);return NextResponse.json({ok:true})}
 if(insertError)return NextResponse.json({error:'Could not join the Team.'},{status:500});
 const {error:updateError}=await admin.from('team_invites').update({accepted_at:new Date().toISOString()}).eq('id',invite.id);
 if(updateError)return NextResponse.json({error:'Team membership was created, but the invitation could not be closed.'},{status:500});
 return NextResponse.json({ok:true});
}