'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Analytics = {
  period: { from: string; to: string; days: number; label: string };
  summary: {
    leadsCreated: number; qualifiedLeads: number; wonLeads: number;
    lostLeads: number; winRatePercent: number; averageLeadScore: number;
  };
  stages: Record<string, number>;
  sources: Record<string, number>;
  intents: Record<string, number>;
  trend: Array<{ date: string; leads: number; won: number }>;
  operations: {
    openTasks: number; overdueTasks: number; dueTasksInPeriod: number;
    completedTasksInPeriod: number; viewingsScheduledInPeriod: number;
    viewingsCompletedInPeriod: number; viewingsNoShowInPeriod: number;
    viewingsCancelledInPeriod: number;
  };
  whatsapp: {
    inboundMessages: number; outboundMessages: number; deliveredOutbound: number;
    failedOutbound: number; openConversations: number; handoffRequired: number;
  };
  inventory: {
    total: number; available: number; unavailable: number;
    availabilityUnknown: number; inactive: number;
  };
};

const stageLabels: Record<string, string> = {
  new: 'جديد', contacted: 'تم التواصل', qualified: 'مؤهل',
  viewing_scheduled: 'معاينة مجدولة', negotiation: 'تفاوض', won: 'ناجح', lost: 'مفقود',
};
const sourceLabels: Record<string, string> = { whatsapp: 'واتساب', manual: 'إدخال يدوي', other: 'أخرى' };
const intentLabels: Record<string, string> = { buy: 'شراء', rent: 'إيجار', invest: 'استثمار', unknown: 'غير محدد' };

function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}
function percent(value: number) {
  return new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 1 }).format(value) + '٪';
}
function quantity(value: number) {
  return new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(value);
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ar-YE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
    : value;
}
function queryFor(days: number, custom: { from: string; to: string } | null) {
  if (custom) return '?' + new URLSearchParams({ from: custom.from, to: custom.to }).toString();
  return '?days=' + encodeURIComponent(String(days));
}
function BucketBars({ items, valueKey, labelKey }: {
  items: Array<Record<string, unknown>>;
  valueKey: string;
  labelKey: string;
}) {
  const maximum = Math.max(1, ...items.map(item => number(item[valueKey])));
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">لا توجد بيانات في الفترة المختارة.</p>;
  return <div className="space-y-3">
    {items.map((item, index) => {
      const value = number(item[valueKey]);
      const width = Math.max(value > 0 ? 2 : 0, value / maximum * 100);
      return <div key={String(item[labelKey]) + index} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
        <span className="truncate text-slate-600">{String(item[labelKey])}</span>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-700" style={{ width: width + '%' }} />
        </div>
        <span className="text-left font-bold tabular-nums text-slate-900">{quantity(value)}</span>
      </div>;
    })}
  </div>;
}

export default function AqarFlowAnalytics() {
  const [days, setDays] = useState(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customPeriod, setCustomPeriod] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/aqarflow/analytics' + queryFor(days, customPeriod), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر تحميل التقرير.');
      setData(body as Analytics);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل التقرير.');
    } finally {
      setLoading(false);
    }
  }, [days, customPeriod]);

  useEffect(() => { void load(); }, [load]);

  const trendBuckets = useMemo(() => {
    const trend = data?.trend || [];
    const bucketSize = days <= 31 ? 1 : days <= 90 ? 7 : 14;
    const result: Array<{ date: string; leads: number; won: number; label: string }> = [];
    for (let i = 0; i < trend.length; i += bucketSize) {
      const group = trend.slice(i, i + bucketSize);
      if (!group.length) continue;
      result.push({
        date: group[0].date,
        label: bucketSize === 1 ? dateLabel(group[0].date) : dateLabel(group[0].date) + ' – ' + dateLabel(group[group.length - 1].date),
        leads: group.reduce((sum, row) => sum + number(row.leads), 0),
        won: group.reduce((sum, row) => sum + number(row.won), 0),
      });
    }
    return result.slice(-24);
  }, [data, days]);

  function applyCustomPeriod() {
    setError('');
    setNotice('');
    if (!customFrom || !customTo) {
      setError('أدخل تاريخ البداية والنهاية لتطبيق الفترة المخصصة.');
      return;
    }
    if (customFrom > customTo) {
      setError('تاريخ النهاية يجب ألا يسبق تاريخ البداية.');
      return;
    }
    setCustomPeriod({ from: customFrom, to: customTo });
  }

  async function exportCsv() {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/aqarflow/analytics/export' + queryFor(days, customPeriod), { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'تعذر تصدير التقرير.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'aqarflow-sales-report.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      const rows = response.headers.get('X-AqarFlow-Export-Rows') || '0';
      const truncated = response.headers.get('X-AqarFlow-Export-Truncated') === 'true';
      setNotice(truncated
        ? `تم تصدير أول 5000 سجل من الفترة المختارة (عدد الصفوف في الملف: ${rows}).`
        : `اكتمل تصدير التقرير. عدد السجلات: ${rows}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تصدير التقرير.');
    } finally {
      setExporting(false);
    }
  }

  const kpis = data ? [
    { label: 'عملاء جدد', value: quantity(number(data.summary.leadsCreated)), icon: 'users', hint: data.period.label },
    { label: 'عملاء مؤهلون', value: quantity(number(data.summary.qualifiedLeads)), icon: 'user-check', hint: 'مؤهلون أو في المراحل التالية' },
    { label: 'صفقات ناجحة', value: quantity(number(data.summary.wonLeads)), icon: 'trophy', hint: 'بحسب مرحلة العميل الحالية، لا الإيراد المحصل' },
    { label: 'معدل النجاح', value: percent(number(data.summary.winRatePercent)), icon: 'chart-no-axes-combined', hint: 'الناجحون ÷ العملاء المسجلين في الفترة' },
    { label: 'متابعات متأخرة', value: quantity(number(data.operations.overdueTasks)), icon: 'calendar-clock', hint: 'كل المهام النشطة المستحقة قبل الآن' },
    { label: 'عقارات متاحة', value: quantity(number(data.inventory.available)), icon: 'building-2', hint: `من أصل ${quantity(number(data.inventory.total))} عقار` },
  ] : [];

  const stages = data ? Object.entries(data.stages).map(([key, value]) => ({
    label: stageLabels[key] || key, value: number(value),
  })).sort((a, b) => b.value - a.value) : [];
  const sources = data ? Object.entries(data.sources).map(([key, value]) => ({
    label: sourceLabels[key] || key, value: number(value),
  })).sort((a, b) => b.value - a.value) : [];
  const intents = data ? Object.entries(data.intents).map(([key, value]) => ({
    label: intentLabels[key] || key, value: number(value),
  })).sort((a, b) => b.value - a.value) : [];

  const card = 'rounded-2xl border border-slate-200 bg-white p-5';
  const heading = 'text-lg font-black text-slate-950';

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-black text-slate-950">الفترة والتحكم بالتقرير</h2>
        <p className="mt-1 text-sm text-slate-500">تُستخدم فترة واحدة لكل المؤشرات والتصدير.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90, 365].map(value => <button key={value} aria-pressed={!customPeriod && days === value}
          onClick={() => { setDays(value); setCustomPeriod(null); setError(''); }}
          className={'min-h-10 rounded-xl border px-4 text-sm font-bold ' + (!customPeriod && days === value
            ? 'border-blue-700 bg-blue-700 text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')}>
          {value === 365 ? 'سنة' : value + ' يوم'}
        </button>)}
        <button onClick={() => void exportCsv()} disabled={exporting || loading}
          className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">
          {exporting ? 'جارٍ التصدير…' : 'تصدير التقرير إلى CSV'}
        </button>
      </div>
      <div className="mt-4 grid w-full grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span className="block">من تاريخ</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span className="block">إلى تاريخ</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800" />
        </label>
        <button onClick={applyCustomPeriod} className="self-end min-h-10 rounded-xl border border-blue-700 px-4 text-sm font-bold text-blue-800 hover:bg-blue-50">تطبيق فترة مخصصة</button>
      </div>
    </section>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
      <span>{error}</span>
      <button onClick={() => void load()} className="underline">إعادة المحاولة</button>
    </div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

    {loading && !data ? <div className={card + ' py-16 text-center text-slate-500'}>جارٍ حساب مؤشرات مساحة العمل…</div> : data && <>
      <p className="text-sm text-slate-500">الفترة: {data.period.label}. أُجريت الحسابات داخل قاعدة البيانات مع تقييد كل استعلام بمالك مساحة العمل.</p>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item, index) => <div key={item.label} className={card}>
          <p className="text-sm font-semibold text-slate-500">{item.label}</p>
          <p className="mt-3 text-3xl font-black tabular-nums text-slate-950">{item.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</p>
        </div>)}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={card}>
          <div className="mb-5"><h2 className={heading}>مسار العملاء المحتملين</h2>
            <p className="mt-1 text-sm text-slate-500">توزيع العملاء الذين أُنشئت سجلاتهم خلال الفترة المختارة.</p></div>
          <BucketBars items={stages.map(item => ({ ...item, count: item.value }))} labelKey="label" valueKey="count" />
        </div>
        <div className={card}>
          <div className="mb-5"><h2 className={heading}>مصادر العملاء</h2>
            <p className="mt-1 text-sm text-slate-500">المصدر المسجل في CRM؛ لا يستنتج مصدرًا غير موجود في البيانات.</p></div>
          <BucketBars items={sources.map(item => ({ ...item, count: item.value }))} labelKey="label" valueKey="count" />
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="mb-4 font-bold text-slate-900">نية العميل</h3>
            <BucketBars items={intents.map(item => ({ ...item, count: item.value }))} labelKey="label" valueKey="count" />
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className={heading}>اتجاه العملاء الجدد</h2>
            <p className="mt-1 text-sm text-slate-500">الأزرق الداكن = عملاء أُضيفوا، والأزرق الفاتح = سجلات وصلت مرحلتها الحالية إلى «ناجح».</p></div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-700" /> عملاء جدد</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-sky-300" /> ناجحون حاليًا</span>
          </div>
        </div>
        {trendBuckets.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">لا توجد بيانات اتجاه في هذه الفترة.</p> :
          <div className="flex min-h-56 items-end gap-2 overflow-x-auto border-b border-slate-200 px-1 pt-4">
            {trendBuckets.map(bucket => {
              const max = Math.max(1, ...trendBuckets.map(row => Math.max(row.leads, row.won)));
              return <div key={bucket.date} className="flex min-w-8 flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div title={`عملاء جدد: ${bucket.leads}`} className="w-2/5 max-w-5 rounded-t bg-blue-700"
                    style={{ height: Math.max(bucket.leads > 0 ? 3 : 0, bucket.leads / max * 100) + '%' }} />
                  <div title={`ناجحون حاليًا: ${bucket.won}`} className="w-2/5 max-w-5 rounded-t bg-sky-300"
                    style={{ height: Math.max(bucket.won > 0 ? 3 : 0, bucket.won / max * 100) + '%' }} />
                </div>
                <span className="max-w-16 truncate text-[10px] text-slate-500" title={bucket.label}>{bucket.label}</span>
                <span className="text-[10px] font-bold text-slate-700">{quantity(bucket.leads)}</span>
              </div>;
            })}
          </div>}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className={card}>
          <h2 className={heading}>عمليات المتابعة</h2>
          <div className="mt-5 space-y-4 text-sm">
            {[['مهام نشطة الآن', data.operations.openTasks], ['متأخرة الآن', data.operations.overdueTasks], ['مستحقة في الفترة', data.operations.dueTasksInPeriod], ['مكتملة في الفترة', data.operations.completedTasksInPeriod]].map(([label, value]) =>
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="text-slate-600">{label}</span><strong className="text-lg tabular-nums text-slate-950">{quantity(number(value))}</strong>
              </div>)}
          </div>
        </div>
        <div className={card}>
          <h2 className={heading}>المعاينات</h2>
          <div className="mt-5 space-y-4 text-sm">
            {[['مجدولة أو مؤكدة', data.operations.viewingsScheduledInPeriod], ['مكتملة', data.operations.viewingsCompletedInPeriod], ['لم يحضر العميل', data.operations.viewingsNoShowInPeriod], ['ملغاة', data.operations.viewingsCancelledInPeriod]].map(([label, value]) =>
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="text-slate-600">{label}</span><strong className="text-lg tabular-nums text-slate-950">{quantity(number(value))}</strong>
              </div>)}
          </div>
        </div>
        <div className={card}>
          <h2 className={heading}>واتساب ومخزون العقارات</h2>
          <div className="mt-5 space-y-4 text-sm">
            {[['رسائل واردة في الفترة', data.whatsapp.inboundMessages], ['رسائل صادرة في الفترة', data.whatsapp.outboundMessages], ['مسلّمة أو مقروءة', data.whatsapp.deliveredOutbound], ['إرسال فاشل', data.whatsapp.failedOutbound], ['محادثات مفتوحة الآن', data.whatsapp.openConversations], ['تحتاج تدخل موظف', data.whatsapp.handoffRequired], ['عقارات غير متاحة', data.inventory.unavailable], ['توفر غير مؤكد', data.inventory.availabilityUnknown], ['عقارات غير نشطة', data.inventory.inactive]].map(([label, value]) =>
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="text-slate-600">{label}</span><strong className="text-lg tabular-nums text-slate-950">{quantity(number(value))}</strong>
              </div>)}
          </div>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-500">توضيح مهم: «الصفقات الناجحة» تعني سجلات CRM التي حالتها الحالية «ناجح» ضمن العملاء المسجلين في الفترة؛ لا تعني قيمة المبيعات أو عمولة محصلة، إذ لا توجد في هذه المرحلة سجلات مالية موثوقة لإثبات الإيراد.</p>
    </>}
  </div>;
}
