import { NextResponse } from 'next/server';

type ExtractedItem = { description?: string; quantity?: number|null; unit?: string|null; price?: number|null };

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
  return (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
}

function geminiModelUrl(model: string) {
  return `${geminiBaseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function geminiGenerate(model: string, body: unknown) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API is not configured. Add GEMINI_API_KEY to the deployment environment.');

  const response = await fetch(geminiModelUrl(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let data: any = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch {}

  if (!response.ok) {
    const providerMessage = data?.error?.message || rawText || `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${providerMessage}`);
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

async function transcribe(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const base64 = btoa(binary);
  const mimeType = file.type || 'audio/webm';

  const data = await geminiGenerate(
    process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
    {
      contents: [{
        parts: [
          { text: 'Transcribe this contractor job-site recording exactly as spoken. Return only the transcription text. Preserve names, quantities, units, prices, addresses, phone numbers, and currency.' },
          { inlineData: { mimeType, data: base64 } }
        ]
      }],
      generationConfig: {
        audioTranscriptionConfig: { mode: 'SMART' }
      }
    }
  );

  const text = responseText(data);
  if (!text) throw new Error('Gemini returned an empty transcription.');
  return text;
}

async function extractWithGemini(transcript: string) {
  const schema = {
    type: 'object',
    properties: {
      client: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' }
        }
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            price: { type: 'number' }
          },
          required: ['description']
        }
      },
      notes: { type: 'array', items: { type: 'string' } },
      currency: { type: 'string' }
    },
    required: ['client', 'items', 'notes', 'currency']
  };

  const data = await geminiGenerate(
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    {
      contents: [{
        parts: [{
          text: [
            'You are the QUVOTO quote extraction engine.',
            'Extract contractor quote details from the transcript below.',
            'Never invent missing customer details, quantities, units, prices, or currency.',
            'When a value is not spoken, use an empty string for text fields and 0 for numeric fields.',
            'Price means the unit price when the speaker gives a unit price.',
            'Return only JSON matching the supplied schema.',
            '',
            transcript
          ].join('\n')
        }]
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    }
  );

  const text = responseText(data);
  if (!text) throw new Error('Gemini returned empty extraction data.');

  try {
    return normalizeExtraction(JSON.parse(text), transcript);
  } catch {
    throw new Error('Gemini returned invalid structured quote data.');
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const notes = String(form.get('notes') || '').trim();
    const audio = form.get('audio');

    if (!notes && !(audio instanceof File)) {
      return NextResponse.json({ error: 'Add a recording or notes.' }, { status: 400 });
    }

    if (audio instanceof File && audio.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Recording is too large. Keep it under 20 MB.' }, { status: 400 });
    }

    let transcript = notes;

    if (audio instanceof File && audio.size > 0) {
      const audioTranscript = await transcribe(audio);
      transcript = notes ? notes + '\n' + audioTranscript : audioTranscript;
    }

    const extracted = transcript ? await extractWithGemini(transcript) : null;
    if (extracted) return NextResponse.json(extracted);

    return NextResponse.json({ error: 'No text was available to analyze.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed.' },
      { status: 500 }
    );
  }
}
