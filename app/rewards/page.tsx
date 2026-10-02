'use client';

import QuvotoLogo from '@/components/QuvotoLogo';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertCircle, CalendarDays, Check, Copy, Gift, Loader2, Sparkles, Trophy, Users, Zap } from 'lucide-react';

type Reward = {
  id:string;
  status:string;
  reward_type:string;
  plan:string;
  milestone:number;
  earned_at?:string|null;
  applied_at?:string|null;
  billing_interval?:string|null;
  redemption_interval?:'month'|'year'|null;
};

type RefData = {
  link:string|null;
  code?:{code?:string}|null;
  plan:string;
  interval:string;
  freeCount:number;
  nextFreeMilestone:number;
  monthlyCount:number;
  nextMonthlyMilestone:number|null;
  qualifiedCount:number;
  nextMilestone:number|null;
  activeTrack:string;
  activeCount:number;
  activeNext:number|null;
  activeReward:string;
  rewards:Reward[];
  nudges:any[];
  timeline:any[];
  badges:any[];
  loyalty:{level:string;totalQualified:number;next:number|null;remaining:number;progress:number};
};

const emptyLoyalty={level:'QUVOTO Starter',totalQualified:0,next:10,remaining:10,progress:0};

export default function RewardsPage(){
  const [data,setData]=useState<RefData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);
    setError('');
    try{
      const res=await fetch('/api/referrals',{cache:'no-store',credentials:'same-origin'});
      if(res.status===401){window.location.href='/login?next=/rewards';return;}
      const json=await res.json();
      if(!res.ok)throw new Error(json?.error||'Could not load Rewards.');
      setData(json);
    }catch(e){
      setError(e instanceof Error?e.message:'Could not load Rewards.');
    }finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[]);

  const choose=async(id:string,interval:'month'|'year')=>{
    setBusy(id+':'+interval);
    setMessage('');
    try{
      const res=await fetch('/api/referrals',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({rewardId:id,redemptionInterval:interval})
      });
      const json=await res.json();
      if(res.status===401){window.location.href='/login?next=/rewards';return;}
      if(!res.ok)throw new Error(json?.error||'Could not save your reward choice.');
      setMessage(json?.message||'Reward choice saved.');
      await load();
    }catch(e){
      setMessage(e instanceof Error?e.message:'Could not save your reward choice.');
    }finally{setBusy(null);}
  };

  const copy=async()=>{
    if(!data?.link)return;
    try{
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1800);
    }catch{setMessage('Copy failed. You can select the link manually.');}
  };

  const freeCount=Number(data?.freeCount||0);
  const freeNext=Number(data?.nextFreeMilestone||10);
  const monthlyCount=Number(data?.monthlyCount||0);
  const monthlyNext=data?.nextMonthlyMilestone??1;
  const annualCount=Number(data?.qualifiedCount||0);
  const annualNext=data?.nextMilestone??2;
  const rewards=data?.rewards||[];
  const loyalty=data?.loyalty||emptyLoyalty;
  const wallet=rewards.filter(r=>['earned','scheduled','applied'].includes(r.status));
  const nextNudges=(data?.nudges||[]).slice(0,3);
  const progress=(count:number,next:number|null)=>next?Math.min(100,(count/Math.max(1,next))*100):100;

  const annualRewardLabel=useMemo(()=>{
    if(annualNext===2)return '1 free year';
    if(annualNext===4)return '6 free months';
    if(annualNext!==null&&annualNext>=8&&((annualNext-8)%6===0))return '1 free year';
    if(annualNext!==null&&annualNext>=10&&((annualNext-10)%6===0))return '6 free months';
    return 'next annual reward';
  },[annualNext]);

  if(loading)return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]"><div className="flex min-h-screen items-center justify-center p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#1769E0]" size={28}/><p className="mt-3 font-bold">Loading your rewards…</p></div></div></main>;

  if(error)return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8"><a href="/dashboard" className="inline-flex items-center"><QuvotoLogo className="h-10 w-auto"/></a><a href="/workspace" className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-600">Workspace</a></div></header><div className="mx-auto max-w-xl px-5 py-20 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><AlertCircle/></div><h1 className="mt-5 text-3xl font-black">Rewards could not load.</h1><p className="mt-3 text-slate-500">{error}</p><button onClick={()=>void load()} className="mt-6 rounded-xl bg-[#1769E0] px-5 py-3 font-bold text-white">Try again</button></div></main>;

  return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <a href="/dashboard" aria-label="QUVOTO home" className="inline-flex items-center"><QuvotoLogo className="h-10 w-auto"/></a>
        <div className="flex items-center gap-2"><a href="/workspace" className="rounded-xl border px-3.5 py-2.5 text-sm font-bold text-slate-600"><span className="hidden sm:inline">Workspace</span><ArrowLeft className="sm:hidden" size={17}/></a><a href="/app" className="rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-sm font-bold text-white">New quote</a></div>
      </div>
    </header>

    <section className="border-b border-[#1769E0]/10 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#1769E0]">QUVOTO REWARDS</p><h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Earn rewards without resetting your progress.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">All three tracks run at the same time: Free-user activity, Monthly paid referrals, and Annual paid referrals.</p></div>
          {data?.link&&<div className="w-full max-w-xl rounded-2xl border bg-slate-50 p-3"><p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Your personal referral link</p><div className="mt-2 flex gap-2"><div className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-600">{data.link}</div><button onClick={copy} className="shrink-0 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-black text-white">{copied?<Check size={17}/>:<Copy size={17}/>}</button></div></div>}
        </div>
      </div>
    </section>

    {message&&<div className="mx-auto max-w-6xl px-5 pt-5 sm:px-8"><div className="rounded-2xl bg-[#1769E0]/5 p-4 text-sm font-bold text-[#1769E0]">{message}</div></div>}

    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid gap-5 lg:grid-cols-3">
        <Track title="Free-user reward" icon={<Users size={20}/>} count={freeCount} next={freeNext} progress={progress(freeCount,freeNext)} reward="Every 10 qualified Free users = 1 free Starter month" detail="The referred person must sign up through your link and create a real quote while remaining on Free."/>
        <Track title="Monthly reward" icon={<Zap size={20}/>} count={monthlyCount} next={monthlyNext} progress={progress(monthlyCount,monthlyNext)} reward="1 referral, then every 3 more = 1 free month" detail="Same-plan, paid Monthly referrals only. The counter continues after every reward."/>
        <Track title="Annual reward" icon={<CalendarDays size={20}/>} count={annualCount} next={annualNext} progress={progress(annualCount,annualNext)} reward="2 = 1 year · 4 = 6 months · 8+ repeats the cycle" detail="Same-plan, paid Annual referrals only. Your counter never resets when a reward is used."/>
      </div>

      <div className="mt-5 rounded-3xl border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Almost there</p><h2 className="mt-2 text-2xl font-black">Your closest milestones</h2></div><p className="text-sm font-bold text-slate-400">{nextNudges.length} active nudge{nextNudges.length===1?'':'s'}</p></div>
        {nextNudges.length?<div className="mt-5 grid gap-3 md:grid-cols-3">{nextNudges.map((n:any)=><div key={n.id} className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center justify-between"><span className="rounded-full bg-[#1769E0]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#1769E0]">{n.track}</span><b className="text-[#1769E0]">{n.remaining} left</b></div><p className="mt-4 font-black">{n.title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{n.detail}</p></div>)}</div>:<p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Your next milestones are further away. Keep sharing and this page will update automatically.</p>}
      </div>

      <div className="mt-5 rounded-3xl border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Trophy size={21}/></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">QUVOTO Loyalty</p><h2 className="text-2xl font-black">{loyalty.level}</h2></div></div>
        <div className="mt-5 flex items-center justify-between text-xs font-bold text-slate-500"><span>{loyalty.totalQualified} qualified referrals</span><span>{loyalty.next?loyalty.next+' next level':'Top level'}</span></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:loyalty.progress+'%'}}/></div>
      </div>

      <div className="mt-5 rounded-3xl border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Reward Wallet</p><h2 className="mt-2 text-2xl font-black">Unlocked rewards stay here until used.</h2></div><span className="text-sm font-bold text-slate-400">{wallet.length} reward{wallet.length===1?'':'s'}</span></div>
        {!wallet.length?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><Gift className="mx-auto text-slate-300" size={25}/><p className="mt-3 font-black">No rewards unlocked yet.</p><p className="mt-1 text-sm text-slate-500">Your rewards appear here automatically after a referral reaches its real qualification point.</p></div>:
        <div className="mt-5 space-y-3">{wallet.map(r=>{
          const value=r.reward_type==='free_year'?'1 free year':r.reward_type==='free_6_months'?'6 free months':'1 free month';
          const paid=['month','year'].includes(r.billing_interval||'');
          const status=r.status==='applied'?'Applied':r.status==='scheduled'?'Scheduled':'Unlocked';
          return <div key={r.id} className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769E0]"><Gift size={20}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{value}</h3><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#1769E0]">{status}</span></div><p className="mt-1 text-xs text-slate-500">Milestone {r.milestone} · {r.plan} · earned {r.earned_at?new Date(r.earned_at).toLocaleDateString():'—'}</p></div></div>
              {paid&&r.status!=='applied'&&<div className="grid grid-cols-2 gap-2 md:min-w-[270px]"><button onClick={()=>choose(r.id,'month')} disabled={busy!==null} className={'rounded-xl border px-3 py-2.5 text-xs font-black '+(r.redemption_interval==='month'?'border-[#1769E0] bg-[#1769E0]/5 text-[#1769E0]':'bg-white text-slate-600')}>{busy===r.id+':month'?<Loader2 className="mx-auto animate-spin" size={15}/>:<><Zap size={14} className="mr-1 inline"/>Monthly</>}</button><button onClick={()=>choose(r.id,'year')} disabled={busy!==null} className={'rounded-xl border px-3 py-2.5 text-xs font-black '+(r.redemption_interval==='year'?'border-[#0A1E3D] bg-[#0A1E3D] text-white':'bg-[#0A1E3D] text-white')}>{busy===r.id+':year'?<Loader2 className="mx-auto animate-spin" size={15}/>:<><CalendarDays size={14} className="mr-1 inline"/>Annual</>}</button></div>}
              {!paid&&r.status!=='applied'&&<span className="text-xs font-bold text-slate-500">Starter month reward</span>}
            </div>
            {r.status==='scheduled'&&<p className="mt-4 rounded-xl bg-white p-3 text-sm font-semibold text-slate-600">Scheduled for <b>{r.redemption_interval==='year'?'Annual':'Monthly'}</b>. You can switch this reward before it is applied.</p>}
          </div>;
        })}</div>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">How it works</p><h2 className="mt-2 text-2xl font-black">Earn → Unlock → Choose → Repeat</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><b className="text-[#1769E0]">01</b><p className="mt-2 text-sm font-black">Earn</p><p className="mt-1 text-xs leading-5 text-slate-500">A real referral reaches its qualification point.</p></div><div className="rounded-2xl bg-slate-50 p-4"><b className="text-[#1769E0]">02</b><p className="mt-2 text-sm font-black">Unlock</p><p className="mt-1 text-xs leading-5 text-slate-500">The reward enters your wallet automatically.</p></div><div className="rounded-2xl bg-slate-50 p-4"><b className="text-[#1769E0]">03</b><p className="mt-2 text-sm font-black">Choose</p><p className="mt-1 text-xs leading-5 text-slate-500">Paid rewards let you choose Monthly or Annual for that reward.</p></div></div></div>
        <div className="rounded-3xl bg-[#0A1E3D] p-6 text-white shadow-sm sm:p-8"><Sparkles className="text-blue-300"/><h2 className="mt-5 text-2xl font-black">Your counters never reset.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Using a reward does not erase referral progress. Free, Monthly, and Annual counters continue independently.</p><p className="mt-5 text-sm font-bold text-blue-200">{data?.activeTrack==='annual'?annualRewardLabel:data?.activeTrack==='monthly'?'1 free month':'1 free Starter month'} is your current active-track reward target.</p></div>
      </div>

      <div className="mt-5 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Simple rules</h2><div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2"><p>Only genuinely new users count.</p><p>You cannot refer yourself or accounts you control.</p><p>A Free referral qualifies after real quote creation.</p><p>Paid referrals must be active and same-plan.</p><p>Each referred person qualifies once per referrer.</p><p>Rewards are not cash and are not transferable.</p></div></div>

      <div className="py-10 text-center"><a href="/app" className="inline-flex rounded-full bg-[#1769E0] px-7 py-3.5 font-bold text-white">Create a quote</a></div>
    </section>
  </main>;
}

function Track({title,icon,count,next,progress,reward,detail}:{title:string;icon:React.ReactNode;count:number;next:number|null;progress:number;reward:string;detail:string}){
  return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]">{icon}</div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{title}</p><p className="mt-1 text-sm font-black">{reward}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-500">{detail}</p><div className="mt-5 flex items-end justify-between"><b className="text-3xl">{count}</b><span className="text-xs font-bold text-slate-400">{next?'next: '+next:'complete'}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:progress+'%'}}/></div></article>;
}