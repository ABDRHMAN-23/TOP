import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

type TargetState = 'paused' | 'capturing';

export async function transitionRecording(
  request: Request,
  ctx: { params: Promise<{ recordingId: string }> },
  target: TargetState,
) {
  const { recordingId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });

  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'لا تملك صلاحية التحكم في التسجيل السريري.' }, { status: 403 });
  }

  const { data: session, error: readError } = await supabase
    .from('recording_sessions')
    .select('id,capture_state,created_by,finished_at')
    .eq('id', recordingId)
    .eq('organization_id', context.organizationId)
    .maybeSingle();
  if (readError || !session) return NextResponse.json({ error: 'جلسة التسجيل غير موجودة في العيادة الحالية.' }, { status: 404 });
  if (session.created_by !== user.id) return NextResponse.json({ error: 'لا تملك صلاحية التحكم في هذه الجلسة.' }, { status: 403 });
  if (session.finished_at || ['queued', 'transcribing', 'structuring', 'needs_review', 'failed', 'deleted'].includes(session.capture_state)) {
    return NextResponse.json({ error: 'انتهت مرحلة التسجيل ولا يمكن تغيير حالتها الآن.' }, { status: 409 });
  }
  if (session.capture_state === target) return NextResponse.json({ recording_id: recordingId, state: target, unchanged: true });

  const allowedFrom = target === 'paused' ? ['capturing', 'uploading'] : ['paused'];
  if (!allowedFrom.includes(session.capture_state)) {
    return NextResponse.json({ error: 'تغيرت حالة التسجيل؛ حدّث الصفحة قبل إعادة المحاولة.' }, { status: 409 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('recording_sessions')
    .update({ capture_state: target, updated_at: new Date().toISOString() })
    .eq('id', recordingId)
    .eq('organization_id', context.organizationId)
    .eq('created_by', user.id)
    .eq('capture_state', session.capture_state)
    .select('id,capture_state')
    .maybeSingle();
  if (updateError || !updated) return NextResponse.json({ error: 'تعذر مزامنة حالة التسجيل؛ تحقق من الحالة الحالية.' }, { status: 409 });

  await supabase.from('audit_events').insert({
    organization_id: context.organizationId,
    actor_user_id: user.id,
    action: target === 'paused' ? 'recording.paused' : 'recording.resumed',
    resource_type: 'recording_session',
    resource_id: recordingId,
    metadata: {},
  });
  return NextResponse.json({ recording_id: recordingId, state: updated.capture_state });
}
