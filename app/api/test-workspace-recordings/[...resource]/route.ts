import { NextResponse } from 'next/server';
import { getTestWorkspaceClient, getTestWorkspaceToken } from '@/lib/supabase/test-workspace';
import { getGeminiApiKey, getRuntimeEnv } from '@/lib/cloudflare/runtime-env';
import { sanitizeModelDraft, validateRecordingByteCount } from '@/lib/clinical/safety.mjs';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Segment = { chunk_index: number; mime_type: string; audio_base64: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedMimeTypes = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4']);
const noStore = { 'Cache-Control': 'no-store, max-age=0' };

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}
function normalizeMimeType(value: unknown) {
  return String(value || 'audio/webm').split(';')[0].trim().toLowerCase();
}
async function readJson(request: Request): Promise<Record<string, any> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, any> : null;
}
function geminiUrl(model: string, key: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
}
async function geminiGenerate(model: string, key: string, parts: Array<Record<string, unknown>>, json = false): Promise<string> {
  const response = await fetch(geminiUrl(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(240_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`تعذرت معالجة الصوت عبر Gemini (HTTP ${response.status}). احتُفظ بالتسجيل ويمكن إعادة المحاولة.`);
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
  if (!text) throw new Error('أعاد Gemini نتيجة فارغة؛ احتُفظ بالتسجيل ويمكن إعادة المحاولة.');
  return text;
}

export async function POST(request: Request, ctx: { params: Promise<{ resource: string[] }> }) {
  const token = getTestWorkspaceToken(request);
  if (!token) return errorResponse('مساحة العمل غير معرّفة. أعد تحميل صفحة سِنان.', 401);
  const client = getTestWorkspaceClient();
  if (!client) return errorResponse('اتصال قاعدة البيانات غير مهيأ.', 503);
  const { resource = [] } = await ctx.params;
  const [first, second, third] = resource;

  if (first === 'start' && resource.length === 1) {
    const input = await readJson(request);
    if (!input || typeof input.patient_id !== 'string' || !uuidPattern.test(input.patient_id)) return errorResponse('اختر ملف مريض صالحاً قبل التسجيل.');
    if (input.consent_confirmed !== true) return errorResponse('يلزم تأكيد الموافقة قبل تشغيل الميكروفون.');
    const contentType = normalizeMimeType(input.content_type);
    if (!allowedMimeTypes.has(contentType)) return errorResponse('صيغة الصوت غير مدعومة في مساحة الاختبار.', 415);
    const { data, error } = await client.rpc('sinan_test_start_recording', {
      p_workspace_token: token,
      p_patient_id: input.patient_id,
      p_content_type: contentType,
      p_consent_confirmed: true,
      p_policy_version: typeof input.consent_policy_version === 'string' ? input.consent_policy_version.slice(0, 60) : 'clinic-policy-v1',
    });
    if (error || !data || typeof data !== 'object' || !data.recording_id) return errorResponse(error?.code === 'P0002' ? 'المريض غير موجود في مساحة العمل الحالية.' : 'تعذر إنشاء جلسة تسجيل اختبار محفوظة.', error?.code === 'P0002' ? 404 : 503);
    return NextResponse.json(data, { status: 201, headers: noStore });
  }

  if (first && uuidPattern.test(first) && second === 'chunks' && resource.length === 2) {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const chunkIndex = Number(form?.get('chunk_index'));
    if (!(file instanceof File) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 2000) return errorResponse('مقطع الصوت أو رقمه غير صالح.');
    if (file.size <= 0 || file.size > 30_000) return errorResponse('حجم المقطع أكبر من حد مساحة الاختبار. تم ضبط التسجيل بمعدل منخفض؛ أوقفه وأعد المحاولة بمقاطع أقصر.', 413);
    const mimeType = normalizeMimeType(file.type || 'audio/webm');
    if (!allowedMimeTypes.has(mimeType)) return errorResponse('صيغة الصوت غير مدعومة. استخدم WebM أو OGG أو WAV أو MP3 أو MP4.', 415);
    const audioBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const { data, error } = await client.rpc('sinan_test_save_recording_chunk', {
      p_workspace_token: token,
      p_recording_id: first,
      p_chunk_index: chunkIndex,
      p_audio_base64: audioBase64,
      p_mime_type: mimeType,
    });
    if (error || !data) return errorResponse('تعذر حفظ مقطع الصوت في قاعدة بيانات مساحة الاختبار. ' + (error?.message?.includes('8 MB') ? 'وصل التسجيل إلى الحد الأقصى البالغ 8 MB.' : 'تحقق من الاتصال ثم أعد المحاولة.'), error?.code === 'P0002' ? 404 : 503);
    return NextResponse.json(data, { headers: noStore });
  }

  if (first && uuidPattern.test(first) && ['pause', 'resume'].includes(second || '') && resource.length === 2) {
    const { data, error } = await client.rpc('sinan_test_update_recording_state', {
      p_workspace_token: token,
      p_recording_id: first,
      p_target_state: second === 'pause' ? 'paused' : 'capturing',
    });
    if (error || !data) return errorResponse('تعذر تحديث حالة التسجيل. ' + (error?.message || ''), error?.code === 'P0002' ? 404 : 409);
    return NextResponse.json(data, { headers: noStore });
  }

  if (first && uuidPattern.test(first) && second === 'finish' && resource.length === 2) {
    const { data, error } = await client.rpc('sinan_test_update_recording_state', {
      p_workspace_token: token,
      p_recording_id: first,
      p_target_state: 'uploading',
    });
    if (error || !data) return errorResponse('تعذر إنهاء التسجيل أو لم يصل أي مقطع صوت إلى قاعدة البيانات.', error?.code === 'P0002' ? 404 : 409);
    return NextResponse.json({
      recording_id: first,
      encounter_id: data.encounter_id,
      job_id: first,
      state: 'queued',
      message: 'تم حفظ مقاطع الصوت؛ ستبقى النتيجة مسودة حتى مراجعتها.',
    }, { headers: noStore });
  }

  if (first === 'process' && resource.length === 1) {
    const input = await readJson(request);
    if (!input || typeof input.recording_id !== 'string' || !uuidPattern.test(input.recording_id)
        || typeof input.job_id !== 'string' || input.job_id !== input.recording_id) {
      return errorResponse('معرّف جلسة التسجيل أو مهمة المعالجة غير صالح.');
    }
    const recordingId: string = input.recording_id;
    const { data: recording, error: recordingError } = await client.rpc('sinan_test_get_recording', {
      p_workspace_token: token, p_recording_id: recordingId,
    });
    if (recordingError || !recording || !recording.recording_id) return errorResponse('جلسة التسجيل غير موجودة في مساحة العمل الحالية.', 404);
    if (recording.status === 'needs_review' && recording.transcript_text && recording.draft_json) {
      return NextResponse.json({
        state: 'needs_review', job_id: recordingId, transcript: recording.transcript_text,
        draft: recording.draft_json, warning: 'تم حفظ التفريغ والمسودة. راجع كل معلومة قبل الاعتماد؛ لم يتم اعتماد أي سجل تلقائياً.',
      }, { headers: noStore });
    }
    const key = getGeminiApiKey();
    if (!key) return errorResponse('مفتاح Gemini غير متاح على الخادم؛ التسجيل محفوظ ويمكن إعادة المعالجة بعد ضبطه.', 503);
    const { data: state, error: stateError } = await client.rpc('sinan_test_update_recording_state', {
      p_workspace_token: token, p_recording_id: recordingId, p_target_state: 'processing',
    });
    if (stateError || !state) return errorResponse('انتهت صلاحية جلسة التسجيل أو لم يكتمل رفع المقاطع.', 409);

    try {
      const { data: chunkData, error: chunksError } = await client.rpc('sinan_test_list_recording_chunks', {
        p_workspace_token: token, p_recording_id: recordingId,
      });
      const chunks = Array.isArray(chunkData) ? chunkData as Segment[] : [];
      if (chunksError || chunks.length === 0) throw new Error('لم توجد مقاطع صوت محفوظة قابلة للمعالجة.');
      const audioBuffers: Buffer[] = [];
      let totalAudioBytes = 0;
      for (const chunk of chunks) {
        if (!chunk.audio_base64 || !Number.isInteger(Number(chunk.chunk_index))) continue;
        const bytes = Buffer.from(chunk.audio_base64, 'base64');
        totalAudioBytes += bytes.byteLength;
        const validation = validateRecordingByteCount(totalAudioBytes);
        if (!validation.ok || totalAudioBytes > 8 * 1024 * 1024) throw new Error('وصل التسجيل إلى حد الحجم المسموح في مساحة الاختبار (8 MB).');
        audioBuffers.push(bytes);
      }
      if (!audioBuffers.length) throw new Error('لم توجد بيانات صوت قابلة للقراءة.');
      const model = getRuntimeEnv('GEMINI_MODEL') || 'gemini-2.5-flash';
      const audioBase64 = Buffer.concat(audioBuffers).toString('base64');
      const mimeType = normalizeMimeType(recording.content_type || chunks[0]?.mime_type || 'audio/webm');
      const transcriptPrompt = 'أنت خدمة تفريغ صوتي سريرية. فرّغ الكلام كاملاً باللغة الأصلية كما قيل، بما في ذلك العربية ولهجاتها أو الإنجليزية. لا تخمّن أسماء الأدوية أو القياسات، ولا تضف تشخيصاً لم يُذكر. اكتب [غير واضح] عند تعذر تمييز الكلام. أخرج النص فقط. هذا تفريغ أولي يحتاج إلى مراجعة الطبيب وليس سجلاً طبياً نهائياً.';
      const transcript = await geminiGenerate(model, key, [
        { text: transcriptPrompt },
        { inlineData: { mimeType, data: audioBase64 } },
      ]);
      if (transcript.length > 150000) throw new Error('نص التفريغ أطول من الحد المسموح للمسودة؛ بقي التسجيل محفوظاً.');
      const structurePrompt = `حوّل التفريغ الآتي إلى JSON صالح فقط. لا تضف أي حقيقة غير موجودة. عند غياب معلومة استخدم value:null و state:"not_collected". استخدم state:"patient_reported" لما قاله المريض و state:"ai_suggested" لأي تلخيص يحتاج مراجعة الطبيب. لا تجعل الحساسية أو الدواء "لا يوجد" إن لم يُذكر نفي صريح. لا توقع ولا تعتمد السجل. أخرج المفاتيح chiefComplaint, historyOfPresentIllness, medicalHistory, allergies, medications, examinationFindings, assessment, proposedPlan, proceduresDiscussed, proceduresCompleted, prescriptionsSuggested, followUp, uncertaintyFlags. القيم السريرية كائنات من شكل {"value":...,"state":"not_collected|unknown|patient_reported|ai_suggested|clinician_confirmed","source":"quote or null","confidence":null}. uncertaintyFlags مصفوفة نصوص.\n\nالتفريغ:\n${transcript}`;
      const structuredText = await geminiGenerate(model, key, [{ text: structurePrompt }], true);
      let draft: Record<string, unknown>;
      try {
        draft = sanitizeModelDraft(JSON.parse(structuredText)) as Record<string, unknown>;
      } catch {
        throw new Error('لم يرجع Gemini مسودة سريرية منظمة صالحة؛ بقي التفريغ الصوتي محفوظاً في الجلسة.');
      }
      const { data: saved, error: saveError } = await client.rpc('sinan_test_save_recording_result', {
        p_workspace_token: token, p_recording_id: recordingId, p_transcript: transcript, p_draft_json: draft,
      });
      if (saveError || !saved) throw new Error('تمت معالجة الصوت لكن تعذر حفظ المسودة في قاعدة البيانات.');
      return NextResponse.json({
        state: 'needs_review', job_id: recordingId, transcript, draft,
        warning: 'تم حفظ التفريغ والمسودة في مساحة الاختبار. راجع كل معلومة قبل الاعتماد؛ لم يتم اعتماد أي سجل تلقائياً.',
      }, { headers: noStore });
    } catch (error) {
      await client.rpc('sinan_test_update_recording_state', {
        p_workspace_token: token, p_recording_id: recordingId, p_target_state: 'failed',
      });
      return errorResponse(error instanceof Error ? error.message : 'تعذرت معالجة التسجيل. بقي الصوت محفوظاً ويمكن إعادة المحاولة.', 500);
    }
  }

  return errorResponse('إجراء التسجيل غير متاح في مساحة العمل الحالية.', 404);
}
