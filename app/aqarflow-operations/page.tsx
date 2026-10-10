import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AqarFlowOperations from '@/components/aqarflow/AqarFlowOperations';

export const dynamic='force-dynamic';

export default async function AqarFlowOperationsPage(){
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)redirect('/login');
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-700">AQARFLOW AI · LEVEL 2</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">عمليات المبيعات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">مركز موحّد لمواعيد المتابعة ومهام العملاء ومعاينات العقارات، مع التحقق من ملكية مساحة العمل ومنع ازدواجية حجز العقار.</p>
        </div>
        <nav aria-label="روابط عمليات المبيعات" className="flex flex-wrap gap-2">
          <a href="/aqarflow-crm" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">العملاء المحتملون</a>
          <a href="/aqarflow-inbox" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">صندوق واتساب</a>
          <a href="/aqarflow-automation" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">الأتمتة والتنبيهات</a>
          <a href="/aqarflow-analytics" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">ذكاء المبيعات</a>
          <a href="/properties" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">العقارات</a>
          <a href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">لوحة العمل</a>
        </nav>
      </header>
      <AqarFlowOperations/>
    </div>
  </main>;
}
