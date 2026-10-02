'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Gift, Users, Sparkles } from 'lucide-react';

export default function RewardsPage() {
  const [ref, setRef] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referrals').then(async r => { if (r.ok) setRef(await r.json()); });
  }, []);

  const copy = async () => {
    if (!ref?.link) return;
    await navigator.clipboard?.writeText(ref.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const freeCount = Number(ref?.freeCount || 0);
  const freeNext = Number(ref?.nextFreeMilestone || 10);
  const freeProgress = Math.min(100, (freeCount / freeNext) * 100);
  const annualCount = Number(ref?.qualifiedCount || 0);
  const annualNext = ref?.nextMilestone || 2;
  const annualProgress = Math.min(100, (annualCount / annualNext) * 100);

  return <main className="min-h-screen bg-white text-[#0A1E3D]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <a href="/dashboard" className="text-xl font-black tracking-[-.04em]">QUVOTO</a>
        <a href="/workspace" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold text-slate-600"><ArrowLeft size={16}/> Workspace</a>
      </div>
    </header>

    <section className="relative overflow-hidden border-b border-[#1769E0]/10 bg-gradient-to-b from-[#1769E0]/5 to-white">
      <div className="mx-auto max-w-5xl px-5 py-14 text-center sm:px-8 sm:py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1769E0] text-white shadow-lg shadow-blue-600/20"><Gift size={27}/></div>
        <p className="mt-6 text-sm font-black uppercase tracking-[.18em] text-[#1769E0]">QUVOTO Rewards</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-[-.04em] sm:text-6xl">Invite good people. Get more time with QUVOTO.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">There are two simple ways to earn. Bring real contractors to QUVOTO, help them start using it, and we’ll take care of the reward automatically.</p>
        {ref?.link && <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-white p-2 shadow-sm sm:flex-row"><div className="flex-1 truncate px-3 py-3 text-left text-sm font-semibold text-slate-600">{ref.link}</div><button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-bold text-white">{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy referral link'}</button></div>}
      </div>
    </section>

    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="grid gap-5 lg:grid-cols-2">
        <RewardCard
          icon={<Users size={23}/>}
          eyebrow="Free User Reward"
          title="10 active Free users = 1 free Starter month"
          text="Share your personal link. When a genuinely new user joins through it and creates their first real quote while staying on the Free plan, they count toward your progress."
          count={freeCount}
          next={freeNext}
          progress={freeProgress}
          label="Free users using QUVOTO"
          accent="blue"
        />
        <RewardCard
          icon={<Sparkles size={23}/>}
          eyebrow="Annual Referral Reward"
          title="Paid annual referrals unlock bigger rewards"
          text="Same-plan annual referrals only. 2 qualified referrals earn 1 free year; 4 total earns another 6 months; 8 total earns another free year, then the pattern continues."
          count={annualCount}
          next={annualNext}
          progress={annualProgress}
          label="Qualified annual referrals"
          accent="navy"
        />
      </div>

      <div className="mt-8 rounded-3xl border bg-slate-50 p-6 sm:p-8">
        <h2 className="text-2xl font-black">How the Free-user reward works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ['01','Share','Send your personal QUVOTO referral link to a real contractor.'],
            ['02','They use Free','They create an account and make at least one real quote on the Free plan.'],
            ['03','You earn','Every 10 qualified Free users earns 1 month of Starter access.']
          ].map(([n,t,d])=><div key={n} className="rounded-2xl bg-white p-5"><span className="text-sm font-black text-[#1769E0]">{n}</span><h3 className="mt-5 font-black">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></div>)}
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-[#1769E0]/15 bg-[#1769E0]/5 p-6 sm:p-8">
        <h2 className="text-xl font-black">A few simple rules</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
          {['Only genuinely new users count.','You cannot refer yourself or accounts you control.','One person can qualify only once for your referral rewards.','The Free-user reward requires real product use, not just a signup.','Rewards have no cash value and cannot be transferred.','If you are already on Pro or Team, a Starter reward is kept as an earned reward rather than downgrading your active plan.'].map(x=><li key={x} className="flex gap-2"><Check size={17} className="mt-1 shrink-0 text-[#1769E0]"/><span>{x}</span></li>)}
        </ul>
      </div>

      <div className="mt-10 text-center">
        <a href="/app" className="inline-flex rounded-full bg-[#1769E0] px-7 py-3.5 font-bold text-white">Create a quote</a>
        <p className="mt-4 text-xs text-slate-400">Your referral progress is updated automatically when referred users reach the qualification point.</p>
      </div>
    </section>
  </main>;
}

function RewardCard({icon,eyebrow,title,text,count,next,progress,label,accent}:{icon:any;eyebrow:string;title:string;text:string;count:number;next:number;progress:number;label:string;accent:'blue'|'navy'}) {
  return <article className="rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
    <div className="flex items-center justify-between"><div className={'flex h-11 w-11 items-center justify-center rounded-xl '+(accent==='navy'?'bg-[#0A1E3D] text-white':'bg-[#1769E0]/10 text-[#1769E0]')}>{icon}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{eyebrow}</span></div>
    <h2 className="mt-6 text-2xl font-black tracking-tight">{title}</h2>
    <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    <div className="mt-7"><div className="flex items-end justify-between gap-3"><span className="text-sm font-bold text-slate-500">{label}</span><span className="text-2xl font-black">{count}<span className="text-sm font-bold text-slate-400"> / {next}</span></span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className={'h-full rounded-full '+(accent==='navy'?'bg-[#0A1E3D]':'bg-[#1769E0]')} style={{width:progress+'%'}}/></div><p className="mt-2 text-xs font-semibold text-slate-400">{Math.max(0,next-count)} more to the next reward</p></div>
  </article>;
}
