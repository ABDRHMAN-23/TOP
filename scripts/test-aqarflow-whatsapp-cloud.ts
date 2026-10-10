import assert from 'node:assert/strict';
import {
  decryptMetaAccessToken, encryptMetaAccessToken, normalizeWhatsAppPhone,
  parseMetaWhatsAppWebhook, sendMetaWhatsAppText, verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature, WhatsAppCloudApiError,
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
assert.equal(events[0].messageText, 'Hello AqarFlow');
assert.equal(events[1].messageText, null, 'non-text inbound types must not be coerced into text');
assert.equal(events[2].kind, 'delivery_status');
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

console.log('AqarFlow WhatsApp Cloud tests passed.');
