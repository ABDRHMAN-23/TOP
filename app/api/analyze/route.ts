import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/runtime-env';
import { createClient } from '@/lib/supabase/server';
import { readBoundedBytes } from '@/lib/aqarflow/http-body';

type ExtractedItem = {
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
};

function normalizeExtraction(value: any, transcript: string) {
  const source = value?.result && typeof value.result === 'object' ? value.result : value;
  return {
    transcript,
    client: source?.client && typeof source.client === 'object' ? source.client : {},
    items: Array.isArray(source?.items)
      ? source.items.map((item: ExtractedItem) => ({
          description: String(item.description || ''),
          quantity: item.quantity == null ? null : Number(item.quantity),
          unit: String(item.unit || 'item'),
          price: item.price == null ? null : Number(item.price),
        }))
      : [],
    notes: Array.isArray(source?.notes) ? source.notes.map(String) : [],
    currency: String(source?.currency || 'GBP'),
  };
}

function geminiBaseUrl() {
  return (runtimeEnv('GEMINI_API_URL') || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
}

function geminiModelUrl(model: string) {
  return `${geminiBaseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

class GeminiError extends Error {
  stage: 'config' | 'transcribe' | 'extract';
  status: number;

  constructor(message: string, stage: 'config' | 'transcribe' | 'extract', status = 502) {
    super(message);
    this.name = 'GeminiError';
    this.stage = stage;
    this.status = status;
  }
}

function requireGeminiApiKey() {
  const apiKey = runtimeEnv('GEMINI_API_KEY');
  if (!apiKey) {
    throw new GeminiError(
      'GEMINI_API_KEY is not available in the Cloudflare runtime.',
      'config',
      500
    );
  }
  return apiKey;
}

async function geminiGenerate(
  model: string,
  body: unknown,
  stage: GeminiError['stage']
) {
  const apiKey = requireGeminiApiKey();

  let response: Response;
  try {
    response = await fetch(geminiModelUrl(model), {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new GeminiError(
      `Could not reach Gemini API: ${error instanceof Error ? error.message : 'network error'}`,
      stage,
      502
    );
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {}

  if (!response.ok) {
    const providerMessage = data?.error?.message || rawText || `HTTP ${response.status}`;
    throw new GeminiError(
      `Gemini API error (${response.status}): ${providerMessage}`,
      stage,
      response.status
    );
  }

  return data;
}

function responseText(data: any) {
  const interactionStepText = Array.isArray(data?.steps)
    ? data.steps
        .filter(
          (step: any) =>
            step?.type === 'model_output' ||
            step?.type === 'model_output_step'
        )
        .flatMap((step: any) =>
          Array.isArray(step?.content) ? step.content : []
        )
        .filter(
          (part: any) =>
            part?.type === 'text' && typeof part?.text === 'string'
        )
        .map((part: any) => part.text)
        .join('')
    : '';

  const outputArrayText = Array.isArray(data?.output)
    ? data.output
        .filter(
          (part: any) =>
            part?.type === 'text' && typeof part?.text === 'string'
        )
        .map((part: any) => part.text)
        .join('')
    : '';

  const candidateText = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
        .map((part: any) => part?.text || '')
        .join('')
    : '';

  return String(
    interactionStepText ||
      data?.output_text ||
      outputArrayText ||
      candidateText ||
      data?.text ||
      ''
  ).trim();
}

async function uploadToGemini(file: File) {
  const apiKey = requireGeminiApiKey();
  const bytes = await file.arrayBuffer();
  const mimeType = (file.type || 'audio/webm').split(';', 1)[0] || 'audio/webm';

  let startResponse: Response;
  try {
    startResponse = await fetch(`${geminiBaseUrl()}/upload/v1beta/files`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(file.size),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: file.name || 'quvoto-voice.webm' },
      }),
    });
  } catch (error) {
    throw new GeminiError(
      `Could not reach Gemini file upload API: ${error instanceof Error ? error.message : 'network error'}`,
      'transcribe',
      502
    );
  }

  if (!startResponse.ok) {
    const message = await startResponse.text();
    throw new GeminiError(
      `Gemini file upload initialization failed (${startResponse.status}): ${message || 'unknown error'}`,
      'transcribe',
      startResponse.status
    );
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new GeminiError(
      'Gemini file upload did not return an upload URL.',
      'transcribe'
    );
  }
  try {
    const parsedUploadUrl = new URL(uploadUrl);
    const allowedOrigin = new URL(geminiBaseUrl()).origin;
    if (parsedUploadUrl.protocol !== 'https:' || parsedUploadUrl.origin !== allowedOrigin) {
      throw new Error('Untrusted upload URL origin.');
    }
  } catch {
    throw new GeminiError('Gemini returned an invalid upload URL.', 'transcribe');
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Content-Length': String(file.size),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: bytes,
    });
  } catch (error) {
    throw new GeminiError(
      `Could not upload the recording to Gemini: ${error instanceof Error ? error.message : 'network error'}`,
      'transcribe',
      502
    );
  }

  const uploadRaw = await uploadResponse.text();
  let uploadData: any = {};
  try {
    uploadData = uploadRaw ? JSON.parse(uploadRaw) : {};
  } catch {}

  if (!uploadResponse.ok) {
    const message =
      uploadData?.error?.message ||
      uploadRaw ||
      `HTTP ${uploadResponse.status}`;
    throw new GeminiError(
      `Gemini file upload failed (${uploadResponse.status}): ${message}`,
      'transcribe',
      uploadResponse.status
    );
  }

  const fileUri = uploadData?.file?.uri;
  const uploadedMimeType = uploadData?.file?.mimeType || mimeType;

  if (!fileUri) {
    throw new GeminiError(
      'Gemini file upload completed without a file URI.',
      'transcribe'
    );
  }

  return { fileUri, mimeType: uploadedMimeType };
}

async function transcribe(file: File) {
  const { fileUri, mimeType } = await uploadToGemini(file);
  const apiKey = requireGeminiApiKey();

  let response: Response;
  try {
    response = await fetch(`${geminiBaseUrl()}/v1beta/interactions`, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: runtimeEnv('GEMINI_TRANSCRIBE_MODEL') || 'gemini-3.5-transcribe',
        input: [
          {
            type: 'audio',
            uri: fileUri,
            mime_type: mimeType,
          },
        ],
        generation_config: {
          transcription_config: {
            mode: 'smart',
          },
        },
      }),
    });
  } catch (error) {
    throw new GeminiError(
      `Could not reach Gemini transcription API: ${error instanceof Error ? error.message : 'network error'}`,
      'transcribe',
      502
    );
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {}

  if (!response.ok) {
    const providerMessage =
      data?.error?.message || rawText || `HTTP ${response.status}`;
    throw new GeminiError(
      `Gemini transcription error (${response.status}): ${providerMessage}`,
      'transcribe',
      response.status
    );
  }

  if (data?.status && data.status !== 'completed') {
    throw new GeminiError(
      `Gemini transcription did not complete (status: ${data.status}).`,
      'transcribe'
    );
  }

  const text = responseText(data);
  if (!text) {
    throw new GeminiError(
      'Gemini returned no transcription text.',
      'transcribe'
    );
  }

  return text;
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^\s*\`\`\`(?:json)?\s*/i, '')
    .replace(/\s*\`\`\`\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  throw new Error('No JSON object found in Gemini response.');
}

async function extractWithGemini(transcript: string) {
  const apiKey = requireGeminiApiKey();
  const schema = {
    type: 'OBJECT',
    properties: {
      client: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          email: { type: 'STRING' },
          phone: { type: 'STRING' },
          address: { type: 'STRING' },
        },
        required: ['name', 'email', 'phone', 'address'],
      },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            quantity: { type: 'NUMBER' },
            unit: { type: 'STRING' },
            price: { type: 'NUMBER' },
          },
          required: ['description', 'quantity', 'unit', 'price'],
        },
      },
      notes: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
      currency: { type: 'STRING' },
    },
    required: ['client', 'items', 'notes', 'currency'],
  };

  let response: Response;
  try {
    response = await fetch(`${geminiBaseUrl()}/v1beta/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: runtimeEnv('GEMINI_MODEL') || 'gemini-3.8-flash',
        input: [
          'You are the QUVOTO quote extraction engine.',
          'Extract contractor quote details from the transcript below.',
          'Never invent missing customer details, quantities, units, prices, or currency.',
          'Use 0 for missing numeric fields and empty strings for missing text fields.',
          '',
          transcript,
        ].join('\\n'),
        response_format: [
          {
            type: 'text',
            mime_type: 'application/json',
            schema,
          },
        ],
      }),
    });
  } catch (error) {
    throw new GeminiError(
      `Could not reach Gemini extraction API: ${error instanceof Error ? error.message : 'network error'}`,
      'extract',
      502
    );
  }

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {}

  if (!response.ok) {
    const providerMessage =
      data?.error?.message || rawText || `HTTP ${response.status}`;
    throw new GeminiError(
      `Gemini extraction error (${response.status}): ${providerMessage}`,
      'extract',
      response.status
    );
  }

  if (data?.status && data.status !== 'completed') {
    throw new GeminiError(
      `Gemini extraction did not complete (status: ${data.status}).`,
      'extract'
    );
  }

  const text = responseText(data);
  if (!text) {
    throw new GeminiError(
      'Gemini returned empty extraction data.',
      'extract'
    );
  }

  try {
    return normalizeExtraction(parseJsonObject(text), transcript);
  } catch {
    throw new GeminiError(
      'Gemini returned invalid structured quote JSON.',
      'extract'
    );
  }
}

const MAX_ANALYZE_BODY_BYTES = 21 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_NOTES_CHARS = 8_000;
const MAX_TRANSCRIPT_CHARS = 16_000;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/aac', 'audio/3gpp', 'audio/flac',
]);

function publicAnalysisError(error: unknown) {
  if (!(error instanceof GeminiError)) {
    return NextResponse.json({ error: 'تعذر إكمال التحليل. تحقق من البيانات ثم أعد المحاولة.' }, {
      status: 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (error.stage === 'config') {
    return NextResponse.json({ error: 'خدمة التحليل غير مهيأة على الخادم.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (error.status === 429) {
    return NextResponse.json({ error: 'خدمة الذكاء الاصطناعي مشغولة حاليًا. حاول لاحقًا.' }, {
      status: 429, headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json({
    error: error.stage === 'transcribe'
      ? 'تعذر تحويل التسجيل إلى نص. جرّب ملفًا صوتيًا مدعومًا ثم أعد المحاولة.'
      : 'تعذر استخراج بيانات العرض من النص. راجع التسجيل أو الملاحظات ثم أعد المحاولة.',
  }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

async function recordAnalysisUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  model: string,
  startedAt: number,
  outcome: 'success' | 'invalid_output' | 'provider_error',
) {
  try {
    await supabase.rpc('aqarflow_record_ai_usage', {
      p_request_id: requestId,
      p_model: model.slice(0, 100),
      p_latency_ms: Math.min(Math.max(Date.now() - startedAt, 0), 120_000),
      p_input_tokens: null,
      p_output_tokens: null,
      p_result_validated: outcome === 'success',
      p_outcome: outcome,
    });
  } catch {
    // Do not store prompts, notes, transcripts, or provider error payloads in usage records.
  }
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_ANALYZE_BODY_BYTES) {
    return NextResponse.json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, {
      status: 413, headers: { 'Cache-Control': 'no-store' },
    });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch {
    return NextResponse.json({ error: 'خدمة تسجيل الدخول غير متاحة حاليًا.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  let user;
  try {
    const auth = await supabase.auth.getUser();
    user = auth.data.user;
    if (auth.error && !user) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول قبل تحليل التسجيلات.' }, {
        status: 401, headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch {
    return NextResponse.json({ error: 'تعذر التحقق من جلسة المستخدم.' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!user) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول قبل تحليل التسجيلات.' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const body = await readBoundedBytes(req, MAX_ANALYZE_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: body.code === 'too_large'
      ? 'حجم الطلب أكبر من الحد المسموح.'
      : 'تعذر قراءة الطلب.' }, {
      status: body.code === 'too_large' ? 413 : 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let form: FormData;
  try {
    const headers = new Headers(req.headers);
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    const replay = new Request(req.url, { method: 'POST', headers, body: body.bytes });
    form = await replay.formData();
  } catch {
    return NextResponse.json({ error: 'صيغة الطلب غير صحيحة؛ أعد إرسال التسجيل أو الملاحظات.' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const notesValue = form.get('notes');
  if (notesValue !== null && typeof notesValue !== 'string') {
    return NextResponse.json({ error: 'حقل الملاحظات يجب أن يكون نصًا.' }, { status: 400 });
  }
  const notes = typeof notesValue === 'string'
    ? notesValue.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : '';
  if (notes.length > MAX_NOTES_CHARS) {
    return NextResponse.json({ error: 'الملاحظات طويلة جدًا؛ الحد الأقصى 8000 حرف.' }, {
      status: 413, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const rawAudio = form.get('audio');
  if (rawAudio !== null && !(rawAudio instanceof File)) {
    return NextResponse.json({ error: 'ملف التسجيل غير صالح.' }, { status: 400 });
  }
  const audio = rawAudio instanceof File && rawAudio.size > 0 ? rawAudio : null;
  if (!notes && !audio) {
    return NextResponse.json({ error: 'أضف تسجيلًا صوتيًا أو ملاحظات نصية.' }, { status: 400 });
  }
  if (audio && audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'التسجيل كبير جدًا؛ الحد الأقصى 20 ميجابايت.' }, {
      status: 413, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const audioMimeType = audio ? (audio.type || '').split(';', 1)[0].trim().toLowerCase() : '';
  if (audio && !ALLOWED_AUDIO_MIME_TYPES.has(audioMimeType)) {
    return NextResponse.json({ error: 'نوع التسجيل غير مدعوم. استخدم WebM أو MP4 أو WAV أو MP3 أو OGG.' }, {
      status: 415, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('team_memberships').select('owner_id')
    .eq('member_id', user.id).neq('owner_id', user.id).limit(2);
  if (membershipError) {
    return NextResponse.json({ error: 'تعذر التحقق من مساحة العمل.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if ((memberships || []).length > 1) {
    return NextResponse.json({ error: 'حسابك مرتبط بأكثر من مساحة عمل؛ يلزم تحديد مساحة العمل.' }, {
      status: 409, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const workspaceOwnerId = memberships?.[0]?.owner_id || user.id;
  const { data: reservationId, error: reservationError } = await supabase.rpc(
    'aqarflow_reserve_ai_request', { p_owner_user_id: workspaceOwnerId },
  );
  if (reservationError) {
    return NextResponse.json({ error: 'حدود استخدام التحليل غير مهيأة. راجع هجرات AqarFlow في قاعدة التطوير.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (typeof reservationId !== 'string' || !reservationId) {
    return NextResponse.json({ error: 'وصلت مساحة العمل إلى حد الاستخدام المؤقت للذكاء الاصطناعي. حاول لاحقًا.' }, {
      status: 429, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const startedAt = Date.now();
  const extractionModel = runtimeEnv('GEMINI_MODEL') || 'gemini-3.8-flash';
  const transcriptionModel = runtimeEnv('GEMINI_TRANSCRIBE_MODEL') || 'gemini-3.5-transcribe';
  const modelLabel = audio ? transcriptionModel + '+' + extractionModel : extractionModel;
  try {
    let transcript = notes;
    if (audio) {
      const audioTranscript = await transcribe(audio);
      transcript = notes ? notes + '\n' + audioTranscript : audioTranscript;
    }
    if (!transcript.trim()) {
      await recordAnalysisUsage(supabase, reservationId, modelLabel, startedAt, 'invalid_output');
      return NextResponse.json({ error: 'لم يتوفر نص كافٍ للتحليل.' }, {
        status: 422, headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      await recordAnalysisUsage(supabase, reservationId, modelLabel, startedAt, 'invalid_output');
      return NextResponse.json({ error: 'النص المستخرج طويل جدًا للتحليل الآمن؛ قسّم التسجيل إلى مقاطع أقصر.' }, {
        status: 413, headers: { 'Cache-Control': 'no-store' },
      });
    }
    const extracted = await extractWithGemini(transcript);
    await recordAnalysisUsage(supabase, reservationId, modelLabel, startedAt, 'success');
    return NextResponse.json(extracted, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    await recordAnalysisUsage(supabase, reservationId, modelLabel, startedAt,
      error instanceof GeminiError ? 'provider_error' : 'invalid_output');
    return publicAnalysisError(error);
  }
}
