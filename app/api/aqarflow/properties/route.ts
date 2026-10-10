import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readBoundedUtf8Body } from '@/lib/aqarflow/http-body';
export const dynamic='force-dynamic';
const COLUMNS='id,title,property_type,purpose,price,currency,area,bedrooms,bathrooms,location_label,verified_features,availability,facts_last_verified_at,is_active,created_at,updated_at';
const PURPOSES=new Set(['sale','rent','invest','unknown']);
const AVAILABILITY=new Set(['available','unavailable','unknown']);
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function context(){
  const supabase=await createClient();const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لإدارة العقارات.'},401)};
  const {data:members,error:memberError}=await supabase.from('team_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
  if(memberError)return {error:response({error:'تعذر التحقق من مساحة العمل.'},503)};
  if((members||[]).length>1)return {error:response({error:'حسابك مرتبط بأكثر من مساحة عمل؛ يلزم تحديد المساحة أولًا.'},409)};
  return {supabase,user:data.user,ownerId:members?.[0]?.owner_id||data.user.id};
}
function clean(v:unknown,max:number){return typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C-\u001F\u007F]/g,'').trim().slice(0,max):'';}
function num(v:unknown,max:number,integer=false):number|null|'invalid'{
  if(v===null||v===undefined||v==='')return null;
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||(integer&&!Number.isInteger(v)))return 'invalid';
  return v;
}
function parse(v:unknown){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const r=v as Record<string,unknown>;const title=clean(r.title,180);if(!title)return null;
  const purpose=typeof r.purpose==='string'&&PURPOSES.has(r.purpose)?r.purpose:null;if(!purpose)return null;
  const price=num(r.price,1e12);const area=num(r.area,1e9);const bedrooms=num(r.bedrooms,100,true);const bathrooms=num(r.bathrooms,100,true);
  if([price,area,bedrooms,bathrooms].includes('invalid'))return null;
  const currency=clean(r.currency||'USD',8).toUpperCase();if(!/^[A-Z]{3,8}$/.test(currency))return null;
  if(r.verifiedFeatures!==undefined&&!Array.isArray(r.verifiedFeatures))return null;
  const features:string[]=[];
  for(const item of (Array.isArray(r.verifiedFeatures)?r.verifiedFeatures:[])){
    if(typeof item!=='string')return null;const f=clean(item,120);
    if(f&&!features.some(x=>x.toLowerCase()===f.toLowerCase()))features.push(f);
    if(features.length>12)return null;
  }
  const availability=typeof r.availability==='string'&&AVAILABILITY.has(r.availability)?r.availability:null;if(!availability)return null;
  if(r.availabilityVerified!==undefined&&typeof r.availabilityVerified!=='boolean')return null;
  // A selected availability value is not proof by itself. Require an explicit owner attestation.
  if(availability!=='unknown'&&r.availabilityVerified!==true)return null;
  if(r.isActive!==undefined&&typeof r.isActive!=='boolean')return null;
  return {title,property_type:clean(r.propertyType,80)||null,purpose,price,currency,area,bedrooms,bathrooms,
    location_label:clean(r.locationLabel,180)||null,verified_features:features,availability,
    facts_last_verified_at:r.availabilityVerified===true?new Date().toISOString():null,is_active:typeof r.isActive==='boolean'?r.isActive:true,updated_at:new Date().toISOString()};
}
async function body(req:Request):Promise<{ok:true;value:unknown}|{ok:false;status:number;error:string}>{
  const length=Number(req.headers.get('content-length')||0);if(Number.isFinite(length)&&length>16000)return {ok:false,status:413,error:'حجم الطلب أكبر من الحد المسموح.'};
  const result=await readBoundedUtf8Body(req,16000);
  if(!result.ok)return {ok:false,status:result.code==='too_large'?413:400,error:'تعذر قراءة الطلب.'};
  try{return {ok:true,value:JSON.parse(result.text)};}catch{return {ok:false,status:400,error:'صيغة JSON غير صحيحة.'};}
}
export async function GET(){
  const ctx=await context();if(ctx.error)return ctx.error;
  const {data,error}=await ctx.supabase!.from('aqarflow_properties').select(COLUMNS).eq('owner_user_id',ctx.ownerId!).order('updated_at',{ascending:false}).limit(200);
  if(error)return response({error:'جدول العقارات غير مهيأ. راجع هجرة AqarFlow في قاعدة التطوير.'},503);
  return response({properties:data||[],canManage:ctx.user!.id===ctx.ownerId});
}
export async function POST(req:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  if(ctx.user!.id!==ctx.ownerId)return response({error:'إضافة العقارات متاحة لمالك مساحة العمل فقط.'},403);
  const read=await body(req);if(!read.ok)return response({error:read.error},read.status);
  const property=parse(read.value);if(!property)return response({error:'راجع اسم العقار والسعر والعملة والغرف والحقول المطلوبة.'},400);
  const {data,error}=await ctx.supabase!.from('aqarflow_properties').insert({...property,owner_user_id:ctx.user!.id}).select(COLUMNS).single();
  if(error)return response({error:'تعذر حفظ العقار. تحقق من جاهزية قاعدة البيانات والحقول.'},503);
  return response({property:data},201);
}
export async function PATCH(req:Request){
  const ctx=await context();if(ctx.error)return ctx.error;if(ctx.user!.id!==ctx.ownerId)return response({error:'تعديل العقارات متاح للمالك فقط.'},403);
  const read=await body(req);if(!read.ok)return response({error:read.error},read.status);
  if(!read.value||typeof read.value!=='object'||Array.isArray(read.value))return response({error:'بيانات الطلب غير صحيحة.'},400);
  const raw=read.value as Record<string,unknown>;const id=clean(raw.id,40);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return response({error:'معرف العقار غير صحيح.'},400);
  const property=parse(raw);if(!property)return response({error:'راجع الحقول المطلوبة.'},400);
  const {data,error}=await ctx.supabase!.from('aqarflow_properties').update(property).eq('id',id).eq('owner_user_id',ctx.user!.id).select(COLUMNS).maybeSingle();
  if(error)return response({error:'تعذر تحديث العقار.'},503);if(!data)return response({error:'العقار غير موجود أو لا تملك صلاحية تعديله.'},404);
  return response({property:data});
}
export async function DELETE(req:Request){
  const ctx=await context();if(ctx.error)return ctx.error;if(ctx.user!.id!==ctx.ownerId)return response({error:'حذف العقارات متاح للمالك فقط.'},403);
  const read=await body(req);if(!read.ok)return response({error:read.error},read.status);
  if(!read.value||typeof read.value!=='object'||Array.isArray(read.value))return response({error:'بيانات الطلب غير صحيحة.'},400);
  const id=clean((read.value as Record<string,unknown>).id,40);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return response({error:'معرف العقار غير صحيح.'},400);
  const {data,error}=await ctx.supabase!.from('aqarflow_properties').delete().eq('id',id).eq('owner_user_id',ctx.user!.id).select('id').maybeSingle();
  if(error)return response({error:'تعذر حذف العقار.'},503);if(!data)return response({error:'العقار غير موجود أو لا تملك صلاحية حذفه.'},404);
  return response({ok:true,id});
}
