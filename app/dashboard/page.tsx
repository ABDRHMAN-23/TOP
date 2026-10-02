import { redirect } from 'next/navigation';
import { FileText, Plus, ExternalLink, Settings } from 'lucide-react';
import QuoteActions from './QuoteActions';
import NotificationCenter from '@/components/NotificationCenter';
import DailyBrief from '@/components/DailyBrief';

function Brand(){return <div className="flex items-center gap-2.5"><img src="/logo.svg" alt="QUVOTO" className="h-9 w-9"/><span className="text-xl font-black tracking-[-0.04em] text-[#0A1E3D]">QUVOTO</span></div>;}
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: subscription } = await supabase.from('subscriptions').select('plan,status,billing_interval').eq('user_id', user.id).maybeSingle();
  const { data: referralRows } = await supabase.from('referrals').select('status,qualifying_plan,qualifying_interval,free_qualified_at').eq('referrer_user_id', user.id);
  const freeCount = (referralRows || []).filter((r:any)=>!!r.free_qualified_at).length;
  const paidRows = (referralRows || []).filter((r:any)=>['qualified','rewarded'].includes(r.status) && r.qualifying_plan===subscription?.plan && r.qualifying_interval===subscription?.billing_interval);
  const paidCount = paidRows.length;
  const rewardTrack = subscription?.billing_interval === 'year' ? 'annual' : subscription?.billing_interval === 'month' && subscription?.plan !== 'free' ? 'monthly' : 'free';
  const rewardNext = rewardTrack === 'annual' ? (paidCount < 2 ? 2 : paidCount < 4 ? 4 : paidCount < 8 ? 8 : paidCount < 10 ? 10 : paidCount < 14 ? 14 : 16) : rewardTrack === 'monthly' ? (paidCount < 1 ? 1 : paidCount < 4 ? 4 : paidCount < 7 ? 7 : paidCount < 10 ? 10 : paidCount + (3 - ((paidCount - 1) % 3))) : Math.max(10, Math.ceil((freeCount + 1) / 10) * 10);
  const rewardCount = rewardTrack === 'free' ? freeCount : paidCount;
  const rewardLabel = rewardTrack === 'annual' ? 'Annual reward' : rewardTrack === 'monthly' ? 'Monthly reward' : 'Free-user reward';
  const isTeam = subscription?.plan === 'team' && ['active','trialing'].includes(subscription.status || '');

    const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, client_name, client_email, total, currency, status, created_at, public_token')
    .order('created_at', { ascending: false })
    .limit(50);
  const { data: followups } = await supabase
    .from('followups')
    .select('id, status, scheduled_for, note, quotes(quote_number, client_name)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(20);
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, created_at, title, quote_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  return <main className="min-h-screen bg-[#f7faff]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <a href="/" aria-label="QUVOTO home"><Brand/></a>
        <div className="flex items-center gap-2"><NotificationCenter/>
          <a href="/advisor" className="hidden min-h-11 items-center rounded-xl bg-[#1769E0]/10 px-3.5 text-sm font-bold text-[#1769E0] sm:inline-flex">Advisor</a>
          <a href="/settings" className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-600"><Settings size={16}/><span className="hidden sm:inline">Settings</span></a>
          {isTeam && <a href="/team" className="hidden min-h-11 items-center rounded-xl bg-[#1769E0]/10 px-3.5 text-sm font-bold text-[#1769E0] sm:inline-flex">Team</a>}
          <a href="/rewards" className="hidden min-h-11 items-center rounded-xl bg-[#1769E0]/10 px-3.5 text-sm font-bold text-[#1769E0] sm:inline-flex">Rewards</a><a href="/workspace" className="hidden min-h-11 items-center rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-600 sm:inline-flex">Workspace</a><a href="/app" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#1769E0] px-3.5 text-sm font-bold text-white"><Plus size={16}/><span>New quote</span></a>
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
      <div><p className="text-sm font-extrabold tracking-[0.16em] text-[#1769E0]">WORKSPACE</p><h1 className="mt-1 text-[2rem] font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Your quotes</h1><p className="mt-2 text-slate-500">{quotes?.length || 0} recent quotes in your QUVOTO workspace.</p></div>
      <DailyBrief quotes={quotes||[]} followups={followups||[]} jobs={jobs||[]}/>
      <a href="/rewards" className="mt-6 block overflow-hidden rounded-[1.5rem] border border-[#1769E0]/15 bg-white p-5 shadow-sm hover:border-[#2F8CFF] sm:mt-8 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-[#1769E0]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#1769E0]">Rewards</span><span className="text-xs font-bold text-slate-400">{rewardLabel}</span></div><h2 className="mt-2 text-xl font-black">You're {Math.max(0,rewardNext-rewardCount)} away from your next unlock.</h2><p className="mt-1 text-sm text-slate-500">Keep sharing QUVOTO. Your counter updates automatically.</p></div><div className="min-w-[11rem]"><div className="flex justify-between text-xs font-bold text-slate-500"><span>{rewardCount}</span><span>{rewardNext}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:Math.min(100,(rewardCount/Math.max(1,rewardNext))*100)+'%'}}/></div></div></div></a>
      <div className="mt-6 overflow-hidden rounded-[1.5rem] sm:mt-8 sm:rounded-[1.7rem] border bg-white shadow-sm">
        {!quotes?.length ? <div className="p-12 text-center"><FileText className="mx-auto mb-3 text-slate-300" size={38}/><h2 className="text-xl font-bold">No quotes yet</h2><p className="mt-2 text-slate-500">Create your first voice quote.</p><a href="/app" className="mt-5 inline-flex rounded-xl bg-[#1769E0] px-5 py-3 font-bold text-white">Create quote</a></div> :
        <div className="divide-y">{quotes.map((quote) => <div key={quote.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5 sm:items-center sm:justify-between"><div><div className="font-bold">{quote.quote_number}</div><div className="text-sm text-slate-500">{quote.client_name || 'No client name'} · {new Date(quote.created_at).toLocaleDateString()}</div></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><div className="font-black">{quote.currency} {Number(quote.total).toFixed(2)}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{quote.status}</span><a target="_blank" rel="noreferrer" href={"/q/"+quote.public_token} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ExternalLink size={17}/></a><QuoteActions quoteId={quote.id} clientEmail={quote.client_email} publicToken={quote.public_token} initialStatus={quote.status}/></div></div>)}</div>}
      </div>
    </section>
  </main>;
}
