import { ArrowRight, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="app-error" dir="rtl">
      <section className="app-error-card">
        <span className="app-error-icon"><FileQuestion size={25} aria-hidden="true" /></span>
        <div className="eyebrow">الصفحة غير موجودة</div>
        <h1>لم نعثر على الصفحة المطلوبة</h1>
        <p>قد يكون الرابط غير صحيح أو أن السجل لم يعد متاحاً ضمن مساحة العيادة الحالية.</p>
        <div className="app-error-actions"><a className="primary-button" href="/"><ArrowRight size={16} /> العودة إلى مساحة العمل</a></div>
      </section>
    </main>
  );
}
