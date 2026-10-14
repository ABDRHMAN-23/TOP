import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/202610120001_initial_clinical_workspace.sql', import.meta.url), 'utf8');
const app = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const finishRoute = await readFile(new URL('../app/api/recordings/[recordingId]/finish/route.ts', import.meta.url), 'utf8');
const pauseRoute = await readFile(new URL('../app/api/recordings/[recordingId]/pause/route.ts', import.meta.url), 'utf8');
const resumeRoute = await readFile(new URL('../app/api/recordings/[recordingId]/resume/route.ts', import.meta.url), 'utf8');
const aiRoute = await readFile(new URL('../app/api/ai/process-recording/route.ts', import.meta.url), 'utf8');

test('every public application table created by the migration enables row-level security', () => {
  const tables = [...migration.matchAll(/create table if not exists public\.([a-z_]+)/gi)].map(m => m[1]);
  const rls = new Set([...migration.matchAll(/alter table public\.([a-z_]+) enable row level security/gi)].map(m => m[1]));
  assert.ok(tables.length >= 20, `expected the clinical schema to cover core entities, got ${tables.length}`);
  assert.deepEqual(tables.filter(name => !rls.has(name)), []);
});

test('private audio bucket is configured as non-public and constrains upload content types', () => {
  assert.match(migration, /values\s*\('clinical-audio-private','clinical-audio-private',false,/i);
  assert.match(migration, /create policy sinan_audio_insert_clinical on storage\.objects/i);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\]/i);
});

test('clinical record cannot be treated as final without a clinician approval transition', () => {
  assert.match(finishRoute, /job_type: 'transcribe_and_structure'/);
  assert.match(aiRoute, /clinician_approval_required: true/);
  assert.match(aiRoute, /status: 'needs_review'/);
  assert.doesNotMatch(aiRoute, /status:\s*'approved'/);
});

test('recording UI creates a server session before capture and streams fragments instead of waiting until stop', () => {
  const serverSessionAt = app.indexOf("fetch('/api/recordings'");
  const recorderStartAt = app.indexOf('rec.start(5000)');
  assert.ok(serverSessionAt >= 0 && recorderStartAt > serverSessionAt, 'server session should be created before MediaRecorder starts');
  assert.match(app, /ondataavailable=/);
  assert.match(app, /uploadQueueRef\.current/);
  assert.match(app, /pendingChunksRef\.current/);
});

test('pause/resume have server-side state transition routes', () => {
  assert.match(pauseRoute, /transitionRecording\(request, ctx, 'paused'\)/);
  assert.match(resumeRoute, /transitionRecording\(request, ctx, 'capturing'\)/);
});

test('finish endpoint reuses an existing active job to reduce duplicate transcription jobs', () => {
  assert.match(finishRoute, /Idempotency: a repeated finish request returns the existing active job/);
  assert.match(finishRoute, /reused: true/);
});

const patientRoute = await readFile(new URL('../app/api/patients/route.ts', import.meta.url), 'utf8');
const patientDetailRoute = await readFile(new URL('../app/api/patients/[patientId]/route.ts', import.meta.url), 'utf8');
const appointmentRoute = await readFile(new URL('../app/api/appointments/route.ts', import.meta.url), 'utf8');
const recordingStartRoute = await readFile(new URL('../app/api/recordings/route.ts', import.meta.url), 'utf8');
const chunkRoute = await readFile(new URL('../app/api/recordings/[recordingId]/chunks/route.ts', import.meta.url), 'utf8');

test('patient directory for reception is a reduced view without clinical complaint fields', () => {
  assert.match(migration, /create or replace view public\.patient_directory as[\s\S]*?where public\.is_org_member\(organization_id\)/i);
  const viewSql = migration.match(/create or replace view public\.patient_directory as([\s\S]*?);/i)?.[1] || '';
  assert.doesNotMatch(viewSql, /chief_complaint|medical_history|diagnos/i);
  assert.match(migration, /create policy patients_clinical_select[\s\S]*?has_org_role\(organization_id, array\['owner','clinic_admin','dentist','clinician','assistant'\]\)/i);
  assert.match(patientRoute, /patient_directory/);
  assert.match(patientRoute, /canReadClinicalFields/);
});

test('clinical details and reports reject front-desk roles at the API boundary', () => {
  assert.match(patientDetailRoute, /تفاصيل التاريخ الصحي والزيارات متاحة للفريق السريري المخوّل فقط/);
  assert.match(migration, /create policy history_clinical_read[\s\S]*?has_org_role\(organization_id, array\['owner','clinic_admin','dentist','clinician','assistant'\]\)/i);
  assert.match(migration, /create policy reports_clinical_read[\s\S]*?has_org_role\(organization_id, array\['owner','clinic_admin','dentist','clinician'\]\)/i);
});

test('recording, consent, encounter and audit entry are created through one transactional database function', () => {
  const functionBody = migration.match(/create or replace function public\.start_clinical_recording\([\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(functionBody, /insert into public\.encounters/);
  assert.match(functionBody, /insert into public\.recording_consents/);
  assert.match(functionBody, /insert into public\.recording_sessions/);
  assert.match(functionBody, /insert into public\.audit_events/);
  assert.match(recordingStartRoute, /rpc\('start_clinical_recording'/);
  assert.match(migration, /revoke all on function public\.start_clinical_recording\(uuid,uuid,text,text\) from public, anon/i);
});

test('audio chunks normalize MIME types before storage and reject unsupported types', () => {
  assert.match(chunkRoute, /split\(';'\)\[0\]/);
  assert.match(chunkRoute, /allowedMimeTypes/);
  assert.match(chunkRoute, /contentType: rawMimeType/);
});

test('receptionist scheduling uses the restricted directory for patient validation and labels', () => {
  assert.match(appointmentRoute, /from\('patient_directory'\)/);
  assert.doesNotMatch(appointmentRoute, /select\([^)]*patients\(full_name/i);
  assert.match(migration, /create policy appointments_staff_insert[\s\S]*?receptionist/i);
  assert.match(migration, /create policy appointments_admin_delete[\s\S]*?array\['owner','clinic_admin','dentist'\]/i);
});

test('AI recording processing uses compare-and-set job claiming to reject concurrent workers', () => {
  assert.match(aiRoute, /Compare-and-set claim/);
  assert.match(aiRoute, /\.eq\('attempts', Number\(job\.attempts \|\| 0\)\)/);
  assert.match(aiRoute, /const claimableStatuses = \['queued', 'failed'\]/);
  assert.match(aiRoute, /claimableStatuses\.push\(job\.status\)/);
  assert.match(aiRoute, /\.in\('status', claimableStatuses\)/);
  assert.match(aiRoute, /if \(claimError \|\| !claimedJob\)/);
  assert.match(aiRoute, /Number\(job\.attempts \|\| 0\) >= 5/);
});

test('approved notes and historical versions cannot be directly mutated by authenticated clients', () => {
  assert.match(migration, /revoke all on public\.clinical_notes from anon, authenticated/i);
  assert.match(migration, /grant select, insert on public\.clinical_notes to authenticated/i);
  assert.match(migration, /create policy notes_clinical_insert[\s\S]*?status in \('draft','needs_review'\)[\s\S]*?approved_by is null/i);
  assert.match(migration, /create or replace function public\.approve_clinical_note[\s\S]*?insert into public\.approvals[\s\S]*?insert into public\.audit_events/i);
  assert.match(migration, /create or replace function public\.revise_clinical_note[\s\S]*?for update[\s\S]*?status='superseded'[\s\S]*?insert into public\.clinical_notes/i);
});

test('approval and revisions call atomic database functions rather than updating note state in separate requests', async () => {
  const approvalRoute = await readFile(new URL('../app/api/encounters/[encounterId]/approve/route.ts', import.meta.url), 'utf8');
  const noteRoute = await readFile(new URL('../app/api/clinical-notes/[noteId]/route.ts', import.meta.url), 'utf8');
  assert.match(approvalRoute, /rpc\('approve_clinical_note'/);
  assert.match(noteRoute, /rpc\('revise_clinical_note'/);
  assert.doesNotMatch(approvalRoute, /from\('clinical_notes'\)\.update/);
  assert.doesNotMatch(noteRoute, /from\('clinical_notes'\)\.update/);
});

test('encounter cannot be marked approved unless a final note with approver and timestamp exists', () => {
  assert.match(migration, /create or replace function public\.guard_encounter_approval[\s\S]*?status = 'approved'[\s\S]*?n\.status = 'approved'[\s\S]*?n\.approved_by is not null[\s\S]*?n\.approved_at is not null/i);
  assert.match(migration, /create trigger guard_encounter_approval_before_write/i);
});


test('abandoned processing workers can be reclaimed only after the stale-worker threshold and attempts stay bounded', () => {
  assert.match(aiRoute, /Date\.parse\(job\.started_at \|\| ''\) < Date\.now\(\) - 10 \* 60 \* 1000/);
  assert.match(aiRoute, /Number\(job\.attempts \|\| 0\) >= 5/);
  assert.match(aiRoute, /claimableStatuses\.push\(job\.status\)/);
});

test('same approval/revision retry is idempotent and one successor per note is enforced', () => {
  assert.match(migration, /clinical_notes_one_successor_idx on public\.clinical_notes\(supersedes_note_id\) where supersedes_note_id is not null/i);
  assert.match(migration, /v_note\.status = 'approved'[\s\S]*?already_approved/i);
  assert.match(migration, /v_old\.status = 'superseded'[\s\S]*?supersedes_note_id=v_old\.id[\s\S]*?already_revised/i);
});

test('private audio objects are linked to the recording creator rather than any clinician in the same tenant', () => {
  const policies = migration.slice(migration.indexOf('create policy sinan_audio_select_member'));
  assert.match(policies, /rs\.created_by = auth\.uid\(\)/);
  assert.match(policies, /rs\.capture_state in \('capturing','paused','uploading'\)/);
});

test('finish race returns the already-created processing job when the active-job uniqueness constraint wins', () => {
  assert.match(finishRoute, /If another finish request won the unique-index race/);
  assert.match(finishRoute, /if \(concurrentJob\)/);
  assert.match(finishRoute, /reused: true/);
});


test('patient initials use the first character of the first and last name tokens', () => {
  assert.match(app, /function getInitials\(fullName: string \| null \| undefined\): string/);
  assert.match(app, /const parts = String\(fullName \|\| ''\)\.trim\(\)\.split\(\/\\s\+\/u\)/);
  assert.match(app, /initials: getInitials\(p\.full_name \|\| 'م'\)/);
});

test('real audio capture is unavailable unless consent and a valid patient are present', () => {
  assert.match(app, /disabled=\{!consent \|\| !patient\?\.id \|\| isDemo\}/);
  assert.match(app, /if\(!consent\)\{setRecordingError\('يجب توثيق الموافقة قبل تشغيل الميكروفون\.'/);
  assert.match(recordingStartRoute, /consent_confirmed: z\.literal\(true\)/);
});

test('mobile navigation has an explicit trigger and dismissible backdrop', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(app, /className="mobile-menu-trigger icon-button"/);
  assert.match(app, /className="sidebar-backdrop"/);
  assert.match(app, /aria-label="إغلاق القائمة الجانبية"/);
  assert.match(css, /\.sidebar-backdrop\{[^}]*position:fixed/s);
  assert.match(css, /\.sidebar-backdrop\{[^}]*display:block/s);
});

test('appointment timeline uses a responsive grid to keep time, patient and status apart', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.timeline-item\{[\s\S]*?grid-template-areas:"time track avatar info status"/);
  assert.match(css, /grid-template-areas:"time track avatar info" "\. track \. status"/);
});

test('clinic settings show an unsaved-change save bar and clear dirty state after success', () => {
  assert.match(app, /function updateClinicSetting<[\s\S]*?setSettingsDirty\(true\)/);
  assert.match(app, /className="settings-sticky-save"/);
  assert.match(app, /setSettingsDirty\(false\); notify\('تم حفظ إعدادات العيادة\.'/);
});

test('reports and endodontics empty states provide a direct next action', () => {
  assert.match(app, /فتح السجلات السريرية/);
  assert.match(app, /إضافة أول ملف علاج عصب لهذا المريض/);
  assert.match(app, /الوحدة ومصدرها وحالة التحقق/);
});

test('patient phone values are consistently masked in the UI layer', () => {
  assert.match(app, /function maskPhoneForDisplay\(phone: string \| null \| undefined\): string/);
  assert.match(app, /phone: maskPhoneForDisplay\(p\.phone\)/);
});


test('clinical status badges are non-interactive labels with distinct icons for review, draft and approved states', () => {
  assert.ok(app.includes("function StatePill({state}:{state:string})"));
  assert.ok(app.includes("const Icon=c==='review'?AlertCircle:c==='approved'?CircleCheck:c==='draft'?FileText:null"));
  assert.ok(app.includes("aria-label={`الحالة: ${state}`}"));
  assert.ok(app.includes("state-pill ${c}"));
  assert.ok(app.includes('aria-hidden="true"'));
});

const reviewQueueRoute = await readFile(new URL('../app/api/review-queue/route.ts', import.meta.url), 'utf8');

test('Sinan dashboard uses a data-led workbench, real counts, and a global command palette', () => {
  assert.match(app, /className="workspace-page dashboard-workbench"/);
  assert.match(app, /setShowCommandPalette\(open => !open\)/);
  assert.match(app, /commandPatientResults/);
  assert.match(app, /const reviewCount = demoMode \? attentionPatients\.length : reviewQueue\.length/);
  assert.match(app, /const \[patients, setPatients\] = useState<Patient\[\]>\(\[\]\)/);
  assert.doesNotMatch(app, /createInitialAppointments|createDemoAppointments/);
  assert.doesNotMatch(app, /سارة محمد علي|عمر خالد صالح|ليلى عبدالكريم|عبدالله ياسر/);
  assert.match(app, /لا توجد ملفات مرضى بعد/);
  assert.doesNotMatch(app, /number="١٢٨"/);
  assert.doesNotMatch(app, /time="٩:٠٠" period="ص" patient=/);
});

test('clinical review queue is limited to one clinic and only unapproved clinical notes', () => {
  assert.match(reviewQueueRoute, /resolveOrganization\(supabase, user, request\)/);
  assert.match(reviewQueueRoute, /allowedRoles\.includes\(context\.role\)/);
  assert.match(reviewQueueRoute, /eq\('organization_id', context\.organizationId\)/);
  assert.match(reviewQueueRoute, /in\('status', \['draft', 'needs_review', 'ready_for_approval'\]\)/);
  assert.match(reviewQueueRoute, /from\('patient_directory'\)/);
  assert.match(reviewQueueRoute, /limit\(50\)/);
  assert.doesNotMatch(reviewQueueRoute, /from\('clinical_notes'\)\.select\('\*'\)/);
});

test('patient edit form is connected to the clinic-scoped patient PATCH endpoint', () => {
  assert.match(app, /async function savePatientEdits\(\)/);
  assert.match(app, /onClick=\{openPatientEdit\}/);
  assert.match(app, /method: 'PATCH'/);
  assert.match(patientDetailRoute, /eq\('id', patientId\)\.eq\('organization_id', context\.organizationId\)/);
  assert.match(patientDetailRoute, /action: 'patient\.updated'/);
});

const appointmentStatusRoute = await readFile(new URL('../app/api/appointments/[appointmentId]/route.ts', import.meta.url), 'utf8');

test('appointment status updates are validated, clinic-scoped, role-checked, and audited', () => {
  assert.match(appointmentStatusRoute, /export async function PATCH/);
  assert.match(appointmentStatusRoute, /status: z\.enum\(\['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'\]\)/);
  assert.match(appointmentStatusRoute, /resolveOrganization\(supabase, user, request\)/);
  assert.match(appointmentStatusRoute, /eq\('organization_id', context\.organizationId\)/);
  assert.match(appointmentStatusRoute, /action: 'appointment\.status_changed'/);
  assert.match(app, /async function updateAppointmentStatus\(appointmentId: string, status: string\)/);
  assert.match(app, /className="appointment-state-select"/);
});

const signInUi = await readFile(new URL('../app/sign-in/page.tsx', import.meta.url), 'utf8');
const uiStyles = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
const uiLocales = await readFile(new URL('../app/i18n.tsx', import.meta.url), 'utf8');

test('retired preview labels do not return to user-facing workspace screens', () => {
  const labels = /وضع العرض التجريبي|وضع عرض تجريبي|بيانات تجريبية|عرض تجريبي|بيانات العرض|مثال تجريبي|مسودة تجريبية|خيالية|تجريبية/;
  assert.doesNotMatch(app, labels);
  assert.doesNotMatch(signInUi, labels);
  assert.doesNotMatch(uiStyles, /\.demo-notice|\.connection-chip\.demo/);
  assert.doesNotMatch(uiLocales, labels);
  assert.match(app, /قاعدة البيانات غير متصلة/);
  assert.match(app, /الحفظ الدائم يتطلب اتصال قاعدة البيانات/);
});
