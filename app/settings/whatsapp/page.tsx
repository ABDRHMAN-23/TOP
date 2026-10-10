import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { runtimeEnv } from '@/lib/runtime-env';
import WhatsAppConnectionManager from '@/components/aqarflow/WhatsAppConnectionManager';
export const dynamic='force-dynamic';
export default async function WhatsAppSettingsPage(){
 const supabase=await createClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user)redirect('/login');
 const {data:members, error:memberError}=await supabase.from('team_memberships').select('owner_id').eq('member_id',data.user.id).neq('owner_id',data.user.id).limit(1);
 if(memberError||((members||[]).length>0))return <main dir="rtl" className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-black">إعدادات واتساب</h1><p className="mt-2 text-sm text-slate-600">إدارة اتصال واتساب متاحة لمالك مساحة العمل فقط في هذه النسخة.</p><a href="/dashboard" className="mt-4 inline-block font-bold text-blue-700">العودة إلى لوحة العمل</a></div></main>;
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-bold text-blue-700">AQARFLOW AI</p><h1 className="mt-1 text-3xl font-black">إعدادات واتساب</h1></div><a href="/aqarflow-inbox" className="font-bold text-blue-700">صندوق المحادثات</a></div><WhatsAppConnectionManager appId={process.env.NEXT_PUBLIC_META_APP_ID||''} configId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID||''} graphVersion={runtimeEnv('META_GRAPH_API_VERSION')||''}/></div></main>;
}
