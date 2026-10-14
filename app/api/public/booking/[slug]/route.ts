import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicBookingClient } from '@/lib/supabase/public-booking-client';

const bookingSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  age_years: z.number().int().min(1).max(120),
  phone: z.string().trim().min(7).max(30),
  start_at: z.string().datetime({ offset: true }),
  idempotency_key: z.string().uuid(),
  website: z.string().max(300).optional().default(''),
}).strict();

function fail(message: string,status:number) {
  return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
}
export async function GET(_request:Request,context:{params:Promise<{slug:string}>}) {
  const {slug}=await context.params;
  if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) return fail('رابط الحجز غير صالح.',404);
  const supabase=createPublicBookingClient();
  if(!supabase) return fail('خدمة الحجز غير متصلة حالياً. يرجى التواصل مع العيادة مباشرة.',503);
  const {data,error}=await supabase.rpc('get_public_booking_info',{p_slug:slug});
  if(error) return fail('تعذر تحميل بيانات الحجز. يرجى التواصل مع العيادة مباشرة.',503);
  if(!data) return fail('رابط الحجز غير مفعّل أو غير موجود.',404);
  return NextResponse.json({clinic:data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,context:{params:Promise<{slug:string}>}) {
  const {slug}=await context.params;
  if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) return fail('رابط الحجز غير صالح.',404);
  const body=await request.json().catch(()=>null);
  const parsed=bookingSchema.safeParse(body);
  if(!parsed.success) return fail('أدخل الاسم والعمر ورقم الهاتف واختر وقتاً متاحاً.',400);
  if(parsed.data.website.trim()) return fail('تعذر إرسال طلب الحجز.',400);
  const supabase=createPublicBookingClient();
  if(!supabase) return fail('خدمة الحجز غير متصلة حالياً. يرجى التواصل مع العيادة مباشرة.',503);
  const {data,error}=await supabase.rpc('create_public_booking_request',{
    p_slug:slug,p_full_name:parsed.data.full_name,p_age_years:parsed.data.age_years,
    p_phone:parsed.data.phone,p_scheduled_start:parsed.data.start_at,p_idempotency_key:parsed.data.idempotency_key,
  });
  if(error) {
    const msg=error.message||'';
    if(/no longer available|outside clinic hours|not a valid appointment slot/i.test(msg)) return fail('هذا الوقت لم يعد متاحاً. حدّث الأوقات واختر موعداً آخر.',409);
    if(/daily phone booking limit/i.test(msg)) return fail('تم بلوغ الحد اليومي للحجز بهذا الرقم. تواصل مع العيادة عند الحاجة إلى أكثر من ثلاثة حجوزات.',429);
    if(/booking is not available/i.test(msg)) return fail('رابط الحجز غير مفعّل حالياً.',404);
    if(/valid phone|patient age|patient name|invalid booking|invalid appointment/i.test(msg)) return fail('راجع الاسم والعمر ورقم الهاتف والوقت المختار.',400);
    return fail('تعذر إتمام الحجز. حدّث الصفحة وحاول مرة أخرى.',500);
  }
  return NextResponse.json({booking:data},{status:201,headers:{'Cache-Control':'no-store'}});
}
