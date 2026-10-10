import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { isUuid } from '@/lib/aqarflow/operations-contract';

export const dynamic = 'force-dynamic';
const COLUMNS = 'id,owner_user_id,recipient_user_id,notification_type,entity_type,entity_id,event_key,title,body,read_at,created_at';

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function context() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch { return { error: response({ error: 'خدمة تسجيل الدخول غير متاحة.' }, 503) }; }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: response({ error: 'يلزم تسجيل الدخول.' }, 401) };

  const membership = await supabase.from('aqarflow_workspace_memberships')
    .select('owner_id').eq('member_id', data.user.id).neq('owner_id', data.user.id).limit(2);
  if (membership.error) return { error: response({ error: 'تعذر التحقق من مساحة العمل.' }, 503) };
  if ((membership.data || []).length > 1) {
    return { error: response({ error: 'الحساب مرتبط بأكثر من مساحة عمل؛ حدد مساحة واحدة أولًا.' }, 409) };
  }

  try {
    return {
      user: data.user,
      ownerId: membership.data?.[0]?.owner_id || data.user.id,
      admin: createAdminClient(),
    };
  } catch {
    return { error: response({ error: 'خدمة الإشعارات غير متاحة.' }, 503) };
  }
}

export async function GET() {
  const ctx = await context();
  if ('error' in ctx) return ctx.error;
  const { data, error } = await ctx.admin.from('aqarflow_crm_notifications')
    .select(COLUMNS)
    .eq('owner_user_id', ctx.ownerId)
    .eq('recipient_user_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return response({ error: 'جدول الإشعارات غير مهيأ. طبّق هجرة المستوى الثالث.' }, 503);
  return response({
    notifications: data || [],
    unreadCount: (data || []).filter(item => !item.read_at).length,
  });
}

export async function PATCH(request: Request) {
  const ctx = await context();
  if ('error' in ctx) return ctx.error;
  const parsed = await readBoundedJson(request, 2_000);
  if (!parsed.ok) return response({ error: 'بيانات الطلب غير صالحة.' }, 400);
  const body = parsed.value as Record<string, unknown>;
  if (!body || typeof body !== 'object' || !isUuid(body.id)) {
    return response({ error: 'معرف الإشعار غير صالح.' }, 400);
  }
  const { data, error } = await ctx.admin.from('aqarflow_crm_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('owner_user_id', ctx.ownerId)
    .eq('recipient_user_id', ctx.user.id)
    .eq('id', body.id)
    .is('read_at', null)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return response({ error: 'تعذر تحديث الإشعار.' }, 503);
  if (!data) return response({ error: 'الإشعار غير موجود أو تمت قراءته.' }, 404);
  return response({ notification: data });
}
