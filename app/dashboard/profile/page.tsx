import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type ProfilePageProps = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('plan,status').eq('user_id', user.id).maybeSingle()
  ]);

  const activePlan = (subscription?.status === 'active' || subscription?.status === 'trialing') ? subscription?.plan : 'free';
  const params = await searchParams;

  async function save(formData: FormData) {
    'use server';

    const server = await createClient();
    const { data: { user: currentUser } } = await server.auth.getUser();
    if (!currentUser) redirect('/login');

    const { data: currentSubscription } = await server
      .from('subscriptions')
      .select('plan,status')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    const plan = (currentSubscription?.status === 'active' || currentSubscription?.status === 'trialing') ? currentSubscription?.plan : 'free';
    const business_name = String(formData.get('business_name') || '').trim();
    if (!business_name) redirect('/dashboard/profile?error=business-name');

    const file = formData.get('logo');
    let logoUrl = String(formData.get('existing_logo_url') || '').trim() || null;

    if (file instanceof File && file.size > 0) {
      if (plan === 'free') redirect('/dashboard/profile?error=logo-plan');
      if (file.size > 2 * 1024 * 1024) redirect('/dashboard/profile?error=logo-size');
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowed.includes(file.type)) redirect('/dashboard/profile?error=logo-type');

      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = currentUser.id + '/' + crypto.randomUUID() + '.' + extension;
      const { error: uploadError } = await server.storage.from('business-logos').upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false
      });
      if (uploadError) redirect('/dashboard/profile?error=logo-upload');
      const { data: publicData } = server.storage.from('business-logos').getPublicUrl(path);
      logoUrl = publicData.publicUrl;
    }

    await server.from('business_profiles').upsert({
      user_id: currentUser.id,
      business_name,
      logo_url: logoUrl,
      primary_color: plan === 'pro' || plan === 'team' ? String(formData.get('primary_color') || '#2563EB') : '#2563EB',
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

  const errorText: Record<string,string> = {
    'logo-plan': 'Custom logos are available from Starter.',
    'logo-size': 'Logo files must be 2 MB or smaller.',
    'logo-type': 'Use PNG, JPG or WebP for the logo.',
    'logo-upload': 'The logo could not be uploaded.',
    'business-name': 'Business name is required.'
  };

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/dashboard" className="text-xl font-black">Voice<span className="text-blue-600">Quote</span></a>
        <a href="/app" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">New quote</a>
      </div>
    </header>

    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-600">BUSINESS PROFILE</p>
          <h1 className="mt-1 text-4xl font-black">Your quote identity</h1>
          <p className="mt-2 text-slate-500">These details can appear on your customer-facing quote.</p>
        </div>
        <a href="/pricing" className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{String(activePlan).toUpperCase()}</a>
      </div>

      {params.saved ? <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Business profile saved.</div> : null}
      {params.error && errorText[params.error] ? <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{errorText[params.error]}</div> : null}

      <form action={save} encType="multipart/form-data" className="mt-8 space-y-5 rounded-[2rem] border bg-white p-6 shadow-sm sm:p-8">
        <input type="hidden" name="existing_logo_url" value={profile?.logo_url || ''}/>
        <div>
          <label className="text-sm font-bold">Business name *</label>
          <input name="business_name" defaultValue={profile?.business_name || ''} required className="mt-2 w-full rounded-xl border p-3"/>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-sm font-bold">Phone</label><input name="phone" defaultValue={profile?.phone || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">Email</label><input name="email" type="email" defaultValue={profile?.email || user.email || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">Website</label><input name="website" defaultValue={profile?.website || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
          <div><label className="text-sm font-bold">VAT / Tax number</label><input name="vat_number" defaultValue={profile?.vat_number || ''} className="mt-2 w-full rounded-xl border p-3"/></div>
        </div>

        <div>
          <label className="text-sm font-bold">Business logo</label>
          <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 p-4 sm:flex-row sm:items-center">
            {profile?.logo_url ? <img src={profile.logo_url} alt="Business logo" className="h-16 w-16 rounded-xl border object-contain"/> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-400">LOGO</div>}
            <div className="flex-1">
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="w-full rounded-xl border p-2.5 text-sm"/>
              <p className="mt-2 text-xs text-slate-500">{activePlan === 'free' ? 'Custom logo unlocks on Starter.' : 'PNG, JPG or WebP · up to 2 MB.'}</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold">Business address</label>
          <textarea name="address" defaultValue={profile?.address || ''} className="mt-2 min-h-24 w-full rounded-xl border p-3"/>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold">Default currency</label>
            <select name="default_currency" defaultValue={profile?.default_currency || 'GBP'} className="mt-2 w-full rounded-xl border p-3">
              {['GBP','USD','EUR','AED','SAR','CAD','AUD','CHF','SEK','NOK'].map(code => <option key={code}>{code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold">Brand color</label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border p-2.5">
              <input name="primary_color" type="color" defaultValue={profile?.primary_color || '#2563EB'} disabled={activePlan !== 'pro' && activePlan !== 'team'} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent"/>
              <span className="text-sm text-slate-500">{activePlan === 'pro' || activePlan === 'team' ? 'Used for Pro/Team branding.' : 'Custom colors unlock on Pro.'}</span>
            </div>
          </div>
        </div>

        <div><label className="text-sm font-bold">Payment terms</label><textarea name="payment_terms" defaultValue={profile?.payment_terms || ''} className="mt-2 min-h-20 w-full rounded-xl border p-3" placeholder="Payment due within 14 days"/></div>
        <div><label className="text-sm font-bold">Warranty / service terms</label><textarea name="warranty_terms" defaultValue={profile?.warranty_terms || ''} className="mt-2 min-h-20 w-full rounded-xl border p-3"/></div>

        <button className="w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white">Save business profile</button>
      </form>
    </section>
  </main>;
}
