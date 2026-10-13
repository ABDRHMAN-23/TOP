import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({ patient_id: z.string().uuid(), tooth_number: z.string().trim().min(1).max(12), notation_system: z.enum(['FDI','Universal','Palmer']).default('FDI'), diagnosis: z.string().max(2000).optional().nullable(), diagnosis_state: z.enum(['needs_review','ai_suggested','clinician_confirmed']).default('needs_review'), stage: z.enum(['planned','in_progress','completed','deferred','stopped']).default('planned'), follow_up_at: z.string().datetime().optional().nullable(), follow_up_note: z.string().max(2000).optional().nullable(), note: z.string().max(10000).optional().nullable(), canals: z.array(z.object({ canal_name: z.string().trim().min(1).max(80), measurement_type: z.enum(['estimated_length','working_length','measured_length','recheck']), length_value: z.number().positive().max(100).optional().nullable(), unit: z.enum(['mm','cm']).default('mm'), method: z.string().max(200).optional().nullable(), source_quote: z.string().max(1000).optional().nullable(), state: z.enum(['needs_review','ai_suggested','clinician_confirmed','corrected']).default('needs_review') }).strict()).max(20).default([]) }).strict();

export async function GET(request: Request, ctx: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  const { data: cases, error: caseError } = await supabase.from('endodontic_cases').select('*').eq('encounter_id', encounterId).eq('organization_id', context.organizationId).order('created_at', { ascending: false });
  if (caseError) return NextResponse.json({ error: 'تعذر تحميل ملفات علاج العصب.' }, { status: 500 });
  const ids = (cases ?? []).map((item) => item.id);
  const { data: canals, error: canalError } = ids.length ? await supabase.from('endodontic_canals').select('*').eq('organization_id', context.organizationId).in('endodontic_case_id', ids).order('created_at', { ascending: true }) : { data: [], error: null };
  if (canalError) return NextResponse.json({ error: 'تعذر تحميل قياسات القنوات.' }, { status: 500 });
  return NextResponse.json({ cases: (cases ?? []).map((item) => ({ ...item, canals: (canals ?? []).filter((canal) => canal.endodontic_case_id === item.id) })) });
}

export async function POST(request: Request, ctx: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return NextResponse.json({ error: 'ملفات علاج العصب متاحة للطبيب المخوّل فقط.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'تحقق من بيانات الحالة وأطوال القنوات ووحداتها.' }, { status: 400 });
  const { data: encounter } = await supabase.from('encounters').select('id,patient_id').eq('id', encounterId).eq('organization_id', context.organizationId).maybeSingle();
  if (!encounter || encounter.patient_id !== parsed.data.patient_id) return NextResponse.json({ error: 'الزيارة لا تخص المريض المحدد.' }, { status: 400 });
  const { canals, ...caseData } = parsed.data;
  const { data: caseRow, error: caseError } = await supabase.from('endodontic_cases').insert({ ...caseData, organization_id: context.organizationId, encounter_id: encounterId, created_by: user.id, confirmed_by: caseData.diagnosis_state === 'clinician_confirmed' ? user.id : null, confirmed_at: caseData.diagnosis_state === 'clinician_confirmed' ? new Date().toISOString() : null }).select('*').single();
  if (caseError || !caseRow) return NextResponse.json({ error: 'تعذر حفظ حالة علاج العصب.' }, { status: 500 });
  let savedCanals: unknown[] = [];
  if (canals.length) {
    const { data, error: canalError } = await supabase.from('endodontic_canals').insert(canals.map((canal) => ({ ...canal, organization_id: context.organizationId, endodontic_case_id: caseRow.id, measured_by: user.id, measured_at: canal.length_value == null ? null : new Date().toISOString(), verified_by: canal.state === 'clinician_confirmed' ? user.id : null, verified_at: canal.state === 'clinician_confirmed' ? new Date().toISOString() : null }))).select('*');
    if (canalError) return NextResponse.json({ error: 'حُفظت الحالة لكن تعذر حفظ قياسات بعض القنوات. راجع الحالة قبل إعادة الإرسال.' }, { status: 500 });
    savedCanals = data ?? [];
  }
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'endodontic_case.created', resource_type: 'endodontic_case', resource_id: caseRow.id, metadata: { tooth_number: caseRow.tooth_number, canal_count: savedCanals.length } });
  return NextResponse.json({ case: { ...caseRow, canals: savedCanals } }, { status: 201 });
}
