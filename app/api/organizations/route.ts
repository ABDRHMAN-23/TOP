import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';

const selectSchema = z.object({ organization_id: z.string().uuid() }).strict();

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const { data, error } = await supabase.from('organization_memberships').select('organization_id,role,status,organizations(id,name,name_en,timezone)').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'تعذر تحميل العيادات المرتبطة بالحساب.' }, { status: 500 });
  return NextResponse.json({ organizations: data ?? [], selected_organization_id: request.headers.get('x-organization-id') });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });
  const parsed = selectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'معرّف العيادة غير صالح.' }, { status: 400 });
  const { data, error } = await supabase.from('organization_memberships').select('organization_id').eq('organization_id', parsed.data.organization_id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'لا توجد صلاحية للوصول إلى العيادة المطلوبة.' }, { status: 403 });
  const response = NextResponse.json({ selected: true, organization_id: data.organization_id });
  response.cookies.set('sinan-org-id', data.organization_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
