import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/analyze/route.ts', import.meta.url), 'utf8');
const bodyReader = readFileSync(new URL('../lib/aqarflow/http-body.ts', import.meta.url), 'utf8');

assert.match(route, /supabase\.auth\.getUser\(\)/);
assert.match(route, /readBoundedBytes\(req, MAX_ANALYZE_BODY_BYTES\)/);
assert.match(route, /MAX_AUDIO_BYTES = 20 \* 1024 \* 1024/);
assert.match(route, /MAX_NOTES_CHARS = 8_000/);
assert.match(route, /MAX_TRANSCRIPT_CHARS = 16_000/);
assert.match(route, /ALLOWED_AUDIO_MIME_TYPES/);
assert.match(route, /aqarflow_reserve_ai_request/);
assert.match(route, /aqarflow_record_ai_usage/);
assert.match(route, /AbortSignal\.timeout\(20_000\)/);
assert.match(route, /parsedUploadUrl\.origin !== allowedOrigin/);
assert.doesNotMatch(route, /error:\s*error\.message/);
assert.match(bodyReader, /totalBytes > maxBytes/);
assert.match(bodyReader, /reader\.cancel\(\)/);
assert.match(bodyReader, /new Uint8Array\(totalBytes\)/);
console.log('AqarFlow voice-analysis auth, quota, bounded-body, and provider-safety contracts passed.');
