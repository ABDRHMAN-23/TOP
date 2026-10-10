export type MetaEmbeddedSignupMetadata = { wabaId: string; phoneNumberId?: string };
export type MetaSignupMode = 'cloud_api' | 'coexistence';

const FINISH_EVENTS = new Set(['FINISH', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING']);

export function buildMetaSignupExtras(mode: MetaSignupMode): Record<string, unknown> {
  if (mode === 'coexistence') {
    return { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' };
  }
  return { setup: {} };
}

const META_ID = /^\d{5,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Parse only the documented Meta Embedded Signup message envelope; caller must verify event.origin. */
export function parseMetaEmbeddedSignupMessage(input: unknown): MetaEmbeddedSignupMetadata | null {
  let decoded: unknown = input;
  if (typeof decoded === 'string') {
    try { decoded = JSON.parse(decoded); } catch { return null; }
  }
  if (!isRecord(decoded) || decoded.type !== 'WA_EMBEDDED_SIGNUP' || typeof decoded.event !== 'string' || !FINISH_EVENTS.has(decoded.event)) return null;
  const data = isRecord(decoded.data) ? decoded.data : decoded;
  const wabaId = data.waba_id;
  if (typeof wabaId !== 'string' || !META_ID.test(wabaId)) return null;

  const rawPhoneId = data.phone_number_id;
  if (rawPhoneId !== undefined && (typeof rawPhoneId !== 'string' || !META_ID.test(rawPhoneId))) return null;
  return typeof rawPhoneId === 'string' ? { wabaId, phoneNumberId: rawPhoneId } : { wabaId };
}
