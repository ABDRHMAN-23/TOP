/**
 * Deterministic safety helpers shared by the server pipeline and unit tests.
 * The language model is never allowed to mark its own content as clinician-confirmed.
 */
const PRESERVED_STATES = new Set(['not_collected', 'unknown', 'not_applicable', 'patient_reported']);

export function sanitizeModelDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Clinical draft must be a JSON object.');
  }
  const copy = structuredClone(input);
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'state')) {
      value.state = PRESERVED_STATES.has(value.state) ? value.state : 'ai_suggested';
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(copy);
  if (copy.uncertaintyFlags != null && !Array.isArray(copy.uncertaintyFlags)) {
    copy.uncertaintyFlags = ['تعذر التحقق من مؤشرات عدم اليقين؛ راجع السجل يدوياً.'];
  }
  if (!Array.isArray(copy.uncertaintyFlags)) copy.uncertaintyFlags = [];
  return copy;
}

export function validateRecordingByteCount(totalBytes, maxBytes = 15 * 1024 * 1024) {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) return { ok: false, reason: 'invalid_size' };
  if (totalBytes > maxBytes) return { ok: false, reason: 'too_large', maxBytes };
  return { ok: true, totalBytes };
}

export function normalizeUnknownState(value) {
  if (value === null || value === undefined || value === '') return 'not_collected';
  return value;
}
