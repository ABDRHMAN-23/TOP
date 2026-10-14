import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';
const createSchema = z.object({ patient_id: z.string().uuid(), scheduled_start: z.string().datetime(), scheduled_end: z.string().datetime(), timezone: z.string().max(80).default('Asia/Aden'), appointment_type: z.string().max(80).default('dental_visit'), note: z.string().max(2000).optional().nullable() }).strict();
export async function GET(request: Request) {
  const {supabase,user}=await requireUser(); if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503}); if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
  const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});
  const params=new URL(request.url).searchParams;
  const start=params.get('from')||new Date().toISOString();
  const end=params.get('to');
  let appointmentsQuery=supabase.from('appointments').select('id,patient_id,clinician_id,scheduled_start,scheduled_end,timezone,appointment_type,status,note,booking_source,booking_status,booking_reference,patient_name_snapshot,patient_age_years').eq('organization_id',context.organizationId).gte('scheduled_start',start).order('scheduled_start',{ascending:true});
  if(end) appointmentsQuery=appointmentsQuery.lt('scheduled_start',end);
  const {data,error:dbError}=await appointmentsQuery.limit(100);
  if(dbError)return NextResponse.json({error:'تعذر تحميل المواعيد.'},{status:500});
  const appointments=data??[];
  const patientIds=[...new Set(appointments.map((item:any)=>item.patient_id).filter(Boolean))];
  let directoryById:Record<string,{full_name:string;patient_number:string|null;reported_age_years:number|null}>={};
  if(patientIds.length){const {data:directory,error:directoryError}=await supabase.from('patient_directory').select('id,full_name,patient_number,reported_age_years').eq('organization_id',context.organizationId).in('id',patientIds);if(directoryError)return NextResponse.json({error:'تعذر تحميل أسماء المرضى للمواعيد.'},{status:500});directoryById=Object.fromEntries((directory??[]).map((p:any)=>[p.id,{full_name:p.full_name,patient_number:p.patient_number,reported_age_years:p.reported_age_years}]));}
  return NextResponse.json({appointments:appointments.map((item:any)=>({...item,patients:directoryById[item.patient_id] || (item.booking_source==='public_link' ? {full_name:item.patient_name_snapshot,patient_number:null,reported_age_years:item.patient_age_years} : null)}))});
}
export async function POST(request: Request) {
  const {supabase,user}=await requireUser();if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
  const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});
  if(!['owner','clinic_admin','dentist','clinician','receptionist'].includes(context.role))return NextResponse.json({error:'لا تسمح صلاحيات الحساب بإنشاء موعد.'},{status:403});
  const parsed=createSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'تحقق من بيانات الموعد.'},{status:400});if(Date.parse(parsed.data.scheduled_end)<=Date.parse(parsed.data.scheduled_start))return NextResponse.json({error:'وقت نهاية الموعد يجب أن يلي بدايته.'},{status:400});
  const {data:patient}=await supabase.from('patient_directory').select('id').eq('id',parsed.data.patient_id).eq('organization_id',context.organizationId).maybeSingle();if(!patient)return NextResponse.json({error:'المريض غير موجود في العيادة.'},{status:404});
  const {data,error:insertError}=await supabase.from('appointments').insert({...parsed.data,organization_id:context.organizationId,created_by:user.id,updated_by:user.id}).select('*').single();if(insertError||!data)return NextResponse.json({error:'تعذر حفظ الموعد.'},{status:500});
  await supabase.from('audit_events').insert({organization_id:context.organizationId,actor_user_id:user.id,action:'appointment.created',resource_type:'appointment',resource_id:data.id,metadata:{}});return NextResponse.json({appointment:data},{status:201});
}
