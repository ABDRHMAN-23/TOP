import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { resolveOrganization } from '@/lib/supabase/organization';
const createSchema=z.object({clinical_note_id:z.string().uuid(),language:z.enum(['ar','en','bi']).default('ar'),report_type:z.enum(['encounter_summary','dental_examination','endodontic_report','patient_history']).default('encounter_summary')}).strict();
export async function GET(request:Request){
 const {supabase,user}=await requireUser();if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
 const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});if(!['owner','clinic_admin','dentist','clinician'].includes(context.role))return NextResponse.json({error:'التقارير السريرية متاحة للطبيب المخوّل فقط.'},{status:403});
 const {data,error:dbError}=await supabase.from('reports').select('id,patient_id,encounter_id,clinical_note_id,report_type,language,status,source_record_version,issued_at,created_at').eq('organization_id',context.organizationId).order('created_at',{ascending:false}).limit(100);
 if(dbError)return NextResponse.json({error:'تعذر تحميل التقارير.'},{status:500});return NextResponse.json({reports:data??[]});
}
export async function POST(request:Request){
 const {supabase,user}=await requireUser();if(!supabase)return NextResponse.json({error:'خدمة قاعدة البيانات غير مهيأة.'},{status:503});if(!user)return NextResponse.json({error:'سجّل الدخول أولاً.'},{status:401});
 const {context,error}=await resolveOrganization(supabase,user,request);if(!context)return NextResponse.json({error},{status:403});
 if(!['owner','clinic_admin','dentist','clinician'].includes(context.role))return NextResponse.json({error:'هذا الدور لا يسمح بإنشاء تقارير سريرية.'},{status:403});
 const parsed=createSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'نوع التقرير أو معرّف السجل غير صالح.'},{status:400});
 const {data:note,error:noteError}=await supabase.from('clinical_notes').select('id,patient_id,encounter_id,status,version,draft_json,created_at,approved_at').eq('id',parsed.data.clinical_note_id).eq('organization_id',context.organizationId).maybeSingle();
 if(noteError||!note)return NextResponse.json({error:'السجل السريري غير موجود.'},{status:404});if(note.status!=='approved')return NextResponse.json({error:'لا يمكن إصدار تقرير من مسودة غير معتمدة.'},{status:409});
 const {data:settings}=await supabase.from('clinic_settings').select('clinic_name_ar,clinic_name_en,logo_storage_key,address_ar,address_en,phone,email,default_report_language,paper_size,settings_version').eq('organization_id',context.organizationId).maybeSingle();
 const snapshot={clinicalNote:note.draft_json,encounter_id:note.encounter_id,recordVersion:note.version,approved_at:note.approved_at,patient_id:note.patient_id};
 const {data:report,error:insertError}=await supabase.from('reports').insert({organization_id:context.organizationId,patient_id:note.patient_id,encounter_id:note.encounter_id,clinical_note_id:note.id,report_type:parsed.data.report_type,language:parsed.data.language,status:'generated',source_record_version:note.version,clinic_identity_snapshot:{...settings,settings_version:settings?.settings_version||1},content_snapshot:snapshot,created_by:user.id}).select('id,report_type,language,status,source_record_version,created_at').single();
 if(insertError||!report)return NextResponse.json({error:'تعذر إنشاء نسخة التقرير.'},{status:500});
 await supabase.from('audit_events').insert({organization_id:context.organizationId,actor_user_id:user.id,action:'report.generated',resource_type:'report',resource_id:report.id,metadata:{note_id:note.id,version:note.version}});
 return NextResponse.json({report,message:'تم إنشاء لقطة تقرير داخل قاعدة البيانات. ملف PDF والتنزيل الفعليان يحتاجان خدمة تصيير التقارير.'},{status:201});
}
