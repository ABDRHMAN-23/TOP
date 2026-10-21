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
const workspaceHelpers = await readFile(new URL('lib/supabase/test-workspace.ts', root), 'utf8');

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
  assert.ok(modulesMigration.includes('create table if not exists public.sinan_test_workspace_records'));
  assert.ok(modulesMigration.includes('enable row level security'));
  assert.ok(modulesMigration.includes('revoke all on table public.sinan_test_workspace_records from public, anon, authenticated'));
  assert.match(modulesMigration, /security definer/i);
  assert.ok(modulesMigration.includes('grant execute on function public.sinan_test_upsert_record(uuid, text, uuid, uuid, jsonb) to anon, authenticated;'));
  assert.ok(workspaceHelpers.includes("client.rpc('sinan_test_list_records'"));
  assert.ok(workspaceHelpers.includes("client.rpc('sinan_test_upsert_record'"));
  assert.ok(workspaceRoute.includes('findPatient(input.patient_id)'));
});

test('only explicit token-bearing supported API paths are rewritten into test-workspace handlers', () => {
  assert.match(middleware, /x-sinan-test-workspace/);
  assert.match(middleware, /supportedTestWorkspaceRoute/);
  assert.ok(middleware.includes('NextResponse.rewrite'));
  assert.ok(middleware.includes("pathname !== '/api/patients'"));
  assert.ok(homePage.includes("headers.set('x-sinan-test-workspace', token)"));
});

const voiceWorkspaceRoute = await readFile(new URL('app/api/test-workspace-recordings/[...resource]/route.ts', root), 'utf8');
const voiceWorkspaceMigration = await readFile(new URL('supabase/migrations/20261021103758_sinan_test_workspace_audio_recordings.sql', root), 'utf8');

test('anonymous workspace records audio only in isolated consent-gated test tables', () => {
  assert.ok(workspaceRoute.includes('لا يمكن إنشاء تقرير قبل وجود مسودة سريرية محفوظة ومعتمدة.'));
  assert.ok(homePage.includes('isDemo={demoMode}'));
  assert.ok(homePage.includes('isTestWorkspace={Boolean(testWorkspaceToken)}'));
  assert.ok(homePage.includes('مساحة اختبار بلا تسجيل دخول'));
  assert.match(homePage, /disabled=\{!consent \|\| !patient\?\.id \|\| isDemo\}/);
  assert.ok(voiceWorkspaceRoute.includes("sinan_test_start_recording"));
  assert.ok(voiceWorkspaceRoute.includes("sinan_test_save_recording_chunk"));
  assert.ok(voiceWorkspaceRoute.includes("sinan_test_save_recording_result"));
  assert.doesNotMatch(voiceWorkspaceRoute, /requireUser\(|resolveOrganization\(/);
  assert.ok(voiceWorkspaceMigration.includes('create table if not exists public.sinan_test_recordings'));
  assert.ok(voiceWorkspaceMigration.includes('create table if not exists public.sinan_test_recording_chunks'));
  assert.ok(voiceWorkspaceMigration.includes('grant execute on function public.sinan_test_start_recording(uuid,uuid,text,boolean,text) to anon, authenticated'));
  assert.match(middleware, /audioWorkspaceRoute/);
  assert.ok(middleware.includes('/api/test-workspace-recordings/start'));
  assert.ok(middleware.includes('/api/test-workspace-recordings/process'));
});
