import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';

const schema = z.object({ category: z.enum(['condition','allergy','medication','surgery','family_history','social_history','dental_history','other']), title: z.string().trim().min(1).max(180), value: z.unknown().optional().nullable(), state: z.enum(['positive','explicitly_negative','not_asked','not_recorded','unknown','not_applicable','needs_review']), source: z.string().max(3000).optional().nullable() }).strict();
export async function GET(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase,user }=await requireUser(); if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
  const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});if(!['owner','clinic_admin','dentist','clinician','assistant'].includes(context.role))return NextResponse.json({error:'التاريخ الصحي متاح للفريق السريري المخوّل فقط.'},{status:403});
  const {data,error:dbError}=await supabase.from('patient_medical_history_items').select('*').eq('patient_id',patientId).eq('organization_id',context.organizationId).order('created_at',{ascending:false});if(dbError)return NextResponse.json({error:'تعذر تحميل التاريخ الصحي.'},{status:500});return NextResponse.json({items:data??[]});
}
export async function POST(request: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params; const { supabase,user }=await requireUser(); if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
  const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});if(!['owner','clinic_admin','dentist','clinician','assistant'].includes(context.role))return NextResponse.json({error:'لا تسمح الصلاحيات بإضافة تاريخ صحي.'},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'تحقق من تصنيف المعلومة وحالتها.'},{status:400});
  const {data:patient}=await supabase.from('patients').select('id').eq('id',patientId).eq('organization_id',context.organizationId).maybeSingle();if(!patient)return NextResponse.json({error:'المريض غير موجود.'},{status:404});
  const {data,error:insertError}=await supabase.from('patient_medical_history_items').insert({...parsed.data,organization_id:context.organizationId,patient_id:patientId,created_by:user.id,last_reviewed_by:parsed.data.state==='needs_review'?null:user.id,last_reviewed_at:parsed.data.state==='needs_review'?null:new Date().toISOString()}).select('*').single();if(insertError||!data)return NextResponse.json({error:'تعذر حفظ عنصر التاريخ الصحي.'},{status:500});
  await supabase.from('audit_events').insert({organization_id:context.organizationId,actor_user_id:user.id,action:'patient_history.created',resource_type:'patient_history_item',resource_id:data.id,metadata:{category:data.category,state:data.state}});return NextResponse.json({item:data},{status:201});
}
