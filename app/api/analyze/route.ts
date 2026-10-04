import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type ExtractedItem = { description?: string; quantity?: number|null; unit?: string|null; price?: number|null };

function runtimeEnv(name: string) {
  try {
    const { env } = getCloudflareContext();
    const value = (env as Record<string, unknown>)[name];
    if (typeof value === 'string' && value) return value;
  } catch {}
  const fallback = process.env[name];
  return typeof fallback === 'string' && fallback ? fallback : undefined;
}

function normalizeExtraction(value: any, transcript: string) {
  const source = value?.result && typeof value.result === 'object' ? value.result : value;
  return {
    transcript,
    client: source?.client && typeof source.client === 'object' ? source.client : {},
    items: Array.isArray(source?.items) ? source.items.map((item: ExtractedItem) => ({
      description: String(item.description || ''),
      quantity: item.quantity == null ? null : Number(item.quantity),
      unit: String(item.unit || 'item'),
      price: item.price == null ? null : Number(item.price),
    })) : [],
    notes: Array.isArray(source?.notes) ? source.notes.map(String) : [],
    currency: String(source?.currency || 'GBP')
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

async function geminiGenerate(model: string, body: unknown, stage: GeminiError['stage']) {
  const apiKey = runtimeEnv('GEMINI_API_KEY');
  if (!apiKey) throw new GeminiError('Gemini API key is not available in the Cloudflare runtime.', 'config', 500);

  const response = await fetch(geminiModelUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let data: any = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch {}

  if (!response.ok) {
    const providerMessage = data?.error?.message || rawText || `HTTP ${response.status}`;
    throw new GeminiError(`Gemini API error (${response.status}): ${providerMessage}`, stage, response.status);
  }

  return data;
}

function responseText(data: any) {
  return String(
    data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') ||
    data?.text ||
    ''
  ).trim();
}

async function uploadToGemini(file: File) {
  const apiKey = runtimeEnv('GEMINI_API_KEY');
  if (!apiKey) throw new GeminiError('Gemini API key is not available in the Cloudflare runtime.', 'config', 500);

  const bytes = await file.arrayBuffer();
  const mimeType = file.type || 'audio/webm';

  const startResponse = await fetch(`${geminiBaseUrl()}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name || 'quvoto-voice.webm' } }),
  });

  if (!startResponse.ok) {
    const message = await startResponse.text();
    throw new GeminiError(`Gemini file upload initialization failed (${startResponse.status}): ${message || 'unknown error'}`, 'transcribe', startResponse.status);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new GeminiError('Gemini file upload did not return an upload URL.', 'transcribe');

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(file.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  const uploadRaw = await uploadResponse.text();
  let uploadData: any = {};
  try { uploadData = uploadRaw ? JSON.parse(uploadRaw) : {}; } catch {}

  if (!uploadResponse.ok) {
    const message = uploadData?.error?.message || uploadRaw || `HTTP ${uploadResponse.status}`;
    throw new GeminiError(`Gemini file upload failed (${uploadResponse.status}): ${message}`, 'transcribe', uploadResponse.status);
  }

  const fileUri = uploadData?.file?.uri;
  const uploadedMimeType = uploadData?.file?.mimeType || mimeType;
  if (!fileUri) throw new GeminiError('Gemini file upload completed without a file URI.', 'transcribe');

  return { fileUri, mimeType: uploadedMimeType };
}

async function transcribe(file: File) {
  const { fileUri, mimeType } = await uploadToGemini(file);
  const data = await geminiGenerate(
    runtimeEnv('GEMINI_TRANSCRIBE_MODEL') || 'gemini-3.5-transcribe',
    {
      contents: [{ parts: [{ fileData: { mimeType, fileUri } }] }],
      generationConfig: { audioTranscriptionConfig: { mode: 'SMART' } }
    },
    'transcribe'
  );

  const text = responseText(data);
  if (!text) throw new GeminiError('Gemini returned an empty transcription.', 'transcribe');
  return text;
}

function parseJsonObject(text: string) {
  const cleaned = text.replace(/^\s*\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('No JSON object found in Gemini response.');
}

async function extractWithGemini(transcript: string) {
  const data = await geminiGenerate(
    runtimeEnv('GEMINI_MODEL') || 'gemini-3.5-flash-lite',
    {
      contents: [{
        parts: [{
          text: [
            'You are the QUVOTO quote extraction engine.',
            'Extract contractor quote details from the transcript below.',
            'Never invent missing customer details, quantities, units, prices, or currency.',
            'When a value is not spoken, use an empty string for text fields and 0 for numeric fields.',
            'Price means the unit price when the speaker gives a unit price.',
            'Return ONLY one valid JSON object. Do not use markdown fences.',
            'Use exactly this shape:',
            '{"client":{"name":"","email":"","phone":"","address":""},"items":[{"description":"","quantity":0,"unit":"item","price":0}],"notes":[],"currency":"GBP"}',
            '',
            transcript
          ].join('\n')
        }]
      }]
    },
    'extract'
  );

  const text = responseText(data);
  if (!text) throw new GeminiError('Gemini returned empty extraction data.', 'extract');

  try { return normalizeExtraction(parseJsonObject(text), transcript); }
  catch { throw new GeminiError('Gemini returned invalid quote JSON.', 'extract'); }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const notes = String(form.get('notes') || '').trim();
    const audio = form.get('audio');

    if (!notes && !(audio instanceof File)) return NextResponse.json({ error: 'Add a recording or notes.' }, { status: 400 });
    if (audio instanceof File && audio.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Recording is too large. Keep it under 20 MB.' }, { status: 400 });

    let transcript = notes;
    if (audio instanceof File && audio.size > 0) {
      const audioTranscript = await transcribe(audio);
      transcript = notes ? notes + '\n' + audioTranscript : audioTranscript;
    }

    const extracted = transcript ? await extractWithGemini(transcript) : null;
    if (extracted) return NextResponse.json(extracted);
    return NextResponse.json({ error: 'No text was available to analyze.' }, { status: 400 });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message, stage: error.stage, hint: 'Server-to-Gemini analysis failed.' }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed.' }, { status: 500 });
  }
}
