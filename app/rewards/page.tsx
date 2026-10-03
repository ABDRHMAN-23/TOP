'use client';

import QuvotoLogo from '@/components/QuvotoLogo';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Copy, Gift,
  History, Loader2, Lock, Medal, Share2, Sparkles, Trophy, Users, Zap
} from 'lucide-react';

type Reward = {
  id:string; status:string; reward_type:string; plan:string; milestone:number;
  earned_at?:string|null; applied_at?:string|null; billing_interval?:string|null;
  redemption_interval?:'month'|'year'|null;
};
type Badge = {id:string;label:string;description:string;unlocked:boolean;icon:string};
type TimelineItem = {id:string;type:string;title:string;detail:string;at:string};
type RefData = {
  link:string|null; plan:string; interval:string; freeCount:number; nextFreeMilestone:number;
  monthlyCount:number; nextMonthlyMilestone:number|null; qualifiedCount:number; nextMilestone:number|null;
  activeTrack:string; activeCount:number; activeNext:number|null; activeReward:string;
  rewards:Reward[]; nudges:any[]; timeline:TimelineItem[]; badges:Badge[];
  loyalty:{level:string;totalQualified:number;next:number|null;remaining:number;progress:number};
};
const empty:RefData={
  link:null,plan:'',interval:'',freeCount:0,nextFreeMilestone:10,monthlyCount:0,nextMonthlyMilestone:null,
  qualifiedCount:0,nextMilestone:null,activeTrack:'free',activeCount:0,activeNext:10,activeReward:'1 free Starter month',
  rewards:[],nudges:[],timeline:[],badges:[],
  loyalty:{level:'QUVOTO Starter',totalQualified:0,next:10,remaining:10,progress:0}
};

function pct(count:number,next:number|null){return next?Math.min(100,Math.round((count/Math.max(1,next))*100)):100}
function annualLabel(n:number|null){
  if(n===2)return '1 free year';
  if(n===4)return '6 free months';
  if(n!=null&&n>=8&&((n-8)%6===0))return '1 free year';
  if(n!=null&&n>=10&&((n-10)%6===0))return '6 free months';
  return 'next Annual reward';
}
function TrackCard({title,icon,count,next,reward,detail}:{title:string;icon:React.ReactNode;count:number;next:number|null;reward:string;detail:string}){
  const p=pct(count,next);
  return <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]">{icon}</div>
      <span className="text-xs font-black text-slate-400">{next?Math.max(0,next-count)+' to go':'Complete'}</span>
    </div>
    <h3 className="mt-4 text-lg font-black">{title}</h3>
    <p className="mt-1 text-sm font-bold text-[#1769E0]">{reward}</p>
    <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    <div className="mt-5 flex items-center justify-between text-xs font-black text-slate-500"><span>{count}</span><span>{next??count}</span></div>
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0] transition-all" style={{width:p+'%'}}/></div>
  </div>
}

export default function RewardsPage(){
  const [data,setData]=useState<RefData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true); setError('');
    try{
      const res=await fetch('/api/referrals',{cache:'no-store',credentials:'same-origin'});
      if(res.status===401){window.location.href='/login?next=/rewards';return}
      const raw=await res.text();
      let json:any=null;
      try{json=raw?JSON.parse(raw):null}catch{}
      if(!res.ok)throw new Error(json?.error||raw||`Could not load Rewards (HTTP ${res.status}).`);
      if(!json||typeof json!=='object')throw new Error('Rewards service returned an empty response. Please try again.');
      setData(json);
    }catch(e){setError(e instanceof Error?e.message:'Could not load Rewards.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[]);

  const choose=async(id:string,interval:'month'|'year')=>{
    setBusy(id+interval);setMessage('');
    try{
      const res=await fetch('/api/referrals',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({rewardId:id,redemptionInterval:interval})});
      const raw=await res.text();
      let json:any=null;
      try{json=raw?JSON.parse(raw):null}catch{}
      if(res.status===401){window.location.href='/login?next=/rewards';return}
      if(!res.ok)throw new Error(json?.error||raw||`Could not save your reward choice (HTTP ${res.status}).`);
      if(!json||typeof json!=='object')throw new Error('Rewards service returned an empty response. Please try again.');
      setMessage(json?.message||'Reward choice saved.'); await load();
    }catch(e){setMessage(e instanceof Error?e.message:'Could not save your reward choice.')}
    finally{setBusy(null)}
  };
  const copy=async()=>{
    if(!data?.link)return;
    try{await navigator.clipboard.writeText(data.link);setCopied(true);setTimeout(()=>setCopied(false),1800)}
    catch{setMessage('Copy failed. You can select the link manually.')}
  };

  const d=data||empty;
  const wallet=d.rewards.filter(r=>['earned','scheduled','applied'].includes(r.status));
  const activeNext=d.activeNext;
  const activePct=pct(d.activeCount,activeNext);
  const annualNext=d.nextMilestone;
  const nextNudges=(d.nudges||[]).slice(0,3);
  const unlocked=d.badges.filter(b=>b.unlocked).length;
  const nextLevel=d.loyalty.next;
  const levelRemaining=d.loyalty.remaining;

  const mainReward=useMemo(()=>{
    if(d.activeTrack==='annual')return annualLabel(activeNext);
    if(d.activeTrack==='monthly')return '1 free month';
    return '1 free Starter month';
  },[d.activeTrack,activeNext]);

  if(loading)return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D] flex items-center justify-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#1769E0]" size={30}/><p className="mt-3 font-bold">Loading your Rewards…</p></div></main>;

  if(error)return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4"><a href="/dashboard" aria-label="QUVOTO dashboard"><QuvotoLogo className="h-10 w-auto"/></a><div className="flex items-center gap-2"><a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-black text-slate-600"><ArrowLeft size={16}/><span>Dashboard</span></a><a href="/app" className="rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-sm font-black text-white">New quote</a></div></div></header><div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="text-5xl">🎁</div><h1 className="mt-5 text-3xl font-black">Rewards could not load.</h1><p className="mt-3 text-slate-500">{error}</p><button onClick={()=>void load()} className="mt-6 rounded-xl bg-[#1769E0] px-5 py-3 font-bold text-white">Try again</button></div></main>;

  return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <a href="/dashboard" aria-label="QUVOTO home"><QuvotoLogo className="h-10 w-auto"/></a>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-black text-slate-600"><ArrowLeft size={16}/><span>Dashboard</span></a>
          <a href="/app" className="rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-sm font-black text-white">New quote</a>
        </div>
      </div>
    </header>

    <section className="border-b border-[#1769E0]/10 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_430px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1769E0]/15 bg-[#1769E0]/5 px-3 py-1.5 text-xs font-black text-[#1769E0]"><Gift size={14}/> QUVOTO REWARDS</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-.04em] sm:text-6xl">Quote. Refer. Get rewarded.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Three reward tracks run independently. Your progress stays with you, rewards go into your wallet, and using a reward never resets your counters.</p>
            {d.link&&<div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[.16em] text-slate-400"><Share2 size={13}/> Your referral link</div><div className="mt-2 flex gap-2"><div className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-bold text-slate-600">{d.link}</div><button onClick={copy} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-black text-white">{copied?<><Check size={16}/>Copied</>:<><Copy size={16}/>Copy</>}</button></div></div>}
          </div>

          <div className="rounded-[2rem] border border-[#1769E0]/15 bg-white p-6 shadow-xl shadow-blue-900/5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Your current track</p><p className="mt-1 text-sm font-bold text-slate-500">{d.activeTrack==='free'?'Free users':d.activeTrack==='monthly'?'Monthly paid referrals':'Annual paid referrals'}</p></div><Sparkles className="text-[#1769E0]" size={21}/></div>
            <div className="mt-5 flex items-center gap-5">
              <div className="relative h-36 w-36 shrink-0">
                <svg viewBox="0 0 120 120" className="-rotate-90 h-full w-full"><circle cx="60" cy="60" r="50" fill="none" stroke="#eef2f7" strokeWidth="9"/><circle cx="60" cy="60" r="50" fill="none" stroke="#1769E0" strokeWidth="9" strokeLinecap="round" strokeDasharray={314} strokeDashoffset={314-(314*activePct/100)}/></svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-3xl font-black">{d.activeCount}</b><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">of {activeNext??d.activeCount}</span></div>
              </div>
              <div className="min-w-0"><p className="text-sm font-black text-slate-400">Next unlock</p><h2 className="mt-1 text-2xl font-black">{mainReward}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{activeNext?Math.max(0,activeNext-d.activeCount)+' more to unlock.':'Track complete.'}</p><a href="#tracks" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#1769E0]">View all tracks <ArrowRight size={15}/></a></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {message&&<div className="mx-auto max-w-6xl px-5 pt-5 sm:px-8"><div className="rounded-2xl border border-[#1769E0]/15 bg-[#1769E0]/5 p-4 text-sm font-bold text-[#1769E0]">{message}</div></div>}

    <section id="tracks" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Three independent tracks</p><h2 className="mt-2 text-3xl font-black tracking-tight">Build progress in parallel.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The counters below are independent. A reward from one track does not erase progress on another.</p></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <TrackCard title="Free-user rewards" icon={<Users size={19}/>} count={d.freeCount} next={d.nextFreeMilestone} reward="10 active Free users → 1 free Starter month" detail="A referred Free user qualifies after joining through your link and creating a real quote."/>
        <TrackCard title="Monthly paid rewards" icon={<Zap size={19}/>} count={d.monthlyCount} next={d.nextMonthlyMilestone} reward="1 referral → 1 free month; every 3 more → another" detail="Same-plan paid Monthly referrals. The counter continues after each reward."/>
        <TrackCard title="Annual paid rewards" icon={<CalendarDays size={19}/>} count={d.qualifiedCount} next={annualNext} reward="2 → 1 year · 4 → 6 months · 8 → 1 year" detail="Same-plan paid Annual referrals. After 8, the larger milestone cycle continues without resetting."/>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Almost there</p><h2 className="mt-2 text-2xl font-black">Your closest milestones</h2></div><span className="text-xs font-black text-slate-400">{nextNudges.length} active</span></div>
          <div className="mt-5 grid gap-3">{nextNudges.length?nextNudges.map((n:any)=><div key={n.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><span className="rounded-full bg-[#1769E0]/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#1769E0]">{n.track}</span><p className="mt-2 font-black">{n.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{n.detail}</p></div><b className="ml-3 shrink-0 text-sm text-[#1769E0]">{n.remaining}</b></div>):<p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Your next milestones are further away. Keep sharing and this page will update automatically.</p>}</div>
        </div>
        <div className="rounded-[1.7rem] bg-[#0A1E3D] p-6 text-white shadow-sm sm:p-8">
          <Trophy className="text-blue-300" size={23}/><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-blue-300">Next stage</p>
          <h2 className="mt-2 text-2xl font-black">{nextLevel?nextLevel+' qualified referrals':'Top loyalty level reached'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{nextLevel?levelRemaining+' more qualified referrals to reach your next QUVOTO loyalty level.':'You have reached the highest loyalty level currently shown.'}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#2F8CFF]" style={{width:d.loyalty.progress+'%'}}/></div>
          <p className="mt-3 text-xs font-bold text-blue-200">{d.loyalty.level}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Reward Wallet</p><h2 className="mt-2 text-2xl font-black">Your unlocked rewards</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{wallet.length}</span></div>
        <p className="mt-2 text-sm text-slate-500">Rewards stay here until applied. Paid rewards can be assigned to Monthly or Annual billing before they are used.</p>
        {!wallet.length?<div className="mt-5 rounded-2xl bg-slate-50 p-7 text-center"><Gift className="mx-auto text-slate-300" size={28}/><p className="mt-3 font-black">Nothing unlocked yet.</p><p className="mt-1 text-sm text-slate-500">Your first reward will appear automatically when a referral qualifies.</p></div>:
          <div className="mt-5 space-y-3">{wallet.map(r=>{
            const value=r.reward_type==='free_year'?'1 free year':r.reward_type==='free_6_months'?'6 free months':'1 free month';
            const paid=r.billing_interval==='month'||r.billing_interval==='year';
            return <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769E0]"><Gift size={19}/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{value}</h3><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-[#1769E0]">{r.status==='applied'?'Applied':r.status==='scheduled'?'Scheduled':'Unlocked'}</span></div><p className="mt-1 text-xs text-slate-500">Milestone {r.milestone} · {r.plan} · {r.earned_at?new Date(r.earned_at).toLocaleDateString():'—'}</p></div></div>
              {paid&&r.status!=='applied'&&<div className="grid grid-cols-2 gap-2 md:min-w-[260px]"><button disabled={!!busy} onClick={()=>void choose(r.id,'month')} className={'rounded-xl border px-3 py-2.5 text-xs font-black '+(r.redemption_interval==='month'?'border-[#1769E0] bg-[#1769E0]/10 text-[#1769E0]':'bg-white text-slate-600')}>{busy===r.id+'month'?<Loader2 className="mx-auto animate-spin" size={15}/>:<>Monthly</>}</button><button disabled={!!busy} onClick={()=>void choose(r.id,'year')} className={'rounded-xl border px-3 py-2.5 text-xs font-black '+(r.redemption_interval==='year'?'border-[#0A1E3D] bg-[#0A1E3D] text-white':'bg-[#0A1E3D] text-white')}>{busy===r.id+'year'?<Loader2 className="mx-auto animate-spin" size={15}/>:<>Annual</>}</button></div>}
            </div>{r.status==='scheduled'&&<p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-slate-600">Scheduled for <b>{r.redemption_interval==='year'?'Annual':'Monthly'}</b> billing. You can switch before it is applied.</p>}</div>
          })}</div>}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Loyalty levels</p><h2 className="mt-2 text-2xl font-black">{d.loyalty.level}</h2></div><Medal className="text-[#1769E0]" size={24}/></div>
          <div className="mt-5 space-y-3">
            {[['QUVOTO Starter',0],['QUVOTO Builder',10],['QUVOTO Champion',25],['QUVOTO Legend',50]].map(([name,n])=><div key={String(name)} className={'flex items-center justify-between rounded-2xl p-4 '+(d.loyalty.totalQualified>=Number(n)?'bg-[#1769E0]/5':'bg-slate-50')}><div className="flex items-center gap-3"><div className={'flex h-9 w-9 items-center justify-center rounded-full '+(d.loyalty.totalQualified>=Number(n)?'bg-[#1769E0] text-white':'bg-white text-slate-300')}><Trophy size={15}/></div><div><p className="text-sm font-black">{name}</p><p className="text-[11px] text-slate-500">{n===0?'Starting level':n+' qualified referrals'}</p></div></div>{d.loyalty.totalQualified>=Number(n)?<Check className="text-[#1769E0]" size={17}/>:<Lock className="text-slate-300" size={16}/>}</div>)}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Medal size={20}/></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Badges</p><h2 className="text-2xl font-black">{unlocked}/{d.badges.length} unlocked</h2></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{d.badges.map(b=><div key={b.id} className={'rounded-2xl border p-4 '+(b.unlocked?'border-[#1769E0]/15 bg-[#1769E0]/5':'border-slate-200 bg-slate-50 opacity-70')}><div className="flex items-start justify-between"><span className="text-xl">{b.icon}</span>{b.unlocked?<Check size={16} className="text-[#1769E0]"/>:<Lock size={15} className="text-slate-400"/>}</div><p className="mt-3 text-sm font-black">{b.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{b.description}</p></div>)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><History size={20}/></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Activity timeline</p><h2 className="text-2xl font-black">Your referral activity</h2></div></div>
        {!d.timeline.length?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Your referral activity will appear here as people join and qualify.</div>:
          <div className="mt-5 space-y-1">{d.timeline.map((item,i)=><div key={item.id} className="flex gap-4"><div className="flex flex-col items-center"><div className="mt-1 h-3 w-3 rounded-full bg-[#1769E0] ring-4 ring-[#1769E0]/10"/>{i<d.timeline.length-1&&<div className="mt-2 w-px flex-1 bg-slate-200"/>}</div><div className="pb-6"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{item.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{item.type}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{new Date(item.at).toLocaleString()}</p></div></div>)}</div>}
      </div>

      <div className="mt-6 rounded-[1.7rem] bg-[#0A1E3D] p-7 text-white shadow-sm sm:p-9">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-300">Keep the streak going</p><h2 className="mt-2 text-3xl font-black">Share QUVOTO. Let your counters do the rest.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Your Free, Monthly, and Annual progress is tracked independently. Every genuine qualifying referral moves the right counter forward.</p></div>{d.link&&<button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-[#0A1E3D]"><Copy size={17}/>{copied?'Copied':'Copy referral link'}</button>}</div>
      </div>

      <div className="py-10 text-center"><a href="/app" className="inline-flex items-center gap-2 rounded-full bg-[#1769E0] px-7 py-4 font-black text-white">Create a quote <ChevronRight size={18}/></a><p className="mt-3 text-xs text-slate-400">Rewards are for genuine referrals only. They are not cash and are not transferable.</p></div>
    </section>
  </main>
}
