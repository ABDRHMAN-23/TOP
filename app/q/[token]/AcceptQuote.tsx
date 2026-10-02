'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

export default function AcceptQuote({ token, initialStatus }: { token:string; initialStatus:string }) {
  const [status,setStatus]=useState(initialStatus); const [busy,setBusy]=useState(false);
  if(status==='accepted') return <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">✓ Quote accepted</div>;
  return <button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/quotes/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not accept quote.');setStatus(d.status)}catch(e){alert(e instanceof Error?e.message:'Could not accept quote.')}finally{setBusy(false)}}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>}Accept quotation</button>;
}
