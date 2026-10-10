import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { decryptMetaAccessToken, listMetaApprovedTextTemplates, WhatsAppCloudApiError } from '@/lib/aqarflow/whatsapp-cloud';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic = 'force-dynamic';

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return response({ error: owner.message }, owner.status);

  const phoneNumberId = new URL(request.url).searchParams.get('phoneNumberId') || '';
  if (!/^\d{5,40}$/.test(phoneNumberId)) {
    return response({ error: 'معرف رقم واتساب غير صالح.' }, 400);
  }

  const encryptionKey = runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey) return response({ error: 'تشفير اتصال واتساب غير مهيأ على الخادم.' }, 503);

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return response({ error: 'تخزين اتصالات واتساب غير متاح.' }, 503); }

  const { data: integration, error } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,waba_id,phone_number_id,graph_api_version,access_token_ciphertext,access_token_iv,token_expires_at,status')
    .eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', phoneNumberId).maybeSingle();
  if (error) return response({ error: 'تعذر تحميل اتصال واتساب.' }, 503);
  if (!integration) return response({ error: 'رقم واتساب غير مرتبط بمساحة العمل هذه.' }, 404);
  if (integration.status !== 'active' || !integration.access_token_ciphertext || !integration.access_token_iv) {
    return response({ error: 'اتصال واتساب يحتاج إلى إعادة التفويض قبل جلب القوالب.' }, 409);
  }
  if (integration.token_expires_at && Date.parse(integration.token_expires_at) <= Date.now() + 60_000) {
    await admin.from('aqarflow_whatsapp_integrations').update({
      status: 'needs_reauth', updated_at: new Date().toISOString(),
    }).eq('owner_user_id', owner.ownerUserId).eq('id', integration.id);
    return response({ error: 'انتهت صلاحية تفويض واتساب أو قاربت الانتهاء؛ أعد ربط الرقم.' }, 409);
  }

  let accessToken: string;
  try { accessToken = await decryptMetaAccessToken(integration.access_token_ciphertext, integration.access_token_iv, encryptionKey); }
  catch { return response({ error: 'تعذر فك تشفير اعتماد واتساب؛ راجع مفتاح الخادم ثم أعد الربط عند الحاجة.' }, 503); }

  try {
    const templates = await listMetaApprovedTextTemplates({
      graphApiVersion: integration.graph_api_version,
      wabaId: integration.waba_id,
      accessToken,
    });
    return response({ templates, supportedShape: 'text_body_with_optional_static_text_header_footer' });
  } catch (error) {
    if (error instanceof WhatsAppCloudApiError && error.httpStatus >= 400 && error.httpStatus < 500) {
      return response({ error: 'رفض Meta طلب جلب القوالب. تحقق من صلاحيات حساب الأعمال ثم أعد المحاولة.' }, 502);
    }
    return response({ error: 'تعذر جلب القوالب المعتمدة من Meta الآن.' }, 502);
  }
}
