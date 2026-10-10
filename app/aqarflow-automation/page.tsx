import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AqarFlowAutomation from '@/components/aqarflow/AqarFlowAutomation';

export const dynamic = 'force-dynamic';

export default async function AqarFlowAutomationPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-700">AQARFLOW AI · LEVEL 3</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">الأتمتة والتنبيهات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">تنبيهات داخلية للمتابعات المستحقة والمعاينات القريبة، مع منع التكرار وعزل بيانات مساحة العمل.</p>
        </div>
        <nav aria-label="روابط AqarFlow" className="flex flex-wrap gap-2">
          <a href="/aqarflow-operations" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">عمليات المبيعات</a>
          <a href="/aqarflow-crm" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">العملاء المحتملون</a>
          <a href="/aqarflow-inbox" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">صندوق واتساب</a>
        </nav>
      </header>
      <AqarFlowAutomation />
    </div>
  </main>;
}
