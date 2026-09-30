import Link from 'next/link';
import { ArrowRight, Check, Mic, FileText, ShieldCheck, Sparkles } from 'lucide-react';

const steps = [
  ['01','Talk','Record a natural field note in seconds.'],
  ['02','Review','Turn the note into editable quote details.'],
  ['03','Send','Download a polished A4 quote and share it.']
];

export default function Home() {
  return <main className="min-h-screen bg-white text-slate-950">
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="text-2xl font-black tracking-tight">Voice<span className="text-blue-600">Quote</span></Link>
      <div className="flex items-center gap-2 sm:gap-5"><Link href="/pricing" className="hidden text-sm font-semibold text-slate-600 sm:block">Pricing</Link><Link href="/login" className="hidden text-sm font-semibold text-slate-600 sm:block">Sign in</Link><Link href="/app" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Start free</Link></div>
    </nav>

    <section className="relative overflow-hidden border-t bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"><Sparkles size={14}/>Built for independent contractors</div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.98] tracking-[-.04em] sm:text-7xl">Talk for 30 seconds.<br/><span className="text-blue-600">Get a quote ready to send.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">Capture the job while you are still on site. VoiceQuote turns your field notes into structured, editable quote details without the admin grind.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-4 font-bold text-white shadow-lg shadow-blue-600/20">Create your first quote <ArrowRight size={18}/></Link><Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-4 font-bold text-slate-800">See pricing</Link></div>
          <div className="mt-7 flex flex-wrap gap-4 text-sm text-slate-500"><span className="flex items-center gap-2"><Check size={16} className="text-emerald-600"/>5 free quotes to start</span><span className="flex items-center gap-2"><Check size={16} className="text-emerald-600"/>No client login</span><span className="flex items-center gap-2"><Check size={16} className="text-emerald-600"/>A4 PDF output</span></div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[3rem] bg-blue-100/60 blur-3xl"/>
          <div className="relative rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-7">
            <div className="flex items-center justify-between border-b pb-5"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">New quote</p><p className="mt-1 font-bold">Kitchen tap replacement</p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><Mic size={22}/></div></div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white"><Mic size={16}/></div><div><p className="text-sm font-bold">Voice note</p><p className="text-xs text-slate-500">00:28 · recording ready</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-4/5 rounded-full bg-blue-600"/></div></div>
            <div className="mt-4 rounded-2xl border p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><FileText size={15}/>Quote preview</div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span>Tap replacement</span><span className="font-semibold">£85.00</span></div><div className="flex justify-between"><span>Labour · 2 hrs</span><span className="font-semibold">£90.00</span></div><div className="flex justify-between border-t pt-3 text-base font-black"><span>Total</span><span>£175.00</span></div></div></div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><ShieldCheck size={17}/>Review everything before it reaches the customer.</div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-widest text-blue-600">How it works</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Less typing. More time on the job.</h2></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">{steps.map(([n,t,d])=><div key={n} className="rounded-[1.7rem] border border-slate-200 p-7"><div className="text-sm font-black text-blue-600">{n}</div><h3 className="mt-7 text-2xl font-black">{t}</h3><p className="mt-2 leading-7 text-slate-500">{d}</p></div>)}</div>
    </section>

    <section className="bg-slate-950 text-white"><div className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><div className="grid gap-10 lg:grid-cols-2 lg:items-center"><div><p className="text-sm font-bold uppercase tracking-widest text-blue-300">Why VoiceQuote</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Focused on one job: getting your quote out fast.</h2></div><div className="grid gap-3">{['Voice-first workflow built for job sites','Editable client and line-item details','Professional A4 PDF output','Secure customer-facing quote links','Simple plans without enterprise complexity'].map(item=><div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><Check size={18} className="text-blue-300"/><span className="font-semibold">{item}</span></div>)}</div></div></div></section>

    <section className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8"><p className="text-sm font-bold uppercase tracking-widest text-blue-600">Ready when you are</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Make your next quote before you leave the job.</h2><p className="mx-auto mt-4 max-w-2xl text-slate-500">Start with five free quotes. No complicated setup.</p><Link href="/app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-4 font-bold text-white">Start free <ArrowRight size={18}/></Link></section>

    <footer className="border-t py-8"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© 2026 VoiceQuote</span><div className="flex gap-5"><Link href="/pricing">Pricing</Link><Link href="/login">Sign in</Link></div></div></footer>
  </main>;
}
