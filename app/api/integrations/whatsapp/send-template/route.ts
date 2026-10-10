import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import {
  decryptMetaAccessToken, listMetaApprovedTextTemplates, normalizeWhatsAppPhone,
  sendMetaWhatsAppTemplate, sha256Hex, WhatsAppCloudApiError,
} from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function cleanText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
    : '';
}
function renderPreview(body: string, parameters: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, index: string) => parameters[Number(index) - 1] ?? '');
}

async function persistCrmOutbound(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  conversationId: string | null,
  preview: string,
  messageId: string,
) {
  if (!conversationId) return true;
  const now = new Date().toISOString();
  const { data: conversation, error: conversationError } = await admin.from('aqarflow_crm_conversations')
    .select('id,contact_id,integration_id,last_message_at,last_message_preview,updated_at')
    .eq('owner_user_id', ownerId).eq('id', conversationId).maybeSingle();
  if (conversationError || !conversation) return false;
  const { data: existingMessage, error: existingMessageError } = await admin.from('aqarflow_crm_messages')
    .select('created_at').eq('owner_user_id', ownerId).eq('provider_message_id', messageId).maybeSingle();
  if (existingMessageError) return false;
  const sentAt = existingMessage?.created_at || now;
  const { data: outboundRequest, error: outboundRequestError } = await admin.from('aqarflow_whatsapp_outbound_requests')
    .select('provider_status').eq('owner_user_id', ownerId).eq('provider_message_id', messageId).maybeSingle();
  if (outboundRequestError) return false;
  const { data: latestStatuses, error: latestStatusError } = await admin.from('aqarflow_whatsapp_events')
    .select('provider_status,provider_timestamp,received_at').eq('owner_user_id', ownerId)
    .eq('provider_message_id', messageId).eq('event_kind', 'delivery_status')
    .order('provider_timestamp', { ascending: false, nullsFirst: false }).order('received_at', { ascending: false }).limit(1);
  if (latestStatusError) return false;
  const providerStatus = latestStatuses?.[0]?.provider_status || outboundRequest?.provider_status || 'sent';
  if (latestStatuses?.[0]?.provider_status) {
    const { error: statusRepairError } = await admin.from('aqarflow_whatsapp_outbound_requests').update({ provider_status: providerStatus })
      .eq('owner_user_id', ownerId).eq('provider_message_id', messageId);
    if (statusRepairError) return false;
  }

  const { error: messageError } = await admin.from('aqarflow_crm_messages').upsert({
    owner_user_id: ownerId,
    conversation_id: conversationId,
    direction: 'outbound',
    channel: 'whatsapp',
    message_type: 'template',
    message_text: preview.slice(0, 4096),
    provider_message_id: messageId,
    provider_status: providerStatus,
    created_at: sentAt,
    sent_at: sentAt,
  }, { onConflict: 'owner_user_id,provider_message_id', ignoreDuplicates: true });
  if (messageError) return false;

  // An idempotent replay can repair a failed CRM write without replacing a newer preview.
  if (Date.parse(sentAt) >= Date.parse(conversation.last_message_at)) {
    const { error: updateError } = await admin.from('aqarflow_crm_conversations')
      .update({ last_message_at: sentAt, last_message_preview: preview.slice(0, 500), updated_at: now })
      .eq('owner_user_id', ownerId).eq('id', conversationId);
    if (updateError) return false;
  }
  return true;
}

export async function POST(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return response({ error: owner.message }, owner.status);

  const body = await readBoundedJson(request, 16_384);
  if (!body.ok) {
    return response({ error: body.reason === 'too_large' ? 'حجم الطلب أكبر من الحد.' : 'بيانات الطلب غير صالحة.' }, body.reason === 'too_large' ? 413 : 400);
  }
  if (!isRecord(body.value)) return response({ error: 'بيانات الطلب غير صالحة.' }, 400);

  const phoneNumberId = cleanText(body.value.phoneNumberId, 40);
  const to = normalizeWhatsAppPhone(body.value.to);
  const templateName = cleanText(body.value.templateName, 512);
  const language = cleanText(body.value.language, 40);
  const idempotencyKey = cleanText(body.value.idempotencyKey, 96);
  const conversationId = typeof body.value.conversationId === 'string' ? body.value.conversationId : null;
  const parametersRaw = body.value.parameters;
  if (
    !/^\d{5,40}$/.test(phoneNumberId) || !to ||
    !/^[a-z0-9_]{1,512}$/.test(templateName) ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) ||
    !/^[A-Za-z0-9_-]{8,96}$/.test(idempotencyKey) ||
    (conversationId !== null && !UUID.test(conversationId)) ||
    !Array.isArray(parametersRaw) || parametersRaw.length > 10 ||
    parametersRaw.some(value => typeof value !== 'string' || !cleanText(value, 1024))
  ) return response({ error: 'تحقق من رقم واتساب والقالب واللغة ومعاملات القالب ومفتاح منع التكرار.' }, 400);

  const parameters = (parametersRaw as string[]).map(value => cleanText(value, 1024));
  const encryptionKey = runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey) return response({ error: 'مفتاح تشفير واتساب غير مهيأ.' }, 503);

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return response({ error: 'تخزين واتساب الآمن غير متاح.' }, 503); }

  const { data: integration, error: integrationError } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,waba_id,phone_number_id,graph_api_version,access_token_ciphertext,access_token_iv,token_expires_at,status')
    .eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', phoneNumberId).maybeSingle();
  if (integrationError) return response({ error: 'تعذر التحقق من اتصال واتساب.' }, 503);
  if (!integration) return response({ error: 'رقم واتساب غير مرتبط بمساحة العمل.' }, 404);
  if (integration.status !== 'active' || !integration.access_token_ciphertext || !integration.access_token_iv) {
    return response({ error: 'اتصال واتساب يحتاج إلى إعادة التفويض.' }, 409);
  }
  if (integration.token_expires_at && Date.parse(integration.token_expires_at) <= Date.now() + 60_000) {
    await admin.from('aqarflow_whatsapp_integrations').update({ status: 'needs_reauth', updated_at: new Date().toISOString() })
      .eq('owner_user_id', owner.ownerUserId).eq('id', integration.id);
    return response({ error: 'انتهت صلاحية تفويض واتساب؛ أعد ربط الرقم.' }, 409);
  }

  if (conversationId) {
    const { data: conversation, error } = await admin.from('aqarflow_crm_conversations')
      .select('id,contact_id,integration_id')
      .eq('owner_user_id', owner.ownerUserId).eq('id', conversationId).maybeSingle();
    if (error) return response({ error: 'تعذر التحقق من المحادثة.' }, 503);
    if (!conversation || conversation.integration_id !== integration.id) {
      return response({ error: 'المحادثة لا تتبع رقم واتساب المحدد.' }, 404);
    }
    const { data: contact, error: contactError } = await admin.from('aqarflow_crm_contacts')
      .select('phone_number').eq('owner_user_id', owner.ownerUserId).eq('id', conversation.contact_id).maybeSingle();
    if (contactError) return response({ error: 'تعذر التحقق من جهة الاتصال.' }, 503);
    if (!contact || contact.phone_number !== to) {
      return response({ error: 'رقم المستلم لا يطابق جهة الاتصال في المحادثة.' }, 409);
    }
  }

  let accessToken: string;
  try {
    accessToken = await decryptMetaAccessToken(integration.access_token_ciphertext, integration.access_token_iv, encryptionKey);
  } catch {
    return response({ error: 'تعذر فك تشفير اعتماد واتساب؛ تحقق من مفتاح الخادم.' }, 503);
  }

  // Only templates currently returned by Meta as APPROVED and supported by our text-only
  // composer can be sent. This does not attempt to approve or create templates.
  let template: Awaited<ReturnType<typeof listMetaApprovedTextTemplates>>[number] | undefined;
  try {
    const templates = await listMetaApprovedTextTemplates({
      graphApiVersion: integration.graph_api_version,
      wabaId: integration.waba_id,
      accessToken,
    });
    template = templates.find(item => item.name === templateName && item.language === language);
  } catch {
    return response({ error: 'تعذر التحقق من القالب المعتمد من Meta. أعد المحاولة لاحقًا.' }, 502);
  }
  if (!template) return response({ error: 'القالب غير معتمد أو لا يدعم الإرسال النصي في هذه الواجهة.' }, 422);
  if (parameters.length !== template.parameterCount) {
    return response({ error: 'عدد المعاملات لا يطابق المتغيرات الموجودة في نص القالب.' }, 400);
  }
  const preview = renderPreview(template.bodyText, parameters);
  if (preview.length > 4096) return response({ error: 'النص النهائي للقالب يتجاوز الحد الذي يمكن حفظه في سجل المحادثة.' }, 400);
  const requestHash = await sha256Hex([
    phoneNumberId, to, templateName, language, JSON.stringify(parameters), conversationId || '',
  ].join('\n'));

  const { data: existing, error: existingError } = await admin.from('aqarflow_whatsapp_outbound_requests')
    .select('request_hash,status,provider_message_id')
    .eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existingError) return response({ error: 'تعذر التحقق من سجل منع التكرار.' }, 503);
  if (existing) {
    if (existing.request_hash !== requestHash) {
      return response({ error: 'مفتاح منع التكرار مستخدم لطلب مختلف.' }, 409);
    }
    if (existing.status === 'sent' && existing.provider_message_id) {
      const persisted = await persistCrmOutbound(admin, owner.ownerUserId, conversationId, preview, existing.provider_message_id);
      return response({ sent: true, persisted, retryAllowed: !persisted, messageId: existing.provider_message_id, replayed: true });
    }
    return response({
      error: 'سبق حجز هذا المفتاح. لن يعاد الإرسال تلقائيًا؛ تحقق من حالة الرسالة قبل إنشاء طلب جديد.',
      idempotencyKey,
    }, 409);
  }

  const { error: claimError } = await admin.from('aqarflow_whatsapp_outbound_requests').insert({
    owner_user_id: owner.ownerUserId,
    integration_id: integration.id,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    phone_number_id: phoneNumberId,
    recipient_phone_number: to,
    status: 'pending',
  });
  if (claimError) return response({ error: 'تعذر حجز مفتاح الإرسال بأمان. لا تكرر الإرسال بمفتاح جديد قبل التحقق.' }, 409);

  try {
    const sent = await sendMetaWhatsAppTemplate({
      graphApiVersion: integration.graph_api_version,
      phoneNumberId,
      accessToken,
      to,
      templateName,
      language,
      parameters,
    });
    const { error: updateError } = await admin.from('aqarflow_whatsapp_outbound_requests')
      .update({ status: 'sent', provider_message_id: sent.messageId, sent_at: new Date().toISOString() })
      .eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey);
    if (updateError) {
      return response({ sent: true, persisted: false, retryAllowed: false, messageId: sent.messageId, idempotencyKey }, 202);
    }
    const persisted = await persistCrmOutbound(admin, owner.ownerUserId, conversationId, preview, sent.messageId);
    return response({ sent: true, persisted, retryAllowed: !persisted, messageId: sent.messageId, replayed: false }, persisted ? 200 : 202);
  } catch (error) {
    const knownRejection = error instanceof WhatsAppCloudApiError && error.httpStatus >= 400 && error.httpStatus < 500;
    await admin.from('aqarflow_whatsapp_outbound_requests')
      .update({
        status: knownRejection ? 'failed' : 'unknown',
        failure_code: error instanceof WhatsAppCloudApiError ? error.code : 'provider_error',
      })
      .eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey);
    return response({
      error: 'لم تؤكد Meta إرسال القالب. لن تتم إعادة المحاولة تلقائيًا لتجنب إرسال نسخة مكررة.',
      idempotencyKey,
      // A provider 4xx is a definite rejection. The UI may generate a fresh idempotency key
      // for an explicit user retry; network/5xx outcomes remain ambiguous and must not retry.
      retryAllowed: knownRejection,
    }, 502);
  }
}
