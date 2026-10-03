'use client';
import { useEffect, useState } from 'react';
import { Loader2, Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import QuvotoLogo from '@/components/QuvotoLogo';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage(){
  const [email,setEmail]=useState('');
  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') || '/dashboard' : '/dashboard';
  const authError = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('error') : null;
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState(''); const [legal,setLegal]=useState(false);
  const socialLogin=async(provider:'google'|'apple')=>{ setError(''); setMessage(''); if(!legal){setError('Please agree to the Terms of Service and acknowledge the Privacy Policy before continuing.');return;} setLoading(true); document.cookie='quvoto_legal_consent=2026-10-02; Max-Age=900; Path=/; SameSite=Lax'; const supabase=createClient(); const result=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin+'/auth/callback?next='+encodeURIComponent(next)}}); if(result.error){setError(result.error.message);setLoading(false);} };
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setMessage('');
    if(!legal){setError('Please agree to the Terms of Service and acknowledge the Privacy Policy before continuing.');return;}
    if(!email.trim())return;
    setLoading(true);
    document.cookie='quvoto_legal_consent=2026-10-02; Max-Age=900; Path=/; SameSite=Lax';
    const supabase=createClient();
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+'/auth/callback?next='+encodeURIComponent(next)}});
    if(error)setError(error.message);else setMessage('Check your email for your secure QUVOTO sign-in link.');
    setLoading(false);
  };
  useEffect(()=>{if(authError==='legal-required')setError('Please accept the Terms of Service and acknowledge the Privacy Policy before signing in.');else if(authError==='auth')setError('The sign-in link could not be completed. Please request a new one.');else if(authError==='consent-save')setError('We could not securely record your legal consent. Please try signing in again.');},[authError]);
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf3ff,transparent_42%),#f7faff] px-4 py-8 text-[#0A1E3D] sm:px-6 sm:py-12">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
      <div className="text-center">
        <a href="/" aria-label="QUVOTO home" className="inline-flex flex-col items-center">
          <QuvotoLogo className="h-20 w-20" stacked/>
        </a>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-[#1769E0]">Speak. Quote. Done.</p>
      </div>
      <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(10,30,61,.10)] sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1769E0]/10 text-[#1769E0]"><ShieldCheck size={21}/></div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#1769E0]">Secure sign in</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Welcome back</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Access your QUVOTO workspace with a secure one-time email link. No password to remember.</p>
        </div>
        <div className="mt-7">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={loading} onClick={()=>socialLogin('google')} className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg font-black text-[#4285F4]">G</span><span>Google</span></button>
            <button type="button" disabled={loading} onClick={()=>socialLogin('apple')} className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg font-black text-[#0A1E3D]">A</span><span>Apple</span></button>
          </div>
          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">or use email</span><div className="h-px flex-1 bg-slate-200"/>
          </div>
          <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">Work email
            <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 min-h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-[#1769E0] focus:bg-white focus:ring-4 focus:ring-[#1769E0]/10" placeholder="you@company.com"/>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-5 text-slate-600">
            <input type="checkbox" checked={legal} onChange={e=>setLegal(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1769E0]"/>
            <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[#1769E0] underline">Terms of Service</a> and acknowledge the <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#1769E0] underline">Privacy Policy</a>.</span>
          </label>
          <button disabled={loading} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1769E0] py-3.5 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#125bc4] disabled:opacity-60">
            {loading?<Loader2 className="animate-spin" size={18}/>:<><span>Email me a secure link</span><ArrowRight size={17}/></>}
          </button>
        </form>
        {message&&<p className="mt-4 rounded-2xl bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700">{message}</p>}
        {error&&<p className="mt-4 rounded-2xl bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</p>}
        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Your customer dashboard is available after sign-in, including Free accounts and paid plans.</p>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">© 2026 QUVOTO · Secure contractor quoting</p>
    </div>
  </main>;
}
