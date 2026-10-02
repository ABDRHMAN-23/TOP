'use client';

import { useState } from 'react';
import { Check, Loader2, Mail } from 'lucide-react';

export default function QuoteActions({ quoteId, clientEmail }: { quoteId:string; clientEmail?:string|null }) {
  const [status,setStatus]=useState('draft'); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const update=async(next:string)=>{
    setBusy(true);setMessage('');
    try{const r=await fetch('/api/quotes/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:quoteId,status:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update status.');setStatus(d.status);setMessage(next==='accepted'?'Accepted':'Status updated.');}catch(e){setMessage(e instanceof Error?e.message:'Could not update status.')}finally{setBusy(false)}
  };
  const send=async()=>{
    setBusy(true);setMessage('');
    try{const r=await fetch('/api/quotes/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:quoteId})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not send email.');setStatus('sent');setMessage('Quotation emailed to '+d.recipient+'.')}catch(e){setMessage(e instanceof Error?e.message:'Could not send email.')}finally{setBusy(false)}
  };
  return <div className="flex flex-wrap items-center gap-2">
    <button disabled={busy} onClick={()=>update('sent')} className="rounded-xl border border-[#1769E0]/20 bg-[#1769E0]/5 px-3 py-2 text-xs font-bold text-[#1769E0] disabled:opacity-50">Mark sent</button>
    {clientEmail && <button disabled={busy} onClick={send} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1769E0] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?<Loader2 size={14} className="animate-spin"/>:<Mail size={14}/>}Email</button>}
    <button disabled={busy} onClick={()=>update('accepted')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"><Check size={14}/>Accepted</button>
    {message && <span className="text-xs font-semibold text-slate-500">{message}</span>}
  </div>;
}
