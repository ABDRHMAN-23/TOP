'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import QuvotoLogo from '@/components/QuvotoLogo';
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
        : 'Could not securely record your legal acknowledgement. Please try again.');
    }
  };

  const socialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setMessage('');

    if (!legal) {
      setError(
        'Please agree to the Terms of Service and acknowledge the Privacy Policy before continuing.',
      );
      return;
    }

    setLoading(true);
    try {
      await registerConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not securely record your legal acknowledgement.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            window.location.origin +
            '/auth/callback?next=' +
            encodeURIComponent(next),
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
        return;
      }

      // Explicitly navigate to the provider URL. This avoids leaving the
      // button in a loading state on browsers where the automatic OAuth
      // navigation is interrupted.
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setError('The sign-in provider did not return a redirect URL. Please try again.');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start secure sign-in.');
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!legal) {
      setError(
        'Please agree to the Terms of Service and acknowledge the Privacy Policy before continuing.',
      );
      return;
    }

    if (!email.trim()) return;

    setLoading(true);
    try {
      await registerConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not securely record your legal acknowledgement.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo:
            window.location.origin +
            '/auth/callback?next=' +
            encodeURIComponent(next),
        },
      });
      if (otpError) {
        setError(otpError.message);
      } else {
        setMessage('Check your email for your secure QUVOTO sign-in link.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start secure sign-in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authError === 'legal-required') {
      setError(
        'Please accept the Terms of Service and acknowledge the Privacy Policy before signing in.',
      );
    } else if (authError === 'auth') {
      setError(
        'The sign-in link could not be completed. Please request a new one.',
      );
    } else if (authError === 'consent-save') {
      setError(
        'We could not securely record your legal consent. Please try signing in again.',
      );
    }
  }, [authError]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf3ff,transparent_42%),#f7faff] px-4 py-8 text-[#0A1E3D] sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="text-center">
          <a
            href="/"
            aria-label="QUVOTO home"
            className="inline-flex flex-col items-center"
          >
            <QuvotoLogo className="h-20 w-20" stacked />
          </a>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-[#1769E0]">
            Speak. Quote. Done.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(10,30,61,.10)] sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1769E0]/10 text-[#1769E0]">
              <ShieldCheck size={21} />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#1769E0]">
              Secure sign in
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">
              Welcome back
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Access your QUVOTO workspace with a secure one-time email link.
              No password to remember.
            </p>
          </div>

          <div className="mt-7">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => socialLogin('google')}
                className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
                  <GoogleIcon />
                </span>
                <span>Google</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => socialLogin('apple')}
                className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0A1E3D]">
                  <AppleIcon />
                </span>
                <span>Apple</span>
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                or use email
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                Work email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 min-h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-[#1769E0] focus:bg-white focus:ring-4 focus:ring-[#1769E0]/10"
                  placeholder="you@company.com"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={legal}
                  onChange={(event) => setLegal(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#1769E0]"
                />
                <span>
                  I agree to the{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#1769E0] underline"
                  >
                    Terms of Service
                  </a>{' '}
                  and acknowledge the{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#1769E0] underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <button
                disabled={loading}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1769E0] py-3.5 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#125bc4] disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>Email me a secure link</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {message && (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              Your customer dashboard is available after sign-in, including
              Free accounts and paid plans.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 QUVOTO · Secure contractor quoting
        </p>
      </div>
    </main>
  );
}
