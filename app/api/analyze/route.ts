import { NextResponse } from 'next/server';

type ExtractedItem = { description?: string; quantity?: number; unit?: string; price?: number };

function normalizeExtraction(value: any, transcript: string) {
  const source = value?.result && typeof value.result === 'object' ? value.result : value;
  return {
    transcript,
    client: source?.client && typeof source.client === 'object' ? source.client : {},
    items: Array.isArray(source?.items) ? source.items.map((item: ExtractedItem) => ({
      description: String(item.description || ''),
      quantity: Number(item.quantity || 0),
      unit: String(item.unit || 'item'),
      price: Number(item.price || 0),
    })) : [],
    notes: Array.isArray(source?.notes) ? source.notes.map(String) : [],
    currency: String(source?.currency || 'GBP')
  };
}

async function transcribe(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return '';
  const form = new FormData();
  form.append('file', file, file.name || 'voice.webm');
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form });
  if (!response.ok) throw new Error('Transcription provider returned an error.');
  const data = await response.json();
  return String(data.text || '').trim();
}

async function extractWithGemma(transcript: string) {
  const url = process.env.GEMMA_API_URL;
  if (!url) return null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.GEMMA_API_KEY) headers.Authorization = 'Bearer ' + process.env.GEMMA_API_KEY;

  const schema = {
    client: { name: 'string|null', email: 'string|null', phone: 'string|null', address: 'string|null' },
    items: [{ description: 'string', quantity: 'number', unit: 'string', price: 'number' }],
    notes: ['string'],
    currency: 'GBP'
  };

  const system = [
    'You are the QUVOTO extraction engine.',
    'Model requirement: Gemma 4 31B.',
    'Return JSON only. Do not invent missing customer or pricing data.',
    'Extract contractor quote details from the transcript.',
    'Use numeric quantity and price values. Price means unit price.',
    'Currency should be a three-letter code when known.',
    JSON.stringify(schema)
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: process.env.GEMMA_MODEL || 'gemma-4-31b-it',
      temperature: 0,
      response_format: { type: 'json_object' },
      system,
      prompt: transcript,
      transcript,
      schema,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: transcript }
      ]
    })
  });
  if (!response.ok) throw new Error('Gemma 4 31B extraction service returned an error.');

  const raw = await response.json();
  let payload = raw?.output ?? raw?.text ?? raw?.response ?? raw?.choices?.[0]?.message?.content ?? raw;
  if (typeof payload === 'string') {
    const cleaned = payload.replace(/^\s*\x60\x60\x60(?:json)?/i, '').replace(/\x60\x60\x60\s*$/i, '').trim();
    try { payload = JSON.parse(cleaned); } catch { payload = {}; }
  }
  return normalizeExtraction(payload, transcript);
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
      if (audioTranscript) transcript = notes ? notes + '\n' + audioTranscript : audioTranscript;
      else if (!notes) transcript = 'Audio received. Add OPENAI_API_KEY to enable automatic transcription.';
    }

    const extracted = transcript ? await extractWithGemma(transcript) : null;
    if (extracted) return NextResponse.json(extracted);

    return NextResponse.json({ transcript, client: {}, items: [], notes: transcript ? [transcript] : [], currency: 'GBP' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed.' }, { status: 500 });
  }
}