import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeModelDraft, validateRecordingByteCount, normalizeUnknownState } from '../lib/clinical/safety.mjs';

test('model cannot self-confirm a diagnosis or prescription in nested arrays', () => {
  const input = {
    assessment: { value: 'caries', state: 'clinician_confirmed' },
    medications: [{ value: 'unknown medication', state: 'approved' }],
    patientStatement: { value: 'I want antibiotics', state: 'patient_reported' },
    allergy: { value: null, state: 'not_collected' },
  };
  const output = sanitizeModelDraft(input);
  assert.equal(output.assessment.state, 'ai_suggested');
  assert.equal(output.medications[0].state, 'ai_suggested');
  assert.equal(output.patientStatement.state, 'patient_reported');
  assert.equal(output.allergy.state, 'not_collected');
  assert.equal(input.assessment.state, 'clinician_confirmed', 'does not mutate provider output');
});

test('bad or missing uncertainty flags never stay as malformed type', () => {
  assert.deepEqual(sanitizeModelDraft({ uncertaintyFlags: 'none' }).uncertaintyFlags, ['تعذر التحقق من مؤشرات عدم اليقين؛ راجع السجل يدوياً.']);
  assert.deepEqual(sanitizeModelDraft({}).uncertaintyFlags, []);
});

test('invalid model output shape is rejected', () => {
  assert.throws(() => sanitizeModelDraft(null), TypeError);
  assert.throws(() => sanitizeModelDraft([]), TypeError);
});

test('recording limits reject empty/invalid sizes and oversized audio', () => {
  assert.equal(validateRecordingByteCount(0).ok, false);
  assert.equal(validateRecordingByteCount(Number.NaN).ok, false);
  assert.deepEqual(validateRecordingByteCount(2048), { ok: true, totalBytes: 2048 });
  assert.equal(validateRecordingByteCount(16 * 1024 * 1024).reason, 'too_large');
});

test('missing clinical values are not silently converted into negative findings', () => {
  assert.equal(normalizeUnknownState(null), 'not_collected');
  assert.equal(normalizeUnknownState(''), 'not_collected');
  assert.equal(normalizeUnknownState('explicitly_negative'), 'explicitly_negative');
});
