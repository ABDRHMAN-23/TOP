'use client';

import { FileText, ArrowRight, CheckCircle2, Clock3, BellRing, BriefcaseBusiness } from 'lucide-react';

export default function DailyBrief({quotes,followups=[],jobs=[]}:{quotes:any[];followups?:any[];jobs?:any[]}){
  const drafts=quotes.filter(x=>x.status==='draft');
  const sent=quotes.filter(x=>x.status==='sent');
  const viewed=quotes.filter(x=>x.status==='viewed');
  const accepted=quotes.filter(x=>x.status==='accepted');
  const now=Date.now();
  const dueFollowups=followups.filter(x=>x.status==='pending' && new Date(x.scheduled_for).getTime()<=now);
  const upcomingFollowups=followups.filter(x=>x.status==='pending' && new Date(x.scheduled_for).getTime()>now).sort((a,b)=>new Date(a.scheduled_for).getTime()-new Date(b.scheduled_for).getTime());
  const items=[
    ...drafts.slice(0,3).map(x=>({id:'draft-'+x.id,title:'Quote '+x.quote_number+' is still a draft',subtitle:(x.client_name||'No client name')+' · Continue when ready',href:'/workspace',kind:'draft'})),
    ...sent.slice(0,2).map(x=>({id:'sent-'+x.id,title:'Quote '+x.quote_number+' is waiting for a response',subtitle:(x.client_name||'Client')+' · Sent and not yet viewed',href:'/workspace',kind:'sent'})),
    ...viewed.slice(0,2).map(x=>({id:'viewed-'+x.id,title:'Quote '+x.quote_number+' was viewed',subtitle:(x.client_name||'Client')+' · They opened your quote',href:'/workspace',kind:'viewed'})),
    ...accepted.slice(0,1).map(x=>({id:'accepted-'+x.id,title:'Quote '+x.quote_number+' was accepted',subtitle:(x.client_name||'Client')+' · Nice work — it was accepted',href:'/workspace',kind:'accepted'})),
    ...dueFollowups.slice(0,3).map(x=>({id:'followup-due-'+x.id,title:'Follow-up is due',subtitle:(x.quotes?.quote_number||'Quote')+' · '+(x.quotes?.client_name||'Client')+' · '+(x.note||'Follow up with the client'),href:'/workspace',kind:'followup'})),
    ...upcomingFollowups.slice(0,2).map(x=>({id:'followup-upcoming-'+x.id,title:'Follow-up coming up',subtitle:(x.quotes?.quote_number||'Quote')+' · '+new Date(x.scheduled_for).toLocaleString(),href:'/workspace',kind:'followup'}))
  ];

  return <section className="mt-6 sm:mt-8">
    <div className="rounded-[1.5rem] border border-[#1769E0]/15 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#1769E0]"><Clock3 size={18}/><span className="text-xs font-black uppercase tracking-[0.16em]">QUVOTO Brief</span></div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Here’s what needs your attention.</h2>
          <p className="mt-1 text-sm text-slate-500">{items.length ? items.length+' item'+(items.length===1?'':'s')+' from your real QUVOTO work data.' : 'Nothing needs your attention right now.'}</p>
        </div>
        <a href="/workspace" className="inline-flex items-center gap-1.5 text-sm font-black text-[#1769E0]">Open workspace <ArrowRight size={15}/></a>
      </div>

      {items.length>0 ? <div className="mt-5 space-y-2">{items.map(item=><a key={item.id} href={item.href} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5 hover:border-[#1769E0]/25 hover:bg-[#1769E0]/[0.03]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]">{item.kind==='accepted'?<CheckCircle2 size={17}/>:item.kind==='followup'?<BellRing size={17}/>:<FileText size={17}/>}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#0A1E3D]">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span></span>
        <ArrowRight size={15} className="shrink-0 text-slate-300"/>
      </a>)}</div> : <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">You’re all caught up. Nice work. 👏</div>}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Drafts</p><p className="mt-1 text-xl font-black">{drafts.length}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Awaiting</p><p className="mt-1 text-xl font-black">{sent.length}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Viewed</p><p className="mt-1 text-xl font-black">{viewed.length}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Accepted</p><p className="mt-1 text-xl font-black">{accepted.length}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Due</p><p className="mt-1 text-xl font-black">{dueFollowups.length}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Jobs</p><p className="mt-1 text-xl font-black">{jobs.length}</p></div>
      </div>
    </div>
  </section>
}
