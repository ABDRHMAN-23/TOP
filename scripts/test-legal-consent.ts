import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSignedLegalConsentToken, verifySignedLegalConsentToken } from '../lib/security/legal-consent.ts';

const secret = 'legal-consent-test-secret-with-more-than-thirty-two-characters';
const now = 1_800_000_000_000;
const token = await createSignedLegalConsentToken(secret, now);
assert.ok(token, 'a sufficiently strong server secret should produce a token');
assert.ok(await verifySignedLegalConsentToken(token, secret, now), 'valid consent token should verify');
assert.equal(await verifySignedLegalConsentToken('2026-10-02', secret, now), null, 'plain client-controlled version must fail');
assert.equal(await verifySignedLegalConsentToken(token, 'different-server-secret-that-is-long-enough-to-be-valid', now), null, 'a different server secret must fail');
assert.equal(await verifySignedLegalConsentToken(token + 'x', secret, now), null, 'tampered token must fail');
assert.equal(await verifySignedLegalConsentToken(token, secret, now + 901_000), null, 'expired token must fail');
assert.equal(await verifySignedLegalConsentToken(token, secret, now - 60_000), null, 'future-issued token must fail');
assert.equal(await createSignedLegalConsentToken('short', now), null, 'short secret must fail closed');

const callback = readFileSync(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8');
const consentRoute = readFileSync(new URL('../app/api/legal-consent/route.ts', import.meta.url), 'utf8');
const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
assert.ok(callback.includes('verifySignedLegalConsentToken(consentToken, consentSecret)'), 'OAuth callback must verify signed consent');
assert.ok(!callback.includes("consentVersion !== '2026-10-02'"), 'OAuth callback must not trust a plaintext version cookie');
assert.ok(consentRoute.includes("httpOnly: true"), 'consent cookie must be HttpOnly');
assert.ok(consentRoute.includes("origin !== url.origin"), 'consent endpoint must reject cross-origin requests');
assert.ok(login.includes("fetch('/api/legal-consent'"), 'login must register consent through the server endpoint');
assert.ok(!login.includes('document.cookie'), 'login page must not create a trusted consent cookie directly');
console.log('Signed legal-consent security tests passed.');
