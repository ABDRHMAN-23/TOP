import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const urlHelper = await readFile(new URL('lib/supabase/url.ts', root), 'utf8');
const serverClient = await readFile(new URL('lib/supabase/server.ts', root), 'utf8');
const browserClient = await readFile(new URL('lib/supabase/browser.ts', root), 'utf8');
const patientRoute = await readFile(new URL('app/api/patients/route.ts', root), 'utf8');
const homePage = await readFile(new URL('app/page.tsx', root), 'utf8');

test('Supabase URL normalization strips one or more PostgREST path suffixes', () => {
  assert.ok(urlHelper.includes(".replace(/(?:\\/rest\\/v1)+\\/?$/i, '')"));
  assert.match(urlHelper, /parsed\.search = ''/);
  assert.match(urlHelper, /parsed\.hash = ''/);
});

test('server, browser, and anonymous patient clients all normalize Supabase URLs', () => {
  assert.match(serverClient, /normalizeSupabaseUrl\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/);
  assert.match(browserClient, /normalizeSupabaseUrl\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/);
  assert.match(patientRoute, /normalizeSupabaseUrl\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/);
});

test('production defaults to database mode and patient form never claims local-only persistence', () => {
  assert.match(homePage, /NEXT_PUBLIC_DEMO_MODE === 'true'/);
  assert.doesNotMatch(homePage, /سيتم إنشاء سجل محلي للعرض فقط ما لم يتم توصيل قاعدة البيانات/);
  assert.match(homePage, /databaseStatus === 'connected' \? 'متصل بقاعدة البيانات'/);
  assert.doesNotMatch(homePage, /href="\/sign-up" className="sign-in-link"/);
  assert.doesNotMatch(homePage, /href="\/sign-in" className="sign-in-link"/);
});
