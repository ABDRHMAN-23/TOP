import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AqarFlowInbox from '@/components/aqarflow/AqarFlowInbox';
export const dynamic='force-dynamic';
export default async function InboxPage({searchParams}:{searchParams:Promise<{conversationId?:string}>}){
 const supabase=await createClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user)redirect('/login');
 const params=await searchParams;const rawId=params.conversationId||'';const initialConversationId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)?rawId:'';
 return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">AQARFLOW AI</p><h1 className="mt-1 text-3xl font-black text-slate-950">صندوق محادثات العملاء</h1><p className="mt-2 text-sm text-slate-600">رسائل واتساب الواردة، ومسودات الذكاء الاصطناعي، ومراجعة الموظف قبل الإرسال.</p></div><nav className="flex flex-wrap gap-3"><a className="text-sm font-bold text-blue-700" href="/aqarflow-operations">عمليات المبيعات</a><a className="text-sm font-bold text-blue-700" href="/dashboard">لوحة العمل</a></nav></div><AqarFlowInbox initialConversationId={initialConversationId}/></div></main>;
}
