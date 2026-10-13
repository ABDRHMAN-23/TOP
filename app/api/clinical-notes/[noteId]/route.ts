import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const patchSchema = z.object({
  expected_version: z.number().int().positive(),
  draft_json: z.record(z.string(), z.unknown()),
  transcript_text: z.string().max(150000).optional().nullable(),
}).strict();

export async function GET(request: Request, ctx: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'السجلات السريرية متاحة للفريق السريري المخوّل فقط.' }, { status: 403 });
  }
  const { data, error: dbError } = await supabase.from('clinical_notes')
    .select('id,organization_id,encounter_id,patient_id,status,version,draft_json,transcript_text,provenance,created_at,updated_at,approved_by,approved_at')
    .eq('id', noteId).eq('organization_id', context.organizationId).maybeSingle();
  if (dbError || !data) return NextResponse.json({ error: 'السجل السريري غير موجود.' }, { status: 404 });
  return NextResponse.json({ note: data });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'لا تملك صلاحية تعديل السجل السريري.' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'بيانات المسودة غير صالحة.' }, { status: 400 });

  // Revisions use a locked compare-and-set transaction: insert the next version and supersede
  // its parent atomically, rather than risking two concurrent writers creating the same version.
  const { data: note, error: revisionError } = await supabase.rpc('revise_clinical_note', {
    p_organization_id: context.organizationId,
    p_clinical_note_id: noteId,
    p_expected_version: parsed.data.expected_version,
    p_draft_json: parsed.data.draft_json,
    p_transcript_text: parsed.data.transcript_text ?? null,
  });
  if (revisionError || !note) {
    const code = (revisionError as { code?: string } | null)?.code;
    const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '40001' ? 409 : code === '55000' || code === '22023' ? 409 : 500;
    const message = status === 403 ? 'لا توجد صلاحية تعديل في هذه العيادة.'
      : status === 404 ? 'المسودة غير موجودة في العيادة الحالية.'
      : status === 409 ? 'تغيرت النسخة أو أُغلقت للتعديل. أعد تحميل السجل.'
      : 'تعذر حفظ نسخة المراجعة بصورة آمنة.';
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ note, message: 'حُفظت نسخة جديدة بشكل ذري؛ بقيت بحاجة إلى مراجعة واعتماد.' }, { status: 201 });
}
