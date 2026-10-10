import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;
export type AqarFlowAnalyticsContext =
  | { ok: true; userId: string; ownerId: string; admin: AdminClient }
  | { ok: false; status: number; error: string };

export async function getAqarFlowAnalyticsContext(): Promise<AqarFlowAnalyticsContext> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, status: 503, error: 'خدمة تسجيل الدخول غير متاحة.' };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, status: 401, error: 'يلزم تسجيل الدخول لعرض تقارير المبيعات.' };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('aqarflow_workspace_memberships')
    .select('owner_id')
    .eq('member_id', data.user.id)
    .neq('owner_id', data.user.id)
    .limit(2);

  if (membershipError) {
    return { ok: false, status: 503, error: 'تعذر التحقق من مساحة العمل.' };
  }
  if ((memberships || []).length > 1) {
    return { ok: false, status: 409, error: 'حسابك مرتبط بأكثر من مساحة عمل؛ حدد مساحة واحدة أولًا.' };
  }

  try {
    return {
      ok: true,
      userId: data.user.id,
      ownerId: memberships?.[0]?.owner_id || data.user.id,
      admin: createAdminClient(),
    };
  } catch {
    return { ok: false, status: 503, error: 'خدمة تقارير المبيعات غير مهيأة على الخادم.' };
  }
}
