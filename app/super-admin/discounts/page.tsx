'use client';
import {useEffect,useState} from 'react';

type Discount=any;
export default function SuperAdminDiscounts(){
 const [rows,setRows]=useState<Discount[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({code:'',name:'',amountType:'percent',amount:'20',plans:['starter','pro','team'],intervals:['month','year'],duration:'once',durationMonths:'',maxRedemptions:'',maxRedemptionsPerUser:'1',startsAt:'',expiresAt:'',internalNote:''});
 const load=async()=>{const r=await fetch('/api/admin/discounts');const d=await r.json();if(!r.ok){setError(d.error||'Forbidden');return}setRows(d.discounts||[])};
 useEffect(()=>{load()},[]);
 const toggle=(key:'plans'|'intervals',value:string)=>setForm(f=>({...f,[key]:f[key].includes(value)?f[key].filter(x=>x!==value):[...f[key],value]}));
 const create=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/admin/discounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create discount');setRows(x=>[d.discount,...x]);setForm(f=>({...f,code:'',name:'',amount:'20',durationMonths:'',maxRedemptions:'',startsAt:'',expiresAt:'',internalNote:''}));}catch(e){setError(e instanceof Error?e.message:'Could not create discount')}finally{setBusy(false)}};
 const disable=async(id:string)=>{if(!confirm('Disable this discount code?'))return;const r=await fetch('/api/admin/discounts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const d=await r.json();if(!r.ok){setError(d.error||'Could not disable');return}setRows(x=>x.map(v=>v.id===id?{...v,active:false}:v))};
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950"><div className="mx-auto max-w-6xl"><div className="mb-8"><p className="text-xs font-bold tracking-[.2em] text-[#1769E0]">QUVOTO SUPER ADMIN</p><h1 className="mt-2 text-4xl font-black">Discounts</h1><p className="mt-2 text-slate-500">Create and disable server-controlled Lemon Squeezy discount codes.</p></div>
 <form onSubmit={create} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-sm md:grid-cols-2">
 {(['code','name','amount','durationMonths','maxRedemptions','maxRedemptionsPerUser','startsAt','expiresAt','internalNote'] as const).map(k=><input key={k} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={k} className="rounded-xl border p-3"/>)}
 <select value={form.amountType} onChange={e=>setForm(f=>({...f,amountType:e.target.value}))} className="rounded-xl border p-3"><option value="percent">Percent %</option><option value="fixed">Fixed USD</option></select>
 <select value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} className="rounded-xl border p-3"><option value="once">First payment only</option><option value="repeating">First X months</option><option value="forever">Forever</option></select>
 <div className="rounded-xl border p-3"><b>Plans</b><div className="mt-2 flex gap-3">{['starter','pro','team'].map(x=><label key={x}><input type="checkbox" checked={form.plans.includes(x)} onChange={()=>toggle('plans',x)}/> {x}</label>)}</div></div>
 <div className="rounded-xl border p-3"><b>Intervals</b><div className="mt-2 flex gap-3">{['month','year'].map(x=><label key={x}><input type="checkbox" checked={form.intervals.includes(x)} onChange={()=>toggle('intervals',x)}/> {x}</label>)}</div></div>
 <button disabled={busy} className="rounded-xl bg-[#1769E0] px-5 py-3 font-bold text-white md:col-span-2">{busy?'Creating…':'Create & Save Discount'}</button>
 </form>
 {error&&<p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
 <div className="mt-8 overflow-x-auto rounded-3xl border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Code</th><th>Discount</th><th>Plans</th><th>Interval</th><th>Used</th><th>Status</th><th/></tr></thead><tbody>{rows.map(d=><tr key={d.id} className="border-b last:border-0"><td className="p-4 font-black">{d.code}</td><td>{d.amount}{d.amount_type==='percent'?'%':' USD'} · {d.duration}</td><td>{d.applies_to_plans.join(', ')}</td><td>{d.applies_to_intervals.join(', ')}</td><td>{d.used_count}{d.max_redemptions?'/'+d.max_redemptions:''}</td><td>{d.active?'Active':'Disabled'}</td><td className="p-4">{d.active&&<button onClick={()=>disable(d.id)} className="rounded-lg border px-3 py-1.5 font-semibold">Disable</button>}</td></tr>)}</tbody></table></div>
 </div></main>
}
