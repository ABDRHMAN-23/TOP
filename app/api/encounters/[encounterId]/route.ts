import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

export async function GET(request: Request, ctx: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return NextResponse.json({ error: 'تفاصيل السجل السريري متاحة للطبيب المخوّل فقط.' }, { status: 403 });
  const { data: encounter, error: encounterError } = await supabase.from('encounters').select('id,organization_id,patient_id,clinician_user_id,status,encounter_type,started_at,ended_at,chief_complaint,created_at,patients(id,patient_number,full_name,date_of_birth,sex,phone,chief_complaint)').eq('id', encounterId).eq('organization_id', context.organizationId).maybeSingle();
  if (encounterError || !encounter) return NextResponse.json({ error: 'الزيارة غير موجودة في العيادة الحالية.' }, { status: 404 });
  const [{ data: note, error: noteError }, { data: segments, error: segmentError }] = await Promise.all([
    supabase.from('clinical_notes').select('id,encounter_id,patient_id,status,version,draft_json,transcript_text,provenance,created_at,updated_at,approved_by,approved_at').eq('encounter_id', encounterId).eq('organization_id', context.organizationId).neq('status', 'superseded').order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('transcript_segments').select('id,segment_index,start_ms,end_ms,text,speaker_label,state,created_at').eq('encounter_id', encounterId).eq('organization_id', context.organizationId).order('segment_index', { ascending: true }),
  ]);
  if (noteError || segmentError) return NextResponse.json({ error: 'تعذر تحميل محتوى الزيارة.' }, { status: 500 });
  return NextResponse.json({ encounter, note: note ?? null, transcript_segments: segments ?? [] });
}
