'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Property = {
  id:string;title:string;property_type:string|null;purpose:string|null;price:number|null;currency:string|null;
  area:number|null;bedrooms:number|null;bathrooms:number|null;location_label:string|null;
  verified_features:string[];availability:'available'|'unavailable'|'unknown';facts_last_verified_at:string|null;property_photos:string[];office_notes:string|null;is_active:boolean;
};
const initial={title:'',propertyType:'',purpose:'sale',price:'',currency:'USD',area:'',bedrooms:'',bathrooms:'',locationLabel:'',features:'',propertyPhotos:'',officeNotes:'',availability:'unknown',availabilityVerified:false,isActive:true};
export default function PropertyInventory({canManageInitial}:{canManageInitial:boolean}) {
  const [properties,setProperties]=useState<Property[]>([]);
  const [canManage,setCanManage]=useState(canManageInitial);
  const [form,setForm]=useState(initial);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [uploadingPhotos,setUploadingPhotos]=useState(false);
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
      bathrooms:p.bathrooms===null?'':String(p.bathrooms),locationLabel:p.location_label||'',features:(p.verified_features||[]).join(','),propertyPhotos:(p.property_photos||[]).join('\n'),officeNotes:p.office_notes||'',
      availability:p.availability,availabilityVerified:p.availability!=='unknown'&&fresh,isActive:p.is_active});
    setError('');
    if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'smooth'});
  }
  async function uploadPhotos(files:FileList|null){
    if(!files||files.length===0)return;
    setError('');
    const selected=Array.from(files);
    if(selected.length>12){setError('اختر 12 صورة كحد أقصى في كل مرة.');return;}
    if(selected.some(file=>!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))){setError('الصور المدعومة هي JPG وPNG وWebP وAVIF فقط.');return;}
    if(selected.some(file=>file.size>8*1024*1024)){setError('حجم الصورة الواحدة يجب ألا يتجاوز 8 ميغابايت.');return;}
    setUploadingPhotos(true);
    try{
      const supabase=createClient();
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error('انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.');
      const current=form.propertyPhotos.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      if(current.length+selected.length>12)throw new Error('الحد الأقصى 12 صورة للعقار. احذف رابطًا قديمًا أولًا.');
      const urls:string[]=[];
      for(const file of selected){
        const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'} as Record<string,string>)[file.type];
        const path=user.id+'/'+crypto.randomUUID()+'.'+extension;
        const {error:uploadError}=await supabase.storage.from('aqarflow-property-photos').upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw new Error('تعذر رفع صورة. تأكد من تطبيق ترحيل قاعدة البيانات ثم أعد المحاولة.');
        const {data}=supabase.storage.from('aqarflow-property-photos').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      set('propertyPhotos',[...current,...urls].join('\n'));
    }catch(e){setError(e instanceof Error?e.message:'تعذر رفع الصور.');}
    finally{setUploadingPhotos(false);}
  }
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    const payload={...(editingId?{id:editingId}:{}),title:form.title,propertyType:form.propertyType,purpose:form.purpose,price:form.price===''?null:Number(form.price),currency:form.currency,
      area:form.area===''?null:Number(form.area),bedrooms:form.bedrooms===''?null:Number(form.bedrooms),bathrooms:form.bathrooms===''?null:Number(form.bathrooms),
      locationLabel:form.locationLabel,verifiedFeatures:form.features.split(',').map(x=>x.trim()).filter(Boolean),propertyPhotos:form.propertyPhotos.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),officeNotes:form.officeNotes,availability:form.availability,availabilityVerified:form.availabilityVerified,isActive:form.isActive};
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
        <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-300 p-3">
          <label className="block text-sm font-bold">صور العقار
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploadingPhotos} onChange={e=>{void uploadPhotos(e.target.files);e.currentTarget.value='';}} className="mt-2 block w-full rounded-lg border p-2 font-normal"/>
          </label>
          <p className="mt-1 text-xs font-normal text-slate-500">{uploadingPhotos?'جارٍ رفع الصور…':'JPG وPNG وWebP وAVIF، بحد أقصى 8 ميغابايت للصورة و12 صورة للعقار. تُرفع الصور إلى مساحة تخزين المكتب.'}</p>
          <textarea maxLength={30000} rows={3} value={form.propertyPhotos} onChange={e=>set('propertyPhotos',e.target.value)} className="mt-3 w-full rounded-xl border p-3 text-sm font-normal" placeholder="روابط الصور المرفوعة (يمكنك إزالة أي سطر لحذف الصورة من هذا العقار)"/>
          {(form.propertyPhotos.split(/\r?\n/).filter(x=>x.trim()).length>0)&&<div className="mt-2 flex flex-wrap gap-2">{form.propertyPhotos.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((url,i)=><img key={url+i} src={url} alt={'معاينة صورة '+(i+1)} className="h-16 w-24 rounded-lg border object-cover"/>)}</div>}
        </div>
        <label className="text-sm font-bold sm:col-span-2">ملاحظات خاصة بالمكتب — لا تظهر للعميل حرفيًا
          <textarea maxLength={3000} rows={4} value={form.officeNotes} onChange={e=>set('officeNotes',e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="مثال: التأمين 150 دولار، العمولة نصف إيجار شهر، توجد رسوم تنظيف 20 دولار. يمكن طلب تفاوض حتى 5% لكن لا يُوعد العميل قبل موافقة المسؤول. اكتب أي تفاصيل إضافية تريد للمساعد الاستناد إليها."/>
          <span className="mt-1 block text-xs font-normal text-slate-500">أضف هنا الرسوم الإضافية، التأمين، العمولة، شروط الدفع، تفاصيل غير ظاهرة في الإعلان، وما يمكن عرضه للتفاوض. سيستخدمها المساعد عند سؤال العميل عنها، ولن يخترع موافقات أو خصومات.</span>
        </label>
        <label className="text-sm font-bold">التوفر<select value={form.availability} onChange={e=>set('availability',e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"><option value="unknown">غير مؤكد</option><option value="available">متاح</option><option value="unavailable">غير متاح</option></select></label>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-bold"><input type="checkbox" checked={form.availabilityVerified} onChange={e=>set('availabilityVerified',e.target.checked)}/> أؤكد أن حالة التوفر أعلاه تم التحقق منها الآن</label>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive',e.target.checked)}/> عقار نشط في نتائج البحث</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'جارٍ الحفظ…':editingId?'حفظ التعديلات':'حفظ العقار'}</button>{editingId&&<button type="button" disabled={busy} onClick={cancelEdit} className="min-h-11 rounded-xl border px-5 py-3 font-bold text-slate-700">إلغاء التعديل</button>}</div>
    </form>}
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="font-black">العقارات المسجلة ({properties.length})</h2><p className="mt-1 text-sm text-slate-500">تُعرض الأسعار والتوفر من قاعدة البيانات، ولا يخترعها المساعد.</p></div>
      {properties.length===0?<p className="p-8 text-center text-sm text-slate-500">لا توجد عقارات مسجلة حتى الآن.</p>:<div className="divide-y">{properties.map(p=><article key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">{p.title}</h3>{(p.property_photos||[]).length>0&&<div className="mt-2 flex gap-2 overflow-x-auto">{p.property_photos.slice(0,4).map((url,i)=><a key={url+i} href={url} target="_blank" rel="noreferrer" className="shrink-0"><img src={url} alt={p.title+' — صورة '+(i+1)} loading="lazy" className="h-20 w-28 rounded-lg border object-cover"/></a>)}</div>}{p.office_notes&&<p className="mt-1 text-xs text-slate-500">توجد ملاحظات داخلية للمساعد</p>}<p className="mt-1 text-sm text-slate-500">{p.location_label||'الموقع غير محدد'} · {p.purpose==='sale'?'للبيع':p.purpose==='rent'?'للإيجار':'استثمار/غير محدد'}</p><p className="mt-1 text-sm">{p.price===null?'السعر غير مسجل':new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(Number(p.price))+' '+p.currency} · {p.bedrooms??'—'} غرف · {p.area??'—'} م²</p><p className="mt-1 text-xs text-slate-500">التوفر: {p.availability==='available'?'متاح':p.availability==='unavailable'?'غير متاح':'غير مؤكد'} · {p.is_active?'نشط':'غير نشط'}</p></div>{canManage&&<div className="flex gap-2 self-start"><button onClick={()=>beginEdit(p)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">تعديل</button><button onClick={()=>remove(p.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">حذف</button></div>}</article>)}</div>}
    </section>
  </div>;
}
