import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicBookingClient } from '@/lib/supabase/public-booking-client';

export async function GET(request:Request,context:{params:Promise<{slug:string}>}) {
  const {slug}=await context.params;
  if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) return NextResponse.json({error:'رابط الحجز غير صالح.'},{status:404});
  const date=new URL(request.url).searchParams.get('date')||'';
  const parsed=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  if(!parsed.success) return NextResponse.json({error:'اختر تاريخاً صحيحاً.'},{status:400});
  const supabase=createPublicBookingClient();
  if(!supabase) return NextResponse.json({error:'خدمة الحجز غير متصلة حالياً.'},{status:503});
  const {data,error}=await supabase.rpc('get_public_booking_slots',{p_slug:slug,p_date:parsed.data});
  if(error) return NextResponse.json({error:'تعذر تحميل الأوقات المتاحة.'},{status:503});
  if(!data?.available) return NextResponse.json({error:'رابط الحجز غير مفعّل.'},{status:404});
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
