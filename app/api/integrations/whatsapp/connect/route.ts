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
  const rawPhoneNumberId = body.value.phoneNumberId;
  const requestedPhoneNumberId = isId(rawPhoneNumberId) ? rawPhoneNumberId : null;
  if (
    code.length < 4 || code.length > 4096 || !isId(wabaId) ||
    (rawPhoneNumberId !== undefined && rawPhoneNumberId !== null && requestedPhoneNumberId === null)
  ) {
    return NextResponse.json({ error: 'A valid Meta signup code and WABA ID are required; phone number ID is optional.' }, { status: 400 });
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
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  // Embedded Signup completion events can provide only a WABA ID. Resolve and verify
  // phone IDs server-side instead of depending on a phone_number_id in postMessage.
  const phoneUrl = new URL('https://graph.facebook.com/' + graphVersion + '/' + wabaId + '/phone_numbers');
  phoneUrl.searchParams.set('fields', 'id,display_phone_number,verified_name');
  phoneUrl.searchParams.set('limit', '100');
  let pageUrl: URL | null = phoneUrl;
  const phones = new Map<string, Record<string, unknown>>();
  let pageCount = 0;
  while (pageUrl && pageCount < 10) {
    const page = await fetchJson(pageUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!page.ok || !isRecord(page.data) || !Array.isArray(page.data.data)) {
      return NextResponse.json({ error: 'The authorized WhatsApp Business Account could not be verified.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    for (const candidate of page.data.data) {
      if (isRecord(candidate) && isId(candidate.id)) phones.set(candidate.id, candidate);
    }
    const paging = isRecord(page.data.paging) ? page.data.paging : null;
    const next = paging && typeof paging.next === 'string' ? paging.next : '';
    if (!next) {
      pageUrl = null;
    } else {
      try {
        const parsedNext = new URL(next);
        const expectedPath = '/' + graphVersion + '/' + wabaId + '/phone_numbers';
        if (parsedNext.protocol !== 'https:' || parsedNext.hostname !== 'graph.facebook.com' || parsedNext.pathname !== expectedPath) {
          return NextResponse.json({ error: 'Meta returned an invalid phone-number pagination URL.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
        }
        // Keep the bearer token out of URL query strings and logs.
        parsedNext.searchParams.delete('access_token');
        pageUrl = parsedNext;
      } catch {
        return NextResponse.json({ error: 'Meta returned an invalid phone-number pagination URL.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      }
    }
    pageCount += 1;
  }
  if (pageUrl) {
    return NextResponse.json({ error: 'This WABA has too many phone numbers to connect automatically. Restart Embedded Signup and select one phone number.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  const targetPhones = [...phones.values()].filter(phone =>
    requestedPhoneNumberId ? phone.id === requestedPhoneNumberId : true
  );
  if (targetPhones.length === 0) {
    return NextResponse.json({
      error: requestedPhoneNumberId
        ? 'The selected phone number does not belong to the authorized WABA.'
        : 'No eligible WhatsApp phone numbers were found for this WABA.',
    }, { status: requestedPhoneNumberId ? 403 : 422, headers: { 'Cache-Control': 'no-store' } });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: 'Secure integration storage is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }

  const phoneIds = targetPhones.map(phone => phone.id as string);
  const { data: existingRows, error: lookupError } = await admin.from('aqarflow_whatsapp_integrations')
    .select('owner_user_id,phone_number_id').in('phone_number_id', phoneIds);
  if (lookupError) return NextResponse.json({ error: 'Integration storage is not ready. Apply the WhatsApp migration first.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if ((existingRows || []).some(row => row.owner_user_id !== owner.ownerUserId)) {
    return NextResponse.json({ error: 'At least one WhatsApp number in this WABA is already linked to another workspace. Select a different number or resolve ownership first.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const integrationRows: Record<string, unknown>[] = [];
  try {
    for (const phone of targetPhones) {
      // AES-GCM requires a fresh IV per encryption, even when several WABA numbers share a token.
      const encrypted = await encryptMetaAccessToken(accessToken, encryptionKey);
      integrationRows.push({
        owner_user_id: owner.ownerUserId,
        waba_id: wabaId,
        phone_number_id: phone.id,
        display_phone_number: typeof phone.display_phone_number === 'string' ? phone.display_phone_number.slice(0, 40) : null,
        verified_name: typeof phone.verified_name === 'string' ? phone.verified_name.slice(0, 160) : null,
        graph_api_version: graphVersion,
        access_token_ciphertext: encrypted.ciphertext,
        access_token_iv: encrypted.iv,
        token_key_version: encrypted.keyVersion,
        token_expires_at: tokenExpiresAt,
        status: 'active',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    return NextResponse.json({ error: 'The server token-encryption key is invalid.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const subscribeUrl = new URL('https://graph.facebook.com/' + graphVersion + '/' + wabaId + '/subscribed_apps');
  const subscription = await fetchJson(subscribeUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken } });
  if (!subscription.ok) {
    return NextResponse.json({ error: 'Meta authorization succeeded, but webhook subscription did not. Check app permissions and retry setup.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const write = await admin.from('aqarflow_whatsapp_integrations')
    .upsert(integrationRows, { onConflict: 'owner_user_id,phone_number_id' });
  if (write.error) return NextResponse.json({ error: 'The verified connection could not be stored securely. Check if a phone number is linked to another workspace.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  return NextResponse.json({
    connected: true,
    connectedCount: integrationRows.length,
    integrations: integrationRows.map(row => ({
      phoneNumberId: row.phone_number_id,
      displayPhoneNumber: row.display_phone_number,
      verifiedName: row.verified_name,
      graphApiVersion: graphVersion,
      tokenExpiresAt,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status, headers: { 'Cache-Control': 'no-store' } });
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: 'Secure integration storage is unavailable.' }, { status: 503 }); }
  const { data, error } = await admin.from('aqarflow_whatsapp_integrations')
    .select('id,waba_id,phone_number_id,display_phone_number,verified_name,graph_api_version,status,last_verified_at,token_expires_at')
    .eq('owner_user_id', owner.ownerUserId).neq('status', 'disconnected').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load WhatsApp connections. Apply the migrations in development first.' }, { status: 503 });
  return NextResponse.json({ integrations: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const owner = await requireOwnerAccount();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status, headers: { 'Cache-Control': 'no-store' } });
  const body = await readBoundedJson(request, 4096);
  if (!body.ok || !isRecord(body.value) || !isId(body.value.phoneNumberId)) {
    return NextResponse.json({ error: 'A valid phoneNumberId is required.' }, { status: 400 });
  }
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: 'Secure integration storage is unavailable.' }, { status: 503 }); }
  const { data, error } = await admin.from('aqarflow_whatsapp_integrations')
    .update({ status: 'disconnected', access_token_ciphertext: null, access_token_iv: null, updated_at: new Date().toISOString() })
    .eq('owner_user_id', owner.ownerUserId).eq('phone_number_id', body.value.phoneNumberId).select('phone_number_id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not disconnect WhatsApp. Check the migration state.' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'WhatsApp number is not connected to this workspace.' }, { status: 404 });
  return NextResponse.json({ disconnected: true, phoneNumberId: data.phone_number_id }, { headers: { 'Cache-Control': 'no-store' } });
}
