import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const form = await req.formData();
  const notes = String(form.get('notes') ?? '').trim();
  const audio = form.get('audio');
  if (!notes && !(audio instanceof File)) return NextResponse.json({ error: 'Add a recording or notes.' }, { status: 400 });
  // Provider-neutral MVP boundary. Connect Whisper/AI through these server-only env vars next.
  const transcript = notes || 'Audio received. Transcription provider is not configured yet.';
  return NextResponse.json({ transcript, client: {}, items: [], notes: notes ? [notes] : [] });
}
