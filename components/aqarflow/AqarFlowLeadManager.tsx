'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';

type LeadStage='new'|'contacted'|'qualified'|'viewing_scheduled'|'negotiation'|'won'|'lost';
type Intent='buy'|'rent'|'invest'|'unknown';
type Note={id:string;note:string;created_at:string};
type Contact={
 id:string;phone_number:string;display_name:string|null;source:string;lead_stage:LeadStage;intent:Intent;
 budget_min:number|string|null;budget_max:number|string|null;budget_currency:string|null;
 preferred_area:string|null;preferred_property_type:string|null;lead_score:number;next_follow_up_at:string|null;
 notes:Note[];conversation:{id:string;status:string;last_message_at:string;last_message_preview:string|null}|null;
};
type LeadForm={displayName:string;phoneNumber:string;leadStage:LeadStage;intent:Intent;budgetMin:string;budgetMax:string;budgetCurrency:string;preferredArea:string;preferredPropertyType:string;leadScore:string;nextFollowUpAt:string};
const initial:LeadForm={displayName:'',phoneNumber:'',leadStage:'new',intent:'unknown',budgetMin:'',budgetMax:'',budgetCurrency:'USD',preferredArea:'',preferredPropertyType:'',leadScore:'0',nextFollowUpAt:''};
const stageLabels:Record<LeadStage,string>={new:'جديد',contacted:'تم التواصل',qualified:'مؤهل',viewing_scheduled:'معاينة مجدولة',negotiation:'تفاوض',won:'تم الإغلاق',lost:'غير مستمر'};
const intentLabels:Record<Intent,string>={buy:'شراء',rent:'إيجار',invest:'استثمار',unknown:'غير محددة'};
function dateTimeLocal(v:string|null){if(!v)return '';const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';const p=(n:number)=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}
function asForm(c:Contact):LeadForm{return {displayName:c.display_name||'',phoneNumber:c.phone_number,leadStage:c.lead_stage||'new',intent:c.intent||'unknown',budgetMin:c.budget_min===null?'':String(c.budget_min),budgetMax:c.budget_max===null?'':String(c.budget_max),budgetCurrency:c.budget_currency||'USD',preferredArea:c.preferred_area||'',preferredPropertyType:c.preferred_property_type||'',leadScore:String(c.lead_score??0),nextFollowUpAt:dateTimeLocal(c.next_follow_up_at)};}
export default function AqarFlowLeadManager(){
 const [contacts,setContacts]=useState<Contact[]>([]);const [form,setForm]=useState<LeadForm>({...initial});const [editingId,setEditingId]=useState('');
 const [stageFilter,setStageFilter]=useState('all');const [search,setSearch]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{const r=await fetch('/api/aqarflow/crm/contacts',{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر تحميل العملاء.');setContacts((b.contacts||[]) as Contact[]);},[]);
 useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل العملاء.')).finally(()=>setLoading(false));},[refresh]);
 function set<K extends keyof LeadForm>(key:K,value:LeadForm[K]){setForm(old=>({...old,[key]:value}));}
 function edit(c:Contact){setEditingId(c.id);setForm(asForm(c));setError('');setNotice('');if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'smooth'});}
 function cancel(){setEditingId('');setForm({...initial});setError('');setNotice('');}
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  const numeric=(s:string)=>s.trim()===''?null:Number(s);
  const payload={...(editingId?{id:editingId}:{}),displayName:form.displayName,phoneNumber:form.phoneNumber,
   leadStage:form.leadStage,intent:form.intent,budgetMin:numeric(form.budgetMin),budgetMax:numeric(form.budgetMax),
   budgetCurrency:form.budgetCurrency,preferredArea:form.preferredArea,preferredPropertyType:form.preferredPropertyType,
   leadScore:Number(form.leadScore),nextFollowUpAt:form.nextFollowUpAt?new Date(form.nextFollowUpAt).toISOString():null};
  try{const r=await fetch('/api/aqarflow/crm/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر حفظ العميل.');setNotice(editingId?'تم تحديث بيانات العميل.':'تم إنشاء العميل المحتمل.');setEditingId('');setForm({...initial});await refresh();}
  catch(e){setError(e instanceof Error?e.message:'تعذر حفظ العميل.');}finally{setBusy(false);}
 }
 const filtered=useMemo(()=>contacts.filter(c=>{
  const q=search.trim().toLocaleLowerCase();
  const match=!q||(c.display_name||'').toLocaleLowerCase().includes(q)||c.phone_number.includes(q)||(c.preferred_area||'').toLocaleLowerCase().includes(q);
  return match&&(stageFilter==='all'||c.lead_stage===stageFilter);
 }),[contacts,search,stageFilter]);
 const counts=useMemo(()=>({all:contacts.length,new:contacts.filter(c=>c.lead_stage==='new').length,qualified:contacts.filter(c=>c.lead_stage==='qualified').length,followups:contacts.filter(c=>c.next_follow_up_at&&Date.parse(c.next_follow_up_at)<=Date.now()).length}),[contacts]);
 if(loading)return <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">يجري تحميل العملاء…</div>;
 return <div dir="rtl" className="space-y-6">
  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
   {[{label:'كل العملاء',n:counts.all},{label:'عملاء جدد',n:counts.new},{label:'مؤهلون',n:counts.qualified},{label:'متابعة مستحقة',n:counts.followups}].map(x=><div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{x.label}</p><p className="mt-2 text-2xl font-black">{x.n}</p></div>)}
  </div>
  <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
   <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">{editingId?'تعديل العميل المحتمل':'إضافة عميل محتمل'}</h2><p className="mt-1 text-sm text-slate-500">يمكن تسجيل العميل قبل وصول أي رسالة واتساب، ثم ربطه بالمحادثة عند بدء التواصل بالرقم نفسه.</p></div>{editingId&&<button type="button" onClick={cancel} className="rounded-lg border px-3 py-2 text-sm font-bold">إلغاء</button>}</div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <label className="text-xs font-bold text-slate-600">اسم العميل<input required maxLength={160} value={form.displayName} onChange={e=>set('displayName',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="الاسم الكامل"/></label>
    <label className="text-xs font-bold text-slate-600">رقم الهاتف مع رمز الدولة<input required maxLength={30} value={form.phoneNumber} onChange={e=>set('phoneNumber',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="+967…"/></label>
    <label className="text-xs font-bold text-slate-600">مرحلة البيع<select value={form.leadStage} onChange={e=>set('leadStage',e.target.value as LeadStage)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal">{Object.entries(stageLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">نية العميل<select value={form.intent} onChange={e=>set('intent',e.target.value as Intent)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal">{Object.entries(intentLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">الميزانية الدنيا<input type="number" min={0} value={form.budgetMin} onChange={e=>set('budgetMin',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"/></label>
    <label className="text-xs font-bold text-slate-600">الميزانية العليا<input type="number" min={0} value={form.budgetMax} onChange={e=>set('budgetMax',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"/></label>
    <label className="text-xs font-bold text-slate-600">العملة<input maxLength={8} required value={form.budgetCurrency} onChange={e=>set('budgetCurrency',e.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"/></label>
    <label className="text-xs font-bold text-slate-600">المنطقة المفضلة<input maxLength={180} value={form.preferredArea} onChange={e=>set('preferredArea',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="المدينة أو الحي"/></label>
    <label className="text-xs font-bold text-slate-600">نوع العقار<input maxLength={80} value={form.preferredPropertyType} onChange={e=>set('preferredPropertyType',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="شقة، فيلا، أرض"/></label>
    <label className="text-xs font-bold text-slate-600">درجة التأهيل (0–100)<input required type="number" min={0} max={100} value={form.leadScore} onChange={e=>set('leadScore',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"/></label>
    <label className="text-xs font-bold text-slate-600">موعد المتابعة<input type="datetime-local" value={form.nextFollowUpAt} onChange={e=>set('nextFollowUpAt',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"/></label>
   </div>
   {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
   <button disabled={busy} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'جارٍ الحفظ…':editingId?'حفظ التعديلات':'إضافة العميل'}</button>
  </form>
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">خط متابعة العملاء</h2><p className="mt-1 text-xs text-slate-500">يعرض السجلات التي أُضيفت يدويًا أو عبر محادثات واتساب.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} className="rounded-xl border border-slate-300 p-2.5 text-sm" placeholder="بحث بالاسم أو الرقم أو المنطقة"/><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm"><option value="all">كل المراحل</option>{Object.entries(stageLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></div>
   {filtered.length===0?<p className="p-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة. أضف عميلًا أو غيّر المرشح.</p>:<div className="divide-y">{filtered.map(c=><article key={c.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{c.display_name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{stageLabels[c.lead_stage]}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{intentLabels[c.intent]}</span></div><p className="mt-1 text-sm text-slate-600">{c.phone_number} · {c.preferred_area||'المنطقة غير محددة'} · {c.preferred_property_type||'نوع العقار غير محدد'}</p><p className="mt-1 text-xs text-slate-500">الميزانية: {c.budget_min??'—'} إلى {c.budget_max??'—'} {c.budget_currency||'USD'} · درجة التأهيل {c.lead_score}/100</p>{c.next_follow_up_at&&<p className="mt-1 text-xs text-blue-700">موعد المتابعة: {new Date(c.next_follow_up_at).toLocaleString('ar')}</p>}{c.conversation&&<p className="mt-1 text-xs text-slate-500">آخر محادثة: {c.conversation.last_message_preview||'محادثة مرتبطة'} · {new Date(c.conversation.last_message_at).toLocaleString('ar')}</p>}{c.notes?.[0]&&<p className="mt-2 line-clamp-2 text-xs text-slate-500">آخر ملاحظة: {c.notes[0].note}</p>}</div>
    <div className="flex flex-wrap gap-2 self-start"><button onClick={()=>edit(c)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">تعديل العميل</button>{c.conversation&&<a href={'/aqarflow-inbox?conversationId='+encodeURIComponent(c.conversation.id)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">فتح محادثة العميل</a>}</div>
   </article>)}</div>}
  </section>
 </div>;
}
