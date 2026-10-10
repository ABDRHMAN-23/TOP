const CURRENT_TERMS_VERSION = '2026-10-02';
const CURRENT_PRIVACY_VERSION = '2026-10-02';
const CONSENT_MAX_AGE_MS = 15 * 60 * 1000;

export type VerifiedLegalConsent = {
  termsVersion: string;
  privacyVersion: string;
  issuedAt: number;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey | null> {
  if (typeof secret !== 'string' || secret.trim().length < 32) return null;
  try {
    return await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  } catch {
    return null;
  }
}

/** Issue a short-lived, signed token after the user explicitly submits both legal checkboxes. */
export async function createSignedLegalConsentToken(
  secret: string,
  nowMs = Date.now(),
): Promise<string | null> {
  const key = await importHmacKey(secret);
  if (!key || !Number.isSafeInteger(nowMs) || nowMs < 0) return null;
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    version: 1,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    issuedAt: nowMs,
    nonce: encodeBase64Url(nonce),
  })));
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + encodeBase64Url(new Uint8Array(signature));
}

/** Verify server signature, exact document versions, nonce shape, and the short acceptance window. */
export async function verifySignedLegalConsentToken(
  token: unknown,
  secret: string,
  nowMs = Date.now(),
  maxAgeMs = CONSENT_MAX_AGE_MS,
): Promise<VerifiedLegalConsent | null> {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadBytes = decodeBase64Url(parts[0]);
  const signature = decodeBase64Url(parts[1]);
  const key = await importHmacKey(secret);
  if (!payloadBytes || !signature || !key) return null;
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    payload = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const validSignature = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(parts[0]),
  );
  if (!validSignature) return null;
  const issuedAt = payload.issuedAt;
  if (
    payload.version !== 1 ||
    payload.termsVersion !== CURRENT_TERMS_VERSION ||
    payload.privacyVersion !== CURRENT_PRIVACY_VERSION ||
    typeof issuedAt !== 'number' ||
    !Number.isSafeInteger(issuedAt) ||
    typeof nowMs !== 'number' ||
    !Number.isSafeInteger(nowMs) ||
    typeof maxAgeMs !== 'number' ||
    maxAgeMs < 1 ||
    nowMs - issuedAt < -30_000 ||
    nowMs - issuedAt > maxAgeMs ||
    typeof payload.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{22}$/.test(payload.nonce)
  ) return null;
  return { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, issuedAt };
}
