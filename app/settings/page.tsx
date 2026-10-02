'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Save } from 'lucide-react';

type Settings = {
  business_name:string; logo_url:string; primary_color:string; phone:string; email:string; website:string; address:string;
  vat_number:string; default_currency:string; default_language:string; payment_terms:string; warranty_terms:string;
};

const empty:Settings={business_name:'',logo_url:'',primary_color:'#1769E0',phone:'',email:'',website:'',address:'',vat_number:'',default_currency:'GBP',default_language:'en',payment_terms:'',warranty_terms:''};

export default function SettingsPage(){
  const [s,setS]=useState<Settings>(empty); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/settings/business').then(r=>r.json()).then(d=>{if(d.error) setError(d.error); else setS({...empty,...d})}).catch(()=>setError('Could not load settings.')).finally(()=>setLoading(false))},[]);
  const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError('');setMessage('');try{const r=await fetch('/api/settings/business',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save settings.');setS({...empty,...d});setMessage('Settings saved.')}catch(e){setError(e instanceof Error?e.message:'Could not save settings.')}finally{setSaving(false)}};
  const set=(k:keyof Settings,v:string)=>setS(x=>({...x,[k]:v}));
  if(loading) return <main className="min-h-screen bg-white"><div className="mx-auto max-w-4xl px-5 py-20 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" size={22}/></div></main>;
  return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4"><Link href="/dashboard" aria-label="QUVOTO home" className="inline-flex items-center"><img src="/logo.svg" alt="QUVOTO" className="h-9 w-auto"/></Link><Link href="/dashboard" className="min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Back to dashboard</Link></div></header>
    <section className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
      <div><p className="text-sm font-extrabold tracking-[0.16em] text-[#1769E0]">SETTINGS</p><h1 className="mt-2 text-[2rem] font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Business identity</h1><p className="mt-2 text-slate-500">Control the information that appears in your quotation workflow.</p></div>
      <form onSubmit={save} className="mt-8 space-y-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.7rem] sm:p-6">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1769E0] text-white"><img src="/icon.svg" alt="" className="h-10 w-10"/></div><div><h2 className="font-extrabold">Brand</h2><p className="text-sm text-slate-500">Your business name, logo and accent color.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Business name<input value={s.business_name} onChange={e=>set('business_name',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]" /></label>
            <label className="text-sm font-bold">Logo URL<input value={s.logo_url} onChange={e=>set('logo_url',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]" placeholder="https://..." /></label>
            <label className="text-sm font-bold">Primary color<input value={s.primary_color} onChange={e=>set('primary_color',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 font-mono outline-none focus:border-[#1769E0]" /></label>
          </div>
        </section>
        <section className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-extrabold">Contact details</h2><p className="mt-1 text-sm text-slate-500">Used on customer-facing quotations when provided.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {([['phone','Phone'],['email','Email'],['website','Website'],['vat_number','VAT / Tax number']] as const).map(([k,l])=><label key={k} className="text-sm font-bold">{l}<input value={s[k]} onChange={e=>set(k,e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]" /></label>)}
            <label className="text-sm font-bold sm:col-span-2">Address<textarea value={s.address} onChange={e=>set('address',e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]"/></label>
          </div>
        </section>
        <section className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-extrabold">Quotation defaults</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Currency<select value={s.default_currency} onChange={e=>set('default_currency',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3.5"><option>GBP</option><option>USD</option><option>EUR</option><option>SAR</option><option>AED</option><option>CAD</option><option>AUD</option></select></label>
            <label className="text-sm font-bold">Language<select value={s.default_language} onChange={e=>set('default_language',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3.5"><option value="en">English</option><option value="ar">Arabic</option><option value="es">Spanish</option><option value="fr">French</option></select></label>
            <label className="text-sm font-bold sm:col-span-2">Payment terms<textarea value={s.payment_terms} onChange={e=>set('payment_terms',e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]" placeholder="50% deposit, balance on completion"/></label>
            <label className="text-sm font-bold sm:col-span-2">Warranty terms<textarea value={s.warranty_terms} onChange={e=>set('warranty_terms',e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3.5 outline-none focus:border-[#1769E0]" placeholder="12-month workmanship warranty"/></label>
          </div>
        </section>
        {error&&<div className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
        {message&&<div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><Check size={17}/>{message}</div>}
        <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1769E0] py-4 font-bold text-white disabled:opacity-60">{saving?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>}Save settings</button>
      </form>
    </section>
  </main>;
}
