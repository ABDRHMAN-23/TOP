'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Stethoscope, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { LanguageButton, Localized } from '../i18n';

export default function SignInPage() {
  const router = useRouter();
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError('خدمة الحسابات غير مهيأة. تحقق من إعداد اتصال Supabase.'); setBusy(false); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) { setError('تعذر تسجيل الدخول. تحقق من بيانات الوصول أو اطلب من مسؤول العيادة تفعيل الحساب.'); setBusy(false); return; }
    router.replace('/'); router.refresh();
  }
  return <Localized><main className="auth-page"><section className="auth-card"><LanguageButton/><div className="auth-brand"><div className="brand-symbol"><Stethoscope size={23}/></div><div><strong>سِنان</strong><span>مساحة العمل السريرية للأسنان</span></div></div><div className="auth-eyebrow">دخول آمن للعيادة</div><h1>مرحباً بعودتك</h1><p className="auth-sub">سجّل الدخول إلى مساحة العمل الخاصة بعيادتك.</p><form onSubmit={submit}><label className="form-field">البريد الإلكتروني<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@clinic.com" required/></label><label className="form-field">كلمة المرور<div className="password-field"><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="أدخل كلمة المرور" required minLength={6}/><button type="button" aria-label={showPassword?'إخفاء كلمة المرور':'عرض كلمة المرور'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<div className="inline-error"><AlertCircle size={16}/>{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy?'جارٍ تسجيل الدخول...':'تسجيل الدخول'}</button></form><div className="auth-note"><ShieldCheck size={17}/><span>الوصول إلى بيانات المرضى مقيد بعضوية العيادة وصلاحيات الحساب. لا يوجد تسجيل عام للحسابات.</span></div><div className="auth-switch-line"><span>ليس لديك حساب بعد؟</span><a href="/sign-up">إنشاء حساب طبيب أو مدير عيادة</a></div><a className="auth-back" href="/">العودة إلى مساحة العمل</a></section></main></Localized>;
}
