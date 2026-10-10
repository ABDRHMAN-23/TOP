import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { isTransitionAllowed, parseViewingCreate, parseViewingPatch } from '@/lib/aqarflow/operations-contract';

export const dynamic='force-dynamic';
const VIEWING_COLUMNS='id,owner_user_id,contact_id,property_id,title,location,starts_at,ends_at,timezone,status,notes,created_by,created_at,updated_at';
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function context(){
  let supabase:Awaited<ReturnType<typeof createClient>>;
  try{supabase=await createClient();}catch{return {error:response({error:'خدمة تسجيل الدخول غير متاحة.'},503)};}
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لإدارة المعاينات.'},401)};
  const {data:members,error:memberError}=await supabase.from('team_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
  if(memberError)return {error:response({error:'تعذر التحقق من مساحة العمل.'},503)};
  if((members||[]).length>1)return {error:response({error:'حسابك مرتبط بأكثر من مساحة عمل؛ حدد مساحة واحدة أولًا.'},409)};
  try{return {supabase,user:data.user,ownerId:members?.[0]?.owner_id||data.user.id,admin:createAdminClient()};}
  catch{return {error:response({error:'قاعدة بيانات المعاينات غير متاحة.'},503)};}
}

export async function GET(){
  const ctx=await context();if(ctx.error)return ctx.error;
  const {data:viewings,error}=await ctx.admin!.from('aqarflow_crm_viewings').select(VIEWING_COLUMNS)
    .eq('owner_user_id',ctx.ownerId!).order('starts_at',{ascending:true}).limit(200);
  if(error)return response({error:'جدول المعاينات غير مهيأ. طبّق هجرة عمليات المبيعات في قاعدة التطوير.'},503);
  const rows=viewings||[];
  const contactIds=Array.from(new Set(rows.map((viewing)=>viewing.contact_id)));
  const propertyIds=Array.from(new Set(rows.map((viewing)=>viewing.property_id).filter((id):id is string=>Boolean(id))));
  const [contactsResult,propertiesResult]=await Promise.all([
    contactIds.length?ctx.admin!.from('aqarflow_crm_contacts').select('id,display_name,phone_number,lead_stage').eq('owner_user_id',ctx.ownerId!).in('id',contactIds):Promise.resolve({data:[],error:null}),
    propertyIds.length?ctx.admin!.from('aqarflow_properties').select('id,title,location_label').eq('owner_user_id',ctx.ownerId!).in('id',propertyIds):Promise.resolve({data:[],error:null}),
  ]);
  if(contactsResult.error||propertiesResult.error)return response({error:'تعذر تحميل تفاصيل العملاء أو العقارات.'},503);
  const contacts=new Map((contactsResult.data||[]).map((contact)=>[contact.id,contact]));
  const properties=new Map((propertiesResult.data||[]).map((property)=>[property.id,property]));
  return response({viewings:rows.map((viewing)=>({...viewing,contact:contacts.get(viewing.contact_id)||null,property:viewing.property_id?properties.get(viewing.property_id)||null:null}))});
}

export async function POST(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const body=await readBoundedJson(request,12_000);
  if(!body.ok)return response({error:body.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صالحة.'},body.reason==='too_large'?413:400);
  const parsed=parseViewingCreate(body.value);if(!parsed.ok)return response({error:parsed.error},400);
  const value=parsed.value;
  const {data:contact,error:contactError}=await ctx.admin!.from('aqarflow_crm_contacts').select('id')
    .eq('owner_user_id',ctx.ownerId!).eq('id',value.contactId).maybeSingle();
  if(contactError)return response({error:'تعذر التحقق من ملكية العميل.'},503);
  if(!contact)return response({error:'العميل غير موجود في مساحة العمل.'},404);
  if(value.propertyId){
    const {data:property,error:propertyError}=await ctx.admin!.from('aqarflow_properties').select('id')
      .eq('owner_user_id',ctx.ownerId!).eq('id',value.propertyId).maybeSingle();
    if(propertyError)return response({error:'تعذر التحقق من العقار.'},503);
    if(!property)return response({error:'العقار غير موجود في مساحة العمل.'},404);
  }
  const {data:viewing,error}=await ctx.admin!.from('aqarflow_crm_viewings').insert({
    owner_user_id:ctx.ownerId,contact_id:value.contactId,property_id:value.propertyId,title:value.title,location:value.location,
    starts_at:value.startsAt,ends_at:value.endsAt,timezone:value.timezone,status:'scheduled',notes:value.notes,created_by:ctx.user!.id,
  }).select(VIEWING_COLUMNS).single();
  if(error){
    if(error.code==='23P01'||String(error.message||'').includes('aqarflow_viewing_overlap')){
      return response({error:'يوجد موعد معاينة آخر لهذا العقار يتداخل مع الوقت المحدد.'},409);
    }
    return response({error:'تعذر جدولة المعاينة. تحقق من بيانات العميل والعقار.'},503);
  }
  return response({viewing},201);
}

export async function PATCH(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const body=await readBoundedJson(request,12_000);
  if(!body.ok)return response({error:body.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صالحة.'},body.reason==='too_large'?413:400);
  const parsed=parseViewingPatch(body.value);if(!parsed.ok)return response({error:parsed.error},400);
  const {id,...changes}=parsed.value;
  const {data:current,error:currentError}=await ctx.admin!.from('aqarflow_crm_viewings').select(VIEWING_COLUMNS)
    .eq('owner_user_id',ctx.ownerId!).eq('id',id).maybeSingle();
  if(currentError)return response({error:'تعذر تحميل المعاينة.'},503);
  if(!current)return response({error:'المعاينة غير موجودة في مساحة العمل.'},404);
  if(changes.status&&!isTransitionAllowed(current.status,changes.status,'viewing')){
    return response({error:'لا يمكن إعادة فتح معاينة ملغاة.'},409);
  }
  const update:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(changes.title!==undefined)update.title=changes.title;
  if(changes.location!==undefined)update.location=changes.location;
  if(changes.startsAt!==undefined)update.starts_at=changes.startsAt;
  if(changes.endsAt!==undefined)update.ends_at=changes.endsAt;
  if(changes.timezone!==undefined)update.timezone=changes.timezone;
  if(changes.notes!==undefined)update.notes=changes.notes;
  if(changes.status!==undefined)update.status=changes.status;
  const {data:viewing,error}=await ctx.admin!.from('aqarflow_crm_viewings').update(update)
    .eq('owner_user_id',ctx.ownerId!).eq('id',id).select(VIEWING_COLUMNS).maybeSingle();
  if(error){
    if(error.code==='23P01'||String(error.message||'').includes('aqarflow_viewing_overlap')){
      return response({error:'يوجد موعد معاينة آخر لهذا العقار يتداخل مع الوقت المحدد.'},409);
    }
    return response({error:'تعذر تحديث المعاينة.'},503);
  }
  if(!viewing)return response({error:'المعاينة غير موجودة في مساحة العمل.'},404);
  return response({viewing});
}
