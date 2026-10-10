import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { parseMetaWhatsAppWebhook, verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedUtf8Body } from '@/lib/aqarflow/whatsapp-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verifyToken = runtimeEnv('META_WEBHOOK_VERIFY_TOKEN');
  if (!verifyToken) return new Response('Webhook is not configured.', { status: 503 });
  const valid = verifyMetaWebhookChallenge(url.searchParams.get('hub.mode'), url.searchParams.get('hub.verify_token'), verifyToken);
  if (!valid) return new Response('Forbidden.', { status: 403 });
  const challenge = url.searchParams.get('hub.challenge');
  if (!challenge || challenge.length > 512) return new Response('Invalid challenge.', { status: 400 });
  return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const appSecret = runtimeEnv('META_APP_SECRET');
  if (!appSecret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const body = await readBoundedUtf8Body(request, 524_288);
  if (!body.ok) {
    return NextResponse.json({ error: body.reason === 'too_large' ? 'Payload too large.' : 'Invalid payload.' }, { status: body.reason === 'too_large' ? 413 : 400 });
  }
  const signature = request.headers.get('x-hub-signature-256');
  if (!(await verifyMetaWebhookSignature(body.text, signature, appSecret))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let payload: unknown;
  try { payload = JSON.parse(body.text); }
  catch { return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }); }
  const events = parseMetaWhatsAppWebhook(payload);
  if (events.length === 0) return NextResponse.json({ received: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: 'Webhook storage is unavailable.' }, { status: 503 }); }

  const phoneNumberIds = Array.from(new Set(events.map((event) => event.phoneNumberId)));
  const integrationsByPhoneId = new Map<string, { id: string; owner_user_id: string }>();
  for (const phoneNumberId of phoneNumberIds) {
    const { data, error } = await admin.from('aqarflow_whatsapp_integrations')
      .select('id,owner_user_id').eq('phone_number_id', phoneNumberId).eq('status', 'active').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Webhook tenant mapping is not ready.' }, { status: 503 });
    integrationsByPhoneId.set(phoneNumberId, data);
  }

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const event of events) {
    const integration = integrationsByPhoneId.get(event.phoneNumberId);
    if (!integration) return NextResponse.json({ error: 'Webhook tenant mapping is missing.' }, { status: 503 });
    const row: Record<string, unknown> = {
      owner_user_id: integration.owner_user_id, integration_id: integration.id,
      phone_number_id: event.phoneNumberId, provider_event_key: event.eventKey,
      event_kind: event.kind, provider_message_id: event.messageId,
      sender_phone_number: event.senderPhoneNumber, message_type: event.messageType,
      message_text: event.messageText, provider_status: event.status,
      provider_timestamp: event.providerTimestamp,
      processing_status: event.kind === 'inbound_message' ? 'received' : 'processed',
    };
    const rows = grouped.get(integration.owner_user_id) || [];
    rows.push(row);
    grouped.set(integration.owner_user_id, rows);
  }

  for (const rows of grouped.values()) {
    const { error } = await admin.from('aqarflow_whatsapp_events')
      .upsert(rows, { onConflict: 'owner_user_id,provider_event_key', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Webhook event persistence failed.' }, { status: 503 });
  }
  return NextResponse.json({ received: true, eventCount: events.length }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
