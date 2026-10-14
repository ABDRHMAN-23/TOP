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
  let appointmentsQuery=supabase.from('appointments').select('id,patient_id,clinician_id,scheduled_start,scheduled_end,timezone,appointment_type,status,note,booking_source,booking_status').eq('organization_id',context.organizationId).gte('scheduled_start',start).order('scheduled_start',{ascending:true});
  if(end) appointmentsQuery=appointmentsQuery.lt('scheduled_start',end);
  const {data,error:dbError}=await appointmentsQuery.limit(100);
  if(dbError)return NextResponse.json({error:'تعذر تحميل المواعيد.'},{status:500});
  const canReviewPublicBookings = ['owner','clinic_admin','dentist','clinician','receptionist'].includes(context.role);
  const appointments=(data??[]).filter((item:any) => canReviewPublicBookings || !(item.booking_source==='public_link' && item.booking_status==='requested'));
  const patientIds=[...new Set(appointments.map((item:any)=>item.patient_id).filter(Boolean))];
  let directoryById:Record<string,{full_name:string;patient_number:string|null;reported_age_years:number|null}>={};
  if(patientIds.length){const {data:directory,error:directoryError}=await supabase.from('patient_directory').select('id,full_name,patient_number,reported_age_years').eq('organization_id',context.organizationId).in('id',patientIds);if(directoryError)return NextResponse.json({error:'تعذر تحميل أسماء المرضى للمواعيد.'},{status:500});directoryById=Object.fromEntries((directory??[]).map((p:any)=>[p.id,{full_name:p.full_name,patient_number:p.patient_number,reported_age_years:p.reported_age_years}]));}
  return NextResponse.json({appointments:appointments.map((item:any)=>({...item,patients:directoryById[item.patient_id] || null}))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician','receptionist'].includes(context.role)) {
    return NextResponse.json({ error: 'لا تسمح صلاحيات الحساب بإنشاء موعد.' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'تحقق من بيانات الموعد.' }, { status: 400 });
  if (Date.parse(parsed.data.scheduled_end) <= Date.parse(parsed.data.scheduled_start)) {
    return NextResponse.json({ error: 'وقت نهاية الموعد يجب أن يلي بدايته.' }, { status: 400 });
  }
  const { data, error: createError } = await supabase.rpc('create_clinic_appointment', {
    p_organization_id: context.organizationId,
    p_patient_id: parsed.data.patient_id,
    p_scheduled_start: parsed.data.scheduled_start,
    p_scheduled_end: parsed.data.scheduled_end,
    p_timezone: parsed.data.timezone,
    p_appointment_type: parsed.data.appointment_type,
    p_note: parsed.data.note ?? null,
  });
  if (createError) {
    if (createError.code === '42501') return NextResponse.json({ error: 'لا تسمح صلاحيات الحساب بإنشاء موعد.' }, { status: 403 });
    if (createError.code === 'P0002' && /patient not found/i.test(createError.message || '')) {
      return NextResponse.json({ error: 'المريض غير موجود أو أن ملفه غير نشط في هذه العيادة.' }, { status: 404 });
    }
    if (createError.code === 'P0002' && /capacity reached/i.test(createError.message || '')) {
      return NextResponse.json({ error: 'هذا الوقت ممتلئ حسب السعة التي حددتها العيادة. اختر وقتاً آخر أو راجع طلبات الحجز.' }, { status: 409 });
    }
    if (createError.code === '22023') return NextResponse.json({ error: 'تحقق من وقت الموعد ومدته والبيانات المدخلة.' }, { status: 400 });
    return NextResponse.json({ error: 'تعذر حفظ الموعد. حاول مرة أخرى.' }, { status: 500 });
  }
  if (!data?.appointment) return NextResponse.json({ error: 'لم يُعِد النظام بيانات الموعد بعد الحفظ.' }, { status: 500 });
  return NextResponse.json({ appointment: data.appointment }, { status: 201 });
}
