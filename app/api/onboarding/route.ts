import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';

const schema = z.object({ name: z.string().trim().min(2).max(180), name_en: z.string().trim().max(180).optional().nullable(), timezone: z.string().trim().min(1).max(80).default('Asia/Aden') }).strict();

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول قبل إعداد العيادة.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'أدخل اسم العيادة بصورة صحيحة.' }, { status: 400 });
  const { data: organizationId, error } = await supabase.rpc('create_clinic', { p_name: parsed.data.name, p_name_en: parsed.data.name_en || null, p_timezone: parsed.data.timezone });
  if (error || !organizationId) return NextResponse.json({ error: 'تعذر إنشاء مساحة العيادة. تأكد من تطبيق مخطط قاعدة البيانات أولاً.' }, { status: 500 });
  const response = NextResponse.json({ organization_id: organizationId, message: 'تم إنشاء مساحة العيادة.' }, { status: 201 });
  response.cookies.set('sinan-org-id', organizationId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
