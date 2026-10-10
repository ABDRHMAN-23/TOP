export type MetaWebhookEvent = {
  eventKey: string;
  kind: 'inbound_message' | 'delivery_status';
  phoneNumberId: string;
  messageId: string;
  senderPhoneNumber: string | null;
  senderDisplayName: string | null;
  messageType: string | null;
  messageText: string | null;
  status: string | null;
  providerTimestamp: string | null;
};

export class WhatsAppCloudApiError extends Error {
  readonly httpStatus: number;
  readonly code: string;
  constructor(httpStatus: number, code: string) {
    super('WhatsApp Cloud API request failed.');
    this.name = 'WhatsAppCloudApiError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function normalizeTimestamp(value: unknown): string | null {
  const seconds = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 9_999_999_999) return null;
  try { return new Date(seconds * 1000).toISOString(); } catch { return null; }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}


function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function verifyMetaWebhookChallenge(mode: string | null, suppliedToken: string | null, expectedToken: string): boolean {
  if (mode !== 'subscribe' || !suppliedToken || !expectedToken) return false;
  return constantTimeEqual(suppliedToken, expectedToken);
}

export async function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !appSecret || !globalThis.crypto?.subtle) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
    let expected = '';
    for (const byte of signed) expected += byte.toString(16).padStart(2, '0');
    return constantTimeEqual(expected, match[1].toLowerCase());
  } catch { return false; }
}

export function normalizeWhatsAppPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(compact)) return null;
  return compact.replace(/^\+/, '');
}

export function parseMetaWhatsAppWebhook(payload: unknown): MetaWebhookEvent[] {
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];
  const events: MetaWebhookEvent[] = [];
  for (const entry of payload.entry.slice(0, 50)) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes.slice(0, 50)) {
      if (!isRecord(change) || change.field !== 'messages' || !isRecord(change.value)) continue;
      const value = change.value;
      const metadata = isRecord(value.metadata) ? value.metadata : {};
      const phoneNumberId = cleanString(metadata.phone_number_id, 40);
      if (!/^\d{5,40}$/.test(phoneNumberId)) continue;
      const contactNames = new Map<string, string>();
      if (Array.isArray(value.contacts)) {
        for (const contact of value.contacts.slice(0, 100)) {
          if (!isRecord(contact)) continue;
          const contactPhone = normalizeWhatsAppPhone(contact.wa_id);
          const profile = isRecord(contact.profile) ? contact.profile : {};
          const displayName = cleanString(profile.name, 160);
          if (contactPhone && displayName && !contactNames.has(contactPhone)) {
            contactNames.set(contactPhone, displayName);
          }
        }
      }
      if (Array.isArray(value.messages)) {
        for (const message of value.messages.slice(0, 100)) {
          if (!isRecord(message)) continue;
          const messageId = cleanString(message.id, 256);
          const sender = normalizeWhatsAppPhone(message.from);
          const type = cleanString(message.type, 40).toLowerCase();
          if (!messageId || !sender || !type) continue;
          const textObject = isRecord(message.text) ? message.text : {};
          const messageText = type === 'text' ? cleanString(textObject.body, 4096) : null;
          events.push({
            eventKey: 'message:' + messageId, kind: 'inbound_message', phoneNumberId, messageId,
            senderPhoneNumber: sender, senderDisplayName: contactNames.get(sender) || null,
            messageType: type, messageText: messageText || null,
            status: null, providerTimestamp: normalizeTimestamp(message.timestamp),
          });
        }
      }
      if (Array.isArray(value.statuses)) {
        for (const statusValue of value.statuses.slice(0, 100)) {
          if (!isRecord(statusValue)) continue;
          const messageId = cleanString(statusValue.id, 256);
          const status = cleanString(statusValue.status, 40).toLowerCase();
          const recipient = normalizeWhatsAppPhone(statusValue.recipient_id);
          const timestamp = normalizeTimestamp(statusValue.timestamp);
          if (!messageId || !status || !recipient || !timestamp) continue;
          events.push({
            eventKey: 'status:' + messageId + ':' + status + ':' + timestamp + ':' + recipient,
            kind: 'delivery_status', phoneNumberId, messageId, senderPhoneNumber: recipient, senderDisplayName: null,
            messageType: null, messageText: null, status, providerTimestamp: timestamp,
          });
        }
      }
      if (events.length >= 200) return events.slice(0, 200);
    }
  }
  return events.slice(0, 200);
}

export async function encryptMetaAccessToken(token: string, base64Key: string): Promise<{ ciphertext: string; iv: string; keyVersion: 1 }> {
  if (!token || !globalThis.crypto?.subtle) throw new Error('Web Crypto or token is unavailable.');
  const rawKey = decodeBase64(base64Key);
  if (rawKey.byteLength !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(new TextEncoder().encode(token))));
  return { ciphertext: encodeBase64(ciphertext), iv: encodeBase64(iv), keyVersion: 1 };
}

export async function decryptMetaAccessToken(ciphertext: string, ivValue: string, base64Key: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable.');
  const rawKey = decodeBase64(base64Key);
  if (rawKey.byteLength !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(decodeBase64(ivValue)) }, key, toArrayBuffer(decodeBase64(ciphertext)));
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  let result = '';
  for (const byte of digest) result += byte.toString(16).padStart(2, '0');
  return result;
}

export async function sendMetaWhatsAppText(options: {
  graphApiVersion: string; phoneNumberId: string; accessToken: string; to: string; text: string; fetcher?: typeof fetch;
}): Promise<{ messageId: string }> {
  const graphVersion = options.graphApiVersion.trim();
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('META_GRAPH_API_VERSION must be pinned explicitly.');
  if (!/^\d{5,40}$/.test(options.phoneNumberId)) throw new Error('Invalid WhatsApp phone number ID.');
  if (!options.accessToken || options.accessToken.length > 8192) throw new Error('Invalid WhatsApp access token.');
  const to = normalizeWhatsAppPhone(options.to);
  const messageText = cleanString(options.text, 4096);
  if (!to || !messageText) throw new Error('Invalid WhatsApp recipient or message text.');
  let response: Response;
  try {
    response = await (options.fetcher || fetch)('https://graph.facebook.com/' + graphVersion + '/' + options.phoneNumberId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + options.accessToken, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: messageText } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new WhatsAppCloudApiError(0, 'network_or_timeout'); }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(result) || !Array.isArray(result.messages)) {
    throw new WhatsAppCloudApiError(response.status, 'provider_rejected');
  }
  const first = result.messages[0];
  const messageId = isRecord(first) ? cleanString(first.id, 256) : '';
  if (!messageId) throw new WhatsAppCloudApiError(response.status, 'invalid_provider_response');
  return { messageId };
}


export type MetaApprovedTextTemplate = {
  name: string;
  language: string;
  category: string | null;
  bodyText: string;
  parameterCount: number;
};

function templateParameterCount(value: string): number | null {
  const indices = [...value.matchAll(/\\{\\{\\s*(\\d+)\\s*\\}\\}/g)].map(match => Number(match[1]));
  if (indices.some(index => !Number.isInteger(index) || index < 1 || index > 10)) return null;
  const max = indices.length ? Math.max(...indices) : 0;
  for (let index = 1; index <= max; index += 1) {
    if (!indices.includes(index)) return null;
  }
  return max;
}

function parseApprovedTextTemplate(value: unknown): MetaApprovedTextTemplate | null {
  if (!isRecord(value) || cleanString(value.status, 40).toUpperCase() !== 'APPROVED') return null;
  const name = cleanString(value.name, 512);
  const language = cleanString(value.language, 40);
  if (!/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) return null;
  if (!Array.isArray(value.components) || value.components.length > 10) return null;
  let bodyText = '';
  let hasBody = false;
  let supported = true;
  for (const raw of value.components) {
    if (!isRecord(raw)) { supported = false; break; }
    const type = cleanString(raw.type, 32).toUpperCase();
    if (type === 'BODY') {
      bodyText = cleanString(raw.text, 4096);
      hasBody = Boolean(bodyText);
    } else if (type === 'HEADER') {
      const format = cleanString(raw.format, 20).toUpperCase();
      const headerText = cleanString(raw.text, 1024);
      if (format !== 'TEXT' || !headerText || /\\{\\{\\s*\\d+\\s*\\}\\}/.test(headerText)) supported = false;
    } else if (type === 'FOOTER') {
      const footerText = cleanString(raw.text, 1024);
      if (!footerText || /\\{\\{\\s*\\d+\\s*\\}\\}/.test(footerText)) supported = false;
    } else {
      // Dynamic buttons, media headers, and unknown component types need a richer composer.
      supported = false;
    }
  }
  if (!supported || !hasBody) return null;
  const parameterCount = templateParameterCount(bodyText);
  if (parameterCount === null) return null;
  return {
    name,
    language,
    category: cleanString(value.category, 40) || null,
    bodyText,
    parameterCount,
  };
}

export async function listMetaApprovedTextTemplates(options: {
  graphApiVersion: string;
  wabaId: string;
  accessToken: string;
  fetcher?: typeof fetch;
}): Promise<MetaApprovedTextTemplate[]> {
  const graphVersion = options.graphApiVersion.trim();
  if (!/^v\\d+\\.\\d+$/.test(graphVersion)) throw new Error('META_GRAPH_API_VERSION must be pinned explicitly.');
  if (!/^\\d{5,40}$/.test(options.wabaId)) throw new Error('Invalid WhatsApp Business Account ID.');
  if (!options.accessToken || options.accessToken.length > 8192) throw new Error('Invalid WhatsApp access token.');
  const requestFetch = options.fetcher || fetch;
  const expectedPath = '/' + graphVersion + '/' + options.wabaId + '/message_templates';
  const firstUrl = new URL('https://graph.facebook.com' + expectedPath);
  firstUrl.searchParams.set('fields', 'name,status,language,category,components');
  firstUrl.searchParams.set('limit', '100');
  let pageUrl: URL | null = firstUrl;
  let pageCount = 0;
  const approved = new Map<string, MetaApprovedTextTemplate>();
  while (pageUrl && pageCount < 10) {
    let response: Response;
    try {
      response = await requestFetch(pageUrl, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + options.accessToken, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new WhatsAppCloudApiError(0, 'template_list_network_or_timeout');
    }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(result) || !Array.isArray(result.data)) {
      throw new WhatsAppCloudApiError(response.status, 'template_list_provider_rejected');
    }
    for (const raw of result.data.slice(0, 100)) {
      const template = parseApprovedTextTemplate(raw);
      if (template) approved.set(template.name + ':' + template.language, template);
    }
    const paging = isRecord(result.paging) ? result.paging : {};
    const next = typeof paging.next === 'string' ? paging.next : '';
    if (!next) {
      pageUrl = null;
    } else {
      try {
        const parsed = new URL(next);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'graph.facebook.com' || parsed.pathname !== expectedPath) {
          throw new Error('Invalid Graph API pagination path.');
        }
        parsed.searchParams.delete('access_token');
        pageUrl = parsed;
      } catch {
        throw new WhatsAppCloudApiError(502, 'template_list_invalid_pagination');
      }
    }
    pageCount += 1;
  }
  if (pageUrl) throw new WhatsAppCloudApiError(413, 'template_list_page_limit');
  return [...approved.values()].slice(0, 100);
}

export async function sendMetaWhatsAppTemplate(options: {
  graphApiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  parameters: string[];
  fetcher?: typeof fetch;
}): Promise<{ messageId: string }> {
  const graphVersion = options.graphApiVersion.trim();
  if (!/^v\\d+\\.\\d+$/.test(graphVersion)) throw new Error('META_GRAPH_API_VERSION must be pinned explicitly.');
  if (!/^\\d{5,40}$/.test(options.phoneNumberId)) throw new Error('Invalid WhatsApp phone number ID.');
  if (!options.accessToken || options.accessToken.length > 8192) throw new Error('Invalid WhatsApp access token.');
  const to = normalizeWhatsAppPhone(options.to);
  const name = options.templateName.trim();
  const language = options.language.trim();
  if (!to || !/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) {
    throw new Error('Invalid WhatsApp template name, language, or recipient.');
  }
  if (!Array.isArray(options.parameters) || options.parameters.length > 10) throw new Error('Invalid WhatsApp template parameters.');
  const parameters = options.parameters.map(value => cleanString(value, 1024));
  if (parameters.some(value => !value)) throw new Error('Template parameters must be non-empty text values.');
  const template: Record<string, unknown> = { name, language: { code: language } };
  if (parameters.length) template.components = [{
    type: 'body',
    parameters: parameters.map(text => ({ type: 'text', text })),
  }];
  let response: Response;
  try {
    response = await (options.fetcher || fetch)('https://graph.facebook.com/' + graphVersion + '/' + options.phoneNumberId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + options.accessToken, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WhatsAppCloudApiError(0, 'template_send_network_or_timeout');
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(result) || !Array.isArray(result.messages)) {
    throw new WhatsAppCloudApiError(response.status, 'template_send_provider_rejected');
  }
  const first = result.messages[0];
  const messageId = isRecord(first) ? cleanString(first.id, 256) : '';
  if (!messageId) throw new WhatsAppCloudApiError(response.status, 'template_send_invalid_provider_response');
  return { messageId };
}
