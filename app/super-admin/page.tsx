import Link from 'next/link';
import {requireSuperAdmin} from '@/lib/super-admin';
import {ArrowRight,ShieldCheck} from 'lucide-react';

export default async function SuperAdminPage(){
 const {user}=await requireSuperAdmin();
 return <main className="min-h-screen bg-[#f7faff] text-[#0A1E3D]">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><div><p className="text-xs font-black tracking-[.2em] text-[#1769E0]">QUVOTO</p><h1 className="mt-1 text-xl font-black">Super Admin</h1></div><Link href="/" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Public site</Link></div></header>
  <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
   <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1769E0]/10 text-[#1769E0]"><ShieldCheck size={23}/></div><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#1769E0]">Private control area</p><h2 className="mt-2 text-3xl font-black">Welcome, Super Admin</h2><p className="mt-2 text-slate-500">{user?.email||'Authorized account'}</p><div className="mt-7"><Link href="/super-admin/discounts" className="inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 font-black text-white">Manage discounts <ArrowRight size={17}/></Link></div></div>
  </section>
 </main>;
}
