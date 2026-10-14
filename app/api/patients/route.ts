import { NextResponse } from 'next/server';
import { patientCreateSchema } from '@/lib/clinical/validators';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للوصول إلى ملفات المرضى.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: error?.includes('حدد العيادة') ? 400 : 403 });
  const q = new URL(request.url).searchParams.get('q')?.trim();
  const canReadClinicalFields = ['owner','clinic_admin','dentist','clinician','assistant'].includes(context.role);
  const table = canReadClinicalFields ? 'patients' : 'patient_directory';
  const columns = canReadClinicalFields
    ? 'id,patient_number,full_name,date_of_birth,reported_age_years,sex,phone,chief_complaint,created_at,updated_at,record_status'
    : 'id,patient_number,full_name,date_of_birth,reported_age_years,phone,created_at,updated_at,record_status';
  let query = supabase.from(table).select(columns)
    .eq('organization_id', context.organizationId).order('updated_at', { ascending: false }).limit(100);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[,%()]/g, '')}%,patient_number.ilike.%${q.replace(/[,%()]/g, '')}%`);
  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: 'تعذر تحميل قائمة المرضى.' }, { status: 500 });
  return NextResponse.json({ patients: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول لإنشاء ملف مريض.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: error?.includes('حدد العيادة') ? 400 : 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) return NextResponse.json({ error: 'دور الحساب لا يسمح بإنشاء ملفات المرضى.' }, { status: 403 });
  const json = await request.json().catch(() => null);
  const parsed = patientCreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'تحقق من الحقول المدخلة.', issues: parsed.error.flatten() }, { status: 400 });
  const values = { ...parsed.data, organization_id: context.organizationId, created_by: user.id, updated_by: user.id };
  const { data, error: insertError } = await supabase.from('patients').insert(values).select('id,patient_number,full_name,date_of_birth,reported_age_years,sex,phone,chief_complaint,created_at,record_status').single();
  if (insertError) return NextResponse.json({ error: insertError.code === '23505' ? 'رقم الملف مستخدم من قبل.' : 'تعذر إنشاء الملف. تحقق من البيانات وصلاحيات العيادة.' }, { status: insertError.code === '23505' ? 409 : 400 });
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'patient.created', resource_type: 'patient', resource_id: data.id, metadata: { origin: 'api' } });
  return NextResponse.json({ patient: data }, { status: 201 });
}
