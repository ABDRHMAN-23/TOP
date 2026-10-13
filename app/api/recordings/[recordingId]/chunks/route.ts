import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const indexRaw = form?.get('chunk_index');
  const index = Number(indexRaw);
  if (!(file instanceof File) || !Number.isInteger(index) || index < 0 || index > 2000) return NextResponse.json({ error: 'مقطع التسجيل أو رقمه غير صالح.' }, { status: 400 });
  const rawMimeType = (file.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const allowedMimeTypes = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4']);
  if (!allowedMimeTypes.has(rawMimeType)) return NextResponse.json({ error: 'صيغة الصوت غير مدعومة. استخدم WebM أو OGG أو WAV أو MP3 أو MP4.' }, { status: 415 });
  const limit = Math.max(1, Number(process.env.MAX_AUDIO_CHUNK_MB || 12)) * 1024 * 1024;
  if (file.size <= 0 || file.size > limit) return NextResponse.json({ error: `حجم مقطع الصوت يتجاوز الحد المسموح (${Math.round(limit / 1024 / 1024)}MB).` }, { status: 413 });
  const { data: session, error: sessionError } = await supabase.from('recording_sessions').select('id,capture_state,organization_id,created_by').eq('id', recordingId).eq('organization_id', context.organizationId).maybeSingle();
  if (sessionError || !session) return NextResponse.json({ error: 'جلسة التسجيل غير موجودة.' }, { status: 404 });
  if (session.created_by !== user.id || !['capturing', 'paused', 'uploading'].includes(session.capture_state)) return NextResponse.json({ error: 'جلسة التسجيل لا تقبل مقاطع جديدة.' }, { status: 409 });
  const bucket = process.env.CLINICAL_AUDIO_BUCKET || 'clinical-audio-private';
  const path = `${context.organizationId}/${recordingId}/${String(index).padStart(6,'0')}.webm`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: rawMimeType, upsert: true });
  if (storageError) return NextResponse.json({ error: 'تعذر حفظ ملف الصوت في التخزين الخاص. تحقق من bucket وسياساته.' }, { status: 500 });
  const { error: chunkError } = await supabase.from('recording_chunks').upsert({ organization_id: context.organizationId, recording_session_id: recordingId, chunk_index: index, storage_key: path, mime_type: rawMimeType, byte_size: file.size, uploaded_by: user.id }, { onConflict: 'recording_session_id,chunk_index' });
  if (chunkError) return NextResponse.json({ error: 'تم رفع الصوت لكن تعذر تسجيل بيانات المقطع. لا تكرر التسجيل قبل مراجعة حالة الجلسة.' }, { status: 500 });
  // Do not overwrite the server-side paused state when an already-in-flight chunk finishes uploading.
  await supabase.from('recording_sessions').update({ last_chunk_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', recordingId).eq('organization_id', context.organizationId).eq('created_by', user.id).in('capture_state', ['capturing', 'paused', 'uploading']);
  return NextResponse.json({ chunk_index: index, stored: true, bytes: file.size });
}
