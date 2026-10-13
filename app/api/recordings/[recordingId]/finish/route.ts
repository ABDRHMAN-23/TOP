import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

export async function POST(request: Request, ctx: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician'].includes(context.role)) {
    return NextResponse.json({ error: 'لا تملك صلاحية إنهاء التسجيل السريري.' }, { status: 403 });
  }

  const { data: session, error: sessionError } = await supabase
    .from('recording_sessions')
    .select('id,encounter_id,capture_state,created_by,finished_at')
    .eq('id', recordingId)
    .eq('organization_id', context.organizationId)
    .maybeSingle();
  if (sessionError || !session) return NextResponse.json({ error: 'جلسة التسجيل غير موجودة.' }, { status: 404 });
  if (session.created_by !== user.id) return NextResponse.json({ error: 'لا تملك صلاحية إنهاء هذه الجلسة.' }, { status: 403 });

  // Idempotency: a repeated finish request returns the existing active job instead of creating a duplicate.
  const { data: existingJob, error: existingError } = await supabase
    .from('ai_processing_jobs')
    .select('id,status,encounter_id,recording_session_id')
    .eq('recording_session_id', recordingId)
    .eq('organization_id', context.organizationId)
    .eq('job_type', 'transcribe_and_structure')
    .in('status', ['queued', 'transcribing', 'structuring', 'needs_review', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: 'تعذر التحقق من حالة مهمة المعالجة الحالية.' }, { status: 500 });
  if (existingJob) {
    return NextResponse.json({ recording_id: recordingId, encounter_id: existingJob.encounter_id, job_id: existingJob.id, state: existingJob.status, reused: true });
  }
  if (['failed', 'deleted'].includes(session.capture_state)) {
    return NextResponse.json({ error: 'جلسة التسجيل متوقفة أو محذوفة ولا يمكن إنهاؤها.' }, { status: 409 });
  }

  const { count, error: countError } = await supabase
    .from('recording_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('recording_session_id', recordingId)
    .eq('organization_id', context.organizationId);
  if (countError) return NextResponse.json({ error: 'تعذر التأكد من وصول المقاطع إلى التخزين.' }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'لم يصل أي مقطع صوت إلى التخزين؛ لم يتم إنهاء التسجيل.' }, { status: 409 });

  const now = new Date().toISOString();
  const { data: updatedSession, error: updateError } = await supabase
    .from('recording_sessions')
    .update({ capture_state: 'queued', finished_at: now, updated_at: now })
    .eq('id', recordingId)
    .eq('organization_id', context.organizationId)
    .eq('created_by', user.id)
    .in('capture_state', ['capturing', 'paused', 'uploading', 'queued'])
    .select('id')
    .maybeSingle();
  if (updateError || !updatedSession) {
    // A concurrent finish may have created the job after our first read. Check once and return it if so.
    const { data: concurrentJob } = await supabase.from('ai_processing_jobs')
      .select('id,status,encounter_id')
      .eq('recording_session_id', recordingId)
      .eq('organization_id', context.organizationId)
      .eq('job_type', 'transcribe_and_structure')
      .in('status', ['queued', 'transcribing', 'structuring', 'needs_review', 'completed'])
      .limit(1).maybeSingle();
    if (concurrentJob) return NextResponse.json({ recording_id: recordingId, encounter_id: concurrentJob.encounter_id, job_id: concurrentJob.id, state: concurrentJob.status, reused: true });
    return NextResponse.json({ error: 'تعذر إنهاء جلسة التسجيل؛ حدّث الحالة وأعد المحاولة.' }, { status: 409 });
  }

  const { data: job, error: jobError } = await supabase.from('ai_processing_jobs')
    .insert({ organization_id: context.organizationId, encounter_id: session.encounter_id, recording_session_id: recordingId, job_type: 'transcribe_and_structure', status: 'queued', requested_by: user.id })
    .select('id').single();
  if (jobError || !job) {
    // If another finish request won the unique-index race, reuse its job rather than
    // reporting a false failure after the audio is already queued.
    const { data: concurrentJob } = await supabase.from('ai_processing_jobs')
      .select('id,status,encounter_id')
      .eq('recording_session_id', recordingId)
      .eq('organization_id', context.organizationId)
      .eq('job_type', 'transcribe_and_structure')
      .in('status', ['queued', 'transcribing', 'structuring', 'needs_review', 'completed'])
      .limit(1).maybeSingle();
    if (concurrentJob) {
      return NextResponse.json({ recording_id: recordingId, encounter_id: concurrentJob.encounter_id, job_id: concurrentJob.id, state: concurrentJob.status, reused: true });
    }
    // Leave uploaded chunks intact; a retry can reconcile a transient insertion failure.
    return NextResponse.json({ error: 'انتهى التسجيل لكن تعذر إنشاء مهمة المعالجة. احتفظ بالجلسة وأعد المحاولة للتحقق من حالتها.' }, { status: 500 });
  }

  await supabase.from('encounters').update({ status: 'processing', ended_at: now, updated_at: now }).eq('id', session.encounter_id).eq('organization_id', context.organizationId);
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'recording.finished', resource_type: 'recording_session', resource_id: recordingId, metadata: { job_id: job.id, chunk_count: count } });
  return NextResponse.json({ recording_id: recordingId, encounter_id: session.encounter_id, job_id: job.id, state: 'queued', message: 'حُفظ التسجيل وأُنشئت مهمة المعالجة؛ ستبقى النتيجة مسودة حتى مراجعة الطبيب.' });
}
