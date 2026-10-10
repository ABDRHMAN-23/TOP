import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';

export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_STAGES=new Set(['new','contacted','qualified','viewing_scheduled','negotiation','won','lost']);
const INTENTS=new Set(['buy','rent','invest','unknown']);
function cleanText(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max):'';}
function nullableMoney(value:unknown):number|null|'invalid'{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)return 'invalid';
 return value;
}
function nullableDate(value:unknown):string|null|'invalid'{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'||value.length>50)return 'invalid';
 const ms=Date.parse(value);if(!Number.isFinite(ms))return 'invalid';
 return new Date(ms).toISOString();
}
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function workspace(){
  const supabase=await createClient();const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لفتح صندوق المحادثات.'},401)};
  const {data:members,error:memberError}=await supabase.from('aqarflow_workspace_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
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
  const [contactsResult,notesResult,integrationsResult,messagesResult]=await Promise.all([
    contactIds.length?ctx.admin!.from('aqarflow_crm_contacts').select('id,phone_number,display_name,lead_stage,intent,budget_min,budget_max,budget_currency,preferred_area,preferred_property_type,lead_score,next_follow_up_at').eq('owner_user_id',ctx.ownerId!).in('id',contactIds):Promise.resolve({data:[],error:null}),
    contactIds.length?ctx.admin!.from('aqarflow_crm_contact_notes').select('id,contact_id,author_user_id,note,created_at').eq('owner_user_id',ctx.ownerId!).in('contact_id',contactIds).order('created_at',{ascending:false}).limit(300):Promise.resolve({data:[],error:null}),
    integrationIds.length?ctx.admin!.from('aqarflow_whatsapp_integrations').select('id,phone_number_id,display_phone_number,verified_name').eq('owner_user_id',ctx.ownerId!).in('id',integrationIds):Promise.resolve({data:[],error:null}),
    convIds.length?ctx.admin!.from('aqarflow_crm_messages').select('id,conversation_id,direction,message_type,message_text,ai_draft,facts_used,unknowns,provider_message_id,provider_status,created_at,sent_at').eq('owner_user_id',ctx.ownerId!).in('conversation_id',convIds).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  ]);
  if(contactsResult.error||notesResult.error||integrationsResult.error||messagesResult.error)return response({error:'تعذر تحميل تفاصيل صندوق CRM.'},503);
  const contacts=new Map((contactsResult.data||[]).map(c=>[c.id,c]));
  const integrations=new Map((integrationsResult.data||[]).map(i=>[i.id,i]));
  const notesByContact=new Map<string,unknown[]>();
  for(const note of notesResult.data||[]){const list=notesByContact.get(note.contact_id)||[];if(list.length<20)list.push(note);notesByContact.set(note.contact_id,list);}
  const messagesByConversation=new Map<string,unknown[]>();
  for(const m of messagesResult.data||[]){const list=messagesByConversation.get(m.conversation_id)||[];list.push(m);messagesByConversation.set(m.conversation_id,list);}
  return response({canSend:ctx.user!.id===ctx.ownerId,canManageCrm:true,conversations:convs.map(c=>{const contact=contacts.get(c.contact_id)||null;return {...c,contact:contact?{...contact,notes:notesByContact.get(c.contact_id)||[]}:null,integration:integrations.get(c.integration_id)||null,messages:(messagesByConversation.get(c.id)||[]).slice(0,30).reverse()};})});
}

export async function POST(request:Request){
  const ctx=await workspace();if(ctx.error)return ctx.error;
  const body=await readBoundedJson(request,12000);
  if(!body.ok)return response({error:body.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صحيحة.'},body.reason==='too_large'?413:400);
  if(!body.value||typeof body.value!=='object'||Array.isArray(body.value))return response({error:'بيانات الطلب غير صحيحة.'},400);
  const raw=body.value as Record<string,unknown>;

  if(raw.action==='update_contact'){
    const contactId=typeof raw.contactId==='string'?raw.contactId:'';
    if(!uuid.test(contactId))return response({error:'معرف العميل غير صحيح.'},400);
    if(typeof raw.leadStage!=='string'||!LEAD_STAGES.has(raw.leadStage)||typeof raw.intent!=='string'||!INTENTS.has(raw.intent))return response({error:'مرحلة العميل أو نية الشراء غير صالحة.'},400);
    const budgetMin=nullableMoney(raw.budgetMin);const budgetMax=nullableMoney(raw.budgetMax);
    if(budgetMin==='invalid'||budgetMax==='invalid'||(budgetMin!==null&&budgetMax!==null&&budgetMin>budgetMax))return response({error:'الميزانية غير صحيحة؛ الحد الأدنى لا يمكن أن يتجاوز الحد الأعلى.'},400);
    const currency=cleanText(raw.budgetCurrency||'USD',8).toUpperCase();
    if(!/^[A-Z]{3,8}$/.test(currency))return response({error:'رمز العملة غير صالح.'},400);
    if(typeof raw.leadScore!=='number'||!Number.isInteger(raw.leadScore)||raw.leadScore<0||raw.leadScore>100)return response({error:'درجة العميل يجب أن تكون بين 0 و100.'},400);
    const followup=nullableDate(raw.nextFollowUpAt);
    if(followup==='invalid')return response({error:'موعد المتابعة غير صالح.'},400);
    const {data:contact,error:contactError}=await ctx.admin!.from('aqarflow_crm_contacts').update({
      lead_stage:raw.leadStage,intent:raw.intent,budget_min:budgetMin,budget_max:budgetMax,budget_currency:currency,
      preferred_area:cleanText(raw.preferredArea,180)||null,preferred_property_type:cleanText(raw.preferredPropertyType,80)||null,
      lead_score:raw.leadScore,next_follow_up_at:followup,updated_at:new Date().toISOString(),
    }).eq('owner_user_id',ctx.ownerId!).eq('id',contactId).select('id,lead_stage,intent,budget_min,budget_max,budget_currency,preferred_area,preferred_property_type,lead_score,next_follow_up_at').maybeSingle();
    if(contactError)return response({error:'تعذر حفظ بيانات العميل. تأكد من تطبيق هجرة CRM pipeline.'},503);
    if(!contact)return response({error:'العميل غير موجود في مساحة العمل.'},404);
    return response({contact});
  }

  if(raw.action==='add_note'){
    const contactId=typeof raw.contactId==='string'?raw.contactId:'';
    const note=cleanText(raw.note,2000);
    if(!uuid.test(contactId)||!note)return response({error:'اكتب ملاحظة صحيحة مرتبطة بعميل.'},400);
    const {data:contact,error:contactError}=await ctx.admin!.from('aqarflow_crm_contacts').select('id').eq('owner_user_id',ctx.ownerId!).eq('id',contactId).maybeSingle();
    if(contactError)return response({error:'تعذر التحقق من العميل.'},503);
    if(!contact)return response({error:'العميل غير موجود في مساحة العمل.'},404);
    const {data:saved,error:savedError}=await ctx.admin!.from('aqarflow_crm_contact_notes').insert({
      owner_user_id:ctx.ownerId,contact_id:contactId,author_user_id:ctx.user!.id,note,
    }).select('id,contact_id,author_user_id,note,created_at').single();
    if(savedError)return response({error:'تعذر حفظ ملاحظة العميل.'},503);
    return response({note:saved},201);
  }

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
