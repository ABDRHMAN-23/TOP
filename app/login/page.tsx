'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, MessagesSquare, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.41-.18-2.08H12v3.94h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.7 2.91-4.2 2.91-7.24Z"/>
      <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.52A9.74 9.74 0 0 0 12 21.5Z"/>
      <path fill="#FBBC05" d="M6.51 13.6A5.85 5.85 0 0 1 6.2 12c0-.56.11-1.1.31-1.6V7.88H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.02 4.12l3.24-2.52Z"/>
      <path fill="#EA4335" d="M12 6.37c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.46 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.73 5.38l3.24 2.52C7.29 8.09 9.45 6.37 12 6.37Z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M16.77 12.62c.02 2.13 1.87 2.84 1.89 2.85-.02.05-.3 1.05-1 2.08-.6.9-1.22 1.8-2.2 1.82-.96.02-1.27-.59-2.37-.59-1.1 0-1.44.57-2.35.61-.95.04-1.68-.98-2.29-1.88-1.25-1.81-2.2-5.1-.92-7.32.64-1.11 1.75-1.81 2.96-1.83.93-.02 1.8.63 2.35.63.55 0 1.59-.78 2.68-.66.46.02 1.74.19 2.57 1.4-.07.04-1.54.9-1.52 2.89ZM14.99 4.91c.5-.61.83-1.46.74-2.31-.72.03-1.58.48-2.09 1.09-.46.53-.86 1.39-.75 2.21.8.06 1.61-.4 2.1-.99Z"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [legal, setLegal] = useState(false);

  const next =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next') || '/dashboard'
      : '/dashboard';

  const authError =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('error')
      : null;

  const registerConsent = async () => {
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
        : 'تعذر حفظ الموافقة القانونية بأمان. حاول مرة أخرى.');
    }
  };

  const socialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setMessage('');
    if (!legal) {
      setError('يرجى الموافقة على شروط الخدمة وسياسة الخصوصية قبل المتابعة.');
      return;
    }

    setLoading(true);
    try {
      await registerConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الموافقة القانونية.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(next),
        },
      });
      if (oauthError) {
        setError('تعذر بدء الدخول عبر ' + (provider === 'google' ? 'Google' : 'Apple') + '. حاول مرة أخرى.');
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError('لم يتم إنشاء رابط الدخول. تحقق من إعدادات تسجيل الدخول ثم حاول مرة أخرى.');
      setLoading(false);
    } catch {
      setError('تعذر بدء الدخول الآمن. حاول مرة أخرى.');
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!legal) {
      setError('يرجى الموافقة على شروط الخدمة وسياسة الخصوصية قبل المتابعة.');
      return;
    }
    if (!email.trim()) return;

    setLoading(true);
    try {
      await registerConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الموافقة القانونية.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(next),
        },
      });
      if (otpError) setError('تعذر إرسال رابط الدخول. تأكد من البريد الإلكتروني ثم حاول مرة أخرى.');
      else setMessage('تم طلب رابط الدخول الآمن. افحص بريدك الإلكتروني واتبع الرابط لإكمال الدخول.');
    } catch {
      setError('تعذر بدء الدخول. تحقق من اتصالك ثم حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authError === 'legal-required') {
      setError('يلزم قبول شروط الخدمة وسياسة الخصوصية قبل تسجيل الدخول.');
    } else if (authError === 'auth') {
      setError('تعذر إكمال رابط الدخول أو انتهت صلاحيته. اطلب رابطًا جديدًا.');
    } else if (authError === 'consent-save') {
      setError('تعذر حفظ الموافقة القانونية بأمان. حاول تسجيل الدخول مرة أخرى.');
    }
  }, [authError]);

  return (
    <main dir="rtl" className="af-login-page">
      <div className="af-login-background-orb af-login-orb-one" />
      <div className="af-login-background-orb af-login-orb-two" />
      <div className="af-login-wrap">
        <header className="af-login-header">
          <a className="af-login-brand" href="/" aria-label="AqarFlow AI — الرئيسية">
            <span className="af-login-brand-mark"><MessagesSquare size={22} /></span>
            <span><strong>AqarFlow<span> AI</span></strong><small>REAL ESTATE SALES INTELLIGENCE</small></span>
          </a>
          <a className="af-login-back" href="/">العودة إلى الرئيسية <ArrowLeft size={15} /></a>
        </header>

        <div className="af-login-grid">
          <section className="af-login-story">
            <span className="af-login-eyebrow"><span /> مساحة عمل المكتب العقاري</span>
            <h1>إدارتك العقارية،<br /><span>بعقلية مبيعات أقوى.</span></h1>
            <p>أدخل إلى مساحة مكتبك لإدارة العقارات ومحادثات العملاء وإعداد مساعد المبيعات الذي يتعامل باحتراف ويحافظ على سمعة المكتب.</p>
            <div className="af-login-benefits">
              <div><span><Check size={16} /></span><div><b>بياناتك في مساحة مكتبك</b><small>العقارات والتفاصيل تبقى مرتبطة بحسابك.</small></div></div>
              <div><span><Check size={16} /></span><div><b>مبيعات باحترام ووضوح</b><small>قواعد واضحة للميزانية والحقائق والصلاحيات.</small></div></div>
              <div><span><Check size={16} /></span><div><b>تحكم في التكاملات</b><small>لا يبدأ الرد التلقائي دون إعداد وتفعيل صريح.</small></div></div>
            </div>
            <div className="af-login-quote"><ShieldCheck size={18} /><span>الثقة لا تُبنى بجملة مقنعة فقط؛ بل بمعلومة صحيحة وتصرف محترم في كل مرة.</span></div>
          </section>

          <section className="af-login-card">
            <div className="af-login-card-icon"><ShieldCheck size={22} /></div>
            <span className="af-login-card-kicker">دخول آمن</span>
            <h2>مرحبًا بعودتك</h2>
            <p className="af-login-card-lead">استخدم بريد عملك لإرسال رابط دخول آمن لمرة واحدة. لا تحتاج إلى حفظ كلمة مرور.</p>

            <div className="af-login-social">
              <button type="button" disabled={loading} onClick={() => socialLogin('google')}><GoogleIcon /><span>الدخول عبر Google</span></button>
              <button type="button" disabled={loading} onClick={() => socialLogin('apple')}><AppleIcon /><span>الدخول عبر Apple</span></button>
            </div>

            <div className="af-login-separator"><span>أو عبر البريد الإلكتروني</span></div>

            <form onSubmit={submit} className="af-login-form">
              <label htmlFor="af-login-email">البريد الإلكتروني للعمل</label>
              <input id="af-login-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" dir="ltr" />
              <label className="af-login-consent">
                <input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} />
                <span>أوافق على <a href="/terms" target="_blank" rel="noreferrer">شروط الخدمة</a> وأقر باطلاعي على <a href="/privacy" target="_blank" rel="noreferrer">سياسة الخصوصية</a>.</span>
              </label>
              <button className="af-login-submit" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>أرسل رابط الدخول الآمن</span><ArrowLeft size={17} /></>}
              </button>
            </form>

            {message ? <p role="status" className="af-login-success">{message}</p> : null}
            {error ? <p role="alert" className="af-login-error">{error}</p> : null}

            <div className="af-login-security-note"><ShieldCheck size={15} /><span>لا نطلب كلمة مرور داخل هذه الصفحة. لن يتم الدخول إلا بعد إكمال التحقق عبر مزود المصادقة.</span></div>
          </section>
        </div>

        <footer className="af-login-footer"><span>© 2026 AqarFlow AI</span><span>الصدق أولًا. ثقة العميل دائمًا.</span></footer>
      </div>
    </main>
  );
}
