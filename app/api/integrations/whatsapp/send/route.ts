import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { decryptMetaAccessToken, normalizeWhatsAppPhone, sendMetaWhatsAppText, sha256Hex, WhatsAppCloudApiError } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic = 'force-dynamic';
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

export async function POST(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status, headers: { 'Cache-Control': 'no-store' } });
  const body = await readBoundedJson(request, 12_000);
  if (!body.ok) return NextResponse.json({ error: body.reason === 'too_large' ? 'Request too large.' : 'Invalid request body.' }, { status: body.reason === 'too_large' ? 413 : 400 });
  if (!isRecord(body.value)) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const phoneNumberId = typeof body.value.phoneNumberId === 'string' ? body.value.phoneNumberId : '';
  const to = normalizeWhatsAppPhone(body.value.to);
  const message = typeof body.value.text === 'string' ? body.value.text.replace(/[\u0000-\u0008\u000B\u000C-\u001F\u007F]/g, '').trim() : '';
  const idempotencyKey = typeof body.value.idempotencyKey === 'string' ? body.value.idempotencyKey.trim() : '';
  if (!/^\d{5,40}$/.test(phoneNumberId) || !to || !message || message.length > 4096 || !/^[A-Za-z0-9_-]{8,96}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: 'Valid phoneNumberId, recipient, text (1–4096 characters), and idempotencyKey are required.' }, { status: 400 });
  }

  const encryptionKey = runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey) return NextResponse.json({ error: 'WhatsApp token encryption is not configured.' }, { status: 503 });
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: 'Secure WhatsApp storage is unavailable.' }, { status: 503 }); }

  const { data: integration, error: integrationError } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,phone_number_id,graph_api_version,access_token_ciphertext,access_token_iv,token_expires_at,status')
    .eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', phoneNumberId).maybeSingle();
  if (integrationError || !integration) return NextResponse.json({ error: 'WhatsApp number is not connected to this workspace.' }, { status: 404 });
  if (integration.status !== 'active') return NextResponse.json({ error: 'WhatsApp connection needs attention before sending.' }, { status: 409 });
  if (integration.token_expires_at && Date.parse(integration.token_expires_at) <= Date.now() + 60_000) {
    await admin.from('aqarflow_whatsapp_integrations').update({ status: 'needs_reauth', updated_at: new Date().toISOString() }).eq('id', integration.id);
    return NextResponse.json({ error: 'WhatsApp authorization has expired; reconnect the number.' }, { status: 409 });
  }

  const { data: lastInbound, error: inboundError } = await admin.from('aqarflow_whatsapp_events')
    .select('provider_timestamp').eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', phoneNumberId)
    .eq('event_kind', 'inbound_message').eq('sender_phone_number', to).not('provider_timestamp', 'is', null)
    .order('provider_timestamp', { ascending: false }).limit(1).maybeSingle();
  if (inboundError) return NextResponse.json({ error: 'Could not verify the customer-service window.' }, { status: 503 });
  const inboundAt = lastInbound?.provider_timestamp ? Date.parse(lastInbound.provider_timestamp) : NaN;
  if (!Number.isFinite(inboundAt) || Date.now() - inboundAt < 0 || Date.now() - inboundAt >= CUSTOMER_SERVICE_WINDOW_MS) {
    return NextResponse.json({ error: 'Free-form replies are allowed only within 24 hours of the customer’s latest message. Approved template messaging is not implemented.' }, { status: 409 });
  }

  const requestHash = await sha256Hex(phoneNumberId + '\n' + to + '\n' + message);
  const { data: existing, error: existingError } = await admin.from('aqarflow_whatsapp_outbound_requests')
    .select('request_hash,status,provider_message_id').eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existingError) return NextResponse.json({ error: 'Could not check the outbound idempotency record.' }, { status: 503 });
  if (existing) {
    if (existing.request_hash !== requestHash) return NextResponse.json({ error: 'This idempotencyKey was already used for a different message.' }, { status: 409 });
    if (existing.status === 'sent' && existing.provider_message_id) {
      return NextResponse.json({ sent: true, messageId: existing.provider_message_id, replayed: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'This message key was already claimed and will not be resent automatically. Check delivery status before using a new key.', idempotencyKey }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const { error: claimError } = await admin.from('aqarflow_whatsapp_outbound_requests').insert({
    owner_user_id: owner.ownerUserId, integration_id: integration.id, idempotency_key: idempotencyKey,
    request_hash: requestHash, phone_number_id: phoneNumberId, recipient_phone_number: to, status: 'pending',
  });
  if (claimError) return NextResponse.json({ error: 'Could not safely claim this message key. Retry with the same key after checking status.', idempotencyKey }, { status: 409 });

  let accessToken: string;
  try { accessToken = await decryptMetaAccessToken(integration.access_token_ciphertext, integration.access_token_iv, encryptionKey); }
  catch {
    await admin.from('aqarflow_whatsapp_outbound_requests').update({ status: 'failed', failure_code: 'token_decryption_failed' }).eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey);
    return NextResponse.json({ error: 'WhatsApp credentials could not be decrypted; reconnect after checking server key configuration.' }, { status: 503 });
  }

  try {
    const result = await sendMetaWhatsAppText({ graphApiVersion: integration.graph_api_version, phoneNumberId, accessToken, to, text: message });
    const { error: updateError } = await admin.from('aqarflow_whatsapp_outbound_requests')
      .update({ status: 'sent', provider_message_id: result.messageId, sent_at: new Date().toISOString() })
      .eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey);
    if (updateError) return NextResponse.json({ sent: true, persisted: false, messageId: result.messageId, idempotencyKey }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ sent: true, messageId: result.messageId, replayed: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const knownRejection = error instanceof WhatsAppCloudApiError && error.httpStatus >= 400 && error.httpStatus < 500;
    await admin.from('aqarflow_whatsapp_outbound_requests').update({
      status: knownRejection ? 'failed' : 'unknown',
      failure_code: error instanceof WhatsAppCloudApiError ? error.code : 'provider_error',
    }).eq('owner_user_id', owner.ownerUserId).eq('idempotency_key', idempotencyKey);
    return NextResponse.json({ error: 'Meta did not confirm the message. The key will not be retried automatically to avoid duplicate sends.', idempotencyKey }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
