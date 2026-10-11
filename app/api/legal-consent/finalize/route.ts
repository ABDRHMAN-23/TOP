import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { verifySignedLegalConsentToken } from '@/lib/security/legal-consent';

export const dynamic = 'force-dynamic';

function sameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return Boolean(origin && origin === url.origin)
    && (!fetchSite || fetchSite === 'same-origin' || fetchSite === 'none');
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'طلب حفظ الموافقة غير صالح.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return NextResponse.json({ error: 'يلزم التحقق من رقم الهاتف أولًا.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const consentMatch = cookieHeader.match(/(?:^|;\s*)quvoto_legal_consent=([^;]+)/);
  let consentToken: string | null = null;
  try { consentToken = consentMatch?.[1] ? decodeURIComponent(consentMatch[1]) : null; } catch {}
  const secret = runtimeEnv('QUVOTO_LEGAL_CONSENT_SECRET') || '';
  const consent = await verifySignedLegalConsentToken(consentToken, secret);
  if (!consent) {
    return NextResponse.json({ error: 'لم نعثر على موافقة قانونية صالحة. أعد تأكيد الشروط والخصوصية.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch {
    return NextResponse.json({ error: 'تعذّر حفظ الموافقة الآن. أعد المحاولة.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const { error: consentError } = await admin.from('legal_consents').insert({
    user_id: data.user.id,
    terms_version: consent.termsVersion,
    privacy_version: consent.privacyVersion,
    source: 'aqarflow_whatsapp_otp',
    user_agent: request.headers.get('user-agent'),
  });
  if (consentError) {
    return NextResponse.json({ error: 'تعذّر حفظ سجل الموافقة. أعد المحاولة قبل المتابعة.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  await supabase.from('profiles').upsert({
    id: data.user.id,
    email: data.user.email ?? null,
    updated_at: new Date().toISOString(),
  });

  const response = NextResponse.json({ accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('quvoto_legal_consent', '', { maxAge: 0, path: '/' });
  return response;
}
