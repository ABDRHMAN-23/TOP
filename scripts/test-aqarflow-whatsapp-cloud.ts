import assert from 'node:assert/strict';
import {
  decryptMetaAccessToken, encryptMetaAccessToken, normalizeWhatsAppPhone,
  listMetaApprovedTextTemplates, parseMetaWhatsAppWebhook, sendMetaWhatsAppText, sendMetaWhatsAppTemplate,
  registerMetaWhatsAppPhone, verifyMetaWebhookChallenge, verifyMetaWebhookSignature, WhatsAppCloudApiError,
} from '../lib/aqarflow/whatsapp-cloud.ts';

const webcrypto = (await import('node:crypto')).webcrypto;
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

function hex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
  return result;
}

const appSecret = 'test-app-secret';
const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const validSignature = 'sha256=' + hex(new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(rawBody))));
assert.equal(await verifyMetaWebhookSignature(rawBody, validSignature, appSecret), true);
assert.equal(await verifyMetaWebhookSignature(rawBody + ' ', validSignature, appSecret), false);
assert.equal(await verifyMetaWebhookSignature(rawBody, 'sha1=' + validSignature.slice(7), appSecret), false);
assert.equal(await verifyMetaWebhookSignature(rawBody, null, appSecret), false);
assert.equal(verifyMetaWebhookChallenge('subscribe', 'expected-token', 'expected-token'), true);
assert.equal(verifyMetaWebhookChallenge('subscribe', 'wrong-token', 'expected-token'), false);
assert.equal(verifyMetaWebhookChallenge('unsubscribe', 'expected-token', 'expected-token'), false);

assert.equal(normalizeWhatsAppPhone('+1 (415) 555-0100'), '14155550100');
assert.equal(normalizeWhatsAppPhone('not-a-number'), null);
assert.equal(normalizeWhatsAppPhone('123'), null);

const payload = {
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '1234567890' },
    contacts: [{ wa_id: '14155550100', profile: { name: 'Rania Test' } }],
    messages: [
      { id: 'wamid.inbound-1', from: '14155550100', timestamp: '1780000000', type: 'text', text: { body: 'Hello AqarFlow' } },
      { id: 'wamid.image-2', from: '14155550101', timestamp: '1780000001', type: 'image', image: { id: 'media-id' } },
    ],
    statuses: [{ id: 'wamid.outbound-1', status: 'delivered', recipient_id: '14155550100', timestamp: '1780000002' }],
  } }] }],
};
const events = parseMetaWhatsAppWebhook(payload);
assert.equal(events.length, 3);
assert.equal(events[0].kind, 'inbound_message');
assert.equal(events[0].senderPhoneNumber, '14155550100');
assert.equal(events[0].senderDisplayName, 'Rania Test', 'Meta contact profile names should be mapped to the matching sender');
assert.equal(events[0].messageText, 'Hello AqarFlow');
assert.equal(events[1].senderDisplayName, null, 'profile names must not be assigned to a different sender');
assert.equal(events[1].messageText, null, 'non-text inbound types must not be coerced into text');
assert.equal(events[2].kind, 'delivery_status');
assert.equal(events[2].senderDisplayName, null);
assert.equal(events[2].status, 'delivered');
assert.equal(parseMetaWhatsAppWebhook({ object: 'wrong', entry: [] }).length, 0);

const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const encrypted = await encryptMetaAccessToken('never-return-this-token', key);
assert.notEqual(encrypted.ciphertext, 'never-return-this-token');
assert.equal(await decryptMetaAccessToken(encrypted.ciphertext, encrypted.iv, key), 'never-return-this-token');
await assert.rejects(() => decryptMetaAccessToken(encrypted.ciphertext, encrypted.iv, btoa('wrong')), /exactly 32 bytes/);

let capturedUrl = '';
let capturedAuthorization = '';
const capturedBody: { value: Record<string, unknown> | null } = { value: null };
const mockFetch: typeof fetch = async (input, init) => {
  capturedUrl = String(input);
  capturedAuthorization = new Headers(init?.headers).get('authorization') || '';
  capturedBody.value = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.sent-123' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const sent = await sendMetaWhatsAppText({
  graphApiVersion: 'v99.0', phoneNumberId: '1234567890', accessToken: 'private-server-token',
  to: '+1 (415) 555-0100', text: 'AqarFlow reply', fetcher: mockFetch,
});
assert.equal(sent.messageId, 'wamid.sent-123');
assert.equal(capturedUrl, 'https://graph.facebook.com/v99.0/1234567890/messages');
assert.equal(capturedAuthorization, 'Bearer private-server-token');
const actualBody = capturedBody.value as unknown as Record<string, unknown>;
assert.equal((actualBody.text as { body?: string })?.body, 'AqarFlow reply');
assert.equal(actualBody.to, '14155550100');

const failingFetch: typeof fetch = async () => new Response(JSON.stringify({ error: { message: 'secret provider detail' } }), { status: 400 });
await assert.rejects(
  () => sendMetaWhatsAppText({ graphApiVersion: 'v99.0', phoneNumberId: '1234567890', accessToken: 'token', to: '14155550100', text: 'hi', fetcher: failingFetch }),
  (error: unknown) => error instanceof WhatsAppCloudApiError && error.httpStatus === 400 && !error.message.includes('secret provider detail'),
);

// Approved template listing ignores unapproved and unsupported templates.
let templateLookupUrl = '';
let templateLookupAuthorization = '';
const templateLookupFetch: typeof fetch = async (input, init) => {
  templateLookupUrl = String(input);
  templateLookupAuthorization = new Headers(init?.headers).get('authorization') || '';
  return new Response(JSON.stringify({ data: [
    { name: 'welcome_text', language: 'ar', status: 'APPROVED', category: 'UTILITY',
      components: [{ type: 'BODY', text: 'مرحبًا {{1}}، عقارك: {{2}}' }] },
    { name: 'pending_text', language: 'ar', status: 'PENDING',
      components: [{ type: 'BODY', text: 'غير معتمد' }] },
    { name: 'media_template', language: 'ar', status: 'APPROVED',
      components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'مرحبًا' }] },
    { name: 'invalid_order', language: 'ar', status: 'APPROVED',
      components: [{ type: 'BODY', text: 'قيمة {{1}} ثم {{3}}' }] },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const templates = await listMetaApprovedTextTemplates({
  graphApiVersion: 'v26.0', wabaId: '1234567890', accessToken: 'private-server-token', fetcher: templateLookupFetch,
});
assert.equal(templates.length, 1, 'only approved supported text templates should be returned');
assert.equal(templates[0].name, 'welcome_text');
assert.equal(templates[0].parameterCount, 2);
assert.equal(templates[0].bodyText, 'مرحبًا {{1}}، عقارك: {{2}}');
assert.equal(templateLookupUrl.startsWith('https://graph.facebook.com/v26.0/1234567890/message_templates?'), true);
assert.equal(templateLookupAuthorization, 'Bearer private-server-token');

let templateSendUrl = '';
let templateSendAuthorization = '';
const templateSendBody: { value: Record<string, unknown> | null } = { value: null };
const templateSendFetch: typeof fetch = async (input, init) => {
  templateSendUrl = String(input);
  templateSendAuthorization = new Headers(init?.headers).get('authorization') || '';
  templateSendBody.value = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.template-123' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const templateSent = await sendMetaWhatsAppTemplate({
  graphApiVersion: 'v26.0', phoneNumberId: '1234567890', accessToken: 'private-server-token',
  to: '+1 (415) 555-0100', templateName: 'welcome_text', language: 'ar',
  parameters: ['Rania', 'Aden apartment'], fetcher: templateSendFetch,
});
assert.equal(templateSent.messageId, 'wamid.template-123');
assert.equal(templateSendUrl, 'https://graph.facebook.com/v26.0/1234567890/messages');
assert.equal(templateSendAuthorization, 'Bearer private-server-token');
const actualTemplateSend = templateSendBody.value as unknown as Record<string, unknown>;
assert.equal(actualTemplateSend.type, 'template');
assert.equal(actualTemplateSend.to, '14155550100');
const actualTemplate = actualTemplateSend.template as { name?: string; language?: { code?: string }; components?: Array<{ type?: string; parameters?: Array<{ text?: string }> }> };
assert.equal(actualTemplate.name, 'welcome_text');
assert.equal(actualTemplate.language?.code, 'ar');
assert.equal(actualTemplate.components?.[0]?.parameters?.[0]?.text, 'Rania');
assert.equal(actualTemplate.components?.[0]?.parameters?.[1]?.text, 'Aden apartment');

await assert.rejects(
  () => listMetaApprovedTextTemplates({
    graphApiVersion: 'v26.0', wabaId: '1234567890', accessToken: 'token',
    fetcher: (async () => new Response(JSON.stringify({
      data: [], paging: { next: 'https://attacker.example/v26.0/1234567890/message_templates' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch,
  }),
  (error: unknown) => error instanceof WhatsAppCloudApiError && error.code === 'template_list_invalid_pagination',
);
await assert.rejects(
  () => sendMetaWhatsAppTemplate({
    graphApiVersion: 'v26.0', phoneNumberId: '1234567890', accessToken: 'token',
    to: '14155550100', templateName: 'bad-name', language: 'ar', parameters: [],
    fetcher: templateSendFetch,
  }),
  /Invalid WhatsApp template name/,
);


// Phone registration must verify the existing number and must never resend an already connected registration.
let registrationCallCount = 0;
const alreadyRegistered = await registerMetaWhatsAppPhone({
  graphApiVersion: 'v26.0', phoneNumberId: '1234567890', accessToken: 'private-server-token', pin: '123456',
  fetcher: (async () => {
    registrationCallCount += 1;
    return new Response(JSON.stringify({ status: 'CONNECTED', code_verification_status: 'VERIFIED' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch,
});
assert.equal(alreadyRegistered.alreadyRegistered, true);
assert.equal(registrationCallCount, 1, 'already-connected phone should not be registered twice');

let registrationRequests = 0;
let registrationPayload: Record<string, unknown> | null = null;
const registered = await registerMetaWhatsAppPhone({
  graphApiVersion: 'v26.0', phoneNumberId: '1234567891', accessToken: 'private-server-token', pin: '654321',
  fetcher: (async (_input, init) => {
    registrationRequests += 1;
    if (registrationRequests === 1) {
      return new Response(JSON.stringify({ status: 'PENDING', code_verification_status: 'VERIFIED' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    registrationPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(String(_input), 'https://graph.facebook.com/v26.0/1234567891/register');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer private-server-token');
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch,
});
assert.equal(registered.registered, true);
assert.equal(registered.alreadyRegistered, false);
assert.equal(registrationRequests, 2);
assert.deepEqual(registrationPayload, { messaging_product: 'whatsapp', pin: '654321' });

await assert.rejects(
  () => registerMetaWhatsAppPhone({
    graphApiVersion: 'v26.0', phoneNumberId: '1234567891', accessToken: 'token', pin: '123456',
    fetcher: (async () => new Response(JSON.stringify({ status: 'PENDING', code_verification_status: 'NOT_VERIFIED' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch,
  }),
  (error: unknown) => error instanceof WhatsAppCloudApiError && error.code === 'phone_number_not_verified',
);
await assert.rejects(
  () => registerMetaWhatsAppPhone({
    graphApiVersion: 'v26.0', phoneNumberId: '1234567891', accessToken: 'token', pin: '12',
    fetcher: templateSendFetch,
  }),
  /exactly six digits/,
);

console.log('AqarFlow WhatsApp Cloud tests passed.');
