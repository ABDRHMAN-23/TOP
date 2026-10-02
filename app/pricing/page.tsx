'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Lock, Mic, FileText } from 'lucide-react';

function Brand(){return <div className="flex items-center gap-2.5"><img src="/logo.svg" alt="QUVOTO" className="h-10 w-10"/><div><div className="text-2xl font-black tracking-[-0.05em] text-[#0A1E3D]">QUVOTO</div><div className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#1769E0]">Speak. Quote. Done.</div></div></div>;}

const plans = [
 { name:'Free', price:'$0', detail:'10 quotes/month', features:['2 PDF templates: Modern + Classic','GBP only','English only','Public quote link','Basic workspace'] },
 { name:'Starter', price:'$9', detail:'25 quotes/month', features:['All 5 PDF templates','GBP, USD, EUR','Custom logo + remove QUVOTO branding','Quote tracking + full stats','CSV export'] },
 { name:'Pro', price:'$19', detail:'100 quotes/month', features:['Everything in Starter','10 currencies','English + Arabic/Spanish/French','Custom colors, fonts & layout controls','Advanced workspace features'] },
 { name:'Team', price:'$39', detail:'Unlimited quotes · 3 users', features:['Everything in Pro','3 users','All supported languages','Priority support','Team-ready workspace'] }
];

export default function Pricing() {
 const [loading,setLoading]=useState(''); const [error,setError]=useState(''); const [interval,setInterval]=useState<'month'|'year'>('month');
 const checkout=async(plan:string)=>{setLoading(plan);setError('');try{const r=await fetch('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,interval})});const d=await r.json();if(r.status===401){window.location.href='/login?next=/pricing';return}if(!r.ok)throw new Error(d.error||'Checkout unavailable.');window.location.href=d.url}catch(e){setError(e instanceof Error?e.message:'Checkout unavailable.')}finally{setLoading('')}}
 return <main className="min-h-screen bg-slate-50 text-slate-950">
  <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><Link href="/" aria-label="QUVOTO home"><Brand/></Link><Link href="/app" className="rounded-full bg-[#0A1E3D] px-5 py-2.5 text-sm font-bold text-white">Start free</Link></div></header>
  <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
   <div className="mx-auto max-w-3xl text-center"><div className="inline-flex items-center gap-2 rounded-full bg-[#1769E0]/5 px-3 py-1.5 text-xs font-bold text-[#1769E0]">Simple by design</div><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Professional quoting without the field-service software price.</h1><p className="mt-4 text-lg leading-8 text-slate-500">QUVOTO is focused on one job: helping contractors turn voice notes into professional quotes. You pay for the quoting workflow you actually use—not a full field-service suite.</p>
    <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#1769E0]/15 bg-[#1769E0]/5 p-4 text-sm font-semibold text-[#0A1E3D]">Rewards: Free users can earn Starter time by bringing active Free users. Monthly plans earn 1 free month at 1 same-plan paid referral, then every 3 additional referrals. Annual plans earn 1 free year at 2 same-plan paid referrals, then 6 months/1 year milestones.</div>
    <div className="mt-7 inline-flex rounded-full border bg-white p-1 shadow-sm"><button onClick={()=>setInterval('month')} className={'rounded-full px-5 py-2 text-sm font-bold '+(interval==='month'?'bg-[#0A1E3D] text-white':'text-slate-500')}>Monthly</button><button onClick={()=>setInterval('year')} className={'rounded-full px-5 py-2 text-sm font-bold '+(interval==='year'?'bg-[#1769E0] text-white':'text-slate-500')}>Annual</button></div>
   </div>
   <div className="mt-12 grid gap-5 lg:grid-cols-4">
    {plans.map((plan,i)=><div key={plan.name} className={'rounded-[2rem] border bg-white p-6 shadow-sm '+(i===1?'border-blue-300 ring-4 ring-[#2F8CFF]/10':'border-slate-200')}>
     <p className="text-sm font-bold text-slate-400">{plan.name}</p><div className="mt-4 flex items-end gap-1"><span className="text-5xl font-black">{plan.name==='Free'||interval==='month'?plan.price:'Annual'}</span>{plan.name!=='Free'&&interval==='month'?<span className="pb-1 text-sm text-slate-400">/mo</span>:null}</div>
     <p className="mt-2 font-semibold text-slate-700">{interval==='year'&&plan.name!=='Free'?'Billed annually · '+plan.detail.replace('/month','/month'):plan.detail}</p>
     <button onClick={()=>plan.name==='Free'?window.location.href='/app':checkout(plan.name.toLowerCase())} disabled={!!loading} className="mt-6 block w-full rounded-xl bg-[#0A1E3D] py-3 text-center font-bold text-white disabled:opacity-60">{loading===plan.name.toLowerCase()?'Opening checkout…':plan.name==='Free'?'Start free':'Choose '+plan.name}</button>
     <div className="mt-7 space-y-3">{plan.features.map(f=><div key={f} className="flex gap-2 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600"/>{f}</div>)}</div>
     <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">{plan.name==='Free'?'Upgrade later when you hit the limit.':'Your selected plan controls its own features and limits. Annual referral rewards never upgrade you into another plan.'}</div>
    </div>)}
   </div>
   {error&&<div className="mx-auto mt-6 max-w-xl rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">{error}</div>}
   <div className="mt-10 grid gap-4 md:grid-cols-3"><div className="rounded-3xl border bg-white p-6"><Mic className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Same core flow</h2><p className="mt-2 text-sm leading-6 text-slate-500">Record → transcribe → extract details → review → save.</p></div><div className="rounded-3xl border bg-white p-6"><FileText className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Five real PDF styles</h2><p className="mt-2 text-sm leading-6 text-slate-500">Modern, Classic, Bold, Minimal and Technical are separate visual layouts.</p></div><div className="rounded-3xl border bg-white p-6"><Lock className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Plan-aware access</h2><p className="mt-2 text-sm leading-6 text-slate-500">Each paid plan keeps its own feature limits and billing interval.</p></div></div>
  </section>
 </main>;
}