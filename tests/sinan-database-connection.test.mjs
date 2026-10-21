import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const urlHelper = await readFile(new URL('lib/supabase/url.ts', root), 'utf8');
const serverClient = await readFile(new URL('lib/supabase/server.ts', root), 'utf8');
const browserClient = await readFile(new URL('lib/supabase/browser.ts', root), 'utf8');
const patientRoute = await readFile(new URL('app/api/patients/route.ts', root), 'utf8');
const homePage = await readFile(new URL('app/page.tsx', root), 'utf8');
const modulesMigration = await readFile(new URL('supabase/migrations/20261021095130_sinan_test_workspace_modules.sql', root), 'utf8');
const workspaceRoute = await readFile(new URL('app/api/test-workspace/[...resource]/route.ts', root), 'utf8');
const middleware = await readFile(new URL('middleware.ts', root), 'utf8');

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

test('other direct-workspace modules persist in a separate RLS-protected test table', () => {
  assert.match(modulesMigration, /create table if not exists public\\.sinan_test_workspace_records/i);
  assert.match(modulesMigration, /enable row level security/i);
  assert.match(modulesMigration, /revoke all on table public\\.sinan_test_workspace_records from public, anon, authenticated/i);
  assert.match(modulesMigration, /security definer/i);
  assert.match(modulesMigration, /grant execute on function public\\.sinan_test_upsert_record\\(uuid, text, uuid, uuid, jsonb\\) to anon, authenticated/i);
  assert.match(workspaceRoute, /sinan_test_list_records/);
  assert.match(workspaceRoute, /sinan_test_upsert_record/);
  assert.match(workspaceRoute, /findPatient\\(payload\\.patient_id\\)/);
});

test('only explicit token-bearing supported API paths are rewritten into test-workspace handlers', () => {
  assert.match(middleware, /x-sinan-test-workspace/);
  assert.match(middleware, /supportedTestWorkspaceRoute/);
  assert.match(middleware, /NextResponse\\.rewrite/);
  assert.match(middleware, /pathname !== '\\/api\\/patients'/);
  assert.match(homePage, /headers\\.set\\('x-sinan-test-workspace', token\\)/);
});

test('anonymous workspace refuses to simulate clinical report generation and disables unsecured audio capture', () => {
  assert.match(workspaceRoute, /لا يُنشئ سِنان تقريراً وهمياً/);
  assert.match(homePage, /isDemo=\\{demoMode \\|\\| Boolean\\(testWorkspaceToken\\)\\}/);
  assert.match(homePage, /التسجيل الصوتي غير مفعّل في مساحة الاختبار حتى يُربط بتخزين آمن ومعالجة سريرية/);
});
