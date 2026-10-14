import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema=z.object({action:z.enum(['confirm','decline'])}).strict();
export async function POST(request:Request,context:{params:Promise<{appointmentId:string}>}) {
  const {appointmentId}=await context.params;
  if(!/^[0-9a-f-]{36}$/i.test(appointmentId)) return NextResponse.json({error:'طلب الحجز غير صالح.'},{status:400});
  const {supabase,user}=await requireUser();
  if(!supabase) return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});
  if(!user) return NextResponse.json({error:'سجّل الدخول لمراجعة طلب الحجز.'},{status:401});
  const {context:org,error}=await resolveOrganization(supabase,user,request);
  if(!org) return NextResponse.json({error:error||'لا توجد صلاحية للعيادة.'},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:'الإجراء المطلوب غير صالح.'},{status:400});
  const {data,error:rpcError}=await supabase.rpc('resolve_public_booking_request',{
    p_organization_id:org.organizationId,p_appointment_id:appointmentId,p_action:parsed.data.action,
  });
  if(rpcError) {
    if(rpcError.code==='42501') return NextResponse.json({error:'لا تسمح صلاحياتك بمراجعة طلبات الحجز.'},{status:403});
    if(rpcError.code==='P0002') return NextResponse.json({error:'طلب الحجز غير موجود في هذه العيادة.'},{status:404});
    return NextResponse.json({error:'تعذر تحديث طلب الحجز؛ ربما تمت مراجعته من مستخدم آخر.'},{status:409});
  }
  return NextResponse.json({result:data});
}
