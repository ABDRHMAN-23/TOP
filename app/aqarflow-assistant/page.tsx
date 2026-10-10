import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AqarFlowSalesAssistant from '@/components/aqarflow/AqarFlowSalesAssistant';

export const dynamic='force-dynamic';
export default async function AqarFlowAssistantPage() {
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)redirect('/login');
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto mb-5 flex max-w-3xl items-center justify-between gap-3"><a className="text-sm font-bold text-blue-700" href="/dashboard">العودة إلى لوحة العمل</a><a className="text-sm font-bold text-slate-600" href="/properties">إدارة العقارات</a></div><AqarFlowSalesAssistant/></main>;
}
