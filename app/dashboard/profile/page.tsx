import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();

  async function save(formData: FormData) {
    'use server';
    const server = await createClient();
    const { data: { user: currentUser } } = await server.auth.getUser();
    if (!currentUser) redirect('/login');
    const business_name = String(formData.get('business_name') || '').trim();
    if (!business_name) return;
    await server.from('business_profiles').upsert({
      user_id: currentUser.id,
      business_name,
      phone: String(formData.get('phone') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      website: String(formData.get('website') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      vat_number: String(formData.get('vat_number') || '').trim() || null,
      default_currency: String(formData.get('default_currency') || 'GBP'),
      payment_terms: String(formData.get('payment_terms') || '').trim() || null,
      warranty_terms: String(formData.get('warranty_terms') || '').trim() || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    redirect('/dashboard/profile?saved=1');
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><a href="/dashboard" className="text-xl font-black">Voice<span className="text-blue-600">Quote</span></a><a href="/app" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">New quote</a></div></header>
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-sm font-bold text-blue-600">BUSINESS PROFILE</p>
      <h1 className="mt-1 text-4xl font-black">Your quote identity</h1>
      <p className="mt-2 text-slate-500">These details can appear on your customer-facing quote.</p>
      <form action={save} className="mt-8 space-y-5 rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
        <div><label className="text-sm font-bold">Business name *</label><input name="business_name" defaultValue={profile?.business_name || ''} required className="mt-2 w-full rounded-xl border p-3"/></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-sm font-bold">Phone</label><input name="phone" defaultValue={profile?.phone || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">Email</label><input name="email" type="email" defaultValue={profile?.email || user.email || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">Website</label><input name="website" defaultValue={profile?.website || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">VAT / Tax number</label><input name="vat_number" defaultValue={profile?.vat_number || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
        </div>
        <div><label className="text-sm font-bold">Business address</label><textarea name="address" defaultValue={profile?.address || ''} className="mt-2 min-h-24 w-full rounded-xl border p-3"/></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-sm font-bold">Default currency</label><select name="default_currency" defaultValue={profile?.default_currency || 'GBP'} className="mt-2 w-full rounded-xl border p-3"><option>GBP</option><option>USD</option><option>EUR</option><option>AED</option><option>SAR</option></select></div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Logo upload will be connected to Supabase Storage in the next pass.</div>
        </div>
        <div><label className="text-sm font-bold">Payment terms</label><textarea name="payment_terms" defaultValue={profile?.payment_terms || ''} className="mt-2 min-h-20 w-full rounded-xl border p-3" placeholder="Payment due within 14 days"/></div>
        <div><label className="text-sm font-bold">Warranty / service terms</label><textarea name="warranty_terms" defaultValue={profile?.warranty_terms || ''} className="mt-2 min-h-20 w-full rounded-xl border p-3"/></div>
        <button className="w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white">Save business profile</button>
      </form>
    </section>
  </main>;
}
