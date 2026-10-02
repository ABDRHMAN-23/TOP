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
      const refCode = request.headers.get('cookie')?.match(/(?:^|;\\s*)quvoto_ref=([^;]+)/)?.[1];
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
      response.cookies.set('quvoto_referrer','',{maxAge:0,path:'/'});
      return response;
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
