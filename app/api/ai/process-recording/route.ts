import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';
import { sanitizeModelDraft, validateRecordingByteCount } from '@/lib/clinical/safety.mjs';
import { getGeminiApiKey, getRuntimeEnv } from '@/lib/cloudflare/runtime-env';

export const runtime = 'nodejs';
export const maxDuration = 300;
const schema = z.object({ recording_id: z.string().uuid(), job_id: z.string().uuid() }).strict();

type AudioChunk = { chunk_index: number; storage_key: string; mime_type: string };
function geminiUrl(model: string, key: string) { return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`; }
async function geminiGenerate(model: string, key: string, parts: Array<Record<string, unknown>>, json = false): Promise<string> {
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, ...(json ? { responseMimeType: 'application/json' } : {}) } };
  const response = await fetch(geminiUrl(model, key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`تعذرت معالجة الذكاء الاصطناعي (HTTP ${response.status}). تحقق من مفتاح Gemini وحدود الاستخدام.`);
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('')?.trim();
  if (!text) throw new Error('أعاد مزود الذكاء الاصطناعي نتيجة فارغة.');
  return text;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول لمعالجة التسجيل.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'معرّف التسجيل أو المهمة غير صالح.' }, { status: 400 });
  const key = getGeminiApiKey();
  if (!key) return NextResponse.json({ error: 'لم يُضبط GEMINI_API_KEY على الخادم؛ بقي التسجيل محفوظاً دون معالجة.' }, { status: 503 });
  const model = getRuntimeEnv('GEMINI_MODEL') || 'gemini-2.5-flash';
  const { data: job, error: jobErr } = await supabase.from('ai_processing_jobs').select('id,status,recording_session_id,encounter_id,attempts,started_at').eq('id', parsed.data.job_id).eq('organization_id', context.organizationId).maybeSingle();
  if (jobErr || !job || job.recording_session_id !== parsed.data.recording_id) return NextResponse.json({ error: 'مهمة المعالجة غير موجودة ضمن العيادة الحالية.' }, { status: 404 });
  if (['completed', 'needs_review'].includes(job.status)) {
    const { data: alreadySaved } = await supabase.from('clinical_notes').select('id,encounter_id,status,version').eq('organization_id', context.organizationId).contains('provenance', { job_id: job.id }).maybeSingle();
    return NextResponse.json({ state: job.status, message: 'تمت معالجة هذه المهمة من قبل.', job_id: job.id, encounter_id: alreadySaved?.encounter_id || job.encounter_id, note_id: alreadySaved?.id || null, note_version: alreadySaved?.version || null, warning: 'هذه مسودة آلية؛ لا تُعد تشخيصاً أو سجلاً نهائياً قبل مراجعة الطبيب واعتماده.' });
  }
  const { data: existingNote } = await supabase.from('clinical_notes').select('id,encounter_id,status,version').eq('organization_id', context.organizationId).contains('provenance', { job_id: job.id }).maybeSingle();
  if (existingNote) {
    await supabase.from('ai_processing_jobs').update({ status: 'needs_review', finished_at: new Date().toISOString(), error_message: null }).eq('id', job.id).eq('organization_id', context.organizationId);
    await supabase.from('recording_sessions').update({ capture_state: 'needs_review' }).eq('id', parsed.data.recording_id).eq('organization_id', context.organizationId);
    return NextResponse.json({ state: 'needs_review', job_id: job.id, encounter_id: existingNote.encounter_id, message: 'توجد مسودة محفوظة لهذه المهمة بالفعل.', note_id: existingNote.id });
  }
  // Compare-and-set claim: duplicate client retries must not transcribe the same audio
  // concurrently. A worker abandoned by a platform timeout becomes reclaimable after 10 minutes.
  const staleWorker = ['transcribing', 'structuring'].includes(job.status)
    && Date.parse(job.started_at || '') < Date.now() - 10 * 60 * 1000;
  const claimableStatuses = ['queued', 'failed'];
  if (staleWorker) claimableStatuses.push(job.status);
  if (!claimableStatuses.includes(job.status)) {
    return NextResponse.json({ error: 'المعالجة جارية بالفعل لهذه المهمة؛ لا حاجة إلى بدء نسخة ثانية.', state: job.status, job_id: job.id, encounter_id: job.encounter_id }, { status: 409 });
  }
  if (Number(job.attempts || 0) >= 5) {
    return NextResponse.json({ error: 'تجاوزت المهمة حد المحاولات الآمنة. بقي التسجيل محفوظاً ويلزم فحص الخطأ قبل إعادة التشغيل.', state: 'failed', job_id: job.id }, { status: 429 });
  }
  const startedAt = new Date().toISOString();
  const { data: claimedJob, error: claimError } = await supabase.from('ai_processing_jobs')
    .update({ status: 'transcribing', started_at: startedAt, attempts: Number(job.attempts || 0) + 1, model_provider: 'google_gemini', model_name: model, error_message: null, updated_at: startedAt })
    .eq('id', job.id).eq('organization_id', context.organizationId).eq('attempts', Number(job.attempts || 0))
    .in('status', claimableStatuses).select('id').maybeSingle();
  if (claimError || !claimedJob) {
    return NextResponse.json({ error: 'بدأت معالجة هذه المهمة في طلب آخر أو تغيرت حالتها. حدّث الحالة قبل إعادة المحاولة.', state: 'processing', job_id: job.id }, { status: 409 });
  }
  const { data: claimedSession, error: sessionStateError } = await supabase.from('recording_sessions')
    .update({ capture_state: 'transcribing', updated_at: startedAt })
    .eq('id', parsed.data.recording_id).eq('organization_id', context.organizationId)
    .in('capture_state', ['queued', 'failed', ...(staleWorker ? ['transcribing', 'structuring'] : [])]).select('id').maybeSingle();
  if (sessionStateError || !claimedSession) {
    await supabase.from('ai_processing_jobs').update({ status: 'failed', error_message: 'تعذر تحديث حالة جلسة التسجيل قبل المعالجة.', finished_at: new Date().toISOString() }).eq('id', job.id).eq('organization_id', context.organizationId).eq('status', 'transcribing');
    return NextResponse.json({ error: 'تعذر تجهيز جلسة التسجيل للمعالجة؛ بقي الصوت محفوظاً.', state: 'failed', recoverable: true }, { status: 409 });
  }
  try {
    const { data: chunks, error: chunksError } = await supabase.from('recording_chunks').select('chunk_index,storage_key,mime_type').eq('recording_session_id', parsed.data.recording_id).eq('organization_id', context.organizationId).order('chunk_index', { ascending: true });
    if (chunksError || !chunks?.length) throw new Error('لا توجد مقاطع صوت قابلة للمعالجة.');
    // MediaRecorder timeslice blobs are fragments; concatenate them in order before sending audio to the provider.
    const bucket = process.env.CLINICAL_AUDIO_BUCKET || 'clinical-audio-private';
    const audioBuffers: Buffer[] = [];
    let totalAudioBytes = 0;
    for (const chunk of chunks as AudioChunk[]) {
      const { data: object, error: objectError } = await supabase.storage.from(bucket).download(chunk.storage_key);
      if (objectError || !object) throw new Error('تعذر قراءة أحد مقاطع الصوت من التخزين الخاص.');
      const bytes = Buffer.from(await object.arrayBuffer());
      totalAudioBytes += bytes.byteLength;
      const sizeValidation = validateRecordingByteCount(totalAudioBytes);
      if (!sizeValidation.ok && sizeValidation.reason === 'too_large') throw new Error('حُفظ التسجيل، لكن حجمه يتجاوز حد المعالجة المباشرة الحالي (15MB). قسّم الزيارة إلى جلسات أقصر أو أضف مسار الرفع الكبير قبل استخدام هذا التسجيل.');
      audioBuffers.push(bytes);
    }
    const audioBase64 = Buffer.concat(audioBuffers).toString('base64');
    const mimeType = chunks[0]?.mime_type || 'audio/webm';
    const prompt = `أنت خدمة تفريغ صوتي سريرية. فرّغ التسجيل كاملاً كما قيل بلغته الأصلية (العربية ولهجاتها أو الإنجليزية). لا تُصلح أسماء الأدوية أو القياسات بالتخمين، ولا تكتب تشخيصاً لم يُذكر. لا تنسب أي جملة إلى الطبيب أو المريض إذا لم توجد قرينة صوتية واضحة؛ اكتب "المتحدث غير محدد" عند الشك. أعد نص التفريغ فقط، مع [غير واضح] حيث لا يمكن تمييز الكلام. هذا النص مسودة للمراجعة، وليس سجلاً طبياً نهائياً.`;
    const transcript = await geminiGenerate(model, key, [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }]);
    if (transcript.length > 150000) throw new Error('نص التفريغ أطول من الحد المسموح للمسودة؛ احتُفظ بالصوت وتوقفت المعالجة الآلية.');
    await supabase.from('ai_processing_jobs').update({ progress_step: 'transcription_complete' }).eq('id', job.id).eq('organization_id', context.organizationId);
    const structurePrompt = `حوّل التفريغ الآتي إلى JSON صالح فقط، باستخدام المفاتيح المحددة. النص قد يتضمن كلام طبيب ومريض ولا يمكن ضمان تمييز المتحدثين. لا تضف أي حقيقة غير موجودة. عند غياب معلومة استخدم value:null و state:"not_collected". استخدم state:"patient_reported" للشكوى/التاريخ الذي يذكره المريض، state:"ai_suggested" لأي تلخيص أو استنتاج يحتاج مراجعة الطبيب. لا تحول طلب المريض إلى تشخيص أو وصفة. لا تجعل الحساسية أو الدواء "لا يوجد" إذا لم يُذكر نفي صريح. القياسات وأطوال القنوات يجب أن تبقى بالنص الأصلي مع علامة مراجعة إذا كانت ملتبسة. لا تعلن الإجراء مكتملًا إذا قيل فقط إنه مخطط. لا توقع ولا تعتمد السجل.\nأخرج JSON بمفاتيح: chiefComplaint, historyOfPresentIllness, medicalHistory, allergies, medications, examinationFindings, assessment, proposedPlan, proceduresDiscussed, proceduresCompleted, prescriptionsSuggested, followUp, uncertaintyFlags. كل قيمة سريرية عدا uncertaintyFlags تكون كائن {"value":...,"state":"not_collected|unknown|patient_reported|ai_suggested|clinician_confirmed","source":"quote or null","confidence":null}. جميع قوائم الarrays لا بد أن تكون arrays أو null. uncertaintyFlags مصفوفة نصوص.\n\nالتفريغ:\n${transcript}`;
    const structuredRaw = await geminiGenerate(model, key, [{ text: structurePrompt }], true);
    let draft: Record<string, unknown>;
    try { draft = sanitizeModelDraft(JSON.parse(structuredRaw)) as Record<string, unknown>; } catch { throw new Error('لم يرجع النموذج بنية JSON سريرية صالحة؛ احتُفظ بالتفريغ وأُوقفت عملية إنشاء المسودة.'); }
    const { data: recording, error: recordingError } = await supabase.from('recording_sessions').select('encounter_id,patient_id').eq('id', parsed.data.recording_id).eq('organization_id', context.organizationId).single();
    if (recordingError || !recording) throw new Error('تعذر ربط المسودة بالزيارة.');
    const { error: segmentDeleteError } = await supabase.from('transcript_segments').delete().eq('encounter_id', recording.encounter_id).eq('organization_id', context.organizationId).eq('source_job_id', job.id);
    if (segmentDeleteError) throw new Error('تعذر تجهيز مقاطع التفريغ للحفظ.');
    const transcriptSegments = transcript.split(/\n{2,}/).map((text: string) => text.trim()).filter(Boolean);
    const segments = (transcriptSegments.length ? transcriptSegments : [transcript]).map((text: string, i: number) => ({ organization_id: context.organizationId, encounter_id: recording.encounter_id, source_job_id: job.id, segment_index: i, text, speaker_label: 'غير محدد', speaker_confidence: null, transcription_confidence: null, state: 'needs_review' }));
    const { error: segmentError } = await supabase.from('transcript_segments').insert(segments);
    if (segmentError) throw new Error('تعذر حفظ نص التفريغ.');
    const noteRecord = { organization_id: context.organizationId, encounter_id: recording.encounter_id, patient_id: recording.patient_id, created_by: user.id, status: 'needs_review', version: 1, draft_json: draft, transcript_text: transcript, model_provider: 'google_gemini', model_name: model, provenance: { job_id: job.id, source: 'recording_transcription', clinician_approval_required: true } };
    const { data: savedNote, error: noteError } = await supabase.from('clinical_notes').insert(noteRecord).select('id,version,status').single();
    if (noteError || !savedNote) throw new Error('تعذر حفظ المسودة السريرية.');
    await supabase.from('encounters').update({ status: 'needs_review' }).eq('id', recording.encounter_id).eq('organization_id', context.organizationId);
    await supabase.from('recording_sessions').update({ capture_state: 'needs_review' }).eq('id', parsed.data.recording_id).eq('organization_id', context.organizationId);
    await supabase.from('ai_processing_jobs').update({ status: 'needs_review', finished_at: new Date().toISOString(), output_summary: { transcript_segment_count: segments.length, model }, error_message: null }).eq('id', job.id).eq('organization_id', context.organizationId);
    await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'clinical_draft.created_by_ai', resource_type: 'clinical_note', resource_id: recording.encounter_id, metadata: { job_id: job.id, model, clinician_approval_required: true } });
    return NextResponse.json({ state: 'needs_review', job_id: job.id, encounter_id: recording.encounter_id, note_id: savedNote.id, note_version: savedNote.version, transcript, draft, warning: 'هذه مسودة آلية؛ لا تُعد تشخيصاً أو سجلاً نهائياً قبل مراجعة الطبيب واعتماده.' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'فشلت المعالجة بسبب خطأ غير معروف.';
    await supabase.from('ai_processing_jobs').update({ status: 'failed', error_message: message.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', job.id).eq('organization_id', context.organizationId);
    await supabase.from('recording_sessions').update({ capture_state: 'failed' }).eq('id', parsed.data.recording_id).eq('organization_id', context.organizationId);
    await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'ai_processing.failed', resource_type: 'ai_processing_job', resource_id: job.id, metadata: { message: message.slice(0, 200) } });
    return NextResponse.json({ error: message, state: 'failed', recoverable: true }, { status: 500 });
  }
}
