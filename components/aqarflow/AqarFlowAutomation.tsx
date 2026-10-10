'use client';

import { useCallback, useEffect, useState } from 'react';

type Notification = {
  id: string;
  notification_type: 'task_due' | 'viewing_soon';
  entity_type: 'task' | 'viewing';
  entity_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ar-YE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
}

export default function AqarFlowAutomation() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/aqarflow/notifications', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'تعذر تحميل الإشعارات.');
    setItems((body.notifications || []) as Notification[]);
    setUnread(Number(body.unreadCount || 0));
  }, []);

  useEffect(() => {
    refresh().catch(e => setError(e instanceof Error ? e.message : 'تعذر تحميل الإشعارات.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function markRead(item: Notification) {
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/aqarflow/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر تحديث الإشعار.');
      await refresh();
      setNotice('تم وضع الإشعار في حالة مقروء.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث الإشعار.');
    } finally {
      setBusyId('');
    }
  }

  return <section dir="rtl" className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-500">غير المقروء</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{unread}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-500">إشعارات المتابعة</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{items.filter(x => x.notification_type === 'task_due').length}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-500">إشعارات المعاينات</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{items.filter(x => x.notification_type === 'viewing_soon').length}</p>
      </div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}
      <button className="mr-3 underline" onClick={() => refresh().then(() => setError('')).catch(() => {})}>إعادة المحاولة</button>
    </div>}
    {notice && <p role="status" className="text-sm font-semibold text-emerald-700">{notice}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div><h2 className="text-lg font-black text-slate-950">مركز التنبيهات</h2>
          <p className="mt-1 text-sm text-slate-500">التنبيهات داخل النظام فقط؛ لا تُرسل رسائل للعميل تلقائيًا.</p></div>
        <button onClick={() => refresh().catch(e => setError(e instanceof Error ? e.message : 'تعذر التحديث.'))}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">تحديث</button>
      </div>
      {loading ? <p className="p-8 text-center text-slate-500">جارٍ تحميل التنبيهات…</p> :
        items.length === 0 ? <p className="p-8 text-center text-slate-500">لا توجد تنبيهات بعد. تتولد التنبيهات عند تشغيل مهمة الجدولة.</p> :
        <ul className="divide-y divide-slate-100">
          {items.map(item => <li key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{item.title}</h3>
                {!item.read_at && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">جديد</span>}
              </div>
              <p className="mt-1 text-sm text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-400">{dateLabel(item.created_at)}</p>
            </div>
            {!item.read_at && <button disabled={busyId === item.id} onClick={() => markRead(item)}
              className="shrink-0 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busyId === item.id ? 'جارٍ التحديث…' : 'وضع علامة مقروء'}</button>}
          </li>)}
        </ul>}
    </div>
  </section>;
}
