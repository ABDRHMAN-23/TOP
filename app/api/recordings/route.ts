import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({
  patient_id: z.string().uuid(),
  content_type: z.string().max(100).default('audio/webm'),
  consent_confirmed: z.literal(true),
  consent_policy_version: z.string().trim().min(1).max(60).default('clinic-policy-v1'),
}).strict();

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول قبل إنشاء جلسة تسجيل.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'يلزم اختيار مريض محفوظ وتأكيد الموافقة قبل التسجيل.' }, { status: 400 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'الحساب لا يملك صلاحية التسجيل السريري.' }, { status: 403 });
  }

  // The database RPC creates encounter + consent evidence + recording session + audit
  // in one transaction, preventing orphaned recording sessions on partial failure.
  const { data, error: startError } = await supabase.rpc('start_clinical_recording', {
    p_organization_id: context.organizationId,
    p_patient_id: parsed.data.patient_id,
    p_content_type: parsed.data.content_type,
    p_policy_version: parsed.data.consent_policy_version,
  });
  if (startError || !data || typeof data !== 'object' || !('recording_id' in data) || !('encounter_id' in data)) {
    const code = (startError as { code?: string } | null)?.code;
    const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '22023' ? 400 : 500;
    return NextResponse.json({ error: status === 404 ? 'المريض المحدد غير موجود ضمن العيادة الحالية.' : status === 400 ? 'نوع الصوت أو سياسة الموافقة غير صالح.' : status === 403 ? 'لا توجد صلاحية لبدء التسجيل في هذه العيادة.' : 'تعذر إنشاء جلسة التسجيل والموافقة بصورة آمنة.' }, { status });
  }
  return NextResponse.json(data, { status: 201 });
}
