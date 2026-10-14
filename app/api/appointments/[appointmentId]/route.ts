import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const updateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show']),
}).strict();

export async function PATCH(request: Request, ctx: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!supabase) return NextResponse.json({ error: 'خدمة قاعدة البيانات غير مهيأة.' }, { status: 503 });
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً.' }, { status: 401 });

  const { context, error } = await resolveOrganization(supabase, user, request);
  if (!context) return NextResponse.json({ error }, { status: 403 });
  if (!['owner', 'clinic_admin', 'dentist', 'clinician', 'receptionist'].includes(context.role)) {
    return NextResponse.json({ error: 'لا تسمح صلاحيات الحساب بتعديل حالة الموعد.' }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'حالة الموعد غير صالحة.' }, { status: 400 });

  const { data, error: updateError } = await supabase
    .from('appointments')
    .update({ status: parsed.data.status, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('organization_id', context.organizationId)
    .select('id,patient_id,clinician_id,scheduled_start,scheduled_end,timezone,appointment_type,status,note')
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: 'تعذر تحديث حالة الموعد.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'الموعد غير موجود في العيادة الحالية.' }, { status: 404 });

  await supabase.from('audit_events').insert({
    organization_id: context.organizationId,
    actor_user_id: user.id,
    action: 'appointment.status_changed',
    resource_type: 'appointment',
    resource_id: data.id,
    metadata: { status: data.status },
  });

  return NextResponse.json({ appointment: data });
}
