import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/app';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const consentMatch = request.headers.get('cookie')?.match(/(?:^|;\s*)quvoto_legal_consent=([^;]+)/);
      const consentVersion = consentMatch?.[1] ? decodeURIComponent(consentMatch[1]) : null;
      if (consentVersion !== '2026-10-02') {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login?error=legal-required', url.origin));
      }
      const admin = createAdminClient();
      const {error:consentError}=await admin.from('legal_consents').insert({user_id:data.user.id,terms_version:'2026-10-02',privacy_version:'2026-10-02',source:'login',user_agent:request.headers.get('user-agent')});
      if(consentError){
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login?error=consent-save', url.origin));
      }
      const refCode = request.headers.get('cookie')?.match(/(?:^|;\s*)quvoto_ref=([^;]+)/)?.[1];
      if (refCode) {
        const admin=createAdminClient();
        const {data:rc}=await admin.from('referral_codes').select('id,user_id').eq('code',decodeURIComponent(refCode)).eq('active',true).maybeSingle();
        if (rc && rc.user_id !== data.user.id) {
          await admin.from('referrals').upsert({referrer_user_id:rc.user_id,referred_user_id:data.user.id,referral_code_id:rc.id,status:'signed_up',signed_up_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'referred_user_id'});
        }
      }
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email ?? null,
        updated_at: new Date().toISOString()
      });
      const response=NextResponse.redirect(new URL(next, url.origin));
      response.cookies.set('quvoto_ref','',{maxAge:0,path:'/'});
      response.cookies.set('quvoto_legal_consent','',{maxAge:0,path:'/'});
      response.cookies.set('quvoto_referrer','',{maxAge:0,path:'/'});
      return response;
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
