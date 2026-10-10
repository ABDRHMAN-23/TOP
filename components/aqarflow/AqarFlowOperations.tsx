'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';

type Contact={id:string;display_name:string|null;phone_number:string;lead_stage:string;lead_score?:number};
type Property={id:string;title:string;location_label:string|null};
type TaskStatus='pending'|'in_progress'|'completed'|'cancelled';
type Task={
 id:string;contact_id:string;title:string;description:string|null;due_at:string;priority:string;status:TaskStatus;
 task_type:string;result_note:string|null;completed_at:string|null;contact:Contact|null;
};
type ViewingStatus='scheduled'|'confirmed'|'completed'|'cancelled'|'no_show';
type Viewing={
 id:string;contact_id:string;property_id:string|null;title:string;location:string|null;starts_at:string;ends_at:string;
 timezone:string;status:ViewingStatus;notes:string|null;contact:Contact|null;property:Property|null;
};
type TaskForm={contactId:string;title:string;taskType:string;dueAt:string;priority:string;description:string};
type ViewingForm={contactId:string;propertyId:string;title:string;location:string;startsAt:string;endsAt:string;notes:string};
const emptyTask:TaskForm={contactId:'',title:'',taskType:'follow_up',dueAt:'',priority:'normal',description:''};
const emptyViewing:ViewingForm={contactId:'',propertyId:'',title:'معاينة عقار',location:'',startsAt:'',endsAt:'',notes:''};
const taskStatusLabels:Record<TaskStatus,string>={pending:'مجدولة',in_progress:'قيد التنفيذ',completed:'مكتملة',cancelled:'ملغاة'};
const viewingStatusLabels:Record<ViewingStatus,string>={scheduled:'مجدولة',confirmed:'مؤكدة',completed:'تمت',cancelled:'ملغاة',no_show:'لم يحضر العميل'};
const taskTypeLabels:Record<string,string>={follow_up:'متابعة',call:'اتصال',send_information:'إرسال معلومات',viewing:'معاينة',document:'مستندات',other:'أخرى'};
const priorityLabels:Record<string,string>={low:'منخفضة',normal:'عادية',high:'مرتفعة',urgent:'عاجلة'};
function localTime(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ar-YE',{dateStyle:'medium',timeStyle:'short'}).format(date):'—';}
function isOverdue(task:Task){return task.status==='pending'||task.status==='in_progress'?Date.parse(task.due_at)<Date.now():false;}
function contactLabel(contact:Contact|null){return contact?.display_name||contact?.phone_number||'عميل غير معروف';}
function errorText(value:unknown,fallback:string){return value instanceof Error&&value.message?value.message:fallback;}

export default function AqarFlowOperations(){
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [properties,setProperties]=useState<Property[]>([]);
 const [tasks,setTasks]=useState<Task[]>([]);
 const [viewings,setViewings]=useState<Viewing[]>([]);
 const [taskForm,setTaskForm]=useState<TaskForm>({...emptyTask});
 const [viewingForm,setViewingForm]=useState<ViewingForm>({...emptyViewing});
 const [filter,setFilter]=useState<'active'|'all'|'overdue'>('active');
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const timezone=useMemo(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Aden';}catch{return 'Asia/Aden';}},[]);
 const refresh=useCallback(async()=>{
  const responses=await Promise.all([
   fetch('/api/aqarflow/crm/contacts',{cache:'no-store'}),
   fetch('/api/aqarflow/properties',{cache:'no-store'}),
   fetch('/api/aqarflow/operations/tasks',{cache:'no-store'}),
   fetch('/api/aqarflow/operations/viewings',{cache:'no-store'}),
  ]);
  const payloads=await Promise.all(responses.map(async r=>({ok:r.ok,status:r.status,body:await r.json().catch(()=>({}))})));
  const failed=payloads.find(x=>!x.ok);
  if(failed)throw new Error(failed.body.error||'تعذر تحميل عمليات المبيعات. تحقق من تطبيق هجرة المستوى الثاني في بيئة التطوير.');
  setContacts((payloads[0].body.contacts||[]) as Contact[]);
  setProperties((payloads[1].body.properties||[]) as Property[]);
  setTasks((payloads[2].body.tasks||[]) as Task[]);
  setViewings((payloads[3].body.viewings||[]) as Viewing[]);
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(errorText(e,'تعذر تحميل العمليات.'))).finally(()=>setLoading(false));},[refresh]);
 const activeTasks=useMemo(()=>tasks.filter(x=>x.status==='pending'||x.status==='in_progress'),[tasks]);
 const overdueTasks=useMemo(()=>activeTasks.filter(isOverdue),[activeTasks]);
 const upcomingViewings=useMemo(()=>viewings.filter(x=>(x.status==='scheduled'||x.status==='confirmed')&&Date.parse(x.ends_at)>=Date.now()),[viewings]);
 const visibleTasks=useMemo(()=>tasks.filter(task=>{
  if(filter==='active')return task.status==='pending'||task.status==='in_progress';
  if(filter==='overdue')return isOverdue(task);
  return true;
 }).sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at)),[tasks,filter]);
 async function createTask(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!taskForm.contactId)throw new Error('اختر العميل المرتبط بالمهمة.');
   const response=await fetch('/api/aqarflow/operations/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    contactId:taskForm.contactId,title:taskForm.title,taskType:taskForm.taskType,dueAt:new Date(taskForm.dueAt).toISOString(),
    priority:taskForm.priority,description:taskForm.description||null,
   })});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'تعذر إنشاء المهمة.');
   setTaskForm({...emptyTask});await refresh();setNotice('تم حفظ المهمة وربطها بسجل العميل.');
  }catch(e){setError(errorText(e,'تعذر إنشاء المهمة.'));}finally{setBusy(false);}
 }
 async function createViewing(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!viewingForm.contactId)throw new Error('اختر العميل المرتبط بالمعاينة.');
   const response=await fetch('/api/aqarflow/operations/viewings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    contactId:viewingForm.contactId,propertyId:viewingForm.propertyId||null,title:viewingForm.title,location:viewingForm.location||null,
    startsAt:new Date(viewingForm.startsAt).toISOString(),endsAt:new Date(viewingForm.endsAt).toISOString(),timezone,
    notes:viewingForm.notes||null,
   })});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'تعذر جدولة المعاينة.');
   setViewingForm({...emptyViewing});await refresh();setNotice('تمت جدولة المعاينة. لم تُرسل أي رسالة إلى العميل.');
  }catch(e){setError(errorText(e,'تعذر جدولة المعاينة.'));}finally{setBusy(false);}
 }
 async function updateTask(task:Task,status:TaskStatus){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/aqarflow/operations/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:task.id,status})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'تعذر تحديث المهمة.');
   await refresh();setNotice('تم تحديث حالة المهمة.');
  }catch(e){setError(errorText(e,'تعذر تحديث المهمة.'));}finally{setBusy(false);}
 }
 async function updateViewing(viewing:Viewing,status:ViewingStatus){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/aqarflow/operations/viewings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:viewing.id,status})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'تعذر تحديث المعاينة.');
   await refresh();setNotice('تم تحديث حالة المعاينة.');
  }catch(e){setError(errorText(e,'تعذر تحديث المعاينة.'));}finally{setBusy(false);}
 }
 const field='min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';
 const smallButton='rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
 return <section dir="rtl" className="space-y-6">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
   <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">المهام المفتوحة</p><p className="mt-2 text-3xl font-black text-slate-950">{activeTasks.length}</p></article>
   <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">المهام المتأخرة</p><p className="mt-2 text-3xl font-black text-rose-700">{overdueTasks.length}</p></article>
   <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">المعاينات القادمة</p><p className="mt-2 text-3xl font-black text-slate-950">{upcomingViewings.length}</p></article>
  </div>
  {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}<button className="mr-3 underline" onClick={()=>{setError('');refresh().catch(e=>setError(errorText(e,'تعذر إعادة التحميل.')));}}>إعادة المحاولة</button></div>}
  {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}<button className="mr-3 underline" onClick={()=>setNotice('')}>إغلاق</button></div>}
  {loading?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">جارٍ تحميل عمليات المبيعات…</div>:<>
   <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
     <div className="mb-4"><p className="text-xs font-bold text-blue-700">FOLLOW-UP</p><h2 className="mt-1 text-xl font-black">إنشاء مهمة متابعة</h2><p className="mt-1 text-sm text-slate-500">تُحدّث المهمة موعد المتابعة الرئيسي في سجل العميل تلقائيًا.</p></div>
     <form onSubmit={createTask} className="space-y-3">
      <label className="block space-y-1 text-sm font-bold text-slate-700">العميل<select className={field} required value={taskForm.contactId} onChange={e=>setTaskForm(s=>({...s,contactId:e.target.value}))}><option value="">اختر العميل</option>{contacts.map(c=><option key={c.id} value={c.id}>{contactLabel(c)} · {c.phone_number}</option>)}</select></label>
      <label className="block space-y-1 text-sm font-bold text-slate-700">عنوان المهمة<input className={field} maxLength={180} required value={taskForm.title} onChange={e=>setTaskForm(s=>({...s,title:e.target.value}))} placeholder="مثال: الاتصال لتأكيد الميزانية"/></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
       <label className="block space-y-1 text-sm font-bold text-slate-700">النوع<select className={field} value={taskForm.taskType} onChange={e=>setTaskForm(s=>({...s,taskType:e.target.value}))}>{Object.entries(taskTypeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
       <label className="block space-y-1 text-sm font-bold text-slate-700">الأولوية<select className={field} value={taskForm.priority} onChange={e=>setTaskForm(s=>({...s,priority:e.target.value}))}>{Object.entries(priorityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
       <label className="block space-y-1 text-sm font-bold text-slate-700">موعد الاستحقاق<input className={field} type="datetime-local" required value={taskForm.dueAt} onChange={e=>setTaskForm(s=>({...s,dueAt:e.target.value}))}/></label>
      </div>
      <label className="block space-y-1 text-sm font-bold text-slate-700">ملاحظات<textarea className={field+' min-h-20'} maxLength={2000} value={taskForm.description} onChange={e=>setTaskForm(s=>({...s,description:e.target.value}))} placeholder="تفاصيل تساعد في المتابعة"/></label>
      <button disabled={busy||contacts.length===0} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-50">{busy?'جارٍ الحفظ…':'حفظ مهمة المتابعة'}</button>
     </form>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
     <div className="mb-4"><p className="text-xs font-bold text-blue-700">VIEWINGS</p><h2 className="mt-1 text-xl font-black">جدولة معاينة عقار</h2><p className="mt-1 text-sm text-slate-500">يُحفظ الموعد بالمنطقة الزمنية {timezone}. لا يتم إرسال رسالة تلقائية.</p></div>
     <form onSubmit={createViewing} className="space-y-3">
      <label className="block space-y-1 text-sm font-bold text-slate-700">العميل<select className={field} required value={viewingForm.contactId} onChange={e=>setViewingForm(s=>({...s,contactId:e.target.value}))}><option value="">اختر العميل</option>{contacts.map(c=><option key={c.id} value={c.id}>{contactLabel(c)} · {c.phone_number}</option>)}</select></label>
      <label className="block space-y-1 text-sm font-bold text-slate-700">العقار (اختياري)<select className={field} value={viewingForm.propertyId} onChange={e=>setViewingForm(s=>({...s,propertyId:e.target.value,title:e.target.value?(properties.find(p=>p.id===e.target.value)?.title||s.title):s.title,location:e.target.value?(properties.find(p=>p.id===e.target.value)?.location_label||s.location):s.location}))}><option value="">بدون ربط بعقار محدد</option>{properties.map(p=><option key={p.id} value={p.id}>{p.title}{p.location_label?' · '+p.location_label:''}</option>)}</select></label>
      <label className="block space-y-1 text-sm font-bold text-slate-700">عنوان المعاينة<input className={field} maxLength={180} required value={viewingForm.title} onChange={e=>setViewingForm(s=>({...s,title:e.target.value}))}/></label>
      <label className="block space-y-1 text-sm font-bold text-slate-700">الموقع<input className={field} maxLength={240} value={viewingForm.location} onChange={e=>setViewingForm(s=>({...s,location:e.target.value}))} placeholder="الحي أو رابط الموقع"/></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
       <label className="block space-y-1 text-sm font-bold text-slate-700">البداية<input className={field} type="datetime-local" required value={viewingForm.startsAt} onChange={e=>setViewingForm(s=>({...s,startsAt:e.target.value}))}/></label>
       <label className="block space-y-1 text-sm font-bold text-slate-700">النهاية<input className={field} type="datetime-local" required value={viewingForm.endsAt} onChange={e=>setViewingForm(s=>({...s,endsAt:e.target.value}))}/></label>
      </div>
      <label className="block space-y-1 text-sm font-bold text-slate-700">ملاحظات<textarea className={field+' min-h-16'} maxLength={2000} value={viewingForm.notes} onChange={e=>setViewingForm(s=>({...s,notes:e.target.value}))}/></label>
      <button disabled={busy||contacts.length===0} className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-50">{busy?'جارٍ الحفظ…':'جدولة المعاينة'}</button>
     </form>
    </section>
   </div>
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">قائمة المتابعة</h2><p className="mt-1 text-sm text-slate-500">المواعيد العاجلة والمتأخرة تظهر وفق الموعد المحفوظ.</p></div><div className="flex gap-1 rounded-xl bg-slate-100 p-1">{([['active','المفتوحة'],['overdue','المتأخرة'],['all','الكل']] as const).map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(filter===v?'bg-white text-slate-950 shadow-sm':'text-slate-500')}>{l}</button>)}</div></div>
    {visibleTasks.length===0?<p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لا توجد مهام ضمن هذا الاختيار.</p>:<div className="divide-y divide-slate-100">{visibleTasks.map(task=><article key={task.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{task.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{taskStatusLabels[task.status]}</span>{isOverdue(task)&&<span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">متأخرة</span>}<span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600">{priorityLabels[task.priority]||task.priority}</span></div><p className="mt-1 text-sm text-slate-600">{contactLabel(task.contact)} · {task.contact?.phone_number||'—'}</p><p className="mt-1 text-xs text-slate-500">{taskTypeLabels[task.task_type]||task.task_type} · {localTime(task.due_at)}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{task.description}</p>}</div>
      {task.status!=='cancelled'&&task.status!=='completed'&&<div className="flex flex-wrap gap-2">{task.status==='pending'&&<button disabled={busy} className={smallButton} onClick={()=>updateTask(task,'in_progress')}>بدء</button>}<button disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" onClick={()=>updateTask(task,'completed')}>إكمال</button><button disabled={busy} className={smallButton} onClick={()=>updateTask(task,'cancelled')}>إلغاء</button></div>}
     </article>)}</div>}
   </section>
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-4"><h2 className="text-xl font-black">مواعيد المعاينات</h2><p className="mt-1 text-sm text-slate-500">يُمنع تعارض مواعيد المعاينات النشطة للعقار نفسه في قاعدة البيانات.</p></div>
    {viewings.length===0?<p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لم تُجدول معاينات بعد.</p>:<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{[...viewings].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).map(viewing=><article key={viewing.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-black text-slate-900">{viewing.title}</h3><p className="mt-1 text-sm text-slate-600">{contactLabel(viewing.contact)} · {viewing.contact?.phone_number||'—'}</p>{viewing.property&&<p className="mt-1 text-sm text-blue-700">{viewing.property.title}</p>}{viewing.location&&<p className="mt-1 text-sm text-slate-500">{viewing.location}</p>}</div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{viewingStatusLabels[viewing.status]}</span></div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{localTime(viewing.starts_at)} — {localTime(viewing.ends_at)}</p>{viewing.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{viewing.notes}</p>}
      {viewing.status==='scheduled'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className={smallButton} onClick={()=>updateViewing(viewing,'confirmed')}>تأكيد</button><button disabled={busy} className={smallButton} onClick={()=>updateViewing(viewing,'cancelled')}>إلغاء</button></div>}
      {viewing.status==='confirmed'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" onClick={()=>updateViewing(viewing,'completed')}>اكتملت</button><button disabled={busy} className={smallButton} onClick={()=>updateViewing(viewing,'no_show')}>لم يحضر</button><button disabled={busy} className={smallButton} onClick={()=>updateViewing(viewing,'cancelled')}>إلغاء</button></div>}
     </article>)}</div>}
   </section>
  </>}
 </section>;
}
