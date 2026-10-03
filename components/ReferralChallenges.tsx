'use client';

import { useEffect, useState } from 'react';

type Props = {
  freeCount:number;
  freeNext:number;
  monthlyCount:number;
  monthlyNext:number|null;
  annualCount:number;
  annualNext:number|null;
};

export default function ReferralChallenges({freeCount,freeNext,monthlyCount,monthlyNext,annualCount,annualNext}:Props){
  const [selected,setSelected]=useState('free');
  useEffect(()=>{const v=window.localStorage.getItem('quvoto_challenge');if(v)setSelected(v)},[]);
  const items=[
    {id:'free',title:'Free Challenge',count:freeCount,next:freeNext,reward:'1 free Starter month',rule:'10 qualified Free users'},
    {id:'monthly',title:'Monthly Challenge',count:monthlyCount,next:monthlyNext,reward:'1 free month',rule:'1 first referral, then every 2 new same-plan referrals'},
    {id:'annual',title:'Annual Challenge',count:annualCount,next:annualNext,reward:annualNext===2?'1 free year':annualNext&&annualNext%4===0?'1 free year':'6 free months',rule:'First 2 = 1 year; each 2 after = 6 months; each 4-referral cycle = 1 year'}
  ];
  const current=items.find(x=>x.id===selected)??items[0];
  const complete=current.next!==null&&current.count>=current.next;
  const choose=(id:string)=>{if(id!==selected&&!complete)return;setSelected(id);window.localStorage.setItem('quvoto_challenge',id)};
  return <section className="mt-8 rounded-[2rem] border border-[#1769E0]/15 bg-white p-5 shadow-sm sm:p-7">
    <div className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#1769E0]">Challenges</p><h2 className="mt-2 text-2xl font-black">Choose a challenge</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Complete the active challenge to unlock the next choice. Each challenge keeps its own real referral progress.</p></div>
    <div className="mt-5 grid gap-3">
      {items.map(x=>{const active=x.id===selected;const locked=!active&&!complete;return <button key={x.id} disabled={locked} onClick={()=>choose(x.id)} className={'rounded-2xl border p-4 text-left transition '+(active?'border-[#1769E0] bg-[#1769E0]/5':'border-slate-200')+(locked?' cursor-not-allowed opacity-45':' hover:border-[#1769E0]/50')}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-black">{x.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{x.rule}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black">{x.count}{x.next!==null?' / '+x.next:''}</span></div>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-black text-[#1769E0]">{x.reward}</span><span className="text-xs font-bold text-slate-400">{active?(complete?'Completed · choose another':'Active'):(locked?'Finish active challenge first':'Choose')}</span></div>
      </button>})}
    </div>
  </section>;
}