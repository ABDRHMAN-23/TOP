'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeInternalRedirectPath } from '@/lib/security/safe-redirect';

function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\\s().-]/g, '');
  return /^\\+[1-9]\\d{7,14}$/.test(compact) ? compact : null;
}

export default function LoginPage() {
  const [phone, setPhone] = useState('+967');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [legal, setLegal] = useState(false);
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  const next = useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard';
    return safeInternalRedirectPath(new URLSearchParams(window.location.search).get('next'), '/dashboard');
  }, []);

  async function registerConsent() {
    const response = await fetch('/api/legal-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        termsAccepted: true,
        privacyAcknowledged: true,
        termsVersion: '2026-10-02',
        privacyVersion: '2026-10-02',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.error === 'string'
        ? result.error
        : 'تعذّر تسجيل الموافقة القانونية. حاول مرة أخرى.');
    }
  }

  async function sendCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError('');
    setMessage('');

    if (!legal) {
      setError('وافق على شروط الاستخدام وأقرّ بسياسة الخصوصية قبل المتابعة.');
      return;
    }
    if (!normalizedPhone) {
      setError('أدخل الرقم بصيغة دولية، مع رمز الدولة، مثل ‎+967771234567.');
      return;
    }

    setLoading(true);
    try {
      await registerConsent();
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          channel: 'whatsapp',
          shouldCreateUser: true,
          data: { product: 'aqarflow_ai', onboarding_source: 'public_landing' },
        },
      });
      if (otpError) {
        setError('لم نتمكن من إرسال رمز واتساب. تحقق من الرقم وإعداد قناة WhatsApp OTP في مزود تسجيل الدخول، ثم حاول مجددًا.');
        return;
      }
      setStep('otp');
      setMessage('أرسلنا طلب رمز التحقق إلى واتساب إن كانت قناة WhatsApp OTP مفعّلة في إعدادات الخدمة. أدخل الرمز لإكمال الدخول أو التسجيل.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر بدء التحقق. حاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const token = otp.replace(/\\D/g, '').slice(0, 8);
    if (!normalizedPhone || token.length < 6) {
      setError('أدخل رمز التحقق الذي وصلك على واتساب.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token,
        type: 'sms',
      });
      if (verifyError || !data.session || !data.user) {
        setError('رمز التحقق غير صحيح أو انتهت صلاحيته. راجع الرمز أو اطلب رمزًا جديدًا.');
        return;
      }
      window.location.assign(next);
    } catch {
      setError('تعذر التحقق من الرمز الآن. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8f5] px-4 py-8 text-[#192721] sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="text-center">
          <a href="/" aria-label="AqarFlow AI الصفحة الرئيسية" className="inline-flex items-center gap-3 rounded-2xl px-3 py-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173d32] text-[#dcf6bd]"><Smartphone size={22} /></span>
            <span className="text-right"><span className="block text-xl font-black tracking-tight">AqarFlow <span className="text-[#2b7057]">AI</span></span><span className="mt-0.5 block text-xs font-bold text-[#718075]">ملك التسويق العقاري</span></span>
          </a>
        </div>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#dce5da] bg-white shadow-xl shadow-[#173d32]/8 sm:mt-9">
          <div className="bg-[#173d32] px-6 py-7 text-center text-white sm:px-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><ShieldCheck size={23} /></div>
            <p className="mt-4 text-xs font-black tracking-wide text-[#c9e7bd]">{step === 'phone' ? 'ابدأ بمساحة مكتبك' : 'التحقق من رقم الهاتف'}</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{step === 'phone' ? 'دخول أو تسجيل آمن' : 'أدخل رمز واتساب'}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#deebe1]">{step === 'phone' ? 'استخدم رقم الهاتف الذي تريد ربطه بمساحة مكتبك. لا تحتاج إلى كلمة مرور.' : 'أدخل رمز التحقق المرتبط بالرقم الذي أدخلته لإكمال المصادقة.'}</p>
          </div>

          <div className="p-6 sm:p-8">
            {step === 'phone' ? (
              <form onSubmit={(event) => void sendCode(event)} className="space-y-5">
                <label className="block text-sm font-extrabold text-[#34483a]">
                  رقم الهاتف مع رمز الدولة
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.slice(0, 24))}
                    className="mt-2 min-h-13 w-full rounded-2xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3.5 text-left text-base outline-none transition focus:border-[#6d9b78] focus:bg-white focus:ring-4 focus:ring-[#d8e9d3]"
                    placeholder="+967 771 234 567"
                  />
                  <span className="mt-2 block text-xs font-medium leading-5 text-[#758175]">أدخل علامة + ورمز الدولة والرقم كاملًا. مثال: +967771234567.</span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-[#e1e8df] bg-[#f8faf7] p-3.5 text-xs leading-6 text-[#617165]">
                  <input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#285c45]" />
                  <span>أوافق على <a href="/terms" target="_blank" rel="noreferrer" className="font-extrabold text-[#2b7057] underline">شروط الاستخدام</a> وأقرّ بالاطلاع على <a href="/privacy" target="_blank" rel="noreferrer" className="font-extrabold text-[#2b7057] underline">سياسة الخصوصية</a>.</span>
                </label>

                <button type="submit" disabled={loading} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#173d32] px-5 py-3.5 font-black text-white shadow-lg shadow-[#173d32]/15 transition hover:bg-[#225442] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><MessageCircle size={18} /><span>إرسال رمز عبر واتساب</span><ArrowLeft size={17} /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-5">
                <div className="rounded-2xl border border-[#dce7d8] bg-[#f5f9f2] p-4">
                  <p className="text-xs font-bold text-[#617165]">رمز التحقق للرقم</p>
                  <p dir="ltr" className="mt-1 text-lg font-black tracking-wide text-[#244b39]">{normalizedPhone}</p>
                  <button type="button" disabled={loading} onClick={() => { setStep('phone'); setOtp(''); setMessage(''); setError(''); }} className="mt-2 text-xs font-extrabold text-[#2b7057] underline">تغيير الرقم</button>
                </div>
                <label className="block text-sm font-extrabold text-[#34483a]">
                  رمز التحقق
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\\D/g, '').slice(0, 8))}
                    className="mt-2 min-h-14 w-full rounded-2xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3.5 text-center text-2xl font-black tracking-[0.3em] outline-none transition focus:border-[#6d9b78] focus:bg-white focus:ring-4 focus:ring-[#d8e9d3]"
                    placeholder="••••••"
                  />
                </label>
                <button type="submit" disabled={loading || otp.replace(/\\D/g, '').length < 6} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#173d32] px-5 py-3.5 font-black text-white shadow-lg shadow-[#173d32]/15 transition hover:bg-[#225442] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>تحقق وادخل إلى المكتب</span><ArrowLeft size={17} /></>}
                </button>
                <button type="button" disabled={loading} onClick={() => void sendCode()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-[#2b7057] transition hover:bg-[#f1f6ef] disabled:opacity-50">إعادة إرسال الرمز</button>
              </form>
            )}

            {message && <p role="status" className="mt-4 rounded-2xl bg-[#eff6ea] p-3.5 text-sm font-semibold leading-6 text-[#2b5c41]">{message}</p>}
            {error && <p role="alert" className="mt-4 rounded-2xl border border-[#f0d7cc] bg-[#fff8f4] p-3.5 text-sm font-semibold leading-6 text-[#92532e]">{error}</p>}

            <div className="mt-6 flex items-start gap-2 border-t border-[#e9eee7] pt-5 text-xs leading-6 text-[#758175]">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#49805c]" />
              <p>تسجيل الدخول عبر رمز لمرة واحدة، دون كلمة مرور. يتطلب إرسال الرموز عبر واتساب تفعيل قناة WhatsApp OTP في إعدادات مزود المصادقة.</p>
            </div>
          </div>
        </section>

        <a href="/" className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-extrabold text-[#4b6655] transition hover:text-[#173d32]"><ArrowRight size={16} /> العودة إلى معاينة «ملك التسويق»</a>
      </div>
    </main>
  );
}
