import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { encryptMetaAccessToken } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{5,40}$/.test(value);
}
async function fetchJson(url: URL, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: init.signal || AbortSignal.timeout(12_000) });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
  } catch { return { ok: false, status: 0, data: null }; }
}

export async function POST(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status, headers: { 'Cache-Control': 'no-store' } });

  const body = await readBoundedJson(request, 8_192);
  if (!body.ok) {
    return NextResponse.json({ error: body.reason === 'too_large' ? 'Request too large.' : 'Invalid request body.' }, { status: body.reason === 'too_large' ? 413 : 400 });
  }
  if (!isRecord(body.value)) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const code = typeof body.value.code === 'string' ? body.value.code.trim() : '';
  const wabaId = body.value.wabaId;
  const phoneNumberId = body.value.phoneNumberId;
  if (code.length < 4 || code.length > 4096 || !isId(wabaId) || !isId(phoneNumberId)) {
    return NextResponse.json({ error: 'A valid Meta signup code, WABA ID, and phone number ID are required.' }, { status: 400 });
  }

  const graphVersion = (runtimeEnv('META_GRAPH_API_VERSION') || '').trim();
  const appId = runtimeEnv('META_APP_ID');
  const appSecret = runtimeEnv('META_APP_SECRET');
  const encryptionKey = runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  if (!/^v\d+\.\d+$/.test(graphVersion) || !appId || !appSecret || !encryptionKey) {
    return NextResponse.json({ error: 'WhatsApp integration is not configured on the server.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const exchangeUrl = new URL('https://graph.facebook.com/' + graphVersion + '/oauth/access_token');
  exchangeUrl.searchParams.set('client_id', appId);
  exchangeUrl.searchParams.set('client_secret', appSecret);
  exchangeUrl.searchParams.set('code', code);
  const exchanged = await fetchJson(exchangeUrl);
  if (!exchanged.ok || !isRecord(exchanged.data) || typeof exchanged.data.access_token !== 'string') {
    return NextResponse.json({ error: 'Meta authorization could not be completed. Restart Embedded Signup and try again.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  const accessToken = exchanged.data.access_token;
  const expiresIn = typeof exchanged.data.expires_in === 'number' && exchanged.data.expires_in > 0 ? exchanged.data.expires_in : null;

  const phoneUrl = new URL('https://graph.facebook.com/' + graphVersion + '/' + wabaId + '/phone_numbers');
  phoneUrl.searchParams.set('fields', 'id,display_phone_number,verified_name');
  const phoneResult = await fetchJson(phoneUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!phoneResult.ok || !isRecord(phoneResult.data) || !Array.isArray(phoneResult.data.data)) {
    return NextResponse.json({ error: 'The authorized WhatsApp Business Account could not be verified.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  const phone = phoneResult.data.data.find((item: unknown) => isRecord(item) && item.id === phoneNumberId);
  if (!isRecord(phone)) return NextResponse.json({ error: 'The selected phone number does not belong to the authorized WABA.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });

  const subscribeUrl = new URL('https://graph.facebook.com/' + graphVersion + '/' + wabaId + '/subscribed_apps');
  const subscription = await fetchJson(subscribeUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken } });
  if (!subscription.ok) {
    return NextResponse.json({ error: 'Meta authorization succeeded, but webhook subscription did not. Check app permissions and retry setup.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  let encrypted: { ciphertext: string; iv: string; keyVersion: 1 };
  try { encrypted = await encryptMetaAccessToken(accessToken, encryptionKey); }
  catch { return NextResponse.json({ error: 'The server token-encryption key is invalid.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: 'Secure integration storage is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }

  const { data: existing, error: lookupError } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,owner_user_id').eq('phone_number_id', phoneNumberId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Integration storage is not ready. Apply the WhatsApp migration first.' }, { status: 503 });
  if (existing && existing.owner_user_id !== owner.ownerUserId) {
    return NextResponse.json({ error: 'This WhatsApp number is already linked to another workspace.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const integrationRow = {
    owner_user_id: owner.ownerUserId, waba_id: wabaId, phone_number_id: phoneNumberId,
    display_phone_number: typeof phone.display_phone_number === 'string' ? phone.display_phone_number.slice(0, 40) : null,
    verified_name: typeof phone.verified_name === 'string' ? phone.verified_name.slice(0, 160) : null,
    graph_api_version: graphVersion, access_token_ciphertext: encrypted.ciphertext,
    access_token_iv: encrypted.iv, token_key_version: encrypted.keyVersion,
    token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    status: 'active', last_verified_at: now, updated_at: now,
  };
  const write = existing
    ? await admin.from('aqarflow_whatsapp_integrations').update(integrationRow).eq('id', existing.id)
    : await admin.from('aqarflow_whatsapp_integrations').insert(integrationRow);
  if (write.error) return NextResponse.json({ error: 'The verified connection could not be stored securely.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  return NextResponse.json({ connected: true, integration: {
    phoneNumberId, displayPhoneNumber: integrationRow.display_phone_number,
    verifiedName: integrationRow.verified_name, graphApiVersion: graphVersion,
    tokenExpiresAt: integrationRow.token_expires_at,
  } }, { headers: { 'Cache-Control': 'no-store' } });
}
