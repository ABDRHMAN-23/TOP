import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PropertyInventory from '@/components/aqarflow/PropertyInventory';
export const dynamic='force-dynamic';
export default async function PropertiesPage(){
 const supabase=await createClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user)redirect('/login');
 return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl"><div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">AQARFLOW AI</p><h1 className="mt-1 text-3xl font-black text-slate-950">إدارة العقارات</h1></div><a className="text-sm font-bold text-blue-700" href="/dashboard">العودة إلى لوحة العمل</a></div><PropertyInventory canManageInitial={false}/></div></main>;
}
