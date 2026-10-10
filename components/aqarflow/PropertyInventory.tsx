'use client';
import { useCallback, useEffect, useState } from 'react';

type Property = {
  id:string;title:string;property_type:string|null;purpose:string|null;price:number|null;currency:string|null;
  area:number|null;bedrooms:number|null;bathrooms:number|null;location_label:string|null;
  verified_features:string[];availability:'available'|'unavailable'|'unknown';facts_last_verified_at:string|null;is_active:boolean;
};
const initial={title:'',propertyType:'',purpose:'sale',price:'',currency:'USD',area:'',bedrooms:'',bathrooms:'',locationLabel:'',features:'',availability:'unknown',availabilityVerified:false,isActive:true};
export default function PropertyInventory({canManageInitial}:{canManageInitial:boolean}) {
  const [properties,setProperties]=useState<Property[]>([]);
  const [canManage,setCanManage]=useState(canManageInitial);
  const [form,setForm]=useState(initial);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const r=await fetch('/api/aqarflow/properties',{cache:'no-store'});const b=await r.json();
    if(!r.ok)throw new Error(b.error||'تعذر تحميل المخزون.');
    setProperties(b.properties||[]);setCanManage(Boolean(b.canManage));
  },[]);
  useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل المخزون.'));},[refresh]);
  function set<K extends keyof typeof initial>(key:K,value:(typeof initial)[K]){setForm(old=>({...old,[key]:value}));}
  function cancelEdit(){setEditingId(null);setForm(initial);setError('');}
  function beginEdit(p:Property){
    const verifiedAt=p.facts_last_verified_at?Date.parse(p.facts_last_verified_at):NaN;
    const fresh=Number.isFinite(verifiedAt)&&Date.now()-verifiedAt>=-5*60*1000&&Date.now()-verifiedAt<=7*24*60*60*1000;
    setEditingId(p.id);
    setForm({title:p.title,propertyType:p.property_type||'',purpose:p.purpose||'unknown',price:p.price===null?'':String(p.price),
      currency:p.currency||'USD',area:p.area===null?'':String(p.area),bedrooms:p.bedrooms===null?'':String(p.bedrooms),
      bathrooms:p.bathrooms===null?'':String(p.bathrooms),locationLabel:p.location_label||'',features:(p.verified_features||[]).join(','),
      availability:p.availability,availabilityVerified:p.availability!=='unknown'&&fresh,isActive:p.is_active});
    setError('');
    if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'smooth'});
  }
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    const payload={...(editingId?{id:editingId}:{}),title:form.title,propertyType:form.propertyType,purpose:form.purpose,price:form.price===''?null:Number(form.price),currency:form.currency,
      area:form.area===''?null:Number(form.area),bedrooms:form.bedrooms===''?null:Number(form.bedrooms),bathrooms:form.bathrooms===''?null:Number(form.bathrooms),
      locationLabel:form.locationLabel,verifiedFeatures:form.features.split(',').map(x=>x.trim()).filter(Boolean),availability:form.availability,availabilityVerified:form.availabilityVerified,isActive:form.isActive};
    try{const r=await fetch('/api/aqarflow/properties',{method:editingId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر الحفظ.');cancelEdit();await refresh();}
    catch(e){setError(e instanceof Error?e.message:'تعذر حفظ العقار.');}finally{setBusy(false);}
  }
  async function remove(id:string){if(!confirm('هل تريد حذف هذا العقار من المخزون؟'))return;setError('');try{const r=await fetch('/api/aqarflow/properties',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر الحذف.');await refresh();}catch(e){setError(e instanceof Error?e.message:'تعذر الحذف.');}}
  return <div dir="rtl" className="space-y-6">
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {canManage&&<form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">{editingId?'تعديل بيانات العقار':'إضافة عقار إلى المخزون'}</h2>
      <p className="mt-1 text-sm text-slate-500">لا تُستخدم العقارات النشطة وحدها إلا بعد تسجيل حقائقها والتحقق منها.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">اسم العقار<input required maxLength={180} value={form.title} onChange={e=>set('title',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">نوع العقار<input maxLength={80} value={form.propertyType} onChange={e=>set('propertyType',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="شقة، فيلا، أرض…"/></label>
        <label className="text-sm font-bold">الغرض<select value={form.purpose} onChange={e=>set('purpose',e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"><option value="sale">للبيع</option><option value="rent">للإيجار</option><option value="invest">استثمار</option><option value="unknown">غير محدد</option></select></label>
        <label className="text-sm font-bold">السعر<input type="number" min="0" value={form.price} onChange={e=>set('price',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">العملة<input required maxLength={8} value={form.currency} onChange={e=>set('currency',e.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">المساحة<input type="number" min="0" value={form.area} onChange={e=>set('area',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">غرف النوم<input type="number" min="0" max="100" value={form.bedrooms} onChange={e=>set('bedrooms',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">الحمامات<input type="number" min="0" max="100" value={form.bathrooms} onChange={e=>set('bathrooms',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
        <label className="text-sm font-bold">الموقع<input maxLength={180} value={form.locationLabel} onChange={e=>set('locationLabel',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="المدينة أو الحي"/></label>
        <label className="text-sm font-bold sm:col-span-2">المزايا المؤكدة، مفصولة بفواصل<input maxLength={1000} value={form.features} onChange={e=>set('features',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="موقف سيارة، شرفة، مصعد…"/></label>
        <label className="text-sm font-bold">التوفر<select value={form.availability} onChange={e=>set('availability',e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"><option value="unknown">غير مؤكد</option><option value="available">متاح</option><option value="unavailable">غير متاح</option></select></label>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-bold"><input type="checkbox" checked={form.availabilityVerified} onChange={e=>set('availabilityVerified',e.target.checked)}/> أؤكد أن حالة التوفر أعلاه تم التحقق منها الآن</label>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive',e.target.checked)}/> عقار نشط في نتائج البحث</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'جارٍ الحفظ…':editingId?'حفظ التعديلات':'حفظ العقار'}</button>{editingId&&<button type="button" disabled={busy} onClick={cancelEdit} className="min-h-11 rounded-xl border px-5 py-3 font-bold text-slate-700">إلغاء التعديل</button>}</div>
    </form>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="font-black">العقارات المسجلة ({properties.length})</h2><p className="mt-1 text-sm text-slate-500">تُعرض الأسعار والتوفر من قاعدة البيانات، ولا يخترعها المساعد.</p></div>
      {properties.length===0?<p className="p-8 text-center text-sm text-slate-500">لا توجد عقارات مسجلة حتى الآن.</p>:<div className="divide-y">{properties.map(p=><article key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">{p.title}</h3><p className="mt-1 text-sm text-slate-500">{p.location_label||'الموقع غير محدد'} · {p.purpose==='sale'?'للبيع':p.purpose==='rent'?'للإيجار':'استثمار/غير محدد'}</p><p className="mt-1 text-sm">{p.price===null?'السعر غير مسجل':new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(Number(p.price))+' '+p.currency} · {p.bedrooms??'—'} غرف · {p.area??'—'} م²</p><p className="mt-1 text-xs text-slate-500">التوفر: {p.availability==='available'?'متاح':p.availability==='unavailable'?'غير متاح':'غير مؤكد'} · {p.is_active?'نشط':'غير نشط'}</p></div>{canManage&&<div className="flex gap-2 self-start"><button onClick={()=>beginEdit(p)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">تعديل</button><button onClick={()=>remove(p.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">حذف</button></div>}</article>)}</div>}
    </section>
  </div>;
}
