'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is safe to display to support; never expose stack traces or clinical payloads.
    if (error.digest) console.error('Sinan workspace error digest:', error.digest);
  }, [error]);

  return (
    <main className="app-error" dir="rtl">
      <section className="app-error-card" role="alert">
        <span className="app-error-icon"><AlertTriangle size={25} aria-hidden="true" /></span>
        <div className="eyebrow">تعذر فتح مساحة العمل</div>
        <h1>لم تكتمل هذه العملية</h1>
        <p>لم يتم تأكيد حفظ أي تغيير بسبب هذا الخطأ. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية والتحقق من السجل.</p>
        {error.digest && <p className="app-error-reference">مرجع الدعم: <bdi>{error.digest}</bdi></p>}
        <div className="app-error-actions">
          <button className="primary-button" onClick={() => reset()}><RefreshCw size={16} /> إعادة المحاولة</button>
          <a className="secondary-button" href="/">العودة للرئيسية</a>
        </div>
        <div className="app-error-footnote"><ShieldCheck size={16} /> لا تعرض هذه الصفحة محتوى السجلات السريرية أو تفاصيل تقنية حساسة.</div>
      </section>
    </main>
  );
}
