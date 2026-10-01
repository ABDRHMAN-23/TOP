import Link from 'next/link';
import { Check, Lock, Mic, FileText } from 'lucide-react';

function Brand(){return <div className="flex items-center gap-2.5"><img src="/logo.svg" alt="QUVOTO" className="h-10 w-10"/><div><div className="text-2xl font-black tracking-[-0.05em] text-[#0A1E3D]">QUVOTO</div><div className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#1769E0]">Speak. Quote. Done.</div></div></div>;}

const plans = [
  { name:'Free', price:'$0', detail:'5 quotes/month', accent:'slate', features:['2 PDF templates: Modern + Classic','GBP only','English only','Public quote link','Basic workspace'] },
  { name:'Starter', price:'$19', detail:'30 quotes/month', accent:'blue', features:['All 5 PDF templates','GBP, USD, EUR','Custom logo + remove QUVOTO branding','Quote tracking + full stats','CSV export'] },
  { name:'Pro', price:'$39', detail:'100 quotes/month', accent:'indigo', features:['Everything in Starter','10 currencies','English + Arabic/Spanish/French','Custom colors, fonts & layout controls','Advanced workspace features'] },
  { name:'Team', price:'$79', detail:'Unlimited quotes · 3 users', accent:'dark', features:['Everything in Pro','3 users','All supported languages','Priority support','Team-ready workspace'] }
];

export default function Pricing() {
  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="QUVOTO home"><Brand/></Link>
        <Link href="/app" className="rounded-full bg-[#0A1E3D] px-5 py-2.5 text-sm font-bold text-white">Start free</Link>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#2F8CFF]/10 px-3 py-1.5 text-xs font-bold text-[#1769E0]"><Sparkles size={14}/>Simple by design</div>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Choose the amount of workflow you need.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-500">Every paid plan keeps the same fast voice-first flow. Higher plans unlock more output formats, currencies, branding and workspace capacity.</p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-4">
        {plans.map((plan, i) => <div key={plan.name} className={'rounded-[2rem] border bg-white p-6 shadow-sm ' + (i===1 ? 'border-blue-300 ring-4 ring-[#2F8CFF]/10' : 'border-slate-200')}>
          <p className="text-sm font-bold text-slate-400">{plan.name}</p>
          <div className="mt-4 flex items-end gap-1"><span className="text-5xl font-black">{plan.price}</span>{plan.name!=='Free' ? <span className="pb-1 text-sm text-slate-400">/mo</span> : null}</div>
          <p className="mt-2 font-semibold text-slate-700">{plan.detail}</p>
          <Link href="/app" className="mt-6 block rounded-xl bg-[#0A1E3D] py-3 text-center font-bold text-white">{plan.name==='Free' ? 'Start free' : 'Use this plan'}</Link>
          <div className="mt-7 space-y-3">{plan.features.map(f => <div key={f} className="flex gap-2 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600"/>{f}</div>)}</div>
          <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">{plan.name==='Free' ? 'Upgrade later when you hit the limit.' : 'Feature access is enforced server-side when a quote is created.'}</div>
        </div>)}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-6"><Mic className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Same core flow</h2><p className="mt-2 text-sm leading-6 text-slate-500">Record → transcribe → Gemma 4 31B extracts details → review → save.</p></div>
        <div className="rounded-3xl border bg-white p-6"><FileText className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Five real PDF styles</h2><p className="mt-2 text-sm leading-6 text-slate-500">Modern, Classic, Bold, Minimal and Technical are separate visual layouts.</p></div>
        <div className="rounded-3xl border bg-white p-6"><Lock className="text-[#1769E0]"/><h2 className="mt-4 text-xl font-black">Plan-aware access</h2><p className="mt-2 text-sm leading-6 text-slate-500">The interface shows locks, and the database route enforces the same rules.</p></div>
      </div>
    </section>
  </main>;
}