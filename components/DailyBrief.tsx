 'use client';

import { useMemo } from 'react';
import { CalendarDays, Clock3, FileText, Receipt, BriefcaseBusiness, ArrowRight } from 'lucide-react';

type Item={id:string;title:string;subtitle?:string;href:string;time?:string;kind:'followup'|'invoice'|'quote'|'job'};

function localDateKey(d:Date){return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function fmtTime(value:string){return new Date(value).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}

export default function DailyBrief({followups,invoices,quotes,jobs}:{followups:any[];invoices:any[];quotes:any[];jobs:any[]}){
  const today=useMemo(()=>localDateKey(new Date()),[]);
  const todayFollowups=followups.filter(x=>localDateKey(new Date(x.scheduled_for))===today && x.status==='pending');
  const todayInvoices=invoices.filter(x=>x.due_date && localDateKey(new Date(x.due_date+'T00:00:00'))===today && x.status!=='paid');
  const overdueInvoices=invoices.filter(x=>x.due_date && new Date(x.due_date+'T23:59:59')<new Date() && x.status!=='paid');
  const drafts=quotes.filter(x=>x.status==='draft').slice(0,3);
  const openJobs=jobs.filter(x=>x.status==='open').slice(0,3);

  const items:Item[]=[
    ...todayFollowups.map(x=>({id:'f'+x.id,title:'Follow up with '+(x.client_name||'a client'),subtitle:x.note||'Scheduled follow-up',href:'/followups',time:fmtTime(x.scheduled_for),kind:'followup' as const})),
    ...todayInvoices.map(x=>({id:'i'+x.id,title:'Invoice '+x.invoice_number+' is due',subtitle:(x.currency||'')+' '+Number(x.amount||0).toFixed(2),href:'/invoices',kind:'invoice' as const})),
    ...overdueInvoices.slice(0,2).map(x=>({id:'o'+x.id,title:'Invoice '+x.invoice_number+' is overdue',subtitle:(x.currency||'')+' '+Number(x.amount||0).toFixed(2),href:'/invoices',kind:'invoice' as const}))
  ];

  const icon=(kind:Item['kind'])=>kind==='followup'?<Clock3 size={17}/>:kind==='invoice'?<Receipt size={17}/>:kind==='job'?<BriefcaseBusiness size={17}/>:<FileText size={17}/>;

  return <section className="mt-6 sm:mt-8">
    <div className="rounded-[1.5rem] border border-[#1769E0]/15 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#1769E0]"><CalendarDays size={18}/><span className="text-xs font-black uppercase tracking-[0.16em]">Today</span></div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Here’s what needs your attention.</h2>
          <p className="mt-1 text-sm text-slate-500">{items.length ? items.length+' item'+(items.length===1?'':'s')+' from your real QUVOTO data.' : 'Nothing urgent is scheduled for today.'}</p>
        </div>
        <a href="/workspace" className="inline-flex items-center gap-1.5 text-sm font-black text-[#1769E0]">Open workspace <ArrowRight size={15}/></a>
      </div>

      {items.length>0&&<div className="mt-5 space-y-2">{items.map(item=><a key={item.id} href={item.href} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5 hover:border-[#1769E0]/25 hover:bg-[#1769E0]/[0.03]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1769E0]/10 text-[#1769E0]">{icon(item.kind)}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#0A1E3D]">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span></span>
        {item.time&&<span className="shrink-0 text-xs font-black text-slate-500">{item.time}</span>}
        <ArrowRight size={15} className="shrink-0 text-slate-300"/>
      </a>)}</div>}

      {(drafts.length>0||openJobs.length>0)&&<div className="mt-5 grid gap-3 sm:grid-cols-2">
        {drafts.length>0&&<a href="/workspace" className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Quotes to finish</p><p className="mt-1 text-xl font-black">{drafts.length}</p><p className="mt-1 text-xs text-slate-500">Draft quotes are waiting in your workspace.</p></a>}
        {openJobs.length>0&&<a href="/jobs" className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Open jobs</p><p className="mt-1 text-xl font-black">{openJobs.length}</p><p className="mt-1 text-xs text-slate-500">Jobs already in QUVOTO that are still open.</p></a>}
      </div>}
    </div>
  </section>
}
