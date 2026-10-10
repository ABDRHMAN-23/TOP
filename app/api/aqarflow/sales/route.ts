import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runtimeEnv } from '@/lib/runtime-env';
import { readBoundedUtf8Body } from '@/lib/aqarflow/http-body';
import { buildPersonalizedSalesPrompt, validateSalesDraft, mergeBuyerProfile, type VerifiedProperty } from '@/lib/aqarflow/sales-engine';
import { generateGeminiJson, GeminiRuntimeError } from '@/lib/aqarflow/gemini-runtime';
import { rankPropertyCandidates } from '@/lib/aqarflow/ranked-inventory';
import { MAX_REQUEST_BODY_BYTES, MAX_REQUEST_BODY_CHARS, buildNoMatchSalesDraft, inferBasicBuyerProfileHints, parseAqarFlowSalesRequest } from '@/lib/aqarflow/runtime-contract';

export const dynamic = 'force-dynamic';
const MODEL_OUTPUT_SCHEMA: Record<string, unknown> = {
  type:'object',
  properties:{
    replyDraft:{type:'string'}, factsUsed:{type:'array',items:{type:'string'}}, unknowns:{type:'array',items:{type:'string'}},
    nextBestAction:{type:'string',enum:['send_photos','compare_properties','book_viewing','answer_question','ask_one_question','handoff_to_agent']},
    askOneQuestion:{type:'string'}, handoffRequired:{type:'boolean'},
  },
  required:['replyDraft','factsUsed','unknowns','nextBestAction','askOneQuestion','handoffRequired'],
};
type PropertyRow = {
  id:string; title:string; property_type:string|null; purpose:string|null; price:number|string|null; currency:string|null;
  area:number|string|null; bedrooms:number|null; bathrooms:number|null; location_label:string|null;
  verified_features:string[]|null; availability:'available'|'unavailable'|'unknown'; facts_last_verified_at:string|null;
};
function numberOrNull(v:number|string|null|undefined):number|null {
  if(v===null||v===undefined||v==='')return null; const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;
}
function mapProperty(row:PropertyRow):VerifiedProperty {
  return {id:row.id,title:row.title,propertyType:row.property_type,purpose:row.purpose,price:numberOrNull(row.price),currency:row.currency,
    area:numberOrNull(row.area),bedrooms:row.bedrooms,bathrooms:row.bathrooms,locationLabel:row.location_label,
    verifiedFeatures:Array.isArray(row.verified_features)?row.verified_features:[],availability:row.availability,factsLastVerifiedAt:row.facts_last_verified_at};
}
function safeError(status=503) {
  return NextResponse.json({error:'خدمة المساعد غير مهيأة بالكامل. يرجى المحاولة لاحقًا.'},{status,headers:{'Cache-Control':'no-store'}});
}
async function recordUsage(supabase:Awaited<ReturnType<typeof createClient>>,requestId:string,values:{
  model:string;latencyMs:number;inputTokens:number|null;outputTokens:number|null;resultValidated:boolean;outcome:'success'|'invalid_output'|'provider_error';
}) {
  try { await supabase.rpc('aqarflow_record_ai_usage',{
    p_request_id:requestId,p_model:values.model.slice(0,100),p_latency_ms:Math.min(Math.max(Math.round(values.latencyMs),0),120000),
    p_input_tokens:values.inputTokens,p_output_tokens:values.outputTokens,p_result_validated:values.resultValidated,p_outcome:values.outcome,
  }); } catch { /* Usage auditing must not leak prompt data or hide the primary result. */ }
}

export async function POST(req:Request) {
  const supabase=await createClient();
  const {data:authData,error:authError}=await supabase.auth.getUser();
  const user=authData?.user;
  if(authError||!user)return NextResponse.json({error:'يلزم تسجيل الدخول لاستخدام المساعد.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const contentLength=Number(req.headers.get('content-length')||0);
  if(Number.isFinite(contentLength)&&contentLength>MAX_REQUEST_BODY_BYTES)return NextResponse.json({error:'حجم الطلب أكبر من الحد المسموح.'},{status:413,headers:{'Cache-Control':'no-store'}});
  const bodyRead=await readBoundedUtf8Body(req,MAX_REQUEST_BODY_BYTES);
  if(!bodyRead.ok)return NextResponse.json({error:bodyRead.code==='too_large'?'حجم الطلب أكبر من الحد المسموح.':'تعذر قراءة الطلب بصيغة UTF-8 صحيحة.'},{status:bodyRead.code==='too_large'?413:400,headers:{'Cache-Control':'no-store'}});
  if(bodyRead.text.length>MAX_REQUEST_BODY_CHARS)return NextResponse.json({error:'حجم الطلب أكبر من الحد المسموح.'},{status:413,headers:{'Cache-Control':'no-store'}});
  let decoded:unknown;try{decoded=JSON.parse(bodyRead.text);}catch{return NextResponse.json({error:'صيغة الطلب غير صحيحة.'},{status:400});}
  const parsed=parseAqarFlowSalesRequest(decoded);
  if(!parsed.ok) {
    const msg=parsed.code==='message_too_long'?'رسالة العميل طويلة جدًا؛ اختصرها ثم أعد المحاولة.':parsed.code==='message_required'?'اكتب رسالة العميل أولًا.':'بيانات الطلب غير صحيحة.';
    return NextResponse.json({error:msg},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  const {data:memberships,error:membershipError}=await supabase.from('team_memberships').select('owner_id,role').eq('member_id',user.id).neq('owner_id',user.id).limit(2);
  if(membershipError)return safeError(503);
  if((memberships||[]).length>1)return NextResponse.json({error:'حسابك مرتبط بأكثر من مساحة عمل؛ يلزم تحديد المساحة أولًا.'},{status:409,headers:{'Cache-Control':'no-store'}});
  const workspaceOwnerId=memberships?.[0]?.owner_id||user.id;
  const model=runtimeEnv('AQARFLOW_GEMINI_MODEL')||'gemini-3.5-flash-lite';
  const {data:reservationId,error:reservationError}=await supabase.rpc('aqarflow_reserve_ai_request',{p_owner_user_id:workspaceOwnerId});
  if(reservationError)return safeError(503);
  if(typeof reservationId!=='string'||!reservationId)return NextResponse.json({error:'وصلت إلى حد استخدام المساعد مؤقتًا. حاول لاحقًا.'},{status:429,headers:{'Cache-Control':'no-store'}});
  const {data:rows,error:propertyError}=await supabase.from('aqarflow_properties')
    .select('id,title,property_type,purpose,price,currency,area,bedrooms,bathrooms,location_label,verified_features,availability,facts_last_verified_at')
    .eq('owner_user_id',workspaceOwnerId).eq('is_active',true).order('updated_at',{ascending:false}).limit(50);
  if(propertyError) {
    await recordUsage(supabase,reservationId,{model,latencyMs:0,inputTokens:null,outputTokens:null,resultValidated:false,outcome:'provider_error'});
    return safeError(503);
  }
  const rankingStartedAt=Date.now();
  const candidates=(rows||[]).map((r:unknown)=>mapProperty(r as PropertyRow));
  const buyerProfile=mergeBuyerProfile(inferBasicBuyerProfileHints(parsed.value.customerMessage),parsed.value.buyerProfile);
  const ranked=rankPropertyCandidates(buyerProfile,candidates);
  const selected=ranked.filter(m=>m.eligible).slice(0,5).map(m=>m.property);
  if(selected.length===0) {
    const validated=validateSalesDraft(buildNoMatchSalesDraft(candidates.length),[]);
    const latencyMs=Math.max(0,Date.now()-rankingStartedAt);
    if(!validated) {
      await recordUsage(supabase,reservationId,{model:'deterministic-no-match',latencyMs,inputTokens:0,outputTokens:0,resultValidated:false,outcome:'invalid_output'});
      return safeError(500);
    }
    await recordUsage(supabase,reservationId,{model:'deterministic-no-match',latencyMs,inputTokens:0,outputTokens:0,resultValidated:true,outcome:'success'});
    return NextResponse.json({...validated,matchedPropertyIds:[],usage:{inputTokens:0,outputTokens:0,totalTokens:0,latencyMs,model:'deterministic-no-match'}},{headers:{'Cache-Control':'no-store'}});
  }
  const apiKey=runtimeEnv('GEMINI_API_KEY');
  if(!apiKey) {
    await recordUsage(supabase,reservationId,{model,latencyMs:Date.now()-rankingStartedAt,inputTokens:null,outputTokens:null,resultValidated:false,outcome:'provider_error'});
    return safeError(503);
  }
  let promptPayload:Record<string,unknown>;
  try {
    promptPayload=JSON.parse(buildPersonalizedSalesPrompt({customerMessage:parsed.value.customerMessage,conversationSummary:parsed.value.conversationSummary,buyerProfile,properties:selected})) as Record<string,unknown>;
  } catch {
    await recordUsage(supabase,reservationId,{model,latencyMs:0,inputTokens:null,outputTokens:null,resultValidated:false,outcome:'invalid_output'});
    return safeError(500);
  }
  const systemInstruction=typeof promptPayload.system==='string'?promptPayload.system:'';
  delete promptPayload.system;
  const startedAt=Date.now();
  let result;
  try {
    result=await generateGeminiJson({apiKey,model,systemInstruction,prompt:JSON.stringify(promptPayload),responseSchema:MODEL_OUTPUT_SCHEMA,maxOutputTokens:650,timeoutMs:18000});
  } catch(error) {
    await recordUsage(supabase,reservationId,{model,latencyMs:Date.now()-startedAt,inputTokens:null,outputTokens:null,resultValidated:false,outcome:'provider_error'});
    if(error instanceof GeminiRuntimeError&&error.code==='timeout')return NextResponse.json({error:'تأخر رد المساعد؛ حاول مجددًا.'},{status:504,headers:{'Cache-Control':'no-store'}});
    return safeError(502);
  }
  let decodedDraft:unknown;
  try {
    decodedDraft=JSON.parse(result.text);
    if(decodedDraft&&typeof decodedDraft==='object'&&!Array.isArray(decodedDraft)) {
      const draft=decodedDraft as Record<string,unknown>;
      if(typeof draft.askOneQuestion!=='string'||!draft.askOneQuestion.trim())draft.askOneQuestion=null;
    }
  } catch {
    await recordUsage(supabase,reservationId,{model,latencyMs:Date.now()-startedAt,inputTokens:result.inputTokens,outputTokens:result.outputTokens,resultValidated:false,outcome:'invalid_output'});
    return NextResponse.json({error:'لم يتمكن المساعد من إنتاج رد قابل للتحقق.'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
  const validated=validateSalesDraft(decodedDraft,selected);
  const latencyMs=Date.now()-startedAt;
  await recordUsage(supabase,reservationId,{model,latencyMs,inputTokens:result.inputTokens,outputTokens:result.outputTokens,resultValidated:Boolean(validated),outcome:validated?'success':'invalid_output'});
  if(!validated)return NextResponse.json({error:'تم رفض الرد لأنه لم يجتز التحقق من الحقائق.'},{status:502,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({...validated,matchedPropertyIds:selected.map(p=>p.id),usage:{inputTokens:result.inputTokens,outputTokens:result.outputTokens,totalTokens:result.totalTokens,latencyMs,model}},{headers:{'Cache-Control':'no-store'}});
}
