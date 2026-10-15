import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  shift: z.enum(['morning','evening']),
  enabled: z.boolean(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).strict();
const schema = z.object({
  public_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,49}$/),
  booking_enabled: z.boolean(),
  slot_minutes: z.union([z.literal(10),z.literal(15),z.literal(20),z.literal(30),z.literal(45),z.literal(60)]),
  max_bookings_per_slot: z.number().int().min(1).max(25),
  advance_booking_days: z.number().int().min(1).max(180),
  min_notice_minutes: z.number().int().min(0).max(10080),
  public_title_ar: z.string().max(180).optional().nullable(),
  public_title_en: z.string().max(180).optional().nullable(),
  public_message_ar: z.string().max(600).optional().nullable(),
  public_message_en: z.string().max(600).optional().nullable(),
  require_phone: z.boolean().default(true),
}).strict();

const shifts = ['morning','evening'] as const;
function defaultHours() {
  return Array.from({ length: 7 }).flatMap((_, weekday) => shifts.map((shift) => ({
    weekday, shift, enabled: false,
    start_time: shift === 'morning' ? '08:00' : '16:00',
    end_time: shift === 'morning' ? '12:00' : '20:00',
  })));
}
function clientSettings(row: any) {
  return {
    public_slug: row?.public_slug ?? '',
    booking_enabled: row?.booking_enabled ?? false,
    slot_minutes: row?.slot_minutes ?? 30,
    max_bookings_per_slot: row?.max_bookings_per_slot ?? 1,
    advance_booking_days: row?.advance_booking_days ?? 30,
    min_notice_minutes: row?.min_notice_minutes ?? 60,
    public_title_ar: row?.public_title_ar ?? '',
    public_title_en: row?.public_title_en ?? '',
    public_message_ar: row?.public_message_ar ?? '',
    public_message_en: row?.public_message_en ?? '',
    require_phone: row?.require_phone ?? true,
  };
}
function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return responseError('خدمة قاعدة البيانات غير مهيأة.',503);
  if (!user) return responseError('سجّل الدخول لإعداد الحجز الإلكتروني.',401);
  const { context, error } = await resolveOrganization(supabase,user,request);
  if (!context) return responseError(error || 'لا توجد صلاحية للوصول إلى العيادة.',403);
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return responseError('إعداد رابط الحجز متاح للطبيب أو مدير العيادة فقط.',403);
  const [{ data: settings, error: settingsError }, { data: hours, error: hoursError }] = await Promise.all([
    supabase.from('clinic_booking_settings').select('public_slug,booking_enabled,slot_minutes,max_bookings_per_slot,advance_booking_days,min_notice_minutes,public_title_ar,public_title_en,public_message_ar,public_message_en,require_phone').eq('organization_id',context.organizationId).maybeSingle(),
    supabase.from('clinic_booking_hours').select('weekday,shift,enabled,start_time,end_time').eq('organization_id',context.organizationId),
  ]);
  if (settingsError || hoursError) return responseError('تعذر تحميل إعدادات الحجز الإلكتروني. تحقق من تطبيق ترحيل قاعدة البيانات.',500);
  const defaults = {
    public_slug: 'clinic-'+context.organizationId.replace(/-/g,'').slice(0,10),
    booking_enabled: false, slot_minutes: 30, max_bookings_per_slot: 1,
    advance_booking_days: 30, min_notice_minutes: 60,
    public_title_ar: '', public_title_en: '', public_message_ar: '', public_message_en: '', require_phone: true,
  };
  const rows = new Map((hours || []).map((row:any) => [row.weekday+'-'+row.shift,row]));
  const completeHours = defaultHours().map((row) => {
    const stored:any = rows.get(row.weekday+'-'+row.shift);
    return stored ? { weekday:row.weekday,shift:row.shift,enabled:stored.enabled,start_time:String(stored.start_time).slice(0,5),end_time:String(stored.end_time).slice(0,5) } : row;
  });
  return NextResponse.json({ settings: { ...defaults, ...clientSettings(settings) }, hours: completeHours }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!supabase) return responseError('خدمة قاعدة البيانات غير مهيأة.',503);
  if (!user) return responseError('سجّل الدخول لإعداد الحجز الإلكتروني.',401);
  const { context, error } = await resolveOrganization(supabase,user,request);
  if (!context) return responseError(error || 'لا توجد صلاحية للوصول إلى العيادة.',403);
  if (!['owner','clinic_admin','dentist','clinician'].includes(context.role)) return responseError('إعداد رابط الحجز متاح للطبيب أو مدير العيادة فقط.',403);
  const parsed = schema.extend({ hours: z.array(hourSchema).length(14) }).strict().safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return responseError('تحقق من مواعيد العمل والحقول المدخلة.',400);
  const uniqueShifts = new Set(parsed.data.hours.map(h=>h.weekday+'-'+h.shift));
  if (uniqueShifts.size !== 14 || parsed.data.hours.some(h=>h.enabled && h.end_time<=h.start_time)) return responseError('لكل يوم فترتان فقط، ويجب أن تكون نهاية الفترة بعد بدايتها.',400);
  try {
    const { data, error: saveError } = await supabase.rpc('save_clinic_booking_settings', {
      p_organization_id: context.organizationId,
      p_settings: {
        public_slug: parsed.data.public_slug, booking_enabled: parsed.data.booking_enabled,
        slot_minutes: parsed.data.slot_minutes, max_bookings_per_slot: parsed.data.max_bookings_per_slot,
        advance_booking_days: parsed.data.advance_booking_days, min_notice_minutes: parsed.data.min_notice_minutes,
        public_title_ar: parsed.data.public_title_ar || null, public_title_en: parsed.data.public_title_en || null,
        public_message_ar: parsed.data.public_message_ar || null, public_message_en: parsed.data.public_message_en || null,
        require_phone: parsed.data.require_phone,
      },
      p_hours: parsed.data.hours,
    });
    if (saveError) {
      if (saveError.code === '23505') return responseError('هذا الاسم المختصر مستخدم لرابط عيادة أخرى. اختر اسماً مختلفاً.',409);
      return responseError(saveError.message.includes('at least one working shift') ? 'فعّل فترة عمل واحدة على الأقل قبل نشر رابط الحجز.' : 'تعذر حفظ إعدادات الحجز. راجع ساعات العمل ثم حاول مجدداً.',400);
    }
    return NextResponse.json({ settings: clientSettings(data?.settings), hours: Array.isArray(data?.hours) ? data.hours : parsed.data.hours }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return responseError('تعذر حفظ إعدادات الحجز.',500);
  }
}
