import { NextResponse } from 'next/server';

type ExtractedItem = { description?: string; quantity?: number; unit?: string; price?: number };

function normalizeExtraction(value: any, transcript: string) {
  return {
    transcript,
    client: value?.client && typeof value.client === 'object' ? value.client : {},
    items: Array.isArray(value?.items) ? value.items.map((item: ExtractedItem) => ({
      description: String(item.description || ''),
      quantity: Number(item.quantity || 0),
      unit: String(item.unit || 'item'),
      price: Number(item.price || 0),
    })) : [],
    notes: Array.isArray(value?.notes) ? value.notes.map(String) : [],
    currency: String(value?.currency || 'GBP')
  };
}

async function transcribe(file: File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return '';
  const form = new FormData();
  form.append('file', file, file.name || 'voice.webm');
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey },
    body: form
  });
  if (!response.ok) throw new Error('Transcription provider returned an error.');
  const data = await response.json();
  return String(data.text || '').trim();
}

async function extract(transcript: string) {
  const url = process.env.EXTRACTION_API_URL;
  if (!url) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.EXTRACTION_API_KEY) headers.Authorization = 'Bearer ' + process.env.EXTRACTION_API_KEY;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      transcript,
      schema: {
        client: { name: 'string|null', email: 'string|null', phone: 'string|null', address: 'string|null' },
        items: [{ description: 'string', quantity: 'number', unit: 'string', price: 'number' }],
        notes: ['string'],
        currency: 'GBP'
      }
    })
  });
  if (!response.ok) throw new Error('Extraction provider returned an error.');
  return normalizeExtraction(await response.json(), transcript);
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

    const extracted = transcript ? await extract(transcript) : null;
    if (extracted) return NextResponse.json(extracted);

    return NextResponse.json({
      transcript,
      client: {},
      items: [],
      notes: transcript ? [transcript] : [],
      currency: 'GBP'
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed.' }, { status: 500 });
  }
}
