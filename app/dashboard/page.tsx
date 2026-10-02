import { redirect } from 'next/navigation';
import { FileText, Plus, ExternalLink, Settings } from 'lucide-react';
import QuoteActions from './QuoteActions';

function Brand(){return <div className="flex items-center gap-2.5"><img src="/logo.svg" alt="QUVOTO" className="h-9 w-9"/><span className="text-xl font-black tracking-[-0.04em] text-[#0A1E3D]">QUVOTO</span></div>;}
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, client_name, client_email, total, currency, status, created_at, public_token')
    .order('created_at', { ascending: false })
    .limit(50);

  return <main className="min-h-screen bg-[#f7faff]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8 sm:py-4"><a href="/" aria-label="QUVOTO home"><Brand/></a><div className="flex items-center gap-2"><a href="/advisor" className="hidden min-h-11 items-center rounded-xl bg-[#1769E0]/10 px-3.5 text-sm font-bold text-[#1769E0] sm:inline-flex">Advisor</a><a href="/settings" className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-600"><Settings size={16}/><span className="hidden sm:inline">Settings</span></a></div><a href="/app" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#1769E0] px-3.5 text-sm font-bold text-white"><Plus size={16}/><span>New quote</span></a></div></header>
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
      <div><p className="text-sm font-extrabold tracking-[0.16em] text-[#1769E0]">WORKSPACE</p><h1 className="mt-1 text-[2rem] font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Your quotes</h1><p className="mt-2 text-slate-500">{quotes?.length || 0} recent quotes in your QUVOTO workspace.</p></div>
      <div className="mt-6 overflow-hidden rounded-[1.5rem] sm:mt-8 sm:rounded-[1.7rem] border bg-white shadow-sm">
        {!quotes?.length ? <div className="p-12 text-center"><FileText className="mx-auto mb-3 text-slate-300" size={38}/><h2 className="text-xl font-bold">No quotes yet</h2><p className="mt-2 text-slate-500">Create your first voice quote.</p><a href="/app" className="mt-5 inline-flex rounded-xl bg-[#1769E0] px-5 py-3 font-bold text-white">Create quote</a></div> :
        <div className="divide-y">{quotes.map((quote) => <div key={quote.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5 sm:items-center sm:justify-between"><div><div className="font-bold">{quote.quote_number}</div><div className="text-sm text-slate-500">{quote.client_name || 'No client name'} · {new Date(quote.created_at).toLocaleDateString()}</div></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><div className="font-black">{quote.currency} {Number(quote.total).toFixed(2)}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{quote.status}</span><a target="_blank" rel="noreferrer" href={"/q/"+quote.public_token} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ExternalLink size={17}/></a><QuoteActions quoteId={quote.id} clientEmail={quote.client_email}/></div></div>)}</div>}
      </div>
    </section>
  </main>;
}
