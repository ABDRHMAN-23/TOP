'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';

type Message={id:string;conversation_id:string;direction:'inbound'|'outbound';message_type:string;message_text:string|null;ai_draft:string|null;facts_used:string[];unknowns:string[];provider_message_id:string|null;provider_status:string|null;created_at:string;sent_at:string|null};
type Conversation={id:string;status:string;handoff_required:boolean;last_message_at:string;last_message_preview:string|null;contact:{id:string;phone_number:string;display_name:string|null}|null;integration:{phone_number_id:string;display_phone_number:string|null;verified_name:string|null}|null;messages:Message[]};
export default function AqarFlowInbox(){
 const [conversations,setConversations]=useState<Conversation[]>([]);const [selectedId,setSelectedId]=useState('');const [canSend,setCanSend]=useState(false);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [draft,setDraft]=useState('');
 const refresh=useCallback(async(keepId?:string)=>{
  const r=await fetch('/api/aqarflow/inbox',{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر تحميل صندوق المحادثات.');
  const rows=(b.conversations||[]) as Conversation[];setConversations(rows);setCanSend(Boolean(b.canSend));
  const nextId=keepId&&rows.some(x=>x.id===keepId)?keepId:(rows[0]?.id||'');setSelectedId(nextId);
  const selected=rows.find(x=>x.id===nextId);const lastDraft=[...(selected?.messages||[])].reverse().find(m=>m.ai_draft);
  setDraft(lastDraft?.ai_draft||'');
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:'تعذر التحميل.')).finally(()=>setLoading(false));},[refresh]);
 const selected=useMemo(()=>conversations.find(x=>x.id===selectedId)||null,[conversations,selectedId]);
 const latestInbound=useMemo(()=>selected?[...selected.messages].reverse().find(m=>m.direction==='inbound'&&m.message_text)?.message_text||'':'',[selected]);
 async function generateDraft(){
  if(!selected||!latestInbound)return;setBusy(true);setError('');
  try{
   const summary=selected.messages.slice(-10).map(m=>(m.direction==='inbound'?'العميل: ':'المكتب: ')+(m.message_text||m.ai_draft||'')).join('\n').slice(-1000);
   const sales=await fetch('/api/aqarflow/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerMessage:latestInbound,conversationSummary:summary,buyerProfile:{preferredLanguage:'ar',preferredTone:'warm'}})});
   const result=await sales.json();if(!sales.ok)throw new Error(result.error||'تعذر إنشاء مسودة.');
   const save=await fetch('/api/aqarflow/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_draft',conversationId:selected.id,draft:result.replyDraft,factsUsed:result.factsUsed,unknowns:result.unknowns,handoffRequired:result.handoffRequired})});
   const saved=await save.json();if(!save.ok)throw new Error(saved.error||'تعذر حفظ المسودة.');
   setDraft(result.replyDraft);await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'حدث خطأ غير متوقع.');}finally{setBusy(false);}
 }
 async function sendReply(){
  if(!selected||!selected.contact?.phone_number||!selected.integration?.phone_number_id||!draft.trim())return;
  if(!canSend){setError('الإرسال متاح لمالك مساحة العمل فقط في هذه النسخة.');return;}
  setBusy(true);setError('');
  try{
   const idempotencyKey='af_'+crypto.randomUUID().replace(/-/g,'');
   const r=await fetch('/api/integrations/whatsapp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    phoneNumberId:selected.integration.phone_number_id,to:selected.contact.phone_number,text:draft.trim(),idempotencyKey,conversationId:selected.id,
   })});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر إرسال الرسالة.');
   setDraft('');await refresh(selected.id);
  }catch(e){setError(e instanceof Error?e.message:'تعذر إرسال الرسالة.');}finally{setBusy(false);}
 }
 if(loading)return <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">يجري تحميل المحادثات…</div>;
 return <section dir="rtl" className="grid min-h-[72vh] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
  <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
   <div className="border-b p-4"><h2 className="font-black">محادثات واتساب</h2><p className="mt-1 text-xs text-slate-500">{conversations.length} محادثة حديثة</p><button onClick={()=>refresh(selectedId).catch(e=>setError(String(e)))} className="mt-2 text-sm font-bold text-blue-700">تحديث</button></div>
   {conversations.length===0?<p className="p-6 text-sm leading-6 text-slate-500">لا توجد رسائل بعد. بعد إعداد Webhook في Meta، ستظهر الرسائل الواردة هنا.</p>:<div className="max-h-[65vh] overflow-y-auto divide-y">{conversations.map(c=><button key={c.id} onClick={()=>{setSelectedId(c.id);const d=[...c.messages].reverse().find(m=>m.ai_draft);setDraft(d?.ai_draft||'');}} className={'block w-full p-4 text-right hover:bg-slate-50 '+(selectedId===c.id?'bg-blue-50':'')}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{c.contact?.display_name||c.contact?.phone_number||'عميل واتساب'}</strong>{c.handoff_required&&<span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">مراجعة</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{c.last_message_preview||'رسالة جديدة'}</span><time className="mt-2 block text-[10px] text-slate-400">{new Date(c.last_message_at).toLocaleString('ar')}</time></button>)}</div>}
  </aside>
  <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
   {!selected?<div className="m-auto p-8 text-center text-slate-500">اختر محادثة لعرض الرسائل.</div>:<>
    <header className="flex items-center justify-between gap-3 border-b p-4"><div><h2 className="font-black">{selected.contact?.display_name||selected.contact?.phone_number||'عميل واتساب'}</h2><p className="mt-1 text-xs text-slate-500">{selected.contact?.phone_number} · {selected.integration?.verified_name||'WhatsApp Business'}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{selected.status==='open'?'مفتوحة':'مغلقة'}</span></header>
    <div className="max-h-[40vh] min-h-56 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">{selected.messages.map(m=><div key={m.id} className={'max-w-[90%] rounded-2xl p-3 '+(m.direction==='inbound'?'ml-auto bg-white border border-slate-200':'mr-auto bg-blue-50 border border-blue-100')}><p className="whitespace-pre-wrap text-sm leading-6">{m.message_text||m.ai_draft||'رسالة غير نصية'}</p><div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400"><span>{m.direction==='inbound'?'العميل':'المكتب'}{m.provider_status==='draft'?' · مسودة غير مرسلة':''}</span><time>{new Date(m.created_at).toLocaleTimeString('ar')}</time></div></div>)}</div>
    <div className="space-y-3 border-t p-4">
     {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     <button disabled={busy||!latestInbound} onClick={generateDraft} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{busy?'جارٍ العمل…':'إنشاء مسودة من المساعد العقاري'}</button>
     <label className="block text-sm font-bold">مسودة قابلة للتعديل<textarea rows={4} maxLength={1200} value={draft} onChange={e=>setDraft(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-blue-600" placeholder="أنشئ مسودة بالذكاء الاصطناعي أو اكتب ردك هنا…"/></label>
     <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">لا تُرسل أي رسالة قبل ضغط زر الإرسال.</span><button disabled={busy||!draft.trim()||!canSend} onClick={sendReply} className="min-h-11 rounded-xl bg-blue-700 px-5 py-2 font-bold text-white disabled:opacity-50">{canSend?'إرسال عبر واتساب':'الإرسال متاح للمالك فقط'}</button></div>
    </div>
   </>}
  </div>
 </section>;
}
