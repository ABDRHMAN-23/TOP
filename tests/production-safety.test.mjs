import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nextConfig = await readFile(new URL('../next.config.mjs', import.meta.url), 'utf8');
const healthRoute = await readFile(new URL('../app/api/health/route.ts', import.meta.url), 'utf8');
const errorBoundary = await readFile(new URL('../app/error.tsx', import.meta.url), 'utf8');
const loading = await readFile(new URL('../app/loading.tsx', import.meta.url), 'utf8');
const notFound = await readFile(new URL('../app/not-found.tsx', import.meta.url), 'utf8');

test('security headers apply to all routes and do not block the required microphone workflow', () => {
  assert.match(nextConfig, /async headers\(\)/);
  assert.match(nextConfig, /source: '\/:path\*'/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /microphone=\(self\)/);
  assert.match(nextConfig, /camera=\(\)/);
});

test('public liveness endpoint does not serialize environment configuration or clinical data', () => {
  assert.match(healthRoute, /Cache-Control/);
  assert.match(healthRoute, /ok: true/);
  assert.doesNotMatch(healthRoute, /process\.env|patient|transcript|clinic_settings|SUPABASE|GEMINI_API_KEY/i);
});

test('app error boundaries do not expose stack traces or error messages to users', () => {
  assert.match(errorBoundary, /تعذر فتح مساحة العمل/);
  assert.match(errorBoundary, /error\.digest/);
  assert.doesNotMatch(errorBoundary, /error\.stack|error\.message/);
  assert.match(notFound, /الصفحة غير موجودة/);
  assert.match(loading, /role="status"/);
});
