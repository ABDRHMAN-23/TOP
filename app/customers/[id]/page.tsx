import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export default async function CustomerPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)notFound();
 const {data:c}=await s.from('customers').select('*').eq('id',id).eq('user_id',user.id).maybeSingle(); if(!c)notFound();
 const [{data:quotes},{data:jobs}]=await Promise.all([
  s.from('quotes').select('id,quote_number,total,currency,status,created_at,public_token').eq('customer_id',id).order('created_at',{ascending:false}),
  s.from('jobs').select('id,title,status,created_at').eq('customer_id',id).order('created_at',{ascending:false})
 ]);
 const quoteIds=(quotes||[]).map(q=>q.id);
 const {data:invoices}=quoteIds.length?await s.from('invoices').select('id,invoice_number,amount,currency,status,created_at,quote_id').in('quote_id',quoteIds).order('created_at',{ascending:false}):{data:[]};
 return <main className="min-h-screen bg-[#f7faff]"><header className="border-b bg-white"><div className="mx-auto max-w-5xl px-5 py-4"><a href="/workspace" className="font-black text-[#0A1E3D]">← Workspace</a></div></header>
 <section className="mx-auto max-w-5xl px-5 py-8"><p className="text-sm font-bold text-[#1769E0]">CUSTOMER</p><h1 className="mt-1 text-4xl font-black">{c.name}</h1><p className="mt-2 text-slate-500">{c.email||''} {c.phone?'· '+c.phone:''}</p>
 <div className="mt-7 grid gap-5 lg:grid-cols-3"><History title="Quotes">{(quotes||[]).map(q=><a key={q.id} href={'/q/'+q.public_token} className="block rounded-xl border p-3"><b>{q.quote_number}</b><p className="text-xs text-slate-500">{q.status} · {q.currency} {Number(q.total).toFixed(2)}</p></a>)}</History><History title="Jobs">{(jobs||[]).map(j=><div key={j.id} className="rounded-xl border p-3"><b>{j.title}</b><p className="text-xs text-slate-500">{j.status}</p></div>)}</History><History title="Invoices">{(invoices||[]).map(i=><div key={i.id} className="rounded-xl border p-3"><b>{i.invoice_number}</b><p className="text-xs text-slate-500">{i.status} · {i.currency} {Number(i.amount).toFixed(2)}</p></div>)}</History></div></section></main>
}
function History({title,children}:{title:string;children:any}){return <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">{title}</h2><div className="mt-3 space-y-2">{children}</div></div>}