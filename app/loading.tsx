import { Activity, Stethoscope } from 'lucide-react';

export default function Loading() {
  return (
    <main className="app-loading" role="status" aria-live="polite" aria-label="جارٍ تحميل مساحة العمل">
      <div className="app-loading-brand">
        <span className="app-loading-symbol"><Stethoscope size={25} aria-hidden="true" /></span>
        <span><strong>سِنان</strong><small>مساحة العمل السريرية للأسنان</small></span>
      </div>
      <div className="app-loading-body"><Activity size={20} className="app-loading-pulse" aria-hidden="true" /><span>جارٍ تجهيز مساحة العمل…</span></div>
    </main>
  );
}
