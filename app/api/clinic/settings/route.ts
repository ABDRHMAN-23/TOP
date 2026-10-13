import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({ clinic_name_ar: z.string().trim().min(2).max(180), clinic_name_en: z.string().trim().max(180).optional().nullable(), address_ar: z.string().max(500).optional().nullable(), address_en: z.string().max(500).optional().nullable(), phone: z.string().max(40).optional().nullable(), email: z.string().email().max(254).optional().nullable(), website: z.string().url().max(500).optional().nullable(), default_report_language: z.enum(['ar','en','bi']).default('ar'), paper_size: z.enum(['A4','Letter']).default('A4'), tooth_notation: z.enum(['FDI','Universal','Palmer']).default('FDI'), recording_policy_version: z.string().min(1).max(60).default('clinic-policy-v1'), audio_retention_days: z.number().int().min(0).max(3650).default(30) }).strict();

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  const { data, error: dbError } = await supabase.from('clinic_settings').select('*').eq('organization_id', context.organizationId).maybeSingle();
  if (dbError) return NextResponse.json({ error: 'تعذر تحميل إعدادات العيادة.' }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner','clinic_admin'].includes(context.role)) return NextResponse.json({ error: 'تعديل هوية العيادة متاح للمالك أو المدير فقط.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'تحقق من الحقول المدخلة.', issues: parsed.error.flatten() }, { status: 400 });
  const { data: current } = await supabase.from('clinic_settings').select('settings_version').eq('organization_id', context.organizationId).maybeSingle();
  const { data, error: updateError } = await supabase.from('clinic_settings').upsert({ ...parsed.data, organization_id: context.organizationId, updated_by: user.id, settings_version: Number(current?.settings_version || 0) + 1, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' }).select('*').single();
  if (updateError || !data) return NextResponse.json({ error: 'تعذر حفظ إعدادات العيادة.' }, { status: 500 });
  await supabase.from('audit_events').insert({ organization_id: context.organizationId, actor_user_id: user.id, action: 'clinic.settings_updated', resource_type: 'clinic_settings', resource_id: context.organizationId, metadata: { settings_version: data.settings_version } });
  return NextResponse.json({ settings: data });
}
