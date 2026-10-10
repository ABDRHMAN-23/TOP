import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { normalizeWhatsAppPhone } from '@/lib/aqarflow/whatsapp-cloud';

export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_STAGES=new Set(['new','contacted','qualified','viewing_scheduled','negotiation','won','lost']);
const INTENTS=new Set(['buy','rent','invest','unknown']);
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
function cleanText(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max):'';}
function money(value:unknown):number|null|'invalid'{if(value===null||value===undefined||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)return 'invalid';return value;}
function isoDate(value:unknown):string|null|'invalid'{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||value.length>50)return 'invalid';const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():'invalid';}

async function getContext(){
  let supabase:Awaited<ReturnType<typeof createClient>>;
  try{supabase=await createClient();}catch{return {error:response({error:'خدمة تسجيل الدخول غير متاحة.'},503)};}
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لإدارة العملاء.'},401)};
  const {data:members,error:membershipError}=await supabase.from('team_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
  if(membershipError)return {error:response({error:'تعذر التحقق من مساحة العمل.'},503)};
  if((members||[]).length>1)return {error:response({error:'حسابك مرتبط بأكثر من مساحة عمل؛ حدد مساحة واحدة أولًا.'},409)};
  try{return {user:data.user,ownerId:members?.[0]?.owner_id||data.user.id,admin:createAdminClient()};}
  catch{return {error:response({error:'قاعدة بيانات CRM غير متاحة.'},503)};}
}

export async function GET(){
  const ctx=await getContext();if(ctx.error)return ctx.error;
  const {data:contacts,error}=await ctx.admin!.from('aqarflow_crm_contacts')
    .select('id,phone_number,display_name,source,lead_stage,intent,budget_min,budget_max,budget_currency,preferred_area,preferred_property_type,lead_score,next_follow_up_at,first_seen_at,last_seen_at,updated_at')
    .eq('owner_user_id',ctx.ownerId!).order('updated_at',{ascending:false}).limit(100);
  if(error)return response({error:'سجل العملاء غير مهيأ. تأكد من تطبيق هجرات CRM في قاعدة التطوير.'},503);
  const ids=(contacts||[]).map(c=>c.id);
  const {data:notes,error:notesError}=ids.length
    ?await ctx.admin!.from('aqarflow_crm_contact_notes').select('id,contact_id,author_user_id,note,created_at').eq('owner_user_id',ctx.ownerId!).in('contact_id',ids).order('created_at',{ascending:false}).limit(500)
    :{data:[],error:null};
  if(notesError)return response({error:'تعذر تحميل ملاحظات العملاء.'},503);
  const byContact=new Map<string,unknown[]>();
  for(const note of notes||[]){const list=byContact.get(note.contact_id)||[];if(list.length<10)list.push(note);byContact.set(note.contact_id,list);}
  const {data:conversationContacts,error:conversationError}=ids.length
    ?await ctx.admin!.from('aqarflow_crm_conversations').select('contact_id,id,status,last_message_at,last_message_preview').eq('owner_user_id',ctx.ownerId!).in('contact_id',ids).order('last_message_at',{ascending:false}).limit(100)
    :{data:[],error:null};
  if(conversationError)return response({error:'تعذر تحميل ربط المحادثات بالعملاء.'},503);
  const convByContact=new Map<string,unknown>();
  for(const conv of conversationContacts||[])if(!convByContact.has(conv.contact_id))convByContact.set(conv.contact_id,conv);
  return response({
    canManageCrm:true,
    contacts:(contacts||[]).map(c=>({...c,notes:byContact.get(c.id)||[],conversation:convByContact.get(c.id)||null})),
  });
}

type LeadRecord={phone_number:string;display_name:string;source:'manual';lead_stage:string;intent:string;budget_min:number|null;budget_max:number|null;budget_currency:string;preferred_area:string|null;preferred_property_type:string|null;lead_score:number;next_follow_up_at:string|null;updated_at:string};
type LeadParseResult={ok:false;error:string}|{ok:true;value:LeadRecord};
function parseLead(raw:Record<string,unknown>):LeadParseResult{
  const phone=normalizeWhatsAppPhone(raw.phoneNumber);
  const name=cleanText(raw.displayName,160);
  if(!phone)return {ok:false,error:'رقم الهاتف غير صالح. أدخله مع رمز الدولة.'};
  if(!name)return {ok:false,error:'اسم العميل مطلوب.'};
  const leadStage=typeof raw.leadStage==='string'?raw.leadStage:'new';
  const intent=typeof raw.intent==='string'?raw.intent:'unknown';
  if(!LEAD_STAGES.has(leadStage)||!INTENTS.has(intent))return {ok:false,error:'مرحلة العميل أو نية الشراء غير صالحة.'};
  const budgetMin=money(raw.budgetMin);const budgetMax=money(raw.budgetMax);
  if(budgetMin==='invalid'||budgetMax==='invalid'||(budgetMin!==null&&budgetMax!==null&&budgetMin>budgetMax))return {ok:false,error:'الميزانية غير صحيحة؛ الحد الأدنى لا يتجاوز الحد الأعلى.'};
  const currency=cleanText(raw.budgetCurrency||'USD',8).toUpperCase();
  if(!/^[A-Z]{3,8}$/.test(currency))return {ok:false,error:'رمز العملة غير صالح.'};
  const score=raw.leadScore===undefined?0:raw.leadScore;
  if(typeof score!=='number'||!Number.isInteger(score)||score<0||score>100)return {ok:false,error:'درجة العميل يجب أن تكون بين 0 و100.'};
  const follow=isoDate(raw.nextFollowUpAt);
  if(follow==='invalid')return {ok:false,error:'موعد المتابعة غير صالح.'};
  return {ok:true,value:{
    phone_number:phone,display_name:name,source:'manual',
    lead_stage:leadStage,intent,budget_min:budgetMin,budget_max:budgetMax,budget_currency:currency,
    preferred_area:cleanText(raw.preferredArea,180)||null,
    preferred_property_type:cleanText(raw.preferredPropertyType,80)||null,
    lead_score:score,next_follow_up_at:follow,updated_at:new Date().toISOString(),
  }};
}

export async function POST(request:Request){
  const ctx=await getContext();if(ctx.error)return ctx.error;
  const body=await readBoundedJson(request,12000);
  if(!body.ok)return response({error:body.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صحيحة.'},body.reason==='too_large'?413:400);
  if(!body.value||typeof body.value!=='object'||Array.isArray(body.value))return response({error:'بيانات الطلب غير صحيحة.'},400);
  const raw=body.value as Record<string,unknown>;
  const parsed=parseLead(raw);if(!parsed.ok)return response({error:parsed.error},400);
  const payload=parsed.value;
  const contactId=typeof raw.id==='string'?raw.id:'';
  if(contactId&&!UUID.test(contactId))return response({error:'معرف العميل غير صحيح.'},400);
  if(contactId){
    const {source: _source, ...updatePayload}=payload;
    const {data:updated,error}=await ctx.admin!.from('aqarflow_crm_contacts').update(updatePayload).eq('owner_user_id',ctx.ownerId!).eq('id',contactId)
      .select('id,phone_number,display_name,source,lead_stage,intent,budget_min,budget_max,budget_currency,preferred_area,preferred_property_type,lead_score,next_follow_up_at,updated_at').maybeSingle();
    if(error)return response({error:'تعذر تحديث العميل. تحقق من أن رقم الهاتف غير مستخدم لعميل آخر.'},409);
    if(!updated)return response({error:'العميل غير موجود في مساحة العمل.'},404);
    return response({contact:updated});
  }
  const {data:created,error}=await ctx.admin!.from('aqarflow_crm_contacts').insert({owner_user_id:ctx.ownerId,...payload})
    .select('id,phone_number,display_name,source,lead_stage,intent,budget_min,budget_max,budget_currency,preferred_area,preferred_property_type,lead_score,next_follow_up_at,updated_at').single();
  if(error){
    const message=String(error.code||'');
    if(message==='23505')return response({error:'هذا الرقم مسجل لعميل آخر داخل مساحة العمل.'},409);
    return response({error:'تعذر إنشاء سجل العميل.'},503);
  }
  return response({contact:created},201);
}
