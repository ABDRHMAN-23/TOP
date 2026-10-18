import type { SupabaseClient, User } from '@supabase/supabase-js';

export type OrganizationContext = { organizationId: string; role: string };
export async function resolveOrganization(
  supabase: SupabaseClient,
  user: User,
  request: Request,
): Promise<{ context: OrganizationContext | null; error?: string }> {
  // The clinic picker stores the selected tenant in an httpOnly cookie. Prefer an
  // explicit header for API clients, then honor that cookie for browser requests.
  const cookieHeader = request.headers.get('cookie') || '';
  const selectedCookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith('sinan-org-id='));
  let cookieOrganizationId: string | null = null;
  if (selectedCookie) {
    try { cookieOrganizationId = decodeURIComponent(selectedCookie.slice('sinan-org-id='.length)); }
    catch { cookieOrganizationId = null; }
  }
  const requested = request.headers.get('x-organization-id') || cookieOrganizationId;
  let query = supabase.from('organization_memberships')
    .select('organization_id,role,status')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (requested) query = query.eq('organization_id', requested);
  const { data, error } = await query.limit(requested ? 1 : 2);
  if (error) return { context: null, error: 'تعذر التحقق من عضوية العيادة.' };
  if (!data?.length) return { context: null, error: requested ? 'ليس لديك صلاحية الوصول إلى هذه العيادة.' : 'لا توجد عضوية عيادة مرتبطة بالحساب.' };
  if (!requested && data.length > 1) return { context: null, error: 'حدد العيادة المطلوبة عبر ترويسة x-organization-id.' };
  const row = data[0];
  return { context: { organizationId: row.organization_id, role: row.role } };
}
