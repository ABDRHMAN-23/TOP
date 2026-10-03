'use client';

import QuvotoLogo from '@/components/QuvotoLogo';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Gift, Loader2, Share2, Users } from 'lucide-react';

type Reward = { id:string; status:string; reward_type:string; plan:string; milestone:number; billing_interval?:string|null; redemption_interval?:'month'|'year'|null };
type PlanCounts = {starter:number; pro:number; team:number};
type RefData = {
  link:string|null; plan:string; interval:string; freeCount:number; nextFreeMilestone:number;
  monthlyCount:number; nextMonthlyMilestone:number|null; qualifiedCount:number; nextMilestone:number|null;
  monthlyCounts:PlanCounts; annualCounts:PlanCounts;
  challenge?:'free'|'monthly'|'annual'; activeTrack:string; activeCount:number; activeNext:number|null; activeReward:string; activeChallengeCompleted?:boolean; rewards:Reward[];
};
const empty:RefData={link:null,plan:'',interval:'',freeCount:0,nextFreeMilestone:10,monthlyCount:0,nextMonthlyMilestone:null,qualifiedCount:0,nextMilestone:null,monthlyCounts:{starter:0,pro:0,team:0},annualCounts:{starter:0,pro:0,team:0},activeTrack:'free',activeCount:0,activeNext:10,activeReward:'1 free Starter month',rewards:[]};
const trackName=(t:string)=>t==='monthly'?'Monthly referrals':t==='annual'?'Annual referrals':'Free referrals';
const rewardValue=(r:Reward)=>r.reward_type==='free_year'?'1 free year':r.reward_type==='free_6_months'?'6 free months':'1 free month';

function RewardRules(){
 const [tab,setTab]=useState<'free'|'monthly'|'annual'>('free');
 const rows=tab==='free'
  ? [['10 qualified Free users','1 free Starter month','First Free reward']]
  : tab==='monthly'
  ? [['1 qualified referral','1 free month','First qualifying paid referral in that plan counter'],['3 qualified referrals','1 free month','Two additional qualifying referrals in the selected plan counter'],['5 qualified referrals','1 free month','Two additional qualifying referrals in the selected plan counter'],['7 qualified referrals','1 free month','Two new same-plan referrals · repeat forever']]
  : [['2 qualified referrals','1 free year','Qualifying referrals in the selected plan counter · Annual billing'],['4 qualified referrals','6 free months','Same paid plan · Annual billing'],['6 qualified referrals','6 free months','Same paid plan · Annual billing'],['8 qualified referrals','1 free year','Same paid plan · Annual billing'],['10 qualified referrals','6 free months','Same paid plan · Annual billing'],['12 qualified referrals','6 free months','Same paid plan · Annual billing'],['14 qualified referrals','6 free months','Same paid plan · Annual billing'],['16 qualified referrals','1 free year','Same paid plan · Annual billing · cycle repeats']];
 return <section className="mt-10">
  <div className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">Reward rules</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">See exactly what you can earn</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">Choose a reward track to see the exact milestones and what each one unlocks.</p></div>
  <div className="mx-auto mt-5 max-w-2xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
   <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1">
    {([['free','Free users'],['monthly','Monthly'],['annual','Annual']] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'rounded-xl px-3 py-3 text-sm font-black transition '+(tab===id?'bg-white text-[#1769E0] shadow-sm':'text-slate-500')}>{label}</button>)}
   </div>
   <div className="divide-y divide-slate-100">{rows.map(([milestone,reward,note],i)=><div key={i} className="grid grid-cols-[1fr_auto] gap-4 p-4 sm:grid-cols-[1.1fr_1fr] sm:p-5"><div><p className="font-black">{milestone}</p><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p></div><div className="flex items-center justify-end text-right"><span className="rounded-full bg-[#1769E0]/10 px-3 py-2 text-sm font-black text-[#1769E0]">{reward}</span></div></div>)}</div>
   <div className="border-t border-slate-200 bg-[#F7FAFF] px-5 py-4 text-center text-xs font-semibold text-slate-500">{tab==='free'?'Free rewards are based on qualified Free users.':tab==='monthly'?'Monthly rewards use three independent counters: Starter, Pro and Team.':'Annual rewards use three independent counters: Starter, Pro and Team.'}</div>
  </div>
 </section>;
}

export default function RewardsPage(){
 const [data,setData]=useState<RefData|null>(null); const [loading,setLoading]=useState(true);
 const [copied,setCopied]=useState(false); const [busy,setBusy]=useState<string|null>(null); const [message,setMessage]=useState('');
 const load=async()=>{setLoading(true);try{const res=await fetch('/api/referrals',{cache:'no-store',credentials:'same-origin'});if(res.status===401){window.location.href='/login?next=/rewards';return}const raw=await res.text();let json:any=null;try{json=raw?JSON.parse(raw):null}catch{}if(!res.ok||!json||typeof json!=='object')throw new Error();setData(json);void 0}catch{setData(empty)}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const copy=async()=>{if(!data?.link)return;try{await navigator.clipboard.writeText(data.link);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setMessage('Select the link and copy it manually.')}};
 const selectChallenge=async(id:'free'|'monthly'|'annual')=>{try{const res=await fetch('/api/referrals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'select_challenge',challenge:id})});const raw=await res.text();let json:any=null;try{json=raw?JSON.parse(raw):null}catch{}if(!res.ok)throw new Error(json?.error||'Could not save challenge.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Could not save challenge.')}};
 const choose=async(id:string)=>{setBusy(id);setMessage('');try{const res=await fetch('/api/referrals',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({rewardId:id,redemptionInterval:'apply'})});const raw=await res.text();let json:any=null;try{json=raw?JSON.parse(raw):null}catch{}if(res.status===401){window.location.href='/login?next=/rewards';return}if(!res.ok)throw new Error(json?.error||'Could not apply the reward.');setMessage(json?.message||'Reward applied.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Could not apply the reward.')}finally{setBusy(null)}};
 const d=data||empty; const selectedChallenge=d.challenge||d.activeTrack||'free'; const activeChallengeCompleted=!!d.activeChallengeCompleted; const remaining=d.activeNext==null?0:Math.max(0,d.activeNext-d.activeCount); const pct=d.activeNext?Math.min(100,Math.round(d.activeCount/d.activeNext*100)):100;
 const wallet=d.rewards.filter(r=>['earned','scheduled','applied'].includes(r.status));
 if(loading)return <main className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-[#1769E0]" size={28}/></main>;
 return <main className="min-h-screen bg-[#F7FAFF] text-[#0A1E3D]">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6"><a href="/dashboard"><QuvotoLogo className="h-10 w-auto"/></a><div className="flex gap-2"><a href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><ArrowLeft size={15}/>Dashboard</a><a href="/app" className="rounded-xl bg-[#1769E0] px-3 py-2 text-sm font-bold text-white">New quote</a></div></div></header>

  <section className="bg-white"><div className="mx-auto max-w-3xl px-5 pb-12 pt-12 text-center sm:pb-16 sm:pt-16">
   <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1769E0]/10 text-[#1769E0]"><Gift size={27}/></div>
   <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">QUVOTO Rewards</p>
   <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">Share QUVOTO. Get rewarded.</h1>
   <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">Invite contractors who need faster quoting. When their referral qualifies, you unlock free QUVOTO time.</p>
   {d.link?<div className="mx-auto mt-7 max-w-2xl rounded-2xl border border-slate-200 bg-[#F7FAFF] p-3 text-left"><div className="mb-2 flex items-center gap-2 px-1 text-xs font-black text-slate-500"><Share2 size={14}/>Your referral link</div><div className="flex gap-2"><div className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-3 text-sm font-bold text-slate-600">{d.link}</div><button onClick={copy} className="shrink-0 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-black text-white">{copied?'Copied':'Copy'}</button></div></div>:<div className="mx-auto mt-7 max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">Your referral link will appear here when your account is connected.</div>}
  </div></section>

  <section className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
   <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">Your progress</p><h2 className="mt-2 text-2xl font-black">{trackName(d.activeTrack)}</h2><p className="mt-1 text-sm text-slate-500">One clear counter. Keep sharing until the next reward.</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]"><Users size={20}/></div></div>
    <div className="mt-7 flex items-end justify-between"><div><span className="text-5xl font-black">{d.activeCount}</span><span className="ml-2 text-lg font-bold text-slate-400">/ {d.activeNext??'—'}</span></div><span className="text-sm font-black text-[#1769E0]">{remaining?remaining+' to go':'Reward unlocked'}</span></div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:pct+'%'}}/></div>
    <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:justify-between"><p className="font-black">{d.activeReward||'Next reward'}</p><p className="text-sm text-slate-500">{d.activeNext?remaining+' more qualifying referral'+(remaining===1?'':'s'):'Keep sharing'}</p></div>
   </div>

   {selectedChallenge==='free'?<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-black">Free users</p><p className="mt-1 text-xs text-slate-500">10 qualified Free users → 1 real Starter month.</p></div><span className="text-2xl font-black">{d.freeCount}<span className="text-sm text-slate-400"> / {d.nextFreeMilestone}</span></span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:Math.min(100,d.freeCount/d.nextFreeMilestone*100)+'%'}}/></div></div>:<div className="mt-6 grid gap-4 sm:grid-cols-3">{[['starter','Starter'],['pro','Pro'],['team','Team']].map(([key,label])=>{const counts=(selectedChallenge==='annual'?d.annualCounts:d.monthlyCounts)||{};const count=Number(counts[key as keyof PlanCounts]||0);const next=selectedChallenge==='annual'?(count<2?2:count%2===0?count+2:count+1):(count%2===0?count+1:count+2);const reward=selectedChallenge==='annual'?(next===2||next%4===0?'1 free year':'6 free months'):'1 free month';return <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black">{label}</p><span className="rounded-full bg-[#1769E0]/10 px-2.5 py-1 text-xs font-black text-[#1769E0]">{reward}</span></div><p className="mt-3 text-3xl font-black">{count}<span className="text-sm text-slate-400"> / {next}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:Math.min(100,count/next*100)+'%'}}/></div><p className="mt-2 text-xs text-slate-500">{count>=next?'Reward unlocked':<>Referrals who actually subscribed to {label}; your own plan does not change this counter.</>}</p></div>})}</div>}

   <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">Challenges</p><h2 className="mt-2 text-2xl font-black">Choose your reward challenge</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Starter, Pro, and Team have separate counters. A real reward unlocks when any plan counter completes its milestone.</p></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[
      ['free','Free','10 qualified Free users → 1 free Starter month.',d.freeCount,d.nextFreeMilestone],
      ['monthly','Monthly','Three independent counters: Starter / Pro / Team. Completing any one counter unlocks its reward.',d.monthlyCount,d.nextMonthlyMilestone],
      ['annual','Annual','Three independent counters: Starter / Pro / Team.',d.qualifiedCount,d.nextMilestone]
    ].map(([id,title,rule,count,next])=>{const active=selectedChallenge===id;const complete=active&&activeChallengeCompleted;return <button key={String(id)} onClick={()=>{if(active)return;if(!activeChallengeCompleted)return;void selectChallenge(id as any)}} className={'rounded-2xl border p-4 text-left '+(active?'border-[#1769E0] bg-[#1769E0]/5':'border-slate-200')+(!active&&!complete?' cursor-not-allowed opacity-45':' hover:border-[#1769E0]/50')}><div className="flex items-start justify-between gap-2"><div><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{rule}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{id==='free'?count:(id==='monthly'?Object.values(d.monthlyCounts||{}).reduce((a,b)=>a+Number(b),0):Object.values(d.annualCounts||{}).reduce((a,b)=>a+Number(b),0))}{next!=null?' / '+next:''}</span></div>{id!=='free'&&<div className="mt-3 grid grid-cols-3 gap-2">{[['Starter',id==='monthly'?d.monthlyCounts?.starter:d.annualCounts?.starter],['Pro',id==='monthly'?d.monthlyCounts?.pro:d.annualCounts?.pro],['Team',id==='monthly'?d.monthlyCounts?.team:d.annualCounts?.team]].map(([name,value])=><div key={String(name)} className="rounded-xl bg-slate-50 p-2 text-center"><p className="text-[10px] font-bold text-slate-400">{name}</p><p className="mt-1 font-black">{Number(value||0)}</p></div>)}</div>}<p className="mt-3 text-xs font-black text-[#1769E0]">{active?(activeChallengeCompleted?'Completed':'Active'):(activeChallengeCompleted?'Choose next':'Finish active challenge first')}</p></button>})}</div>
   </section>
   <RewardRules/>
   <div className="mt-10 text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">How it works</p><h2 className="mt-2 text-2xl font-black">Three simple steps.</h2></div>
   <div className="mt-5 grid gap-4 sm:grid-cols-3">{[['1','Share','Send your referral link.'],['2','They qualify','They join and reach the required milestone.'],['3','You earn','Your reward appears here.']].map(([n,t,desc])=><div key={n} className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200"><div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#1769E0] text-sm font-black text-white">{n}</div><h3 className="mt-4 font-black">{t}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{desc}</p></div>)}</div>

   <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">Reward wallet</p><h2 className="mt-2 text-2xl font-black">Your rewards</h2></div><Gift className="text-[#1769E0]" size={22}/></div>
    {!wallet.length?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-black">No rewards yet.</p><p className="mt-1 text-sm text-slate-500">Your first reward will appear here automatically.</p></div>:
    <div className="mt-5 space-y-3">{wallet.map(r=>{const paid=r.billing_interval==='month'||r.billing_interval==='year';return <div key={r.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{rewardValue(r)}</p><p className="mt-1 text-xs text-slate-500">Milestone {r.milestone} · {r.plan} · {r.status}</p></div>{paid&&r.status!=='applied'&&<button disabled={!!busy} onClick={()=>void choose(r.id)} className="rounded-xl bg-[#0A1E3D] px-4 py-2.5 text-xs font-black text-white">{busy===r.id?<Loader2 className="mx-auto animate-spin" size={14}/>:<><Check size={13} className="mr-1 inline"/>Apply reward</>}</button>}</div></div>})}</div>}
   </div>
   {message&&<div className="mt-4 rounded-xl border border-[#1769E0]/15 bg-[#1769E0]/5 px-4 py-3 text-sm font-bold text-[#1769E0]">{message}</div>}
   <div className="py-10 text-center"><a href="/app" className="rounded-xl bg-[#1769E0] px-6 py-3.5 font-black text-white">Create a quote</a><p className="mt-3 text-xs text-slate-400">Rewards are for genuine referrals and are not cash.</p></div>
  </section>
 </main>;
}
