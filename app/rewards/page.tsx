'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Gift, Users, Sparkles, Trophy, Lock, Zap, CalendarDays } from 'lucide-react';

export default function RewardsPage() {
  const [ref, setRef] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState<any>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [choiceMessage, setChoiceMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/referrals').then(async r => { if (r.ok) setRef(await r.json()); });
  }, []);

  useEffect(() => {
    const latest = ref?.rewards?.find((r:any)=>['earned','scheduled','applied'].includes(r.status));
    if (!latest || typeof window === 'undefined') return;
    const key = 'quvoto_last_seen_reward';
    if (window.localStorage.getItem(key) !== latest.id) {
      window.localStorage.setItem(key, latest.id);
      setCelebrate(latest);
    }
  }, [ref]);

  const chooseReward = async (id:string, interval:'month'|'year') => {
    setChoosing(id + ':' + interval);
    setChoiceMessage(null);
    try {
      const res = await fetch('/api/referrals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ rewardId:id, redemptionInterval:interval }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not save reward choice.');
      setChoiceMessage(data?.message || 'Reward choice saved.');
      const refreshed = await fetch('/api/referrals');
      if (refreshed.ok) setRef(await refreshed.json());
    } catch (e:any) { setChoiceMessage(e?.message || 'Could not save reward choice.'); }
    finally { setChoosing(null); }
  };

  const copy = async () => {
    if (!ref?.link) return;
    await navigator.clipboard?.writeText(ref.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const freeCount = Number(ref?.freeCount || 0);
  const freeNext = Number(ref?.nextFreeMilestone || 10);
  const freeProgress = Math.min(100, (freeCount / freeNext) * 100);
  const monthlyCount = Number(ref?.monthlyCount || 0);
  const monthlyNext = ref?.nextMonthlyMilestone || 1;
  const monthlyProgress = Math.min(100, (monthlyCount / monthlyNext) * 100);
  const annualCount = Number(ref?.qualifiedCount || 0);
  const annualNext = ref?.nextMilestone || 2;
  const annualProgress = Math.min(100, (annualCount / annualNext) * 100);
  const activeTrack = ref?.activeTrack || 'free';
  const activeCount = Number(ref?.activeCount || 0);
  const activeNext = Number(ref?.activeNext || 10);
  const activeReward = ref?.activeReward || '1 free Starter month';
  const badges = ref?.badges || [];
  const activeTitle = activeTrack === 'annual' ? 'Annual momentum' : activeTrack === 'monthly' ? 'Monthly momentum' : 'Free-user momentum';
  const circleProgress = Math.min(100, (activeCount / Math.max(1, activeNext)) * 100);
  const earnedRewards = (ref?.rewards || []).filter((r:any)=>['earned','scheduled','applied'].includes(r.status));
  const latestReward = earnedRewards[0];
  const selectableRewards = (ref?.rewards || []).filter((r:any)=>['earned','scheduled'].includes(r.status) && ['month','year'].includes(r.billing_interval));
  const walletRewards = (ref?.rewards || []).filter((r:any)=>['earned','scheduled','applied'].includes(r.status));
  const statusLabel = (status:string) => status==='earned' ? 'Unlocked' : status==='scheduled' ? 'Scheduled' : status==='applied' ? 'Applied' : 'Locked';
  const statusClass = (status:string) => status==='applied' ? 'bg-emerald-50 text-emerald-700' : status==='scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-[#1769E0]/10 text-[#1769E0]';
  const loyalty = ref?.loyalty || {level:'QUVOTO Starter',totalQualified:0,next:10,remaining:10,progress:0};

  return <main className="min-h-screen bg-white text-[#0A1E3D]">
    {celebrate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1E3D]/60 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1769E0] text-white shadow-lg"><Trophy size={30}/></div><p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[#1769E0]">Milestone unlocked</p><h2 className="mt-2 text-3xl font-black">You earned a reward.</h2><p className="mt-3 text-slate-500">Your referral progress just crossed a milestone. Keep going — the next unlock is already waiting.</p><div className="mt-5 rounded-2xl bg-[#1769E0]/5 p-4"><p className="font-black">{celebrate.reward_type==='free_year'?'1 free year':celebrate.reward_type==='free_6_months'?'6 free months':'1 free month'} · {celebrate.plan}</p><p className="mt-1 text-xs text-slate-500">Milestone {celebrate.milestone}</p></div><button onClick={()=>setCelebrate(null)} className="mt-6 w-full rounded-xl bg-[#1769E0] py-3.5 font-bold text-white">See my next milestone</button></div></div>}
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
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-[-.04em] sm:text-6xl">Share QUVOTO. Hit milestones. Unlock rewards.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">Every qualified referral moves your counter. Cross a milestone, unlock a reward, earn a badge, and immediately see what is waiting next.</p>
        {ref?.link && <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-white p-2 shadow-sm sm:flex-row"><div className="flex-1 truncate px-3 py-3 text-left text-sm font-semibold text-slate-600">{ref.link}</div><button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-bold text-white">{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy referral link'}</button></div>}
      </div>
    </section>

    <section className="mx-auto max-w-5xl px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="rounded-[2rem] border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">QUVOTO Loyalty</p><h2 className="mt-2 text-3xl font-black">{loyalty.level}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Your loyalty level grows from qualified referrals across all three tracks. It is a recognition system — it never changes your plan or billing.</p></div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-[#1769E0]/15 bg-[#1769E0]/5 text-center"><div><p className="text-xl font-black">{loyalty.totalQualified}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">qualified</p></div></div>
        </div>
        <div className="mt-6"><div className="flex justify-between text-xs font-black text-slate-500"><span>{loyalty.level}</span><span>{loyalty.next ? loyalty.next+' total' : 'Maximum level'}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1769E0]" style={{width:loyalty.progress+'%'}}/></div><p className="mt-2 text-xs font-semibold text-slate-400">{loyalty.next ? loyalty.remaining+' more qualified referrals to the next level.' : 'You have reached the current top loyalty level.'}</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-[#1769E0]">Starter</p><p className="mt-1 text-sm font-bold">0–9 qualified referrals</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-[#1769E0]">Builder</p><p className="mt-1 text-sm font-bold">10–24 qualified referrals</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-[#1769E0]">Champion → Legend</p><p className="mt-1 text-sm font-bold">25–49 → 50+ qualified referrals</p></div></div>
      </div>
    </section>


      <div className="rounded-[2rem] border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Reward Wallet</p><h2 className="mt-2 text-3xl font-black">You choose how to use it.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Each unlocked paid reward is yours to direct. Choose Monthly or Annual for this reward — your next unlocked reward can go the other way.</p></div>
          {choiceMessage && <div className="rounded-xl bg-[#1769E0]/5 px-4 py-3 text-sm font-bold text-[#1769E0]">{choiceMessage}</div>}
        </div>
        {walletRewards.length ? <div className="mt-6 space-y-4">{walletRewards.map((r:any)=>{
          const value=r.reward_type==='free_year'?'1 free year':r.reward_type==='free_6_months'?'6 free months':'1 free month';
          const paid=['month','year'].includes(r.billing_interval);
          return <div key={r.id} className="rounded-2xl border bg-slate-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769E0] shadow-sm"><Gift size={20}/></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-[#1769E0]">{r.status==='applied'?'Reward used':'Reward'}</p><span className={'rounded-full px-2.5 py-1 text-[10px] font-black '+statusClass(r.status)}>{statusLabel(r.status)}</span></div><h3 className="mt-1 text-xl font-black">{value}</h3><p className="mt-1 text-xs text-slate-500">Milestone {r.milestone} · {r.plan} · Earned {r.earned_at ? new Date(r.earned_at).toLocaleDateString() : '—'}</p></div></div>
              <div className="text-left sm:text-right"><p className="text-xs font-bold text-slate-400">Redemption</p><p className="mt-1 text-sm font-black">{r.redemption_interval ? (r.redemption_interval==='year'?'Annual':'Monthly') : paid ? 'Choose track' : 'Starter month'}</p></div>
            </div>
            {r.status==='scheduled' && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-600">Scheduled for <b>{r.redemption_interval==='year'?'Annual':'Monthly'}</b>. You can still switch the track before it is applied.</p>}
            {r.status==='applied' && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Applied {r.applied_at ? new Date(r.applied_at).toLocaleDateString() : 'to your plan'}.</p>}
            {r.status==='earned' && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-600">{paid ? 'Unlocked — choose Monthly or Annual when you are ready.' : 'Unlocked — your Starter reward is ready.'}</p>}
            {paid && r.status!=='applied' && <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={()=>chooseReward(r.id,'month')} disabled={!!choosing} className={'rounded-xl border px-3 py-3 text-sm font-black disabled:opacity-50 '+(r.redemption_interval==='month'?'border-[#1769E0] bg-[#1769E0]/5 text-[#1769E0]':'bg-white hover:border-[#1769E0]')}><span className="flex items-center justify-center gap-2"><Zap size={15}/> Monthly</span><span className="mt-1 block text-[10px] font-semibold text-slate-400">{r.redemption_interval==='month'?'Selected':'Choose / switch'}</span></button>
              <button onClick={()=>chooseReward(r.id,'year')} disabled={!!choosing} className={'rounded-xl border px-3 py-3 text-sm font-black disabled:opacity-50 '+(r.redemption_interval==='year'?'border-[#0A1E3D] bg-[#0A1E3D] text-white':'bg-[#0A1E3D] text-white')}><span className="flex items-center justify-center gap-2"><CalendarDays size={15}/> Annual</span><span className="mt-1 block text-[10px] font-semibold text-slate-300">{r.redemption_interval==='year'?'Selected':'Choose / switch'}</span></button>
            </div>}
          </div>
        })}</div> : <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-black">No rewards unlocked yet.</p><p className="mt-1 text-sm text-slate-500">Your wallet will show every reward from the moment it is unlocked through the moment it is applied.</p></div>}
      </div>
    </section>

    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-6 rounded-[2rem] border border-[#1769E0]/15 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">All reward tracks</p>
            <h2 className="mt-2 text-3xl font-black">Three counters. Running at the same time.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Free, Monthly, and Annual referrals are tracked independently. Completing one track never resets or locks the others.</p>
          </div>
          <div className="rounded-full bg-[#1769E0]/5 px-4 py-2 text-xs font-black text-[#1769E0]">Earn → Unlock → Choose → Repeat</div>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          <TrackCounter icon={<Users size={20}/>} title="Free users" count={freeCount} next={freeNext} progress={freeProgress} reward="1 free Starter month" tone="blue" />
          <TrackCounter icon={<Gift size={20}/>} title="Monthly referrals" count={monthlyCount} next={monthlyNext || 1} progress={monthlyProgress} reward="1 free month" tone="navy" disabled={!ref?.plan} />
          <TrackCounter icon={<CalendarDays size={20}/>} title="Annual referrals" count={annualCount} next={annualNext || 2} progress={annualProgress} reward={annualNext===2?'1 free year':annualNext===4?'6 free months':annualNext && (annualNext-8)%6===0 && annualNext>=8?'1 free year':annualNext && (annualNext-10)%6===0 && annualNext>=10?'6 free months':'Next annual reward'} tone="blue" disabled={!ref?.plan} />
        </div>

        <div className="mt-5 rounded-2xl bg-[#0A1E3D] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-200">How it works</p>
            <p className="mt-1 font-black">A milestone unlocks a reward — it does not automatically change your billing.</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">For paid rewards, open your Reward Wallet and choose Monthly or Annual. Your counters keep progressing separately.</p>
          </div>
          <div className="mt-4 shrink-0 rounded-xl bg-white/10 px-4 py-3 text-xs font-black sm:mt-0">No track is permanently selected.</div>
        </div>
      </div>

      <div className="mb-8 rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Referral activity</p><h2 className="mt-2 text-2xl font-black">Watch your network move.</h2><p className="mt-1 text-sm text-slate-500">Every meaningful qualification appears here automatically.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">{ref?.timeline?.length || 0} recent events</span></div>
        {(ref?.timeline?.length || 0) > 0 ? <div className="mt-6 space-y-1">{ref.timeline.map((e:any)=><div key={e.id} className="relative flex gap-4 rounded-2xl p-3 hover:bg-slate-50"><div className="relative flex w-9 shrink-0 justify-center"><div className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#1769E0]/10 text-[#1769E0]">{e.type==='annual'?<CalendarDays size={16}/>:e.type==='monthly'?<Gift size={16}/>:e.type==='free'?<Users size={16}/>:<Sparkles size={16}/>}</div></div><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="font-black">{e.title}</p><time className="text-[11px] font-semibold text-slate-400">{e.at ? new Date(e.at).toLocaleDateString() : ''}</time></div><p className="mt-1 text-sm leading-5 text-slate-500">{e.detail}</p></div></div>)}</div> : <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-black">Your referral activity will appear here.</p><p className="mt-1 text-sm text-slate-500">Share your link and the timeline will fill automatically as people join and qualify.</p></div>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <RewardCard
          icon={<Users size={23}/>}
          eyebrow="Free User Reward"
          title="10 active Free users = 1 free Starter month"
          text="A genuinely new user must join through your link and create their first real quote while staying on Free."
          count={freeCount}
          next={freeNext}
          progress={freeProgress}
          label="Qualified Free users"
          accent="blue"
        />
        <RewardCard
          icon={<Gift size={23}/>}
          eyebrow="Monthly Referral Reward"
          title="1 paid referral, then every 3 more = 1 free month"
          text="Same-plan monthly referrals only. 1 qualified referral earns 1 free month; then another month at 4, 7, 10, 13…"
          count={monthlyCount}
          next={monthlyNext}
          progress={monthlyProgress}
          label="Qualified monthly referrals"
          accent="blue"
        />
        <RewardCard
          icon={<Sparkles size={23}/>}
          eyebrow="Annual Referral Reward"
          title="Annual referrals unlock bigger rewards"
          text="Same-plan annual referrals only. 2 = 1 free year; 4 total = 6 months; 8 = 1 year; 10 = 6 months; 14 = 1 year, then the pattern continues."
          count={annualCount}
          next={annualNext}
          progress={annualProgress}
          label="Qualified annual referrals"
          accent="navy"
        />
      </div>

      <div className="mt-8 rounded-3xl border bg-slate-50 p-6 sm:p-8"><div><div className="flex items-center gap-3"><Trophy className="text-[#1769E0]" size={24}/><div><p className="text-xs font-black uppercase tracking-widest text-[#1769E0]">Milestone badges</p><h2 className="text-2xl font-black">Make every referral feel like progress.</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{badges.map((b:any)=><div key={b.id} className={'rounded-2xl border bg-white p-4 '+(b.unlocked?'border-[#1769E0]/25':'opacity-65')}><div className="flex items-center justify-between"><div className={'flex h-10 w-10 items-center justify-center rounded-xl '+(b.unlocked?'bg-[#1769E0] text-white':'bg-slate-100 text-slate-400')}>{b.unlocked?<Trophy size={18}/>:<Lock size={16}/>}</div><span>{b.icon}</span></div><p className="mt-3 font-black">{b.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{b.description}</p><p className={'mt-2 text-[10px] font-black '+(b.unlocked?'text-[#1769E0]':'text-slate-400')}>{b.unlocked?'UNLOCKED':'KEEP GOING'}</p></div>)}</div></div>
        <h2 className="text-2xl font-black">How the rewards work</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['01','Free users','Every 10 qualified Free users earns 1 free Starter month.'],
            ['02','Monthly plans','1 same-plan paid monthly referral earns 1 free month; then every 3 additional referrals.'],
            ['03','Annual plans','2 same-plan paid annual referrals earn 1 free year, followed by the agreed 6-month/1-year cycle.']
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
