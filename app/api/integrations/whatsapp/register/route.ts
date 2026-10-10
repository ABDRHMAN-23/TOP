import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { decryptMetaAccessToken, registerMetaWhatsAppPhone, WhatsAppCloudApiError } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return response({ error: owner.message }, owner.status);

  const body = await readBoundedJson(request, 4_096);
  if (!body.ok) return response({ error: body.reason === 'too_large' ? 'حجم الطلب أكبر من الحد.' : 'بيانات الطلب غير صالحة.' }, body.reason === 'too_large' ? 413 : 400);
  if (!isRecord(body.value)) return response({ error: 'بيانات الطلب غير صالحة.' }, 400);

  const phoneNumberId = typeof body.value.phoneNumberId === 'string' ? body.value.phoneNumberId.trim() : '';
  const pin = typeof body.value.pin === 'string' ? body.value.pin.trim() : '';
  if (!/^\d{5,40}$/.test(phoneNumberId) || !/^\d{6}$/.test(pin)) {
    return response({ error: 'أدخل رقم واتساب الصحيح ورمز PIN المكون من 6 أرقام.' }, 400);
  }

  const encryptionKey = runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  const graphApiVersion = (runtimeEnv('META_GRAPH_API_VERSION') || '').trim();
  if (!encryptionKey || !/^v\d+\.\d+$/.test(graphApiVersion)) {
    return response({ error: 'إعدادات أمان واتساب غير مكتملة على الخادم.' }, 503);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return response({ error: 'التخزين الآمن لواتساب غير متاح.' }, 503); }

  const { data: integration, error } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,waba_id,phone_number_id,graph_api_version,access_token_ciphertext,access_token_iv,token_expires_at,status')
    .eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', phoneNumberId).maybeSingle();
  if (error) return response({ error: 'تعذر التحقق من ربط واتساب.' }, 503);
  if (!integration) return response({ error: 'رقم واتساب غير مرتبط بمساحة العمل هذه.' }, 404);
  if (integration.status !== 'active' || !integration.access_token_ciphertext || !integration.access_token_iv) {
    return response({ error: 'أعد تفويض رقم واتساب قبل تسجيله.' }, 409);
  }
  if (integration.token_expires_at && Date.parse(integration.token_expires_at) <= Date.now() + 60_000) {
    await admin.from('aqarflow_whatsapp_integrations').update({ status: 'needs_reauth', updated_at: new Date().toISOString() })
      .eq('owner_user_id', owner.ownerUserId).eq('id', integration.id);
    return response({ error: 'انتهت صلاحية تفويض واتساب أو قاربت الانتهاء؛ أعد ربط الرقم.' }, 409);
  }

  let accessToken: string;
  try { accessToken = await decryptMetaAccessToken(integration.access_token_ciphertext, integration.access_token_iv, encryptionKey); }
  catch { return response({ error: 'تعذر فك تشفير اعتماد واتساب؛ تحقق من مفتاح الخادم.' }, 503); }

  try {
    const result = await registerMetaWhatsAppPhone({
      graphApiVersion: integration.graph_api_version || graphApiVersion,
      phoneNumberId,
      accessToken,
      pin,
    });
    await admin.from('aqarflow_whatsapp_integrations')
      .update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('owner_user_id', owner.ownerUserId).eq('id', integration.id);
    // Do not persist or log the PIN. It is accepted for this request only.
    return response({ ...result, message: result.alreadyRegistered
      ? 'رقم واتساب مسجل بالفعل في Cloud API.'
      : 'تم تسجيل رقم واتساب في Cloud API.' });
  } catch (error) {
    if (error instanceof WhatsAppCloudApiError && error.code === 'phone_number_not_verified') {
      return response({ error: 'رقم الهاتف لم يُتحقق منه بعد. أكمل التحقق من الرقم في Meta ثم أعد المحاولة.' }, 409);
    }
    if (error instanceof WhatsAppCloudApiError && error.code === 'phone_registration_provider_rejected' && error.httpStatus >= 400 && error.httpStatus < 500) {
      return response({ error: 'رفض Meta تسجيل الرقم. تحقق من PIN المكوّن من 6 أرقام ومن إعدادات التحقق بخطوتين.' }, 422);
    }
    return response({ error: 'تعذر التحقق من حالة الرقم أو تسجيله مع Meta الآن.' }, 502);
  }
}
