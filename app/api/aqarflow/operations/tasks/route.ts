import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { isTransitionAllowed, parseTaskCreate, parseTaskPatch } from '@/lib/aqarflow/operations-contract';

export const dynamic='force-dynamic';
const TASK_COLUMNS='id,owner_user_id,contact_id,conversation_id,task_type,title,description,due_at,priority,status,result_note,assigned_to,created_by,completed_at,created_at,updated_at';
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function context(){
  let supabase:Awaited<ReturnType<typeof createClient>>;
  try{supabase=await createClient();}catch{return {error:response({error:'خدمة تسجيل الدخول غير متاحة.'},503)};}
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return {error:response({error:'يلزم تسجيل الدخول لإدارة المهام.'},401)};
  const {data:members,error:memberError}=await supabase.from('aqarflow_workspace_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(2);
  if(memberError)return {error:response({error:'تعذر التحقق من مساحة العمل.'},503)};
  if((members||[]).length>1)return {error:response({error:'حسابك مرتبط بأكثر من مساحة عمل؛ حدد مساحة واحدة أولًا.'},409)};
  try{return {supabase,user:data.user,ownerId:members?.[0]?.owner_id||data.user.id,admin:createAdminClient()};}
  catch{return {error:response({error:'قاعدة بيانات عمليات المبيعات غير متاحة.'},503)};}
}
async function canAssign(ctx:{supabase:Awaited<ReturnType<typeof createClient>>;user:{id:string};ownerId:string},assignedTo:string|null){
  if(!assignedTo||assignedTo===ctx.ownerId)return true;
  const {data,error}=await ctx.supabase.from('aqarflow_workspace_memberships').select('member_id')
    .eq('owner_id',ctx.ownerId).eq('member_id',assignedTo).maybeSingle();
  return !error&&Boolean(data);
}

export async function GET(){
  const ctx=await context();if(ctx.error)return ctx.error;
  const {data:tasks,error}=await ctx.admin!.from('aqarflow_crm_tasks').select(TASK_COLUMNS)
    .eq('owner_user_id',ctx.ownerId!).order('due_at',{ascending:true}).limit(200);
  if(error)return response({error:'جدول المهام غير مهيأ. طبّق هجرة عمليات المبيعات في قاعدة التطوير.'},503);
  const rows=tasks||[];
  const contactIds=Array.from(new Set(rows.map((task)=>task.contact_id)));
  const contactsResult=contactIds.length
    ?await ctx.admin!.from('aqarflow_crm_contacts').select('id,display_name,phone_number,lead_stage,lead_score').eq('owner_user_id',ctx.ownerId!).in('id',contactIds)
    :{data:[],error:null};
  if(contactsResult.error)return response({error:'تعذر تحميل بيانات العملاء المرتبطين بالمهام.'},503);
  const contacts=new Map((contactsResult.data||[]).map((contact)=>[contact.id,contact]));
  return response({tasks:rows.map((task)=>({...task,contact:contacts.get(task.contact_id)||null})),canManage:true});
}

export async function POST(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const parsedBody=await readBoundedJson(request,12_000);
  if(!parsedBody.ok)return response({error:parsedBody.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صالحة.'},parsedBody.reason==='too_large'?413:400);
  const parsed=parseTaskCreate(parsedBody.value);if(!parsed.ok)return response({error:parsed.error},400);
  const value=parsed.value;
  const {data:contact,error:contactError}=await ctx.admin!.from('aqarflow_crm_contacts').select('id')
    .eq('owner_user_id',ctx.ownerId!).eq('id',value.contactId).maybeSingle();
  if(contactError)return response({error:'تعذر التحقق من ملكية العميل.'},503);
  if(!contact)return response({error:'العميل غير موجود في مساحة العمل.'},404);
  if(value.conversationId){
    const {data:conversation,error:conversationError}=await ctx.admin!.from('aqarflow_crm_conversations').select('id')
      .eq('owner_user_id',ctx.ownerId!).eq('id',value.conversationId).eq('contact_id',value.contactId).maybeSingle();
    if(conversationError)return response({error:'تعذر التحقق من المحادثة المرتبطة.'},503);
    if(!conversation)return response({error:'المحادثة لا تتبع العميل المحدد داخل مساحة العمل.'},400);
  }
  if(!(await canAssign({supabase:ctx.supabase!,user:ctx.user!,ownerId:ctx.ownerId!},value.assignedTo))){
    return response({error:'المسؤول المحدد ليس عضوًا في مساحة العمل.'},403);
  }
  const {data:task,error}=await ctx.admin!.from('aqarflow_crm_tasks').insert({
    owner_user_id:ctx.ownerId,contact_id:value.contactId,conversation_id:value.conversationId,
    task_type:value.taskType,title:value.title,description:value.description,due_at:value.dueAt,
    priority:value.priority,status:'pending',assigned_to:value.assignedTo,created_by:ctx.user!.id,
  }).select(TASK_COLUMNS).single();
  if(error)return response({error:'تعذر إنشاء المهمة. تأكد من وجود العميل ومن تطبيق هجرة عمليات المبيعات.'},503);
  return response({task},201);
}

export async function PATCH(request:Request){
  const ctx=await context();if(ctx.error)return ctx.error;
  const parsedBody=await readBoundedJson(request,12_000);
  if(!parsedBody.ok)return response({error:parsedBody.reason==='too_large'?'حجم الطلب أكبر من الحد.':'بيانات الطلب غير صالحة.'},parsedBody.reason==='too_large'?413:400);
  const parsed=parseTaskPatch(parsedBody.value);if(!parsed.ok)return response({error:parsed.error},400);
  const {id,...changes}=parsed.value;
  const {data:current,error:currentError}=await ctx.admin!.from('aqarflow_crm_tasks').select(TASK_COLUMNS)
    .eq('owner_user_id',ctx.ownerId!).eq('id',id).maybeSingle();
  if(currentError)return response({error:'تعذر تحميل المهمة.'},503);
  if(!current)return response({error:'المهمة غير موجودة في مساحة العمل.'},404);
  if(changes.status&&!isTransitionAllowed(current.status,changes.status,'task')){
    return response({error:'لا يمكن إعادة فتح مهمة ملغاة.'},409);
  }
  if(Object.hasOwn(changes,'assignedTo')&&!(await canAssign({supabase:ctx.supabase!,user:ctx.user!,ownerId:ctx.ownerId!},changes.assignedTo||null))){
    return response({error:'المسؤول المحدد ليس عضوًا في مساحة العمل.'},403);
  }
  const status=changes.status||current.status;
  const update:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(changes.title!==undefined)update.title=changes.title;
  if(changes.description!==undefined)update.description=changes.description;
  if(changes.dueAt!==undefined)update.due_at=changes.dueAt;
  if(changes.priority!==undefined)update.priority=changes.priority;
  if(changes.status!==undefined)update.status=changes.status;
  if(changes.resultNote!==undefined)update.result_note=changes.resultNote;
  if(changes.assignedTo!==undefined)update.assigned_to=changes.assignedTo;
  if(changes.status==='completed')update.completed_at=new Date().toISOString();
  else if(status!=='completed')update.completed_at=null;
  const {data:task,error}=await ctx.admin!.from('aqarflow_crm_tasks').update(update)
    .eq('owner_user_id',ctx.ownerId!).eq('id',id).select(TASK_COLUMNS).maybeSingle();
  if(error)return response({error:'تعذر تحديث المهمة.'},503);
  if(!task)return response({error:'المهمة غير موجودة في مساحة العمل.'},404);
  return response({task});
}
