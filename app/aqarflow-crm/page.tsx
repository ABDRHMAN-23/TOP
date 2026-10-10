import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AqarFlowLeadManager from '@/components/aqarflow/AqarFlowLeadManager';
export const dynamic='force-dynamic';
export default async function AqarFlowCrmPage(){
 const supabase=await createClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user)redirect('/login');
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">AQARFLOW AI</p><h1 className="mt-1 text-3xl font-black">إدارة العملاء المحتملين</h1><p className="mt-2 text-sm text-slate-500">تسجيل العملاء يدويًا، وتأهيلهم، وتحديد ميزانيتهم وخطوة المتابعة التالية.</p></div><div className="flex flex-wrap gap-2"><a href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">لوحة العمل</a><a href="/aqarflow-inbox" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">صندوق محادثات واتساب</a></div></header><AqarFlowLeadManager/></div></main>;
}
