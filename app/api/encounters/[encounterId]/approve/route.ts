import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({
  clinical_note_id: z.string().uuid(),
  expected_version: z.number().int().positive(),
  confirmation: z.literal(true),
  method: z.enum(['clinician_review', 'electronic_signature']).default('clinician_review'),
}).strict();

export async function POST(request: Request, ctx: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'اعتماد السجل متاح للطبيب المخوّل فقط.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'تأكيد الاعتماد أو بيانات النسخة غير صالحة.' }, { status: 400 });

  // Approval is performed in one database transaction. Clients cannot update clinical_notes
  // directly, so no note can appear approved without its matching encounter and audit event.
  const { data: note, error: approvalError } = await supabase.rpc('approve_clinical_note', {
    p_organization_id: context.organizationId,
    p_encounter_id: encounterId,
    p_clinical_note_id: parsed.data.clinical_note_id,
    p_expected_version: parsed.data.expected_version,
    p_method: parsed.data.method,
  });
  if (approvalError || !note) {
    const code = (approvalError as { code?: string } | null)?.code;
    const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '40001' ? 409 : code === '55000' || code === '22023' ? 409 : 500;
    const message = status === 403 ? 'لا توجد صلاحية اعتماد في هذه العيادة.'
      : status === 404 ? 'السجل أو الزيارة غير موجودين في العيادة الحالية.'
      : status === 409 ? 'تغيرت النسخة أو لم تعد في حالة تسمح بالاعتماد. أعد تحميل السجل.'
      : 'تعذر اعتماد السجل بصورة آمنة؛ لم يتم تأكيد نجاح العملية.';
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ note, message: 'تم اعتماد النسخة المحددة في معاملة واحدة مع تحديث الزيارة وسجل التدقيق.' });
}
