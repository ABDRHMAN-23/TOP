import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const patchSchema = z.object({ full_name: z.string().trim().min(2).max(180).optional(), date_of_birth: z.string().date().nullable().optional(), sex: z.enum(['female','male','unspecified']).optional(), phone: z.string().trim().max(40).nullable().optional(), chief_complaint: z.string().trim().max(2000).nullable().optional(), record_status: z.enum(['active','inactive','merged','archived']).optional() }).strict();
const clinicalRoles = ['owner','clinic_admin','dentist','clinician','assistant'];

export async function GET(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!clinicalRoles.includes(context.role)) return NextResponse.json({ error: 'تفاصيل التاريخ الصحي والزيارات متاحة للفريق السريري المخوّل فقط.' }, { status: 403 });
  const { data: patient, error: patientError } = await supabase.from('patients').select('id,organization_id,patient_number,full_name,date_of_birth,sex,phone,email,address,chief_complaint,record_status,created_at,updated_at').eq('id', patientId).eq('organization_id', context.organizationId).maybeSingle();
  if (patientError || !patient) return NextResponse.json({ error: 'ملف المريض غير موجود.' }, { status: 404 });
  const [{ data: history, error: historyError }, { data: encounters, error: encounterError }, { data: appointments, error: appointmentsError }] = await Promise.all([
    supabase.from('patient_medical_history_items').select('id,category,title,value,state,source,last_reviewed_at,created_at,updated_at').eq('patient_id', patientId).eq('organization_id', context.organizationId).order('updated_at', { ascending: false }),
    supabase.from('encounters').select('id,status,encounter_type,started_at,ended_at,chief_complaint,created_at').eq('patient_id', patientId).eq('organization_id', context.organizationId).order('created_at', { ascending: false }).limit(30),
    supabase.from('appointments').select('id,scheduled_start,scheduled_end,status,appointment_type,note,timezone').eq('patient_id', patientId).eq('organization_id', context.organizationId).order('scheduled_start', { ascending: false }).limit(20),
  ]);
  if (historyError || encounterError || appointmentsError) return NextResponse.json({ error: 'تعذر تحميل تفاصيل الملف.' }, { status: 500 });
  return NextResponse.json({ patient, history: history ?? [], encounters: encounters ?? [], appointments: appointments ?? [] });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return NextResponse.json({ error: 'لا تملك صلاحية تعديل ملف المريض.' }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return NextResponse.json({ error: 'لا توجد حقول صالحة للحفظ.' }, { status: 400 });
  const { data, error: updateError } = await supabase.from('patients').update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', patientId).eq('organization_id', context.organizationId).select('id,patient_number,full_name,date_of_birth,sex,phone,chief_complaint,record_status,updated_at').maybeSingle();
  if (updateError || !data) return NextResponse.json({ error: 'تعذر تحديث ملف المريض.' }, { status: 500 });
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'patient.updated', resource_type: 'patient', resource_id: data.id, metadata: { fields: Object.keys(parsed.data) } });
  return NextResponse.json({ patient: data });
}
