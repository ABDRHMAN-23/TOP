'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, Globe2, Loader2, MessageSquare, TrendingUp } from 'lucide-react';

type Result = { answer:string; warnings:string[]; actions:string[]; facts:string[]; confidence:string; market:string; currency:string; fx_source?:string; fx_date?:string|null };

export default function AdvisorPage() {
  const [question,setQuestion]=useState('');
  const [market,setMarket]=useState('United Kingdom');
  const [currency,setCurrency]=useState('GBP');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<Result|null>(null);

  const ask=async()=>{
    if(!question.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r=await fetch('/api/advisor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,market,currency})});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'Advisor request failed.');
      setResult(data);
    } catch(e){setError(e instanceof Error?e.message:'Advisor request failed.');}
    finally{setLoading(false);}
  };

  return <main className="min-h-screen bg-white text-[#0A1E3D]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <a href="/app" className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/>Back to quote</a>
        <div className="flex items-center gap-2"><img src="/logo.svg" alt="QUVOTO" className="h-9 w-9"/><span className="text-lg font-black tracking-[-0.04em]">QUVOTO</span></div>
      </div>
    </header>
    <section className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
      <div className="max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#2F8CFF]/10 px-3 py-1.5 text-xs font-bold text-[#1769E0]"><MessageSquare size={14}/>QUVOTO ADVISOR</div>
        <h1 className="text-[2.15rem] font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl">Your quoting advisor, grounded in your business data.</h1>
        <p className="mt-4 text-[15px] leading-6 text-slate-500 sm:text-base">Ask about pricing, quote quality, margins, materials, currencies, or a job you are preparing. QUVOTO separates sourced facts from estimates.</p>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:rounded-[2rem] sm:p-7">
          <div className="grid gap-4">
            <label className="text-sm font-bold">Market<select value={market} onChange={e=>setMarket(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option>United Kingdom</option><option>United States</option><option>Ireland</option><option>Australia</option><option>Canada</option></select></label>
            <label className="text-sm font-bold">Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{['GBP','USD','EUR','AUD','CAD'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-sm font-bold">Ask the Advisor<textarea value={question} onChange={e=>setQuestion(e.target.value)} className="mt-2 min-h-44 w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-[#1769E0] focus:ring-4 focus:ring-blue-50" placeholder="Example: Review this bathroom quote. My materials are £2,100 and labour is £1,500. What should I check before sending it?"/></label>
            <button onClick={ask} disabled={loading||!question.trim()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 font-bold text-white disabled:opacity-50">{loading?<><Loader2 size={17} className="animate-spin"/>Reviewing…</>:<><TrendingUp size={17}/>Ask Advisor</>}</button>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Product prices are never presented as live market facts unless a verified source is actually connected. Exchange-rate data is labeled with its source and date.</p>
        </section>
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-7">
          {!result&&!error?<div className="flex min-h-[420px] items-center justify-center text-center"><div><Globe2 className="mx-auto text-[#1769E0]" size={34}/><h2 className="mt-4 text-xl font-bold">Ask something practical</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">QUVOTO will use your recent quotes, business profile and available market data as context.</p></div></div>:null}
          {error?<div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>:null}
          {result?<div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">{result.market}</p><h2 className="mt-1 text-2xl font-black">Advisor result</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Confidence: {result.confidence}</span></div>
            <div className="rounded-2xl bg-[#0A1E3D] p-5 text-white"><p className="whitespace-pre-wrap text-[15px] leading-7">{result.answer}</p></div>
            {result.facts.length?<div><h3 className="font-bold">Verified context</h3><ul className="mt-2 space-y-2">{result.facts.map((x,i)=><li key={i} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#1769E0]"/>{x}</li>)}</ul></div>:null}
            {result.warnings.length?<div><h3 className="font-bold">Review before sending</h3><ul className="mt-2 space-y-2">{result.warnings.map((x,i)=><li key={i} className="flex gap-2 text-sm text-slate-600"><CircleAlert size={17} className="mt-0.5 shrink-0 text-amber-500"/>{x}</li>)}</ul></div>:null}
            {result.actions.length?<div><h3 className="font-bold">Suggested actions</h3><ul className="mt-2 space-y-2">{result.actions.map((x,i)=><li key={i} className="text-sm text-slate-600">• {x}</li>)}</ul></div>:null}
            {result.fx_date?<div className="border-t border-slate-100 pt-4 text-xs text-slate-400">Currency reference: {result.fx_source} · {result.fx_date}</div>:null}
          </div>:null}
        </section>
      </div>
    </section>
  </main>;
}
