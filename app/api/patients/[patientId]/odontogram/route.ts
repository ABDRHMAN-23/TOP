import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({ encounter_id: z.string().uuid().optional().nullable(), tooth_number: z.string().trim().min(1).max(12), notation_system: z.enum(['FDI','Universal','Palmer']).default('FDI'), status: z.string().trim().min(1).max(100), surfaces: z.array(z.enum(['mesial','distal','occlusal','incisal','buccal','lingual','palatal'])).max(8).default([]), note: z.string().max(4000).optional().nullable(), state: z.enum(['needs_review','clinician_confirmed','corrected']).default('needs_review') }).strict();
export async function GET(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  const { data, error: dbError } = await supabase.from('dental_tooth_entries').select('*').eq('patient_id', patientId).eq('organization_id', context.organizationId).order('created_at', { ascending: false });
  if (dbError) return NextResponse.json({ error: 'تعذر تحميل مخطط الأسنان.' }, { status: 500 }); return NextResponse.json({ entries: data ?? [] });
}
export async function POST(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 }); if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request); if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return NextResponse.json({ error: 'تعديل مخطط الأسنان متاح للطبيب المخوّل فقط.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'تحقق من رقم السن والسطوح والحالة.' }, { status: 400 });
  const { data: patient } = await supabase.from('patients').select('id').eq('id', patientId).eq('organization_id', context.organizationId).maybeSingle(); if (!patient) return NextResponse.json({ error: 'المريض غير موجود في هذه العيادة.' }, { status: 404 });
  if (parsed.data.encounter_id) { const { data: encounter } = await supabase.from('encounters').select('id').eq('id', parsed.data.encounter_id).eq('patient_id', patientId).eq('organization_id', context.organizationId).maybeSingle(); if (!encounter) return NextResponse.json({ error: 'الزيارة المحددة لا تخص هذا المريض.' }, { status: 400 }); }
  const { data, error: dbError } = await supabase.from('dental_tooth_entries').insert({ ...parsed.data, organization_id: context.organizationId, patient_id: patientId, created_by: user.id, confirmed_by: parsed.data.state === 'clinician_confirmed' ? user.id : null, confirmed_at: parsed.data.state === 'clinician_confirmed' ? new Date().toISOString() : null }).select('*').single();
  if (dbError || !data) return NextResponse.json({ error: 'تعذر حفظ حالة السن.' }, { status: 500 });
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'odontogram.entry_created', resource_type: 'dental_tooth_entry', resource_id: data.id, metadata: { tooth_number: data.tooth_number, state: data.state } });
  return NextResponse.json({ entry: data }, { status: 201 });
}
