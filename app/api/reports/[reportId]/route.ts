import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

export async function GET(request: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return NextResponse.json({ error: 'التقرير السريري متاح للطبيب المخوّل فقط.' }, { status: 403 });
  const { data, error: dbError } = await supabase.from('reports').select('id,organization_id,patient_id,encounter_id,clinical_note_id,report_type,language,status,source_record_version,clinic_identity_snapshot,content_snapshot,storage_key,issued_at,created_at').eq('id', reportId).eq('organization_id', context.organizationId).maybeSingle();
  if (dbError || !data) return NextResponse.json({ error: 'التقرير غير موجود أو لا تملك صلاحية عرضه.' }, { status: 404 });
  const { data: patient } = await supabase.from('patients').select('id,patient_number,full_name,date_of_birth').eq('id', data.patient_id).eq('organization_id', context.organizationId).maybeSingle();
  return NextResponse.json({ report: data, patient });
}
