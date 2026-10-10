import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';

export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function workspace(){
  const supabase=await createClient();const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لفتح صندوق المحادثات.'},401)};
  const {data:members,error:memberError}=await supabase.from('team_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
  if(memberError)return {error:response({error:'تعذر التحقق من مساحة العمل.'},503)};
  if((members||[]).length>1)return {error:response({error:'حسابك مرتبط بأكثر من مساحة عمل؛ يلزم تحديد مساحة العمل.'},409)};
  return {user:data.user,ownerId:members?.[0]?.owner_id||data.user.id,admin:createAdminClient()};
}

export async function GET(){
  const ctx=await workspace();if(ctx.error)return ctx.error;
  const {data:conversations,error}=await ctx.admin!.from('aqarflow_crm_conversations')
    .select('id,status,handoff_required,last_message_at,last_message_preview,contact_id,integration_id')
    .eq('owner_user_id',ctx.ownerId!).order('last_message_at',{ascending:false}).limit(50);
  if(error)return response({error:'صندوق المحادثات غير مهيأ. راجع هجرات AqarFlow في قاعدة التطوير.'},503);
  const convs=conversations||[];const contactIds=Array.from(new Set(convs.map(c=>c.contact_id)));const integrationIds=Array.from(new Set(convs.map(c=>c.integration_id)));const convIds=convs.map(c=>c.id);
  const [contactsResult,integrationsResult,messagesResult]=await Promise.all([
    contactIds.length?ctx.admin!.from('aqarflow_crm_contacts').select('id,phone_number,display_name').eq('owner_user_id',ctx.ownerId!).in('id',contactIds):Promise.resolve({data:[],error:null}),
    integrationIds.length?ctx.admin!.from('aqarflow_whatsapp_integrations').select('id,phone_number_id,display_phone_number,verified_name').eq('owner_user_id',ctx.ownerId!).in('id',integrationIds):Promise.resolve({data:[],error:null}),
    convIds.length?ctx.admin!.from('aqarflow_crm_messages').select('id,conversation_id,direction,message_type,message_text,ai_draft,facts_used,unknowns,provider_message_id,provider_status,created_at,sent_at').eq('owner_user_id',ctx.ownerId!).in('conversation_id',convIds).order('created_at',{ascending:true}).limit(500):Promise.resolve({data:[],error:null}),
  ]);
  if(contactsResult.error||integrationsResult.error||messagesResult.error)return response({error:'تعذر تحميل تفاصيل صندوق المحادثات.'},503);
  const contacts=new Map((contactsResult.data||[]).map(c=>[c.id,c]));
  const integrations=new Map((integrationsResult.data||[]).map(i=>[i.id,i]));
  const messagesByConversation=new Map<string,unknown[]>();
  for(const m of messagesResult.data||[]){const list=messagesByConversation.get(m.conversation_id)||[];list.push(m);messagesByConversation.set(m.conversation_id,list);}
  return response({canSend:ctx.user!.id===ctx.ownerId,conversations:convs.map(c=>({...c,contact:contacts.get(c.contact_id)||null,integration:integrations.get(c.integration_id)||null,messages:(messagesByConversation.get(c.id)||[]).slice(-30)}))});
}

export async function POST(request:Request){
  const ctx=await workspace();if(ctx.error)return ctx.error;
  const body=await readBoundedJson(request,12000);
  if(!body.ok)return response({error:body.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صحيحة.'},body.reason==='too_large'?413:400);
  if(!body.value||typeof body.value!=='object'||Array.isArray(body.value))return response({error:'بيانات الطلب غير صحيحة.'},400);
  const raw=body.value as Record<string,unknown>;
  if(raw.action!=='save_draft')return response({error:'الإجراء غير مدعوم.'},400);
  const conversationId=typeof raw.conversationId==='string'?raw.conversationId:'';
  const draft=typeof raw.draft==='string'?raw.draft.replace(/[\u0000-\u0008\u000B\u000C-\u001F\u007F]/g,'').trim():'';
  if(!uuid.test(conversationId)||!draft||draft.length>1200)return response({error:'المحادثة أو مسودة الرد غير صالحة.'},400);
  const {data:conversation,error:conversationError}=await ctx.admin!.from('aqarflow_crm_conversations')
    .select('id').eq('owner_user_id',ctx.ownerId!).eq('id',conversationId).maybeSingle();
  if(conversationError)return response({error:'تعذر التحقق من المحادثة.'},503);
  if(!conversation)return response({error:'المحادثة غير موجودة في مساحة العمل.'},404);
  const cleanList=(value:unknown)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string').slice(0,20).map(x=>x.slice(0,160)):[];
  const {data:saved,error:savedError}=await ctx.admin!.from('aqarflow_crm_messages').insert({
    owner_user_id:ctx.ownerId,conversation_id:conversationId,direction:'outbound',channel:'whatsapp',message_type:'text',
    ai_draft:draft,provider_status:'draft',facts_used:cleanList(raw.factsUsed),unknowns:cleanList(raw.unknowns),
  }).select('id,conversation_id,ai_draft,provider_status,created_at').single();
  if(savedError)return response({error:'تعذر حفظ المسودة في صندوق المحادثات.'},503);
  if(typeof raw.handoffRequired==='boolean'){
    await ctx.admin!.from('aqarflow_crm_conversations').update({handoff_required:raw.handoffRequired,updated_at:new Date().toISOString()})
      .eq('owner_user_id',ctx.ownerId!).eq('id',conversationId);
  }
  return response({saved},201);
}
