import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { patientCreateSchema } from '@/lib/clinical/validators';

export const dynamic = 'force-dynamic';

function getWorkspaceToken(request: Request) {
  const token = request.headers.get('x-sinan-test-workspace')?.trim() || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token) ? token : null;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function GET(request: Request) {
  const workspaceToken = getWorkspaceToken(request);
  if (!workspaceToken) return NextResponse.json({ error: 'تعذر تهيئة مساحة العمل على هذا الجهاز. أعد تحميل الصفحة.' }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'اتصال قاعدة البيانات غير مهيأ.' }, { status: 503 });
  const { data, error } = await supabase.rpc('sinan_test_list_patients', { p_workspace_token: workspaceToken });
  if (error) return NextResponse.json({ error: 'تعذر تحميل ملفات المرضى من قاعدة البيانات.' }, { status: 503 });
  return NextResponse.json({ patients: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const workspaceToken = getWorkspaceToken(request);
  if (!workspaceToken) return NextResponse.json({ error: 'تعذر تهيئة مساحة العمل على هذا الجهاز. أعد تحميل الصفحة.' }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'اتصال قاعدة البيانات غير مهيأ.' }, { status: 503 });
  const json = await request.json().catch(() => null);
  const parsed = patientCreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'تحقق من اسم المريض والعمر والشكوى.' }, { status: 400 });
  const { data, error } = await supabase.rpc('sinan_test_create_patient', {
    p_workspace_token: workspaceToken,
    p_full_name: parsed.data.full_name,
    p_reported_age_years: parsed.data.reported_age_years ?? null,
    p_chief_complaint: parsed.data.chief_complaint ?? null,
  });
  if (error || !data || typeof data !== 'object') return NextResponse.json({ error: 'تعذر حفظ ملف المريض في قاعدة البيانات.' }, { status: 503 });
  return NextResponse.json({ patient: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
