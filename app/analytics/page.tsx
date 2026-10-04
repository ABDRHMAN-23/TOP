'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, CheckCircle2, FileText, Loader2, Send, TrendingUp } from 'lucide-react';
import QuvotoLogo from '@/components/QuvotoLogo';

type Quote = { id:string; quote_number:string; client_name:string|null; total:number|string|null; currency:string; status:string; created_at:string };
type Analytics = { periodDays:number; metrics:{totalQuotes:number;sent:number;accepted:number;revenue:number}; quotes:Quote[] };

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics|null>(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    fetch('/api/analytics').then(async r => {
      const body = await r.json();
      if (!r.ok) {
        setAuthError(r.status === 401);
        throw new Error(body.error || 'Could not load analytics.');
      }
      setData(body);
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load analytics.'));
  }, []);

  return <main className="min-h-screen bg-slate-50 text-[#0A1E3D]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <a href="/app"><QuvotoLogo className="h-10 w-auto"/></a>
        <a href="/app" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"><ArrowLeft size={16}/> Back to quote</a>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-8"><div className="inline-flex items-center gap-2 rounded-full bg-[#1769E0]/10 px-3 py-1.5 text-xs font-bold text-[#1769E0]"><BarChart3 size={14}/> ANALYTICS</div><h1 className="mt-3 text-4xl font-black tracking-tight">Quote performance</h1><p className="mt-2 text-slate-500">Your last 30 days, based on quotes in your QUVOTO workspace.</p></div>
      {error ? <div className="rounded-2xl bg-red-50 p-5 font-semibold text-red-700">{error}{authError && <div className="mt-3"><a href="/login" className="font-bold underline">Sign in</a></div>}</div> : !data ? <div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-slate-500"><Loader2 className="animate-spin"/>Loading analytics…</div> :
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Quotes',data.metrics.totalQuotes,FileText],['Sent',data.metrics.sent,Send],['Accepted',data.metrics.accepted,CheckCircle2],['Accepted value',data.metrics.revenue.toFixed(2),TrendingUp]].map(([label,value,Icon]:any)=><div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Icon size={20} className="text-[#1769E0]"/><p className="mt-5 text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="font-black">Recent quotes</h2></div>
          {data.quotes.length === 0 ? <div className="p-10 text-center text-slate-500">No quotes in the last 30 days yet.</div> : <div className="divide-y">{data.quotes.map(q=><div key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-bold">{q.quote_number}</p><p className="text-sm text-slate-500">{q.client_name || 'No client name'} · {new Date(q.created_at).toLocaleDateString()}</p></div><div className="text-right"><p className="font-black">{q.currency} {Number(q.total || 0).toFixed(2)}</p><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{q.status}</span></div></div>)}</div>}
        </div>
      </>}
    </section>
  </main>;
}
