'use client';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';

type Note={id:string;contact_id:string;author_user_id:string;note:string;created_at:string};
type Contact={
 id:string;phone_number:string;display_name:string|null;lead_stage:string;intent:string;
 budget_min:number|string|null;budget_max:number|string|null;budget_currency:string|null;
 preferred_area:string|null;preferred_property_type:string|null;lead_score:number;next_follow_up_at:string|null;notes:Note[];
};
type Message={id:string;conversation_id:string;direction:'inbound'|'outbound';message_type:string;message_text:string|null;ai_draft:string|null;facts_used:string[];unknowns:string[];provider_message_id:string|null;provider_status:string|null;created_at:string;sent_at:string|null};
type Template={name:string;language:string;category:string|null;bodyText:string;parameterCount:number};
type PendingTemplateSend={signature:string;key:string;conversationId:string};
type Conversation={id:string;status:string;handoff_required:boolean;last_message_at:string;last_message_preview:string|null;contact:Contact|null;integration:{phone_number_id:string;display_phone_number:string|null;verified_name:string|null}|null;messages:Message[]};
type LeadForm={leadStage:string;intent:string;budgetMin:string;budgetMax:string;budgetCurrency:string;preferredArea:string;preferredPropertyType:string;leadScore:string;nextFollowUpAt:string};

function toLocalDateTime(value:string|null|undefined){
 if(!value)return '';
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
const emptyLead:LeadForm={leadStage:'new',intent:'unknown',budgetMin:'',budgetMax:'',budgetCurrency:'USD',preferredArea:'',preferredPropertyType:'',leadScore:'0',nextFollowUpAt:''};
function leadFormFrom(contact:Contact|null):LeadForm{
 if(!contact)return {...emptyLead};
 return {
  leadStage:contact.lead_stage||'new',intent:contact.intent||'unknown',
  budgetMin:contact.budget_min===null?'':String(contact.budget_min),
  budgetMax:contact.budget_max===null?'':String(contact.budget_max),
  budgetCurrency:contact.budget_currency||'USD',preferredArea:contact.preferred_area||'',
  preferredPropertyType:contact.preferred_property_type||'',leadScore:String(contact.lead_score??0),
  nextFollowUpAt:toLocalDateTime(contact.next_follow_up_at),
 };
}
export default function AqarFlowInbox({initialConversationId=''}:{initialConversationId?:string}){
 const [conversations,setConversations]=useState<Conversation[]>([]);const [selectedId,setSelectedId]=useState('');const [canSend,setCanSend]=useState(false);const [canManageCrm,setCanManageCrm]=useState(false);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [draft,setDraft]=useState('');const [leadForm,setLeadForm]=useState<LeadForm>({...emptyLead});const [noteDraft,setNoteDraft]=useState('');
 const [templates,setTemplates]=useState<Template[]>([]);const [templatesLoading,setTemplatesLoading]=useState(false);const [selectedTemplateKey,setSelectedTemplateKey]=useState('');const [templateParams,setTemplateParams]=useState<string[]>([]);const [templateError,setTemplateError]=useState('');const [templateNotice,setTemplateNotice]=useState('');const [sendNeedsReview,setSendNeedsReview]=useState(false);const [templateNeedsReview,setTemplateNeedsReview]=useState(false);
 const pendingSend=useRef<{text:string;conversationId:string;key:string}|null>(null);
 const pendingTemplateSend=useRef<PendingTemplateSend|null>(null);
 const refresh=useCallback(async(keepId?:string)=>{
  const r=await fetch('/api/aqarflow/inbox',{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر تحميل صندوق المحادثات.');
  const rows=(b.conversations||[]) as Conversation[];setConversations(rows);setCanSend(Boolean(b.canSend));setCanManageCrm(Boolean(b.canManageCrm));
  const nextId=keepId&&rows.some(x=>x.id===keepId)?keepId:(rows[0]?.id||'');setSelectedId(nextId);
  if(pendingSend.current&&pendingSend.current.conversationId!==nextId)pendingSend.current=null;
  const selected=rows.find(x=>x.id===nextId);const lastDraft=[...(selected?.messages||[])].reverse().find(m=>m.ai_draft);
  setDraft(lastDraft?.ai_draft||'');
 },[]);
 useEffect(()=>{refresh(initialConversationId||undefined).catch(e=>setError(e instanceof Error?e.message:'تعذر التحميل.')).finally(()=>setLoading(false));},[refresh,initialConversationId]);
 const selected=useMemo(()=>conversations.find(x=>x.id===selectedId)||null,[conversations,selectedId]);
 useEffect(()=>{setLeadForm(leadFormFrom(selected?.contact||null));setNoteDraft('');},[selected?.contact,selected?.id]);
 const latestInbound=useMemo(()=>selected?[...selected.messages].reverse().find(m=>m.direction==='inbound'&&m.message_text)?.message_text||'':'',[selected]);
 const templateKey=(template:Template)=>template.name+'::'+template.language;
 const selectedTemplate=useMemo(()=>templates.find(template=>templateKey(template)===selectedTemplateKey)||null,[templates,selectedTemplateKey]);
 function setLead<K extends keyof LeadForm>(key:K,value:LeadForm[K]){setLeadForm(old=>({...old,[key]:value}));}
 async function generateDraft(){
  if(!selected||!latestInbound)return;setBusy(true);setError('');setNotice('');
  try{
   const summary=selected.messages.slice(-10).map(m=>(m.direction==='inbound'?'العميل: ':'المكتب: ')+(m.message_text||m.ai_draft||'')).join('\n').slice(-1000);
   const sales=await fetch('/api/aqarflow/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerMessage:latestInbound,conversationSummary:summary,buyerProfile:{preferredLanguage:'ar',preferredTone:'warm',intent:leadForm.intent,propertyType:leadForm.preferredPropertyType,preferredAreas:leadForm.preferredArea?[leadForm.preferredArea]:[],budgetMin:leadForm.budgetMin===''?undefined:Number(leadForm.budgetMin),budgetMax:leadForm.budgetMax===''?undefined:Number(leadForm.budgetMax),currency:leadForm.budgetCurrency}})});
   const result=await sales.json();if(!sales.ok)throw new Error(result.error||'تعذر إنشاء مسودة.');
   const save=await fetch('/api/aqarflow/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_draft',conversationId:selected.id,draft:result.replyDraft,factsUsed:result.factsUsed,unknowns:result.unknowns,handoffRequired:result.handoffRequired})});
   const saved=await save.json();if(!save.ok)throw new Error(saved.error||'تعذر حفظ المسودة.');
   setDraft(result.replyDraft);pendingSend.current=null;await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'حدث خطأ غير متوقع.');}finally{setBusy(false);}
 }
 async function saveLead(){
  if(!selected?.contact)return;setBusy(true);setError('');setNotice('');
  try{
   const numeric=(s:string)=>s.trim()===''?null:Number(s);
   const body={
    action:'update_contact',contactId:selected.contact.id,leadStage:leadForm.leadStage,intent:leadForm.intent,
    budgetMin:numeric(leadForm.budgetMin),budgetMax:numeric(leadForm.budgetMax),
    budgetCurrency:leadForm.budgetCurrency,preferredArea:leadForm.preferredArea,
    preferredPropertyType:leadForm.preferredPropertyType,leadScore:Number(leadForm.leadScore),
    nextFollowUpAt:leadForm.nextFollowUpAt?new Date(leadForm.nextFollowUpAt).toISOString():null,
   };
   const r=await fetch('/api/aqarflow/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر حفظ بيانات العميل.');
   setNotice('تم حفظ بيانات العميل وخطوة المتابعة.');await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ بيانات العميل.');}finally{setBusy(false);}
 }
 async function addNote(){
  if(!selected?.contact||!noteDraft.trim())return;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/aqarflow/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_note',contactId:selected.contact.id,note:noteDraft.trim()})});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر حفظ الملاحظة.');
   setNoteDraft('');setNotice('أضيفت الملاحظة إلى سجل العميل.');await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الملاحظة.');}finally{setBusy(false);}
 }
 async function loadTemplates(){
  const phoneNumberId=selected?.integration?.phone_number_id;
  if(!phoneNumberId){setTemplateError('لا يوجد رقم واتساب مرتبط بهذه المحادثة.');return;}
  setTemplatesLoading(true);setTemplateError('');setTemplateNotice('');
  try{
   const r=await fetch('/api/integrations/whatsapp/templates?phoneNumberId='+encodeURIComponent(phoneNumberId),{cache:'no-store'});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر تحميل القوالب المعتمدة.');
   const rows=(b.templates||[]) as Template[];setTemplates(rows);
   if(rows.length===0){setSelectedTemplateKey('');setTemplateParams([]);setTemplateNotice('لم يعثر Meta على قوالب نصية معتمدة مدعومة لهذا الرقم.');}
   else{
    const selectedStillExists=rows.some(template=>templateKey(template)===selectedTemplateKey);
    const next=selectedStillExists?rows.find(template=>templateKey(template)===selectedTemplateKey)!:rows[0];
    setSelectedTemplateKey(templateKey(next));setTemplateParams(old=>templateKey(next)===selectedTemplateKey&&old.length===next.parameterCount?old:new Array(next.parameterCount).fill(''));
    setTemplateNotice('تم تحميل القوالب النصية المعتمدة مباشرة من Meta.');
   }
  }catch(e){setTemplateError(e instanceof Error?e.message:'تعذر تحميل القوالب المعتمدة.');}
  finally{setTemplatesLoading(false);}
 }
 function selectTemplate(key:string){
  const template=templates.find(item=>templateKey(item)===key)||null;
  setSelectedTemplateKey(key);setTemplateParams(new Array(template?.parameterCount||0).fill(''));setTemplateError('');setTemplateNotice('');
  pendingTemplateSend.current=null;
 }
 async function sendApprovedTemplate(){
  if(!selected||!selected.contact?.phone_number||!selected.integration?.phone_number_id||!selectedTemplate)return;
  if(!canSend){setTemplateError('إرسال الرسائل متاح لمالك مساحة العمل فقط.');return;}
  if(templateParams.length!==selectedTemplate.parameterCount||templateParams.some(value=>!value.trim())){setTemplateError('أكمل جميع معاملات القالب قبل الإرسال.');return;}
  setBusy(true);setTemplateError('');setTemplateNotice('');
  try{
   const signature=JSON.stringify({conversationId:selected.id,phoneNumberId:selected.integration.phone_number_id,to:selected.contact.phone_number,name:selectedTemplate.name,language:selectedTemplate.language,parameters:templateParams});
   if(!pendingTemplateSend.current||pendingTemplateSend.current.signature!==signature){
    pendingTemplateSend.current={signature,conversationId:selected.id,key:'tpl_'+crypto.randomUUID().replace(/-/g,'')};
   }
   const idempotencyKey=pendingTemplateSend.current.key;
   const r=await fetch('/api/integrations/whatsapp/send-template',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    phoneNumberId:selected.integration.phone_number_id,to:selected.contact.phone_number,
    templateName:selectedTemplate.name,language:selectedTemplate.language,parameters:templateParams,
    idempotencyKey,conversationId:selected.id,
   })});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر إرسال القالب المعتمد.');
   if(b.persisted===false){
    if(b.retryAllowed){
     setTemplateNotice('أُرسل القالب، لكن سجل CRM غير مكتمل. يمكنك الضغط مرة أخرى بالقالب نفسه لإصلاح السجل؛ سيستخدم النظام المفتاح نفسه ولن يرسل نسخة مكررة.');
    }else{
     setTemplateNeedsReview(true);
     setTemplateNotice('أكدت Meta الإرسال لكن تعذر حفظ حالة الطلب على الخادم. أوقفت إعادة الإرسال احترازيًا؛ راجع حالة الرسالة في Meta قبل بدء إرسال جديد.');
    }
   }else{
    pendingTemplateSend.current=null;setTemplateNotice(b.replayed?'تمت مطابقة الرسالة السابقة وتحديث سجل المحادثة دون إرسال نسخة أخرى.':'تم إرسال القالب المعتمد وتسجيله في سجل المحادثة.');
   }
   await refresh(selected.id);
  }catch(e){setTemplateError(e instanceof Error?e.message:'تعذر إرسال القالب المعتمد.');}
  finally{setBusy(false);}
 }
 async function sendReply(){
  if(!selected||!selected.contact?.phone_number||!selected.integration?.phone_number_id||!draft.trim())return;
  if(!canSend){setError('الإرسال متاح لمالك مساحة العمل فقط في هذه النسخة.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const exactText=draft.trim();
   if(!pendingSend.current||pendingSend.current.text!==exactText||pendingSend.current.conversationId!==selected.id){pendingSend.current={text:exactText,conversationId:selected.id,key:'af_'+crypto.randomUUID().replace(/-/g,'')};}
   const idempotencyKey=pendingSend.current.key;
   const r=await fetch('/api/integrations/whatsapp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    phoneNumberId:selected.integration.phone_number_id,to:selected.contact.phone_number,text:draft.trim(),idempotencyKey,conversationId:selected.id,
   })});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر إرسال الرسالة.');
   if(b.persisted===false){
    if(b.retryAllowed){
     setNotice('أُرسلت الرسالة، لكن سجل CRM غير مكتمل. يمكنك الضغط مرة أخرى بالنص نفسه لإصلاح السجل؛ سيستخدم النظام المفتاح نفسه ولن يرسل نسخة مكررة.');
    }else{
     setSendNeedsReview(true);
     setNotice('أكدت Meta الإرسال لكن تعذر حفظ حالة الطلب على الخادم. أوقفت إعادة الإرسال احترازيًا؛ راجع حالة الرسالة في Meta قبل بدء إرسال جديد.');
    }
   }else{
    pendingSend.current=null;setDraft('');setNotice('تم إرسال الرسالة.');
   }
   await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'تعذر إرسال الرسالة.');}finally{setBusy(false);}
 }
 if(loading)return <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">يجري تحميل المحادثات…</div>;
 return <section dir="rtl" className="grid min-h-[72vh] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
  <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
   <div className="border-b p-4"><h2 className="font-black">محادثات واتساب</h2><p className="mt-1 text-xs text-slate-500">{conversations.length} محادثة حديثة</p><button onClick={()=>refresh(selectedId).catch(e=>setError(String(e)))} className="mt-2 text-sm font-bold text-blue-700">تحديث</button></div>
   {conversations.length===0?<p className="p-6 text-sm leading-6 text-slate-500">لا توجد رسائل بعد. بعد إعداد Webhook في Meta، ستظهر الرسائل الواردة هنا.</p>:<div className="max-h-[65vh] overflow-y-auto divide-y">{conversations.map(c=><button key={c.id} onClick={()=>{pendingSend.current=null;pendingTemplateSend.current=null;setSendNeedsReview(false);setTemplateNeedsReview(false);setSelectedId(c.id);setTemplates([]);setSelectedTemplateKey('');setTemplateParams([]);setTemplateError('');setTemplateNotice('');const d=[...c.messages].reverse().find(m=>m.ai_draft);setDraft(d?.ai_draft||'');}} className={'block w-full p-4 text-right hover:bg-slate-50 '+(selectedId===c.id?'bg-blue-50':'')}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{c.contact?.display_name||c.contact?.phone_number||'عميل واتساب'}</strong>{c.handoff_required&&<span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">مراجعة</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{c.last_message_preview||'رسالة جديدة'}</span><time className="mt-2 block text-[10px] text-slate-400">{new Date(c.last_message_at).toLocaleString('ar')}</time></button>)}</div>}
  </aside>
  <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
   {!selected?<div className="m-auto p-8 text-center text-slate-500">اختر محادثة لعرض الرسائل.</div>:<>
    <header className="flex items-center justify-between gap-3 border-b p-4"><div><h2 className="font-black">{selected.contact?.display_name||selected.contact?.phone_number||'عميل واتساب'}</h2><p className="mt-1 text-xs text-slate-500">{selected.contact?.phone_number} · {selected.integration?.verified_name||'WhatsApp Business'}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{selected.status==='open'?'مفتوحة':'مغلقة'}</span></header>
    <section className="border-b bg-white p-4">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">بيانات العميل ومراحل البيع</h3><span className="text-xs text-slate-500">درجة العميل: {leadForm.leadScore}/100</span></div>
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-xs font-bold text-slate-600">مرحلة البيع<select value={leadForm.leadStage} onChange={e=>setLead('leadStage',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal"><option value="new">عميل جديد</option><option value="contacted">تم التواصل</option><option value="qualified">عميل مؤهل</option><option value="viewing_scheduled">معاينة مجدولة</option><option value="negotiation">تفاوض</option><option value="won">تم الإغلاق</option><option value="lost">غير مستمر</option></select></label>
      <label className="text-xs font-bold text-slate-600">نية العميل<select value={leadForm.intent} onChange={e=>setLead('intent',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal"><option value="unknown">غير محددة</option><option value="buy">شراء</option><option value="rent">إيجار</option><option value="invest">استثمار</option></select></label>
      <label className="text-xs font-bold text-slate-600">درجة العميل (0–100)<input type="number" min={0} max={100} value={leadForm.leadScore} onChange={e=>setLead('leadScore',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"/></label>
      <label className="text-xs font-bold text-slate-600">الميزانية الدنيا<input type="number" min={0} value={leadForm.budgetMin} onChange={e=>setLead('budgetMin',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"/></label>
      <label className="text-xs font-bold text-slate-600">الميزانية العليا<input type="number" min={0} value={leadForm.budgetMax} onChange={e=>setLead('budgetMax',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"/></label>
      <label className="text-xs font-bold text-slate-600">العملة<input maxLength={8} value={leadForm.budgetCurrency} onChange={e=>setLead('budgetCurrency',e.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"/></label>
      <label className="text-xs font-bold text-slate-600">المنطقة المفضلة<input maxLength={180} value={leadForm.preferredArea} onChange={e=>setLead('preferredArea',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" placeholder="المدينة أو الحي"/></label>
      <label className="text-xs font-bold text-slate-600">نوع العقار المطلوب<input maxLength={80} value={leadForm.preferredPropertyType} onChange={e=>setLead('preferredPropertyType',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" placeholder="شقة، فيلا، أرض"/></label>
      <label className="text-xs font-bold text-slate-600">موعد المتابعة<input type="datetime-local" value={leadForm.nextFollowUpAt} onChange={e=>setLead('nextFollowUpAt',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"/></label>
     </div>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">تُستخدم هذه التفضيلات عند إنشاء مسودة المساعد العقاري.</span><button disabled={busy||!canManageCrm} onClick={saveLead} className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'جارٍ الحفظ…':'حفظ بيانات العميل'}</button></div>
     {selected.contact?.next_follow_up_at&&<p className="mt-2 text-xs text-blue-700">المتابعة المسجلة: {new Date(selected.contact.next_follow_up_at).toLocaleString('ar')}</p>}
    </section>
    <div className="max-h-[35vh] min-h-48 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">{selected.messages.map(m=><div key={m.id} className={'max-w-[90%] rounded-2xl p-3 '+(m.direction==='inbound'?'ml-auto bg-white border border-slate-200':'mr-auto bg-blue-50 border border-blue-100')}><p className="whitespace-pre-wrap text-sm leading-6">{m.message_text||m.ai_draft||'رسالة غير نصية'}</p><div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400"><span>{m.direction==='inbound'?'العميل':'المكتب'}{m.provider_status==='draft'?' · مسودة غير مرسلة':''}</span><time>{new Date(m.created_at).toLocaleTimeString('ar')}</time></div></div>)}</div>
    <section className="border-t p-4">
     <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-black">ملاحظات داخلية</h3><span className="text-xs text-slate-500">{selected.contact?.notes?.length||0} ملاحظة حديثة</span></div>
     <div className="space-y-2">{(selected.contact?.notes||[]).map(n=><article key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="whitespace-pre-wrap text-sm leading-6">{n.note}</p><time className="mt-1 block text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString('ar')}</time></article>)}</div>
     <div className="mt-3 flex flex-col gap-2 sm:flex-row"><textarea rows={2} maxLength={2000} value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-600" placeholder="أضف ملاحظة داخلية للفريق — لا تُرسل للعميل."/><button disabled={busy||!noteDraft.trim()||!canManageCrm} onClick={addNote} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">حفظ الملاحظة</button></div>
    </section>
    <div className="space-y-3 border-t p-4">
     {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     {notice&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
     <button disabled={busy||!latestInbound} onClick={generateDraft} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{busy?'جارٍ العمل…':'إنشاء مسودة من المساعد العقاري'}</button>
     <label className="block text-sm font-bold">مسودة قابلة للتعديل<textarea rows={4} maxLength={1200} value={draft} onChange={e=>setDraft(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-blue-600" placeholder="أنشئ مسودة بالذكاء الاصطناعي أو اكتب ردك هنا…"/></label>
     <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">لا تُرسل أي رسالة قبل ضغط زر الإرسال.</span><button disabled={busy||sendNeedsReview||!draft.trim()||!canSend} onClick={sendReply} className="min-h-11 rounded-xl bg-blue-700 px-5 py-2 font-bold text-white disabled:opacity-50">{canSend?'إرسال عبر واتساب':'الإرسال متاح للمالك فقط'}</button></div>
    </div>
    <section className="space-y-3 border-t bg-slate-50 p-4">
     <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">قوالب واتساب المعتمدة</h3><p className="mt-1 text-xs leading-5 text-slate-500">للإرسال خارج نافذة 24 ساعة. يتم جلب الاعتماد الحالي من Meta، ولا ترسل القوالب إلا بعد الضغط اليدوي على الزر.</p></div><button disabled={templatesLoading||busy||!selected.integration?.phone_number_id} onClick={loadTemplates} className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{templatesLoading?'جارٍ التحميل…':'تحديث القوالب من Meta'}</button></div>
     {templateError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{templateError}</p>}
     {templateNotice&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{templateNotice}</p>}
     {templates.length>0&&<label className="block text-sm font-bold">القالب واللغة<select value={selectedTemplateKey} onChange={e=>selectTemplate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="">اختر قالبًا معتمدًا</option>{templates.map(template=><option key={templateKey(template)} value={templateKey(template)}>{template.name} · {template.language}{template.category?' · '+template.category:''}</option>)}</select></label>}
     {selectedTemplate&&<div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-600">معاينة متن القالب</p><p className="whitespace-pre-wrap text-sm leading-6">{selectedTemplate.bodyText}</p><p className="text-xs text-slate-500">المعاملات المطلوبة: {selectedTemplate.parameterCount}. يقتصر هذا المسار على قوالب النص؛ القوالب ذات أزرار ديناميكية أو وسائط غير مدعومة تُستبعد.</p>
      {selectedTemplate.parameterCount>0&&<div className="grid gap-3 sm:grid-cols-2">{templateParams.map((value,index)=><label key={index} className="text-xs font-bold text-slate-600">قيمة المتغير {index+1}<input value={value} maxLength={1024} onChange={e=>setTemplateParams(old=>old.map((item,i)=>i===index?e.target.value:item))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" placeholder={'أدخل قيمة {{'+(index+1)+'}}'}/></label>)}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">معاينة تقريبية فقط؛ Meta هي المرجع النهائي للقالب المعتمد.</span><button disabled={busy||templateNeedsReview||!canSend||templateParams.length!==selectedTemplate.parameterCount||templateParams.some(value=>!value.trim())} onClick={sendApprovedTemplate} className="min-h-11 rounded-xl bg-blue-700 px-5 py-2 font-bold text-white disabled:opacity-50">{busy?'جارٍ التحقق والإرسال…':'إرسال القالب المعتمد يدويًا'}</button></div>
     </div>}
     {templates.length===0&&!templatesLoading&&!templateNotice&&<p className="text-xs text-slate-500">اضغط تحديث القوالب لعرض القوالب المدعومة والمعتمدة حاليًا من Meta.</p>}
    </section>
   </>}
  </div>
 </section>;
}
