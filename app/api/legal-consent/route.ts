import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/runtime-env';
import { readBoundedUtf8Body } from '@/lib/aqarflow/http-body';
import { createSignedLegalConsentToken } from '@/lib/security/legal-consent';

export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 4096;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!origin || origin !== url.origin || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
    return NextResponse.json({ error: 'طلب الموافقة غير صالح.' }, {
      status: 403, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, {
      status: 413, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const body = await readBoundedUtf8Body(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: 'تعذر قراءة طلب الموافقة.' }, {
      status: body.code === 'too_large' ? 413 : 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  let value: unknown;
  try { value = JSON.parse(body.text); }
  catch { return NextResponse.json({ error: 'صيغة طلب الموافقة غير صحيحة.' }, { status: 400 }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return NextResponse.json({ error: 'بيانات الموافقة غير صحيحة.' }, { status: 400 });
  }
  const input = value as Record<string, unknown>;
  if (
    input.termsAccepted !== true ||
    input.privacyAcknowledged !== true ||
    input.termsVersion !== '2026-10-02' ||
    input.privacyVersion !== '2026-10-02'
  ) {
    return NextResponse.json({ error: 'يجب تأكيد الموافقة على الشروط والإقرار بسياسة الخصوصية الحالية.' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const secret = runtimeEnv('QUVOTO_LEGAL_CONSENT_SECRET');
  if (!secret) {
    return NextResponse.json({ error: 'تسجيل الموافقة القانونية غير مهيأ على الخادم.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const token = await createSignedLegalConsentToken(secret);
  if (!token) {
    return NextResponse.json({ error: 'تعذر تأمين سجل الموافقة. حاول لاحقًا.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const response = NextResponse.json({ accepted: true, termsVersion: '2026-10-02', privacyVersion: '2026-10-02' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
  response.cookies.set('quvoto_legal_consent', token, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 900,
  });
  return response;
}
