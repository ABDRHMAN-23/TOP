'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import SinanMark from '@/components/SinanMark';

export default function SignInPage() {
  const router = useRouter();
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError('لم يتم إعداد Supabase بعد. أضف قيم NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY إلى متغيرات البيئة.'); setBusy(false); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) { setError('تعذر تسجيل الدخول. تحقق من بيانات الوصول أو اطلب من مسؤول العيادة تفعيل الحساب.'); setBusy(false); return; }
    router.replace('/'); router.refresh();
  }
  return <main className="auth-page auth-page-sinan"><section className="auth-card auth-card-sinan"><div className="auth-brand"><div className="brand-symbol"><SinanMark className="sinan-mark" /></div><div><strong>سِنان</strong><span>مساحة العمل السريرية للأسنان</span></div></div><div className="auth-eyebrow">دخول آمن للعيادة</div><h1>مرحباً بعودتك</h1><p className="auth-sub">سجّل الدخول إلى مساحة العمل الخاصة بعيادتك.</p><form onSubmit={submit}><label className="form-field">البريد الإلكتروني<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@clinic.com" required/></label><label className="form-field">كلمة المرور<div className="password-field"><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="أدخل كلمة المرور" required minLength={6}/><button type="button" aria-label={showPassword?'إخفاء كلمة المرور':'عرض كلمة المرور'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<div className="inline-error"><AlertCircle size={16}/>{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy?'جارٍ تسجيل الدخول...':'تسجيل الدخول'}</button></form><div className="auth-note"><ShieldCheck size={17}/><span>الوصول إلى بيانات المرضى مقيد بعضوية العيادة وصلاحيات الحساب. لا يوجد تسجيل عام للحسابات.</span></div><a className="auth-back" href="/">العودة إلى العرض التجريبي</a></section><aside className="auth-visual" aria-label="مبادئ مساحة العمل السريرية">
  <div className="auth-visual-top"><span className="auth-visual-symbol"><SinanMark className="sinan-mark" /></span><div><strong>سِنان</strong><span>مساحة العمل السريرية للأسنان</span></div><span className="auth-visual-chip"><ShieldCheck size={14}/> مراجعة الطبيب أساس السجل</span></div>
  <div className="auth-visual-copy"><div className="auth-visual-eyebrow">DENTAL CLINICAL WORKSPACE <span>·</span> 01</div><h2>زيارة أكثر وضوحًا،<br/><em>وسجلّ يُراجع بثقة.</em></h2><p>رتّب ما يذكره المريض، وما يلاحظه الطبيب، وما يحتاج إلى مراجعة — في مساحة واحدة هادئة.</p><div className="auth-visual-track"><div className="auth-track-item"><span>01</span><div><strong>الإنصات والتوثيق</strong><small>احتفظ بمصدر المعلومة</small></div></div><div className="auth-track-item"><span>02</span><div><strong>مراجعة سريرية</strong><small>وضّح المعلوم وما لم يُحسم</small></div></div><div className="auth-track-item"><span>03</span><div><strong>اعتماد الطبيب</strong><small>السجل النهائي بقرار مخوّل</small></div></div></div></div>
  <div className="auth-visual-foot"><ShieldCheck size={17}/><span>تصميم يوضّح الحالة ولا يستبدل القرار السريري.</span><i>SN</i></div>
</aside></main>;
}
