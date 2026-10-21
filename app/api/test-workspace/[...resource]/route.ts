import { NextResponse } from 'next/server';
import {
  getTestWorkspaceClient,
  getTestWorkspaceToken,
  listTestWorkspaceRecords,
  upsertTestWorkspaceRecord,
  type TestWorkspaceResource,
} from '@/lib/supabase/test-workspace';

const SINGLETON_ID = '00000000-0000-4000-8000-000000000001';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validAppointmentStatuses = new Set(['scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show']);
const historyCategories = new Set(['condition','allergy','medication','surgery','family_history','social_history','dental_history','other']);
const historyStates = new Set(['positive','explicitly_negative','not_asked','not_recorded','unknown','not_applicable','needs_review']);
const toothSurfaces = new Set(['mesial','distal','occlusal','incisal','buccal','lingual','palatal']);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
function asObject(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}
async function readBody(request: Request) {
  return asObject(await request.json().catch(() => null));
}
function defaultBookingHours() {
  return Array.from({ length: 7 }).flatMap((_, weekday) => [
    { weekday, shift: 'morning', enabled: false, start_time: '08:00', end_time: '12:00' },
    { weekday, shift: 'evening', enabled: false, start_time: '16:00', end_time: '20:00' },
  ]);
}

export async function GET(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  return handle(request, context, 'GET');
}
export async function POST(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  return handle(request, context, 'POST');
}
export async function PATCH(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  return handle(request, context, 'PATCH');
}
export async function DELETE(request: Request, context: { params: Promise<{ resource: string[] }> }) {
  return handle(request, context, 'DELETE');
}

async function handle(request: Request, context: { params: Promise<{ resource: string[] }> }, method: string) {
  const token = getTestWorkspaceToken(request);
  if (!token) return errorResponse('مساحة الاختبار غير معرّفة. أعد تحميل الصفحة.', 401);
  const client = getTestWorkspaceClient();
  if (!client) return errorResponse('اتصال قاعدة البيانات غير مهيأ.', 503);
  const { resource = [] } = await context.params;
  const [first, second, third] = resource;
  const rest = resource.length;
  const payload = method === 'POST' || method === 'PATCH' ? await readBody(request) : null;
  if ((method === 'POST' || method === 'PATCH') && !payload) return errorResponse('بيانات الطلب غير صالحة.');

  async function records(type: TestWorkspaceResource) {
    const result = await listTestWorkspaceRecords(client, token, type);
    if (result.error) throw new Error('تعذر قراءة مساحة الاختبار من قاعدة البيانات.');
    return result.data;
  }
  async function patientRows() {
    const result = await client.rpc('sinan_test_list_patients', { p_workspace_token: token });
    if (result.error) throw new Error('تعذر قراءة ملفات المرضى من قاعدة البيانات.');
    return Array.isArray(result.data) ? result.data : [];
  }
  async function findPatient(id: string) {
    if (!uuidPattern.test(id)) return null;
    return (await patientRows()).find((item: any) => item.id === id) || null;
  }
  async function put(type: TestWorkspaceResource, row: Record<string, any>, options: { id?: string | null; patientId?: string | null } = {}) {
    const result = await upsertTestWorkspaceRecord(client, token, type, row, { recordId: options.id ?? row.id ?? null, patientId: options.patientId ?? row.patient_id ?? null });
    if (result.error || !result.data) throw new Error('تعذر حفظ التغييرات في قاعدة البيانات.');
    return result.data;
  }
  async function get(type: TestWorkspaceResource, id: string) {
    const result = await client.rpc('sinan_test_get_record', { p_workspace_token: token, p_resource_type: type, p_record_id: id });
    if (result.error) throw new Error('تعذر قراءة السجل من قاعدة البيانات.');
    return result.data && typeof result.data === 'object' ? result.data as Record<string, any> : null;
  }

  try {
    // Home dashboard collections
    if (first === 'appointments' && second === 'booking-requests' && rest === 2 && method === 'GET') {
      return NextResponse.json({ requests: await records('booking_requests') }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (first === 'appointments' && rest === 1 && method === 'GET') {
      const query = new URL(request.url).searchParams;
      const from = query.get('from');
      const to = query.get('to');
      const rows = (await records('appointments')).filter((item: any) => {
        const start = Date.parse(item.scheduled_start || '');
        return Number.isFinite(start) && (!from || start >= Date.parse(from)) && (!to || start < Date.parse(to));
      }).sort((a: any, b: any) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start));
      const patients = await patientRows();
      const byId = new Map(patients.map((p: any) => [p.id, p]));
      return NextResponse.json({ appointments: rows.map((row: any) => ({ ...row, patients: byId.has(row.patient_id) ? { full_name: (byId.get(row.patient_id) as any).full_name } : null })) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (first === 'appointments' && rest === 1 && method === 'POST') {
      if (!payload || typeof payload.patient_id !== 'string' || !uuidPattern.test(payload.patient_id)) return errorResponse('اختر ملف مريض صحيحاً.');
      const patient = await findPatient(payload.patient_id);
      if (!patient) return errorResponse('المريض غير موجود في مساحة العمل الحالية.', 404);
      const start = Date.parse(String(payload.scheduled_start || ''));
      const end = Date.parse(String(payload.scheduled_end || ''));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return errorResponse('تحقق من وقت بداية الموعد ونهايته.');
      const appointment = await put('appointments', {
        patient_id: patient.id,
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString(),
        timezone: String(payload.timezone || 'Asia/Aden').slice(0, 80),
        appointment_type: String(payload.appointment_type || 'dental_visit').slice(0, 80),
        note: typeof payload.note === 'string' ? payload.note.slice(0, 2000) : null,
        status: 'scheduled',
        booking_source: 'workspace',
        booking_status: null,
      }, { patientId: patient.id });
      return NextResponse.json({ appointment: { ...appointment, patients: { full_name: patient.full_name } } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    if (first === 'appointments' && second && uuidPattern.test(second) && third === 'review-booking' && rest === 3 && method === 'POST') {
      const item = await get('appointments', second);
      if (!item) return errorResponse('طلب الموعد غير موجود في مساحة الاختبار.', 404);
      const action = payload?.action;
      if (action !== 'confirm' && action !== 'decline') return errorResponse('قرار الحجز غير صالح.');
      const updated = await put('appointments', { ...item, status: action === 'confirm' ? 'confirmed' : 'cancelled', booking_status: action === 'confirm' ? 'confirmed' : 'declined' }, { id: second, patientId: item.patient_id });
      return NextResponse.json({ appointment: updated, message: action === 'confirm' ? 'تم تأكيد الموعد.' : 'تم رفض الطلب.' });
    }
    if (first === 'appointments' && second && uuidPattern.test(second) && rest === 2 && method === 'PATCH') {
      const item = await get('appointments', second);
      if (!item) return errorResponse('الموعد غير موجود في مساحة الاختبار.', 404);
      const status = String(payload?.status || '');
      if (!validAppointmentStatuses.has(status)) return errorResponse('حالة الموعد غير صالحة.');
      const updated = await put('appointments', { ...item, status }, { id: second, patientId: item.patient_id });
      return NextResponse.json({ appointment: updated }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (first === 'clinic' && second === 'settings' && rest === 2) {
      if (method === 'GET') {
        const rows = await records('clinic_settings');
        return NextResponse.json({ settings: rows[0] || null }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (method === 'PATCH') {
        const name = String(payload?.clinic_name_ar || '').trim();
        if (name.length < 2 || name.length > 180) return errorResponse('أدخل اسم العيادة بالعربية بشكل صحيح.');
        const settings = await put('clinic_settings', {
          ...payload, clinic_name_ar: name,
          clinic_name_en: typeof payload?.clinic_name_en === 'string' ? payload.clinic_name_en.slice(0, 180) : null,
          address_ar: typeof payload?.address_ar === 'string' ? payload.address_ar.slice(0, 500) : null,
          address_en: typeof payload?.address_en === 'string' ? payload.address_en.slice(0, 500) : null,
          phone: typeof payload?.phone === 'string' ? payload.phone.slice(0, 40) : null,
          email: typeof payload?.email === 'string' ? payload.email.slice(0, 254) : null,
          website: typeof payload?.website === 'string' ? payload.website.slice(0, 500) : null,
          settings_version: Number(payload?.settings_version || 0) + 1,
        }, { id: SINGLETON_ID });
        return NextResponse.json({ settings }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (first === 'clinic' && second === 'booking-settings' && rest === 2) {
      if (method === 'GET') {
        const rows = await records('booking_settings');
        const saved = rows[0] || {};
        return NextResponse.json({ settings: saved.settings || saved, hours: Array.isArray(saved.hours) ? saved.hours : defaultBookingHours() }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (method === 'PATCH') {
        const { hours, ...settings } = payload || {};
        const safeHours = Array.isArray(hours) ? hours.slice(0, 14).map((item: any) => ({
          weekday: Math.max(0, Math.min(6, Number(item.weekday) || 0)),
          shift: item.shift === 'evening' ? 'evening' : 'morning',
          enabled: Boolean(item.enabled),
          start_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item.start_time || '')) ? item.start_time : '08:00',
          end_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item.end_time || '')) ? item.end_time : '12:00',
        })) : defaultBookingHours();
        const saved = await put('booking_settings', { settings, hours: safeHours }, { id: SINGLETON_ID });
        return NextResponse.json({ settings: saved.settings, hours: saved.hours }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (first === 'reports' && rest === 1 && method === 'GET') {
      return NextResponse.json({ reports: await records('reports') }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (first === 'reports' && method === 'POST') {
      return errorResponse('إنشاء تقرير طبي يحتاج إلى مسودة سريرية محفوظة ومعتمدة؛ لا يُنشئ سِنان تقريراً وهمياً في مساحة الاختبار.', 409);
    }
    if (first === 'review-queue' && rest === 1 && method === 'GET') {
      return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (first === 'patients' && second && uuidPattern.test(second)) {
      const patient = await findPatient(second);
      if (!patient) return errorResponse('المريض غير موجود في مساحة العمل الحالية.', 404);
      if (rest === 2 && method === 'GET') {
        const detail = await get('patient_details', second);
        const history = (await records('medical_history')).filter((item: any) => item.patient_id === second);
        return NextResponse.json({ patient: { ...patient, ...(detail || {}) }, history }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (rest === 2 && method === 'PATCH') {
        const fullName = String(payload?.full_name ?? patient.full_name).trim();
        const age = Object.prototype.hasOwnProperty.call(payload, 'reported_age_years') ? payload.reported_age_years : patient.reported_age_years;
        const complaint = Object.prototype.hasOwnProperty.call(payload, 'chief_complaint') ? payload.chief_complaint : patient.chief_complaint;
        if (fullName.length < 2 || fullName.length > 180 || (age != null && (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120))) return errorResponse('تحقق من اسم المريض والعمر.');
        const result = await client.rpc('sinan_test_update_patient', {
          p_workspace_token: token, p_patient_id: second, p_full_name: fullName,
          p_reported_age_years: age == null ? null : Number(age),
          p_chief_complaint: complaint == null ? null : String(complaint).slice(0, 2000),
        });
        if (result.error || !result.data) return errorResponse('تعذر تحديث ملف المريض في قاعدة البيانات.', 503);
        let detail: any = {};
        if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
          const phone = String(payload.phone || '').slice(0, 40);
          const savedDetail = await put('patient_details', { phone }, { id: second, patientId: second });
          detail = savedDetail;
        } else {
          detail = (await get('patient_details', second)) || {};
        }
        return NextResponse.json({ patient: { ...(result.data as any), ...(detail || {}) } }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const resourceBySegment: Record<string, TestWorkspaceResource> = {
        odontogram: 'odontogram', endodontics: 'endodontics', history: 'medical_history', encounters: 'encounters',
      };
      const kind = third ? resourceBySegment[third] : undefined;
      if (kind && rest === 3 && method === 'GET' && kind !== 'encounters') {
        const items = (await records(kind)).filter((item: any) => item.patient_id === second);
        return NextResponse.json(kind === 'odontogram' ? { entries: items } : kind === 'endodontics' ? { cases: items } : { items }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (kind === 'encounters' && rest === 3 && method === 'POST') {
        const encounter = await put('encounters', {
          patient_id: second, encounter_type: String(payload?.encounter_type || 'dental_visit').slice(0, 80),
          chief_complaint: typeof payload?.chief_complaint === 'string' ? payload.chief_complaint.slice(0, 2000) : null,
          status: 'draft',
        }, { patientId: second });
        return NextResponse.json({ encounter }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      }
      if (kind && rest === 3 && method === 'POST' && kind !== 'encounters') {
        let clean: Record<string, any> = { ...payload, patient_id: second };
        if (kind === 'odontogram') {
          const surfaces = Array.isArray(payload?.surfaces) ? payload.surfaces.filter((value: any) => toothSurfaces.has(value)).slice(0, 8) : [];
          if (!String(payload?.tooth_number || '').trim() || !String(payload?.status || '').trim()) return errorResponse('اكتب رقم السن والحالة.');
          clean = { tooth_number: String(payload.tooth_number).slice(0, 12), notation_system: ['FDI','Universal','Palmer'].includes(payload.notation_system) ? payload.notation_system : 'FDI', status: String(payload.status).slice(0, 100), surfaces, note: typeof payload.note === 'string' ? payload.note.slice(0, 4000) : null, state: ['needs_review','clinician_confirmed','corrected'].includes(payload.state) ? payload.state : 'needs_review', patient_id: second };
        } else if (kind === 'medical_history') {
          if (!historyCategories.has(String(payload?.category)) || !historyStates.has(String(payload?.state)) || !String(payload?.title || '').trim()) return errorResponse('تحقق من تصنيف المعلومة الصحية وحالتها.');
          clean = { category: payload.category, title: String(payload.title).trim().slice(0, 180), value: payload.value ?? null, state: payload.state, source: typeof payload.source === 'string' ? payload.source.slice(0, 3000) : null, patient_id: second };
        } else if (kind === 'endodontics') {
          if (!String(payload?.tooth_number || '').trim() || !Array.isArray(payload?.canals)) return errorResponse('أدخل رقم السن وبيانات القنوات.');
          clean = { ...payload, patient_id: second };
        }
        const saved = await put(kind, clean, { patientId: second });
        return NextResponse.json(kind === 'odontogram' ? { entry: saved } : kind === 'endodontics' ? { case: saved } : { item: saved }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    return errorResponse('هذا الإجراء غير متاح في مساحة الاختبار المباشرة.', 404);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'تعذر إتمام العملية في مساحة الاختبار.', 503);
  }
}
