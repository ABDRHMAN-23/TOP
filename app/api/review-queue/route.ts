import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const allowedRoles = ['owner', 'clinic_admin', 'dentist', 'clinician'];

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للوصول إلى قائمة المراجعة.' }, { status: 401 });

  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!allowedRoles.includes(context.role)) {
    return NextResponse.json({ error: 'قائمة مراجعة السجلات متاحة للطبيب السريري المخوّل فقط.' }, { status: 403 });
  }

  const { data: notes, error: notesError } = await supabase
    .from('clinical_notes')
    .select('id,organization_id,encounter_id,patient_id,status,version,created_at,updated_at')
    .eq('organization_id', context.organizationId)
    .in('status', ['draft', 'needs_review', 'ready_for_approval'])
    .order('updated_at', { ascending: false })
    .limit(50);

  if (notesError) return NextResponse.json({ error: 'تعذر تحميل قائمة السجلات التي تنتظر المراجعة.' }, { status: 500 });
  const items = notes ?? [];
  if (items.length === 0) return NextResponse.json({ items: [] });

  const encounterIds = [...new Set(items.map((item: any) => item.encounter_id))];
  const patientIds = [...new Set(items.map((item: any) => item.patient_id))];
  const [{ data: encounters, error: encountersError }, { data: patients, error: patientsError }] = await Promise.all([
    supabase.from('encounters').select('id,patient_id,chief_complaint,started_at,status').eq('organization_id', context.organizationId).in('id', encounterIds),
    supabase.from('patient_directory').select('id,full_name,patient_number').eq('organization_id', context.organizationId).in('id', patientIds),
  ]);

  if (encountersError || patientsError) {
    return NextResponse.json({ error: 'تعذر تحميل تفاصيل المراجعة ضمن العيادة الحالية.' }, { status: 500 });
  }

  const encounterById = Object.fromEntries((encounters ?? []).map((item: any) => [item.id, item]));
  const patientById = Object.fromEntries((patients ?? []).map((item: any) => [item.id, item]));

  return NextResponse.json({
    items: items.map((item: any) => {
      const encounter = encounterById[item.encounter_id];
      const patient = patientById[item.patient_id];
      return {
        id: item.id,
        encounter_id: item.encounter_id,
        patient_id: item.patient_id,
        patient_name: patient?.full_name ?? 'مريض',
        patient_number: patient?.patient_number ?? null,
        chief_complaint: encounter?.chief_complaint ?? null,
        encounter_status: encounter?.status ?? null,
        status: item.status,
        version: item.version,
        updated_at: item.updated_at ?? item.created_at,
      };
    }),
  });
}
