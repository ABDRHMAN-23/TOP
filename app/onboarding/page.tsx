'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, ShieldCheck, AlertCircle } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [timezone, setTimezone] = useState('Asia/Aden');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, name_en: nameEn || null, timezone }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر إنشاء العيادة.');
      router.replace('/'); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء العيادة.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><div className="brand-symbol"><Stethoscope size={23}/></div><div><strong>سِنان</strong><span>إعداد مساحة العيادة</span></div></div><div className="auth-eyebrow">الخطوة الأولى</div><h1>أنشئ مساحة عيادتك</h1><p className="auth-sub">تُستخدم هذه البيانات في إعدادات العيادة والتقارير. يمكنك إكمال بقية الإعدادات بعد الدخول.</p><form onSubmit={submit}><label className="form-field">اسم العيادة بالعربية<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={180} required placeholder="مثال: عيادة النور للأسنان"/></label><label className="form-field">اسم العيادة بالإنجليزية (اختياري)<input value={nameEn} onChange={e=>setNameEn(e.target.value)} maxLength={180} placeholder="Al Noor Dental Clinic"/></label><label className="form-field">المنطقة الزمنية<select value={timezone} onChange={e=>setTimezone(e.target.value)}><option value="Asia/Aden">اليمن — عدن</option><option value="Asia/Riyadh">السعودية — الرياض</option><option value="Asia/Dubai">الإمارات — دبي</option><option value="Africa/Cairo">مصر — القاهرة</option><option value="UTC">UTC</option></select></label>{error&&<div className="inline-error"><AlertCircle size={16}/>{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy?'جارٍ إنشاء المساحة...':'إنشاء العيادة'}</button></form><div className="auth-note"><ShieldCheck size={17}/><span>يُنشأ الحساب السريري ضمن عضويتك فقط. يلزم تطبيق مخطط Supabase قبل إنشاء العيادة.</span></div><a className="auth-back" href="/">العودة</a></section></main>;
}
