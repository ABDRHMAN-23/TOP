import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const reviewRoles = ['owner','clinic_admin','dentist','clinician','receptionist'];

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503, headers: { 'Cache-Control':'no-store' } });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول لعرض طلبات الحجز.' }, { status: 401, headers: { 'Cache-Control':'no-store' } });
  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error: error || 'لا توجد صلاحية للوصول إلى العيادة.' }, { status: 403, headers: { 'Cache-Control':'no-store' } });
  if (!reviewRoles.includes(context.role)) {
    return NextResponse.json({ error: 'طلبات الحجز متاحة للطبيب أو فريق الاستقبال المخوّل فقط.' }, { status: 403, headers: { 'Cache-Control':'no-store' } });
  }

  const { data, error: queryError } = await supabase
    .from('appointments')
    .select('id,organization_id,patient_id,clinician_id,scheduled_start,scheduled_end,timezone,appointment_type,status,booking_status,booking_reference,patient_name_snapshot,patient_age_years,patient_phone_snapshot,created_at')
    .eq('organization_id', context.organizationId)
    .eq('booking_source', 'public_link')
    .eq('booking_status', 'requested')
    .order('scheduled_start', { ascending: true })
    .limit(100);

  if (queryError) return NextResponse.json({ error: 'تعذر تحميل طلبات الحجز الواردة.' }, { status: 500, headers: { 'Cache-Control':'no-store' } });
  return NextResponse.json({ requests: data ?? [] }, { headers: { 'Cache-Control':'no-store' } });
}
