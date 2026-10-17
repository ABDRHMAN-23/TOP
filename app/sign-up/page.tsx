'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LanguageButton, Localized } from '../i18n';

export default function SignUpPage() {
  const router=useRouter();
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [confirmationEmail,setConfirmationEmail]=useState('');

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');
    if(fullName.trim().length<2){setError('أدخل اسمك الكامل.');return;}
    if(password.length<10){setError('استخدم كلمة مرور لا تقل عن 10 أحرف.');return;}
    if(password!==confirmPassword){setError('كلمتا المرور غير متطابقتين.');return;}
    setBusy(true);
    try {
      const supabase=createSupabaseBrowserClient();
      if(!supabase)throw new Error('خدمة الحسابات غير مهيأة. تحقق من إعداد اتصال Supabase.');
      const redirectTo=new URL('/auth/callback?next=%2Fonboarding',window.location.origin).toString();
      const {data,error:signUpError}=await supabase.auth.signUp({
        email:email.trim(),
        password,
        options:{emailRedirectTo:redirectTo,data:{full_name:fullName.trim(),account_type:'clinic_owner'}},
      });
      if(signUpError) {
        const details = `${signUpError.code || ''} ${signUpError.message || ''}`.toLowerCase();
        if(details.includes('already registered') || details.includes('user_already_exists')) throw new Error('هذا البريد مسجل بالفعل. سجّل الدخول بدلاً من إنشاء حساب جديد.');
        if(details.includes('email address not authorized') || details.includes('email_not_authorized')) throw new Error('Supabase رفض إرسال رسالة التأكيد إلى هذا البريد. فعّل SMTP مخصصاً في Supabase Auth؛ خدمة البريد الافتراضية لا ترسل إلى كل العناوين.');
        if(details.includes('redirect') && (details.includes('not allowed') || details.includes('allow list') || details.includes('whitelist'))) throw new Error('عنوان العودة بعد تأكيد البريد غير مسموح في Supabase. أضف عنوان الموقع المنشور ضمن Authentication ← URL Configuration.');
        if(details.includes('signup') && (details.includes('disabled') || details.includes('not allowed'))) throw new Error('التسجيل الجديد معطّل في إعدادات Supabase Auth. فعّل Allow new users to sign up.');
        if(details.includes('rate limit') || details.includes('email rate limit')) throw new Error('وصلت خدمة البريد إلى حد الإرسال المؤقت في Supabase. انتظر قبل المحاولة مجدداً أو اضبط SMTP مخصصاً.');
        if(details.includes('password') && (details.includes('weak') || details.includes('length'))) throw new Error('كلمة المرور لا تحقق متطلبات الأمان في Supabase. استخدم كلمة مرور أطول وأقوى.');
        throw new Error('تعذر إنشاء الحساب في Supabase. تحقق من إعدادات البريد الإلكتروني وعنوان العودة المسموح به، ثم حاول مجدداً.');
      }
      if(data.session){
        router.replace('/onboarding');
        router.refresh();
        return;
      }
      setConfirmationEmail(email.trim());
    } catch(err) {
      setError(err instanceof Error?err.message:'تعذر إنشاء الحساب حالياً.');
    } finally {setBusy(false);}
  }

  if(confirmationEmail) return <Localized><main className="auth-page"><section className="auth-card"><LanguageButton/><div className="auth-brand"><div className="brand-symbol"><MailCheck size={23}/></div><div><strong>سِنان</strong><span>تأكيد البريد الإلكتروني</span></div></div><div className="auth-success-mark"><MailCheck size={27}/></div><div className="auth-eyebrow">خطوة التحقق</div><h1>تحقق من بريدك الإلكتروني</h1><p className="auth-sub">أرسلنا رابط تأكيد إلى <strong dir="ltr">{confirmationEmail}</strong>. افتح الرسالة وأكّد البريد للانتقال إلى إعداد عيادتك. قد تصل الرسالة إلى مجلد البريد غير المرغوب فيه.</p><div className="auth-note"><ShieldCheck size={17}/><span>لن تُنشأ مساحة العيادة حتى تؤكد حسابك وتدخل إليه. لا ترسل كلمة المرور لأي شخص.</span></div><a className="primary-button auth-submit auth-link-button" href="/sign-in">العودة إلى تسجيل الدخول</a><a className="auth-back" href="/">العودة إلى الصفحة الرئيسية</a></section></main></Localized>;

  return <Localized><main className="auth-page"><section className="auth-card signup-card"><LanguageButton/><div className="auth-brand"><div className="brand-symbol brand-symbol-image"><img src="/sinan-icon.webp" alt="" width={44} height={44} className="brand-logo-image" /></div><div><strong>سِنان</strong><span>مساحة العمل السريرية للأسنان</span></div></div><div className="auth-eyebrow">ابدأ مساحة عيادتك</div><h1>إنشاء حساب طبيب أو مدير عيادة</h1><p className="auth-sub">أنشئ حسابك بالبريد الإلكتروني، ثم أكّد البريد وأضف بيانات عيادتك وساعات العمل.</p><form onSubmit={submit}><label className="form-field">الاسم الكامل<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={160} required placeholder="اسم الطبيب أو مدير العيادة"/></label><label className="form-field">البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required placeholder="name@clinic.com"/></label><label className="form-field">كلمة المرور<div className="password-field"><input type={showPassword?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="10 أحرف على الأقل"/><button type="button" aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'} onClick={()=>setShowPassword(current=>!current)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><label className="form-field">تأكيد كلمة المرور<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="أعد كتابة كلمة المرور"/></label>{error&&<div className="inline-error" role="alert"><AlertCircle size={16}/>{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy?<LockKeyhole size={16}/>:<UserRoundPlus size={16}/>} {busy?'جارٍ إنشاء الحساب...':'إنشاء الحساب والمتابعة'}</button></form><div className="auth-note"><ShieldCheck size={17}/><span>يتطلب الحساب تأكيد البريد الإلكتروني عند تفعيل التحقق. لا نطلب بيانات مرضى في خطوة التسجيل.</span></div><div className="auth-switch-line"><span>لديك حساب بالفعل؟</span><a href="/sign-in">تسجيل الدخول</a></div></section></main></Localized>;
}
