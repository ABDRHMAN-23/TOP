import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({
  chief_complaint: z.string().trim().max(2000).optional().nullable(),
  encounter_type: z.enum(['dental_visit', 'dental_examination', 'endodontic_visit', 'follow_up', 'emergency']).default('dental_visit'),
}).strict();

const emptyFact = () => ({ value: null, state: 'not_collected', source: null, confidence: null });

export async function POST(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'إنشاء سجل سريري يدوي متاح للطبيب المخوّل فقط.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'بيانات الزيارة غير صالحة.' }, { status: 400 });

  const { data: patient, error: patientError } = await supabase.from('patients')
    .select('id,full_name')
    .eq('id', patientId)
    .eq('organization_id', context.organizationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (patientError || !patient) return NextResponse.json({ error: 'المريض غير موجود في العيادة الحالية.' }, { status: 404 });

  const complaint = parsed.data.chief_complaint?.trim() || null;
  const { data: encounter, error: encounterError } = await supabase.from('encounters').insert({
    organization_id: context.organizationId,
    patient_id: patient.id,
    clinician_user_id: user.id,
    status: 'needs_review',
    encounter_type: parsed.data.encounter_type,
    started_at: new Date().toISOString(),
    chief_complaint: complaint,
    created_by: user.id,
  }).select('id,patient_id,status,started_at,chief_complaint').single();
  if (encounterError || !encounter) return NextResponse.json({ error: 'تعذر إنشاء الزيارة اليدوية.' }, { status: 500 });

  const draft: Record<string, unknown> = {
    chiefComplaint: complaint ? { value: complaint, state: 'patient_reported', source: 'إدخال يدوي من الطبيب وفق ما ذكره المريض', confidence: null } : emptyFact(),
    historyOfPresentIllness: emptyFact(), medicalHistory: emptyFact(), allergies: emptyFact(), medications: emptyFact(),
    examinationFindings: emptyFact(), assessment: emptyFact(), proposedPlan: emptyFact(), proceduresDiscussed: emptyFact(),
    proceduresCompleted: emptyFact(), prescriptionsSuggested: emptyFact(), followUp: emptyFact(),
    uncertaintyFlags: ['هذه زيارة يدوية أولية؛ أكمل المعلومات اللازمة وتحقق منها قبل الاعتماد.'],
  };
  const { data: note, error: noteError } = await supabase.from('clinical_notes').insert({
    organization_id: context.organizationId,
    encounter_id: encounter.id,
    patient_id: patient.id,
    created_by: user.id,
    status: 'needs_review',
    version: 1,
    draft_json: draft,
    transcript_text: null,
    provenance: { source: 'manual_entry', clinician_approval_required: true },
  }).select('id,version,status').single();

  if (noteError || !note) {
    await supabase.from('encounters').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', encounter.id).eq('organization_id', context.organizationId);
    return NextResponse.json({ error: 'أُنشئت الزيارة لكن تعذر إنشاء مسودة لها؛ أُوقفت الزيارة لحين المراجعة.' }, { status: 500 });
  }

  await supabase.from('audit_events').insert({
    organization_id: context.organizationId,
    actor_user_id: user.id,
    action: 'clinical_note.created_manually',
    resource_type: 'clinical_note',
    resource_id: note.id,
    metadata: { encounter_id: encounter.id, patient_id: patient.id, version: note.version },
  });
  return NextResponse.json({ encounter, note, message: 'أُنشئت مسودة يدوية؛ أكمل الحقول وراجعها قبل الاعتماد.' }, { status: 201 });
}
