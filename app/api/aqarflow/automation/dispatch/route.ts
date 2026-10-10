import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Scheduled server-to-server endpoint. Configure a scheduler to POST every five
 * minutes and send Authorization: Bearer <CRON_SECRET>. Never call this from the
 * browser and never expose the secret in NEXT_PUBLIC_*.
 */
export async function POST(request: Request) {
  const secret = runtimeEnv('CRON_SECRET');
  if (!secret || secret.length < 32) {
    return response({ error: 'خدمة الأتمتة غير مهيأة على الخادم.' }, 503);
  }
  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (authorization.length !== expected.length || authorization !== expected) {
    return response({ error: 'غير مصرح.' }, 401);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return response({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, 503);
  }

  const { data, error } = await admin.rpc('aqarflow_dispatch_due_notifications', {
    p_now: new Date().toISOString(),
  });
  if (error) {
    return response({ error: 'تعذر تشغيل دورة الأتمتة. تحقق من تطبيق هجرة المستوى الثالث.' }, 503);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return response({
    ok: true,
    dispatched: {
      taskNotifications: Number(result?.task_notifications || 0),
      viewingNotifications: Number(result?.viewing_notifications || 0),
    },
    delivery: 'in_app_only',
  });
}
