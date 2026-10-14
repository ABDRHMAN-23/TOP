'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageButton, Localized, useLanguage } from './i18n';
import {
  Activity, AlertCircle, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock3, FileText, HeartPulse, Mic, Plus, Search, Settings, ShieldCheck,
  Stethoscope, Users, X, ArrowUpLeft, FilePlus2, Play, Sparkles, CircleCheck, Menu, Pencil
} from 'lucide-react';

type Patient = { id: string; displayId?: string; name: string; age: string; phone: string; visit: string; reason: string; state: string; initials: string; color: string };
const nav = [
  { key: 'dashboard', label: 'الرئيسية', icon: Activity },
  { key: 'patients', label: 'ملفات المرضى', icon: Users },
  { key: 'appointments', label: 'المواعيد', icon: CalendarDays },
  { key: 'scribe', label: 'تسجيل الزيارة', icon: Mic },
  { key: 'reports', label: 'التقارير والسجلات', icon: FileText },
];
const toothTop = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const toothBottom = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const primaryToothTop = [55,54,53,52,51,61,62,63,64,65];
const primaryToothBottom = [85,84,83,82,81,71,72,73,74,75];
const weekdayLabels = [
  {ar:'الأحد',en:'Sunday'},{ar:'الاثنين',en:'Monday'},{ar:'الثلاثاء',en:'Tuesday'},
  {ar:'الأربعاء',en:'Wednesday'},{ar:'الخميس',en:'Thursday'},{ar:'الجمعة',en:'Friday'},
  {ar:'السبت',en:'Saturday'},
];
const defaultBookingHours = () => Array.from({length:7}).flatMap((_,weekday)=>[
  {weekday,shift:'morning',enabled:false,start_time:'08:00',end_time:'12:00'},
  {weekday,shift:'evening',enabled:false,start_time:'16:00',end_time:'20:00'},
]);


function getInitials(fullName: string | null | undefined): string {
  const parts = String(fullName || '').trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return 'م';
  const first = Array.from(parts[0])[0] || 'م';
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('');
  return first + (Array.from(parts[parts.length - 1])[0] || '');
}

function maskPhoneForDisplay(phone: string | null | undefined): string {
  const raw = String(phone || '').trim();
  if (!raw || raw === '—') return '—';
  const digits = Array.from(raw).filter(character => /[0-9٠-٩۰-۹]/u.test(character));
  if (digits.length === 0) return '—';
  let countryCode = '';
  let localDigits = digits;
  if (raw.startsWith('+967') || raw.startsWith('٩٦٧') || raw.startsWith('967')) {
    countryCode = '+967';
    localDigits = digits.slice(3);
  } else if (raw.startsWith('00967') || raw.startsWith('٠٠٩٦٧')) {
    countryCode = '+967';
    localDigits = digits.slice(5);
  }
  if (localDigits.length === 0) localDigits = digits;
  const leading = localDigits.slice(0, Math.min(3, Math.max(1, localDigits.length - 2))).join('');
  const ending = localDigits.slice(-2).join('');
  return `${countryCode ? countryCode + ' ' : ''}${leading} ••• •• ${ending}`;
}

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
function dateInputForAden(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function arabicDateForAden(value = new Date()) {
  return new Intl.DateTimeFormat('ar-YE', { timeZone: 'Asia/Aden', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
}
function shiftAdenDate(date: string, amount: number) { const value = new Date(date + 'T12:00:00+03:00'); value.setUTCDate(value.getUTCDate() + amount); return dateInputForAden(value); }
function englishDateForAden(value = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Aden', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
}

export default function HomePage() {
  const { language } = useLanguage();
  const [active, setActive] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');
  const [search, setSearch] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTooth, setSelectedTooth] = useState(46);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientPhone, setEditPatientPhone] = useState('');
  const [editPatientComplaint, setEditPatientComplaint] = useState('');
  const [patientSaving, setPatientSaving] = useState(false);
  const [showScribe, setShowScribe] = useState(false);
  const [showManualVisit, setShowManualVisit] = useState(false);
  const [manualComplaint, setManualComplaint] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [name, setName] = useState('');
  const [complaint, setComplaint] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadError, setLoadError] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState('');
  const [clinicName, setClinicName] = useState('مساحة العيادة');
  const [showOrganizationPicker, setShowOrganizationPicker] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [reviewQueueAccessDenied, setReviewQueueAccessDenied] = useState(false);
  const [clinicSettings, setClinicSettings] = useState({ clinic_name_ar: '', clinic_name_en: '', address_ar: '', address_en: '', phone: '', email: '', website: '', default_report_language: 'ar', paper_size: 'A4', tooth_notation: 'FDI', recording_policy_version: 'clinic-policy-v1', audio_retention_days: 30 });
  const [bookingSettings, setBookingSettings] = useState({ public_slug: '', booking_enabled: false, slot_minutes: 30, max_bookings_per_slot: 1, advance_booking_days: 30, min_notice_minutes: 60, public_title_ar: '', public_title_en: '', public_message_ar: '', public_message_en: '', require_phone: true });
  const [bookingHours, setBookingHours] = useState<any[]>(defaultBookingHours());
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingLoaded, setBookingLoaded] = useState(false);
  const [bookingOrigin, setBookingOrigin] = useState('');
  const [bookingDecisionBusyId, setBookingDecisionBusyId] = useState('');
  const [dentition, setDentition] = useState<'permanent'|'primary'>('permanent');
  const [toothSurfaces, setToothSurfaces] = useState<string[]>([]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [showToothEntry, setShowToothEntry] = useState(false);
  const [toothStatus, setToothStatus] = useState('');
  const [toothNote, setToothNote] = useState('');
  const [toothEntryState, setToothEntryState] = useState<'needs_review'|'clinician_confirmed'|'corrected'>('needs_review');
  const [toothEntries, setToothEntries] = useState<any[]>([]);
  const [toothSaving, setToothSaving] = useState(false);
  const [showEndoForm, setShowEndoForm] = useState(false);
  const [endodonticCases, setEndodonticCases] = useState<any[]>([]);
  const [endoTooth, setEndoTooth] = useState('46');
  const [endoDiagnosis, setEndoDiagnosis] = useState('');
  const [endoStage, setEndoStage] = useState<'planned'|'in_progress'|'completed'|'deferred'|'stopped'>('planned');
  const [endoFollowUp, setEndoFollowUp] = useState('');
  const [endoCanals, setEndoCanals] = useState([{ canal_name: 'MB', measurement_type: 'working_length', length: '', unit: 'mm', method: '', source_quote: '', state: 'needs_review' }]);
  const [endoSaving, setEndoSaving] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [appointmentPatientId, setAppointmentPatientId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => dateInputForAden());
  const [appointmentViewDate, setAppointmentViewDate] = useState(() => dateInputForAden());
  const [scheduleAppointments, setScheduleAppointments] = useState<any[]>([]);
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [appointmentDuration, setAppointmentDuration] = useState('30');
  const [appointmentNote, setAppointmentNote] = useState('');
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [patientTab, setPatientTab] = useState<'overview'|'history'|'visits'>('overview');
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [historyCategory, setHistoryCategory] = useState('condition');
  const [historyTitle, setHistoryTitle] = useState('');
  const [historyValue, setHistoryValue] = useState('');
  const [historyState, setHistoryState] = useState('needs_review');
  const [historySaving, setHistorySaving] = useState(false);

  function updateClinicSetting<K extends keyof typeof clinicSettings>(key: K, value: typeof clinicSettings[K]) {
    setClinicSettings(current => ({ ...current, [key]: value }));
    setSettingsDirty(true);
  }

  function organizationName(item: any) { const linked = Array.isArray(item?.organizations) ? item.organizations[0] : item?.organizations; return linked?.name || linked?.name_en || 'عيادة'; }
  async function loadLiveCollections() {
    const patientResponse = await fetch('/api/patients', { cache: 'no-store' });
    const patientBody = await patientResponse.json().catch(() => ({}));
    if (!patientResponse.ok) throw new Error(patientBody.error || 'تعذر تحميل بيانات العيادة.');
    const rows = Array.isArray(patientBody.patients) ? patientBody.patients : [];
    const mapped: Patient[] = rows.map((p: any, i: number) => ({ id: p.id, displayId: p.patient_number || String(p.id).slice(0, 8), name: p.full_name, age: p.date_of_birth ? `${Math.max(0,new Date().getFullYear() - new Date(p.date_of_birth).getFullYear())} سنة` : 'العمر غير مسجل', phone: maskPhoneForDisplay(p.phone), visit: 'راجع سجل الزيارات', reason: p.chief_complaint || 'لم تسجل الشكوى بعد', state: p.record_status === 'active' ? 'ملف نشط' : 'ملف مؤرشف', initials: getInitials(p.full_name || 'م'), color: ['mint','blue','peach','lilac'][i%4] }));
    setPatients(mapped); setSelectedPatient(current => current && mapped.some(p=>p.id===current.id) ? mapped.find(p=>p.id===current.id) || null : mapped[0] || null); setLoadError('');
    const [appointmentsResult, settingsResult, reportsResult] = await Promise.allSettled([
      fetch('/api/appointments?from=' + encodeURIComponent(new Date(dateInputForAden() + 'T00:00:00+03:00').toISOString()) + '&to=' + encodeURIComponent(new Date(new Date(dateInputForAden() + 'T00:00:00+03:00').getTime()+86400000).toISOString()), { cache: 'no-store' }).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'appointments unavailable');return b;}),
      fetch('/api/clinic/settings', { cache: 'no-store' }).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'settings unavailable');return b;}),
      fetch('/api/reports', { cache: 'no-store' }).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'reports unavailable');return b;}),
    ]);
    if (appointmentsResult.status==='fulfilled') { setTodayAppointments(appointmentsResult.value.appointments || []); setScheduleAppointments(appointmentsResult.value.appointments || []); }
    if (settingsResult.status==='fulfilled' && settingsResult.value.settings) setClinicSettings(current=>({...current,...settingsResult.value.settings}));
    if (reportsResult.status==='fulfilled') setSavedReports(reportsResult.value.reports || []);
  }
  async function loadAppointmentsForDate(date: string) {
    setAppointmentViewDate(date);
    if (demoMode) return;
    const dayStart = new Date(date + 'T00:00:00+03:00');
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    try {
      const response = await fetch('/api/appointments?from=' + encodeURIComponent(dayStart.toISOString()) + '&to=' + encodeURIComponent(dayEnd.toISOString()), { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر تحميل المواعيد.');
      setScheduleAppointments(Array.isArray(body.appointments) ? body.appointments : []);
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر تحميل المواعيد.'); }
  }

  async function bootstrapOrganization() {
    try {
      const response = await fetch('/api/organizations', { cache: 'no-store' }); const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error || 'تعذر تحميل العيادات.');
      const options: any[] = Array.isArray(body.organizations) ? body.organizations : [];
      setOrganizations(options);
      if (options.length === 0) { setLoadError('لا توجد عيادة مرتبطة بهذا الحساب. أنشئ مساحة العيادة للبدء.'); return; }
      let selectedId = body.selected_organization_id;
      if (!selectedId || !options.some(item=>item.organization_id===selectedId)) {
        if (options.length > 1) { setLoadError('اختر مساحة العيادة التي تريد فتحها.'); setShowOrganizationPicker(true); return; }
        selectedId = options[0].organization_id;
        const selectedResponse = await fetch('/api/organizations', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({organization_id:selectedId}) });
        if (!selectedResponse.ok) throw new Error('تعذر اختيار مساحة العيادة.');
      }
      setActiveOrganizationId(selectedId);
      const selected = options.find(item=>item.organization_id===selectedId); if (selected) { setClinicName(organizationName(selected)); setClinicSettings(current=>({...current,clinic_name_ar:current.clinic_name_ar||organizationName(selected)})); }
      await loadLiveCollections();
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'); }
  }
  useEffect(() => { setTodayLabel(language === 'ar' ? arabicDateForAden() : englishDateForAden()); }, [language]);
  useEffect(() => { setBookingOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (active !== 'settings' || demoMode || !activeOrganizationId) return;
    let cancelled=false;
    setBookingLoading(true);
    fetch('/api/clinic/booking-settings',{cache:'no-store'})
      .then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'تعذر تحميل إعدادات الحجز.');return body;})
      .then(body=>{if(!cancelled){setBookingSettings(current=>({...current,...body.settings}));setBookingHours(Array.isArray(body.hours)?body.hours:defaultBookingHours());setBookingLoaded(true);}})
      .catch(error=>{if(!cancelled)notify(error instanceof Error?error.message:'تعذر تحميل إعدادات الحجز.');})
      .finally(()=>{if(!cancelled)setBookingLoading(false);});
    return()=>{cancelled=true;};
  },[active,activeOrganizationId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette(open => !open);
        setCommandSearch('');
      } else if (event.key === 'Escape') {
        setShowCommandPalette(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => { if (showCommandPalette) commandInputRef.current?.focus(); }, [showCommandPalette]);
  useEffect(() => { if (demoMode) return; let cancelled=false; bootstrapOrganization().catch(e=>{if(!cancelled)setLoadError(e instanceof Error?e.message:'تعذر تحميل مساحة العيادة.')}); return ()=>{cancelled=true}; }, []);
  useEffect(() => {
    if (demoMode || active !== 'odontogram' || !selectedPatient?.id) return;
    let cancelled=false; fetch(`/api/patients/${selectedPatient.id}/odontogram`,{cache:'no-store'}).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'تعذر تحميل مخطط الأسنان.');return b;}).then(b=>{if(!cancelled)setToothEntries(Array.isArray(b.entries)?b.entries:[])}).catch(e=>{if(!cancelled)notify(e instanceof Error?e.message:'تعذر تحميل مخطط الأسنان.')});
    return()=>{cancelled=true};
  },[active,selectedPatient?.id]);
  useEffect(() => {
    if (demoMode || active !== 'endodontics' || !selectedPatient?.id) return;
    let cancelled=false; fetch(`/api/patients/${selectedPatient.id}/endodontics`,{cache:'no-store'}).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'تعذر تحميل ملفات علاج العصب.');return b;}).then(b=>{if(!cancelled)setEndodonticCases(Array.isArray(b.cases)?b.cases:[])}).catch(e=>{if(!cancelled)notify(e instanceof Error?e.message:'تعذر تحميل ملفات علاج العصب.')});
    return()=>{cancelled=true};
  },[active,selectedPatient?.id]);
  useEffect(() => {
    if (demoMode || active !== 'patients' || !selectedPatient?.id) return;
    let cancelled=false;
    fetch(`/api/patients/${selectedPatient.id}`,{cache:'no-store'}).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'تعذر تحميل ملف المريض.');return b;}).then(b=>{if(!cancelled){setPatientDetails(b);setHistoryItems(Array.isArray(b.history)?b.history:[])}}).catch(e=>{if(!cancelled)notify(e instanceof Error?e.message:'تعذر تحميل التاريخ الصحي.')});
    return()=>{cancelled=true};
  },[active,selectedPatient?.id]);
  useEffect(() => {
    if (demoMode || active !== 'dashboard' || !activeOrganizationId) return;
    let cancelled = false;
    setReviewQueueLoading(true);
    setReviewQueueAccessDenied(false);
    fetch('/api/review-queue', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 403) return { items: [], accessDenied: true };
        if (!response.ok) throw new Error(body.error || 'تعذر تحميل قائمة مراجعة السجلات.');
        return body;
      })
      .then(body => { if (!cancelled) { setReviewQueue(Array.isArray(body.items) ? body.items : []); setReviewQueueAccessDenied(Boolean(body.accessDenied)); } })
      .catch(error => { if (!cancelled) notify(error instanceof Error ? error.message : 'تعذر تحميل قائمة المراجعة.'); })
      .finally(() => { if (!cancelled) setReviewQueueLoading(false); });
    return () => { cancelled = true; };
  }, [active, activeOrganizationId]);
  useEffect(() => {
    if (demoMode || active !== 'reports') return;
    let cancelled=false; fetch('/api/reports',{cache:'no-store'}).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'تعذر تحميل التقارير.');return b;}).then(b=>{if(!cancelled)setSavedReports(Array.isArray(b.reports)?b.reports:[])}).catch(e=>{if(!cancelled)notify(e instanceof Error?e.message:'تعذر تحميل التقارير.')});return()=>{cancelled=true};
  },[active]);
  const filtered = useMemo(() => patients.filter(p => `${p.name} ${p.id} ${p.reason}`.toLowerCase().includes(search.toLowerCase())), [patients, search]);
  const currentToothEntry = toothEntries.find(entry => entry.patient_id === selectedPatient?.id && String(entry.tooth_number) === String(selectedTooth)) || null;
  const selectedHistoryItems = historyItems.filter((item:any) => item.patient_id === selectedPatient?.id);
  const selectedEndodonticCases = endodonticCases.filter((item:any) => item.patient_id === selectedPatient?.id);
  const currentPatientDetails = patientDetails?.patient?.id === selectedPatient?.id ? patientDetails : null;
  const attentionPatients = useMemo(() => [] as Patient[], []);
  const reviewCount = demoMode ? attentionPatients.length : reviewQueue.length;
  const activeClinicRole = organizations.find(item => item.organization_id === activeOrganizationId)?.role;
  const canEditPatient = demoMode || ['owner', 'clinic_admin', 'dentist', 'clinician'].includes(activeClinicRole);
  const visibleScheduleAppointments = demoMode ? scheduleAppointments.filter(item => dateInputForAden(new Date(item.scheduled_start)) === appointmentViewDate) : scheduleAppointments;
  const commandRoutes = useMemo(() => [
    ...nav,
    { key: 'odontogram', label: 'مخطط الأسنان', icon: HeartPulse },
    { key: 'endodontics', label: 'علاج العصب', icon: Activity },
    { key: 'settings', label: 'إعدادات العيادة', icon: Settings },
  ], []);
  const commandNavResults = useMemo(() => {
    const aliases: Record<string, string> = { dashboard: 'home dashboard overview', patients: 'patient files directory', appointments: 'calendar scheduling', scribe: 'record visit voice documentation', reports: 'reports records', odontogram: 'dental chart teeth', endodontics: 'root canal endodontics', settings: 'clinic settings configuration' };
    const query = commandSearch.trim().toLocaleLowerCase();
    return commandRoutes.filter(item => !query || (item.label + ' ' + item.key + ' ' + (aliases[item.key] || '')).toLocaleLowerCase().includes(query));
  }, [commandRoutes, commandSearch]);
  const commandPatientResults = useMemo(() => {
    const query = commandSearch.trim().toLocaleLowerCase();
    return patients.filter(patient => !query || (patient.name + ' ' + patient.id + ' ' + patient.reason).toLocaleLowerCase().includes(query)).slice(0, 5);
  }, [patients, commandSearch]);
  const renderSavedAppointment = (a: any, color = 'blue') => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const minutes = Math.max(1, Math.round((Date.parse(a.scheduled_end) - Date.parse(a.scheduled_start)) / 60000));
    return <Appointment key={a.id} time={new Date(a.scheduled_start).toLocaleTimeString(language === 'ar' ? 'ar-YE' : 'en-US', { timeZone: 'Asia/Aden', hour: '2-digit', minute: '2-digit' })} period="" patient={patient?.full_name || patients.find(p => p.id === a.patient_id)?.name || 'مريض'} type={a.appointment_type === 'dental_visit' ? 'زيارة أسنان' : a.appointment_type || 'زيارة أسنان'} duration={minutes + (language === 'ar' ? ' دقيقة' : ' minutes')} status={appointmentStatus(a.status)} statusKey={a.status} onStatusChange={active === 'appointments' ? nextStatus => void updateAppointmentStatus(a.id, nextStatus) : undefined} color={color}/>;
  };

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 3200); }
  async function createPatient() {
    if (name.trim().length < 2) { notify('أدخل اسم المريض أولاً.'); return; }
    if (demoMode) {
      const next: Patient = { id: `SN-${1050 + patients.length}`, displayId: `SN-${1050 + patients.length}`, name: name.trim(), age: 'غير مسجل', phone: '—', visit: 'لم يحدد موعد', reason: complaint.trim() || 'لم تسجل الشكوى بعد', state: 'مسودة', initials: getInitials(name.trim()), color: 'mint' };
      setPatients([next, ...patients]); setSelectedPatient(next); setName(''); setComplaint(''); setShowNewPatient(false); setActive('patients'); notify('تمت إضافة الملف إلى مساحة العمل الحالية. الحفظ الدائم يتطلب اتصال قاعدة البيانات.'); return;
    }
    try { const response = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name.trim(), chief_complaint: complaint.trim() || null }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'تعذر إنشاء ملف المريض.'); const p = body.patient; const next: Patient = { id: p.id, displayId: p.patient_number || String(p.id).slice(0,8), name: p.full_name, age: 'العمر غير مسجل', phone: maskPhoneForDisplay(p.phone), visit: 'لا توجد زيارة مسجلة', reason: p.chief_complaint || 'لم تسجل الشكوى بعد', state: 'مسودة', initials: getInitials(p.full_name || 'م'), color: 'mint' }; setPatients([next,...patients]); setSelectedPatient(next); setName(''); setComplaint(''); setShowNewPatient(false); setActive('patients'); notify('تم إنشاء ملف المريض في قاعدة البيانات.'); } catch (error) { notify(error instanceof Error ? error.message : 'تعذر إنشاء ملف المريض.'); }
  }

  function openPatientEdit() {
    if (!selectedPatient) { notify('اختر ملف المريض أولاً.'); return; }
    setEditPatientName(selectedPatient.name);
    setEditPatientPhone(demoMode ? '' : (patientDetails?.patient?.id === selectedPatient.id ? String(patientDetails.patient.phone || '') : ''));
    setEditPatientComplaint(demoMode ? selectedPatient.reason : (patientDetails?.patient?.id === selectedPatient.id ? String(patientDetails.patient.chief_complaint || '') : ''));
    setShowEditPatient(true);
  }

  async function savePatientEdits() {
    if (!selectedPatient) { notify('اختر ملف المريض أولاً.'); return; }
    const fullName = editPatientName.trim();
    if (fullName.length < 2) { notify('أدخل اسم المريض بشكل صحيح.'); return; }
    const complaintValue = editPatientComplaint.trim();
    if (demoMode) {
      const updated: Patient = {
        ...selectedPatient,
        name: fullName,
        initials: getInitials(fullName),
        reason: complaintValue || 'لم تسجل الشكوى بعد',
        phone: editPatientPhone.trim() ? maskPhoneForDisplay(editPatientPhone.trim()) : selectedPatient.phone,
      };
      setPatients(current => current.map(patient => patient.id === selectedPatient.id ? updated : patient));
      setSelectedPatient(updated);
      setShowEditPatient(false);
      notify('تم تحديث الملف في مساحة العمل الحالية. الحفظ الدائم يتطلب اتصال قاعدة البيانات.');
      return;
    }

    const payload: Record<string, unknown> = {};
    if (fullName !== selectedPatient.name) payload.full_name = fullName;
    const detailMatchesSelection = patientDetails?.patient?.id === selectedPatient.id;
    const originalComplaint = detailMatchesSelection ? String(patientDetails.patient.chief_complaint || '') : '';
    if (complaintValue !== originalComplaint) payload.chief_complaint = complaintValue || null;
    const originalPhone = detailMatchesSelection ? String(patientDetails.patient.phone || '') : '';
    if (editPatientPhone.trim() && editPatientPhone.trim() !== originalPhone) payload.phone = editPatientPhone.trim();
    if (Object.keys(payload).length === 0) {
      setShowEditPatient(false);
      notify('لا توجد تغييرات جديدة لحفظها.');
      return;
    }

    setPatientSaving(true);
    try {
      const response = await fetch('/api/patients/' + selectedPatient.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.patient) throw new Error(body.error || 'تعذر تحديث ملف المريض.');
      const updated: Patient = {
        ...selectedPatient,
        name: body.patient.full_name,
        initials: getInitials(body.patient.full_name),
        reason: body.patient.chief_complaint || 'لم تسجل الشكوى بعد',
        phone: maskPhoneForDisplay(body.patient.phone),
      };
      setPatients(current => current.map(patient => patient.id === updated.id ? updated : patient));
      setSelectedPatient(updated);
      setPatientDetails((current: any) => current ? { ...current, patient: body.patient } : current);
      setShowEditPatient(false);
      notify('تم حفظ تعديلات ملف المريض.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذر تحديث ملف المريض.');
    } finally {
      setPatientSaving(false);
    }
  }

  async function createManualVisit() {
    if (!selectedPatient) { notify('اختر ملف المريض أولاً.'); return; }
    if (demoMode) { notify('إنشاء الزيارة غير متاح حتى تتصل قاعدة بيانات العيادة.'); return; }
    setManualSaving(true);
    try {
      const response = await fetch(`/api/patients/${selectedPatient.id}/encounters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chief_complaint: manualComplaint.trim() || null, encounter_type: 'dental_visit' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر إنشاء الزيارة اليدوية.');
      setShowManualVisit(false); setManualComplaint('');
      window.location.assign(`/encounters/${body.encounter.id}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذر إنشاء الزيارة اليدوية.');
    } finally { setManualSaving(false); }
  }

  async function selectOrganization(organizationId: string) {
    try {
      const response = await fetch('/api/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: organizationId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'تعذر اختيار العيادة.');
      setActiveOrganizationId(organizationId);
      const option = organizations.find(item => item.organization_id === organizationId);
      if (option) setClinicName(organizationName(option));
      setShowOrganizationPicker(false);
      await loadLiveCollections();
      notify('تم فتح مساحة العيادة المحددة.');
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر اختيار العيادة.'); }
  }

  async function saveBookingSettings() {
    if (demoMode) { notify('يلزم اتصال قاعدة بيانات العيادة لحفظ ساعات العمل ورابط الحجز.'); return; }
    setBookingSaving(true);
    try {
      const response=await fetch('/api/clinic/booking-settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...bookingSettings,hours:bookingHours})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'تعذر حفظ إعدادات الحجز.');
      setBookingSettings(current=>({...current,...(body.settings||bookingSettings)}));
      if(Array.isArray(body.hours))setBookingHours(body.hours);
      setBookingLoaded(true);
      notify(bookingSettings.booking_enabled?'تم حفظ إعدادات الحجز ونشر الرابط.':'تم حفظ ساعات العمل. رابط الحجز غير منشور حتى تفعيله.');
    } catch(error) { notify(error instanceof Error?error.message:'تعذر حفظ إعدادات الحجز.'); }
    finally { setBookingSaving(false); }
  }

  function updateBookingHour(weekday:number,shift:'morning'|'evening',patch:Record<string,unknown>) {
    setBookingHours(current=>current.map(row=>row.weekday===weekday&&row.shift===shift?{...row,...patch}:row));
  }

  async function reviewPublicBooking(appointmentId:string,action:'confirm'|'decline') {
    if(action==='decline'&&!window.confirm('هل تريد رفض طلب الحجز وإتاحة الوقت لمريض آخر؟'))return;
    setBookingDecisionBusyId(appointmentId);
    try {
      const response=await fetch('/api/appointments/'+appointmentId+'/review-booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'تعذر تحديث طلب الحجز.');
      notify(action==='confirm'?'تم تأكيد الحجز وإنشاء ملف المريض.':'تم رفض الطلب وإتاحة الوقت من جديد.');
      await loadLiveCollections();
      if(appointmentViewDate!==dateInputForAden())await loadAppointmentsForDate(appointmentViewDate);
    } catch(error) { notify(error instanceof Error?error.message:'تعذر مراجعة طلب الحجز.'); }
    finally { setBookingDecisionBusyId(''); }
  }

  async function saveClinicSettings() {
    if (demoMode) { notify('تعذر حفظ الإعدادات لأن قاعدة بيانات العيادة غير متصلة.'); return; }
    setSettingsBusy(true);
    try {
      const payload = { ...clinicSettings, clinic_name_ar: clinicSettings.clinic_name_ar.trim() || clinicName, clinic_name_en: clinicSettings.clinic_name_en.trim() || null, address_ar: clinicSettings.address_ar.trim() || null, address_en: clinicSettings.address_en.trim() || null, phone: clinicSettings.phone.trim() || null, email: clinicSettings.email.trim() || null, website: clinicSettings.website.trim() || null };
      const response = await fetch('/api/clinic/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'تعذر حفظ إعدادات العيادة.');
      setClinicSettings(current => ({ ...current, ...body.settings })); setClinicName(body.settings.clinic_name_ar); setSettingsDirty(false); notify('تم حفظ إعدادات العيادة.');
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.'); }
    finally { setSettingsBusy(false); }
  }

  async function saveToothEntry() {
    if (!selectedPatient || toothStatus.trim().length < 2) { notify('اختر مريضاً واكتب حالة السن أو الملاحظة بوضوح.'); return; }
    if (demoMode) {
      const entry = { id: `workspace-${Date.now()}`, patient_id: selectedPatient.id, tooth_number: String(selectedTooth), notation_system: 'FDI', status: toothStatus.trim(), note: toothNote.trim() || null, state: toothEntryState, created_at: new Date().toISOString() };
      setToothEntries(current => [entry, ...current]); setShowToothEntry(false); setToothStatus(''); setToothNote(''); notify('تم تحديث حالة السن في مساحة العمل الحالية. الحفظ الدائم يتطلب اتصال قاعدة البيانات.'); return;
    }
    setToothSaving(true);
    try {
      const response = await fetch(`/api/patients/${selectedPatient.id}/odontogram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tooth_number: String(selectedTooth), notation_system: clinicSettings.tooth_notation || 'FDI', status: toothStatus.trim(), surfaces: [], note: toothNote.trim() || null, state: toothEntryState }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'تعذر حفظ حالة السن.');
      setToothEntries(current => [body.entry, ...current]); setShowToothEntry(false); setToothStatus(''); setToothNote(''); notify('تم حفظ حالة السن.');
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ حالة السن.'); }
    finally { setToothSaving(false); }
  }

  async function saveEndodonticCase() {
    if (!selectedPatient || !endoTooth.trim()) { notify('اختر مريضاً وحدد رقم السن.'); return; }
    const canals = endoCanals.map(c => ({ canal_name: c.canal_name.trim(), measurement_type: c.measurement_type, length_value: c.length.trim() ? Number(c.length) : null, unit: c.unit, method: c.method.trim() || null, source_quote: c.source_quote.trim() || null, state: c.state }));
    if (canals.some(c => !c.canal_name || (c.length_value !== null && (!Number.isFinite(c.length_value) || c.length_value <= 0)))) { notify('تحقق من أسماء القنوات وأطوالها.'); return; }
    if (demoMode) {
      setEndodonticCases(current => [{ id:`demo-${Date.now()}`,patient_id:selectedPatient.id,tooth_number:endoTooth,diagnosis:endoDiagnosis||null,stage:endoStage,follow_up_at:endoFollowUp||null,canals,created_at:new Date().toISOString() },...current]);
      setShowEndoForm(false); notify('تم تحديث ملف علاج العصب في مساحة العمل الحالية. الحفظ الدائم يتطلب اتصال قاعدة البيانات.'); return;
    }
    setEndoSaving(true);
    try {
      const response = await fetch(`/api/patients/${selectedPatient.id}/endodontics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tooth_number: endoTooth, notation_system: clinicSettings.tooth_notation || 'FDI', diagnosis: endoDiagnosis.trim() || null, diagnosis_state: 'needs_review', stage: endoStage, follow_up_at: endoFollowUp ? new Date(`${endoFollowUp}T12:00:00`).toISOString() : null, follow_up_note: null, note: null, canals }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'تعذر حفظ ملف علاج العصب.');
      setEndodonticCases(current => [body.case, ...current]); setShowEndoForm(false); setEndoDiagnosis(''); notify('تم حفظ ملف علاج العصب وقياسات القنوات.');
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ ملف علاج العصب.'); }
    finally { setEndoSaving(false); }
  }

  async function updateAppointmentStatus(appointmentId: string, status: string) {
    const allowed = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!allowed.includes(status)) { notify('حالة الموعد غير صالحة.'); return; }
    if (demoMode) {
      setScheduleAppointments(current => current.map(item => item.id === appointmentId ? { ...item, status } : item));
      setTodayAppointments(current => current.map(item => item.id === appointmentId ? { ...item, status } : item));
      notify('تم تحديث حالة الموعد في مساحة العمل الحالية. الحفظ الدائم يتطلب اتصال قاعدة البيانات.');
      return;
    }
    try {
      const response = await fetch('/api/appointments/' + appointmentId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.appointment) throw new Error(body.error || 'تعذر تحديث حالة الموعد.');
      const updateList = (list: any[]) => list.map(item => item.id === appointmentId ? { ...item, ...body.appointment, patients: item.patients } : item);
      setScheduleAppointments(updateList);
      setTodayAppointments(updateList);
      notify('تم تحديث حالة الموعد.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذر تحديث حالة الموعد.');
    }
  }

  async function saveAppointment() {
    if (!appointmentPatientId) { notify('اختر المريض أولاً.'); return; }
    const start = new Date(`${appointmentDate}T${appointmentTime}:00+03:00`);
    if (Number.isNaN(start.getTime())) { notify('موعد البداية غير صالح.'); return; }
    const end = new Date(start.getTime() + Math.max(5, Number(appointmentDuration) || 30) * 60_000);
    if (demoMode) {
      const currentAppointment = { id: `workspace-appointment-${Date.now()}`, patient_id: appointmentPatientId, scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), timezone: 'Asia/Aden', appointment_type: 'dental_visit', note: appointmentNote.trim() || null, status: 'scheduled', patients: { full_name: patients.find(p => p.id === appointmentPatientId)?.name || 'مريض' } };
      setScheduleAppointments(current => [...current, currentAppointment].sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start)));
      if (appointmentDate === dateInputForAden()) setTodayAppointments(current => [...current, currentAppointment].sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start)));
      setAppointmentViewDate(appointmentDate);
      setShowNewAppointment(false); setAppointmentNote('');
      notify('تمت إضافة الموعد إلى جدول العمل الحالي. الحفظ الدائم يتطلب اتصال قاعدة البيانات.');
      return;
    }
    setAppointmentSaving(true);
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: appointmentPatientId, scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), timezone: 'Asia/Aden', appointment_type: 'dental_visit', note: appointmentNote.trim() || null }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'تعذر حفظ الموعد.');
      const savedAppointment = { ...body.appointment, patients: { full_name: patients.find(p=>p.id===appointmentPatientId)?.name || 'مريض' } };
      if (appointmentDate === dateInputForAden()) setTodayAppointments(current => [...current, savedAppointment].sort((a,b)=>Date.parse(a.scheduled_start)-Date.parse(b.scheduled_start)));
      if (appointmentDate === appointmentViewDate) setScheduleAppointments(current => [...current, savedAppointment].sort((a,b)=>Date.parse(a.scheduled_start)-Date.parse(b.scheduled_start)));
      setShowNewAppointment(false); setAppointmentNote(''); notify('تم حفظ الموعد في قاعدة البيانات.');
      if (appointmentDate !== appointmentViewDate) await loadAppointmentsForDate(appointmentDate);
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ الموعد.'); }
    finally { setAppointmentSaving(false); }
  }

  async function saveHistoryItem() {
    if (!selectedPatient || historyTitle.trim().length < 1) { notify('أدخل عنوان المعلومة الصحية.'); return; }
    if (demoMode) { setHistoryItems(current=>[{id:`workspace-${Date.now()}`,patient_id:selectedPatient.id,category:historyCategory,title:historyTitle.trim(),value:historyValue.trim()||null,state:historyState,created_at:new Date().toISOString()},...current]); setShowHistoryForm(false);setHistoryTitle('');setHistoryValue('');notify('تمت إضافة المعلومة إلى ملف العمل الحالي. الحفظ الدائم يتطلب اتصال قاعدة البيانات.');return; }
    setHistorySaving(true);
    try { const response=await fetch(`/api/patients/${selectedPatient.id}/history`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:historyCategory,title:historyTitle.trim(),value:historyValue.trim()||null,state:historyState,source:'إدخال يدوي بواسطة مستخدم العيادة'})}); const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'تعذر حفظ التاريخ الصحي.');setHistoryItems(current=>[body.item,...current]);setShowHistoryForm(false);setHistoryTitle('');setHistoryValue('');notify('تم حفظ المعلومة الصحية.'); }
    catch(error){notify(error instanceof Error?error.message:'تعذر حفظ التاريخ الصحي.');} finally{setHistorySaving(false)}
  }

  return <Localized><div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="إغلاق القائمة الجانبية" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="قائمة التنقل الرئيسية">
      <div className="brand"><div className="brand-symbol"><Stethoscope size={21} strokeWidth={2.1}/></div><div><div className="brand-name">سِنان</div><div className="brand-sub">مساحة العمل السريرية</div></div><span className="brand-dot"/></div>
      <button className="clinic-switch" type="button" onClick={()=>{if(!demoMode&&organizations.length>1)setShowOrganizationPicker(true);else notify(demoMode?'إعدادات مساحة العيادة تتطلب اتصال قاعدة البيانات.':'مساحة العيادة الحالية.')}}><div className="clinic-mark">{clinicName.slice(0,1)||'س'}</div><div className="clinic-meta"><strong>{clinicName}</strong><span>{demoMode?'مساحة العمل':activeOrganizationId?'مساحة متصلة':'تحميل المساحة...'}</span></div><ChevronDown size={15}/></button>
      <div className="nav-label">مساحة العيادة</div>
      <nav className="main-nav">{nav.map(item => <button key={item.key} className={`nav-item ${active === item.key ? 'active' : ''}`} onClick={() => { setActive(item.key); setSidebarOpen(false); if (item.key === 'scribe') setShowScribe(true); }}><item.icon size={18}/><span>{item.label}</span>{item.key === 'scribe' && <span className="nav-live"/>}</button>)}</nav>
      <div className="nav-label nav-lower">الأدوات السريرية</div>
      <nav className="main-nav"><button className="nav-item" onClick={() => {setActive('odontogram');setSidebarOpen(false);if(!selectedPatient)notify('اختر مريضاً لفتح مخطط الأسنان التفاعلي.')}}><HeartPulse size={18}/><span>مخطط الأسنان</span></button><button className="nav-item" onClick={() => {setActive('endodontics');setSidebarOpen(false);if(!selectedPatient)notify('اختر ملف مريض أولاً لفتح علاج العصب.')}}><Activity size={18}/><span>علاج العصب</span></button><button className="nav-item" onClick={() => {setActive('reports');setSidebarOpen(false)}}><ClipboardList size={18}/><span>سجل الزيارات</span></button></nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => {setActive('settings');setSidebarOpen(false)}}><Settings size={18}/><span>إعدادات العيادة</span></button><div className="privacy-card"><ShieldCheck size={18}/><div><strong>الخصوصية أولاً</strong><p>يجب اعتماد الصلاحيات والموافقة قبل استخدام بيانات مرضى حقيقية.</p></div></div><div className="profile-row"><div className="avatar doctor-avatar">د</div><div className="profile-text"><strong>حساب العيادة</strong><span>{demoMode ? 'مساحة العمل' : 'جلسة موثقة'}</span></div><button className="icon-button subtle" aria-label="إعدادات الحساب" onClick={() => notify('إدارة الحساب تحتاج إلى تفعيل المصادقة.') }><ChevronLeft size={16}/></button></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="mobile-menu-trigger icon-button" type="button" aria-label="فتح القائمة" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(value => !value)}><Menu size={19}/></button><div className="breadcrumb"><span>{clinicName}</span><ChevronLeft size={14}/><strong>{nav.find(n=>n.key===active)?.label || (active==='odontogram'?'مخطط الأسنان':active==='endodontics'?'علاج العصب':'إعدادات العيادة')}</strong></div><div className="top-actions"><button className="command-launcher" type="button" onClick={() => {setShowCommandPalette(true);setCommandSearch("")}} aria-label="بحث شامل"><Search size={16}/><span>بحث سريع</span><kbd>Ctrl K</kbd></button><LanguageButton/>{!demoMode && <span className="status-pill"><span className="status-dot"/> {activeOrganizationId ? 'مساحة العيادة' : 'غير متصل'}</span>}{demoMode && <span className="connection-text" role="status">قاعدة البيانات غير متصلة</span>}<a href="/sign-in" className="sign-in-link">تسجيل الدخول</a><button className="icon-button" aria-label="التنبيهات" onClick={()=>notify('لا توجد تنبيهات جديدة.')}><Bell size={18}/><i className="notification-dot"/></button><div className="top-divider"/><div className="top-date"><CalendarDays size={16}/><span>{todayLabel || 'تاريخ اليوم'}</span></div></div></header>
      {!demoMode && loadError ? <div className="system-notice"><AlertCircle size={17}/><div><strong>تعذر تحميل مساحة العيادة</strong><span>{loadError}</span></div>{loadError.includes('لا توجد عيادة')&&<a className="text-link" href="/onboarding">إعداد العيادة</a>}<a className="text-link" href="/sign-in">تسجيل الدخول</a>{organizations.length>1&&<button className="text-link" onClick={()=>setShowOrganizationPicker(true)}>اختيار العيادة</button>}</div> : null}

      {active === 'dashboard' && <section className="workspace-page dashboard-workbench">
        <header className="workbench-heading">
          <div className="workbench-title">
            <div className="eyebrow"><span className="workbench-status-dot"/>{todayLabel || 'مساحة العيادة'}</div>
            <h1>{clinicName || 'مساحة عمل العيادة'}</h1>
            <p>إدارة مواعيد العيادة وملفات المرضى ومراجعة السجلات من مساحة عمل واحدة.</p>
          </div>
          <div className="workbench-heading-actions">
            {!demoMode && <span className={'connection-chip ' + (activeOrganizationId ? 'connected' : 'disconnected')}><i/>{activeOrganizationId ? 'متصل بالعيادة' : 'غير متصل'}</span>}
            <button className="secondary-button" type="button" onClick={() => setShowCommandPalette(true)}><Search size={16}/> بحث شامل</button>
          </div>
        </header>

        <div className="workbench-actionbar" aria-label="الإجراءات السريعة">
          <button className="workbench-action primary" type="button" onClick={() => setShowNewPatient(true)}><span className="workbench-action-icon"><Plus size={18}/></span><span><strong>إضافة مريض</strong><small>فتح ملف جديد</small></span></button>
          <button className="workbench-action" type="button" onClick={() => { if (patients.length===0) { setActive('patients'); setShowNewPatient(true); } else { setAppointmentPatientId(selectedPatient?.id || patients[0]?.id || ''); setAppointmentDate(appointmentViewDate); setShowNewAppointment(true); } }}><span className="workbench-action-icon"><CalendarDays size={18}/></span><span><strong>حجز موعد</strong><small>إضافة إلى الجدول</small></span></button>
          <button className="workbench-action" type="button" onClick={() => { if (!selectedPatient) { setActive('patients'); setShowNewPatient(true); notify('أنشئ ملف المريض أولاً لتوثيق الزيارة.'); return; } setManualComplaint(''); setShowManualVisit(true); }}><span className="workbench-action-icon"><FilePlus2 size={18}/></span><span><strong>توثيق يدوي</strong><small>إنشاء مسودة زيارة</small></span></button>
          <button className="workbench-action" type="button" onClick={() => { setActive('scribe'); setShowScribe(true); }}><span className="workbench-action-icon"><Mic size={18}/></span><span><strong>التوثيق الصوتي</strong><small>يتطلب إعداد التسجيل</small></span></button>
        </div>

        <div className="workbench-metrics">
          <button className="workbench-metric" type="button" onClick={() => setActive('appointments')}>
            <span className="metric-symbol blue"><CalendarDays size={19}/></span><span className="metric-content"><small>مواعيد اليوم</small><strong>{todayAppointments.length.toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</strong><em>{demoMode ? 'ضمن جدول اليوم' : 'مواعيد محمّلة من العيادة'}</em></span><ChevronLeft size={16}/>
          </button>
          <button className="workbench-metric" type="button" onClick={() => setActive('patients')}>
            <span className="metric-symbol mint"><Users size={19}/></span><span className="metric-content"><small>ملفات المرضى</small><strong>{patients.length.toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</strong><em>{demoMode ? 'الملفات الحالية' : 'الملفات التي تم تحميلها'}</em></span><ChevronLeft size={16}/>
          </button>
          <button className="workbench-metric" type="button" onClick={() => setActive('patients')}>
            <span className="metric-symbol amber"><AlertCircle size={19}/></span><span className="metric-content"><small>تحتاج إلى متابعة</small><strong>{reviewCount.toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</strong><em>مسودات بانتظار مراجعة الطبيب</em></span><ChevronLeft size={16}/>
          </button>
        </div>

        <div className="workbench-columns">
          <section className="panel workbench-schedule">
            <div className="workbench-section-heading">
              <div><span className="section-kicker">إدارة اليوم</span><h2>جدول المواعيد</h2><p>{todayLabel}</p></div>
              <button className="text-link" type="button" onClick={() => setActive('appointments')}>فتح الجدول الكامل <ChevronLeft size={16}/></button>
            </div>
            <div className="workbench-timeline">
              {todayAppointments.length ? todayAppointments.slice().sort((a,b)=>Date.parse(a.scheduled_start)-Date.parse(b.scheduled_start)).slice(0,5).map(item => renderSavedAppointment(item, item.status === 'arrived' ? 'mint' : 'blue')) : <div className="workbench-empty"><CalendarDays size={24}/><strong>لا توجد مواعيد محمّلة</strong><span>{demoMode ? 'اختر موعداً من الجدول أو أضف موعداً إلى قائمة العمل.' : 'تحقق من الاتصال أو أنشئ موعداً جديداً.'}</span><button className="primary-button" type="button" onClick={() => { if (patients.length===0) { setActive('patients'); setShowNewPatient(true); } else { setAppointmentPatientId(selectedPatient?.id || patients[0]?.id || ''); setShowNewAppointment(true); } }}><Plus size={15}/>{patients.length===0?'إضافة مريض أولاً':'حجز موعد'}</button></div>}
            </div>
            <div className="workbench-panel-footer"><span>{demoMode ? 'لا يتوفر حفظ دائم دون اتصال قاعدة البيانات' : 'المواعيد حسب اليوم المحدد في العيادة'}</span><button type="button" onClick={() => setActive('appointments')}>عرض التقويم <ChevronLeft size={15}/></button></div>
          </section>

          <div className="workbench-side-stack">
            <section className="panel workbench-attention">
              <div className="workbench-section-heading"><div><span className="section-kicker">قائمة العمل</span><h2>تحتاج إلى انتباهك</h2><p>افتح الملف لمراجعة الحالة أو المسودة.</p></div><span className="workbench-count">{attentionPatients.length.toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</span></div>
              
              {!demoMode && reviewQueueLoading && <div className="review-queue-loading"><span className="loading-dot"/><span>جارٍ تحميل السجلات التي تنتظر المراجعة...</span></div>}
              {!demoMode && !reviewQueueLoading && reviewQueue.length > 0 && <div className="attention-list">{reviewQueue.slice(0,5).map(item => <button type="button" className="attention-row" key={item.id} onClick={() => item.encounter_id ? window.location.assign('/encounters/' + item.encounter_id) : setActive('patients')}><span className="attention-avatar blue">{getInitials(item.patient_name)}</span><span className="attention-copy"><strong>{item.patient_name}</strong><small>{item.chief_complaint || item.patient_number || ('نسخة ' + item.version)}</small></span><StatePill state={item.status==='ready_for_approval'?'جاهز للاعتماد':item.status==='draft'?'مسودة':'تحتاج مراجعة'}/><ChevronLeft size={15}/></button>)}</div>}
              {!demoMode && reviewQueueAccessDenied && <div className="workbench-empty compact"><ShieldCheck size={21}/><strong>تحتاج إلى صلاحية سريرية</strong><span>لا تسمح صلاحيات هذا الحساب بعرض السجلات التي تنتظر المراجعة.</span></div>}
              {demoMode ? <div className="workbench-empty compact"><AlertCircle size={21}/><strong>قائمة المراجعة غير متاحة</strong><span>اتصل بقاعدة بيانات العيادة لعرض السجلات التي تنتظر اعتماد الطبيب.</span></div> : !reviewQueueLoading && !reviewQueueAccessDenied && reviewQueue.length===0 && <div className="workbench-empty compact"><CircleCheck size={21}/><strong>لا توجد سجلات تنتظر المراجعة</strong><span>ستظهر هنا المسودات والسجلات التي تحتاج إلى اعتماد الطبيب.</span></div>}
              <button className="workbench-link-row" type="button" onClick={() => setActive('patients')}>فتح ملفات المرضى <ChevronLeft size={15}/></button>
            </section>

            <section className="panel workbench-shortcuts">
              <div className="workbench-section-heading"><div><span className="section-kicker">الوحدات</span><h2>انتقال مباشر</h2></div></div>
              <div className="workbench-shortcut-grid">
                <button type="button" onClick={() => setActive('odontogram')}><HeartPulse size={19}/><span>مخطط الأسنان</span><ChevronLeft size={14}/></button>
                <button type="button" onClick={() => setActive('endodontics')}><Activity size={19}/><span>علاج العصب</span><ChevronLeft size={14}/></button>
                <button type="button" onClick={() => setActive('reports')}><FileText size={19}/><span>التقارير والسجلات</span><ChevronLeft size={14}/></button>
                <button type="button" onClick={() => setActive('settings')}><Settings size={19}/><span>إعدادات العيادة</span><ChevronLeft size={14}/></button>
              </div>
            </section>
          </div>
        </div>

        <section className="panel workbench-patients">
          <div className="workbench-section-heading patients-workbench-heading">
            <div><span className="section-kicker">الوصول السريع</span><h2>ملفات المرضى</h2><p>اختر ملفاً للانتقال مباشرة إلى التاريخ الصحي والزيارات.</p></div>
            <div className="workbench-patient-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الملف"/></label><button className="primary-button" type="button" onClick={() => setShowNewPatient(true)}><Plus size={16}/> إضافة مريض</button></div>
          </div>
          <div className="workbench-patient-grid">
            {filtered.slice(0,4).map(patient => <button className="workbench-patient-card" type="button" key={patient.id} onClick={() => {setSelectedPatient(patient);setPatientTab('overview');setActive('patients')}}>
              <span className={'workbench-patient-avatar ' + patient.color}>{patient.initials}</span>
              <span className="workbench-patient-main"><strong>{patient.name}</strong><small>{patient.displayId || patient.id} · {patient.age}</small><em>{patient.reason}</em></span>
              <StatePill state={patient.state}/>
              <ChevronLeft size={15}/>
            </button>)}
            {!filtered.length && <div className="workbench-empty compact"><Search size={20}/><strong>لم نعثر على ملف مطابق</strong><span>جرّب الاسم أو رقم الملف أو أضف ملفاً جديداً.</span></div>}
          </div>
          <div className="workbench-panel-footer"><span>{filtered.length.toLocaleString(language === 'ar' ? 'ar' : 'en-US')} نتائج في البحث الحالي</span><button type="button" onClick={() => setActive('patients')}>فتح مساحة المرضى <ChevronLeft size={15}/></button></div>
        </section>
      </section>}

      {active === 'patients' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">الملفات السريرية</div><h1>ملفات المرضى</h1><p>الهوية، التاريخ الصحي، الزيارات، وخطة العلاج في ملف واحد.</p></div><button className="primary-button" onClick={()=>setShowNewPatient(true)}><Plus size={17}/> إضافة مريض</button></div><div className="patient-workspace"><div className="panel patient-list-panel"><div className="search-box wide"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المريض أو الرقم"/></div>{filtered.map(p=><button key={p.id} onClick={()=>setSelectedPatient(p)} className={`patient-select ${selectedPatient?.id===p.id?'selected':''}`}><div className={`avatar ${p.color}`}>{p.initials}</div><div className="patient-select-main"><strong>{p.name}</strong><span>{p.displayId || p.id} · {p.age}</span><small>{p.reason}</small></div><ChevronLeft size={15}/></button>)}{filtered.length===0 && <div className="workbench-empty compact patient-list-empty"><Users size={22}/><strong>لا توجد ملفات مرضى بعد</strong><span>أنشئ ملف المريض الأول لإدارة المواعيد والتاريخ الصحي والعلاج.</span><button className="primary-button" type="button" onClick={()=>setShowNewPatient(true)}><Plus size={15}/> إضافة مريض</button></div>}</div>{selectedPatient&&<div className="panel patient-detail"><div className="patient-profile-head"><div className={`avatar big ${selectedPatient.color}`}>{selectedPatient.initials}</div><div className="patient-profile-meta"><div className="patient-id">ملف رقم {selectedPatient.displayId || selectedPatient.id}</div><h2>{selectedPatient.name}</h2><p>{selectedPatient.age} · {selectedPatient.phone}</p></div><div className="patient-head-actions">{canEditPatient && <button className="secondary-button" onClick={openPatientEdit}><Pencil size={16}/> تعديل البيانات</button>}<button className="secondary-button" onClick={()=>setShowScribe(true)}><Mic size={16}/> توثيق بالصوت</button><button className="secondary-button" onClick={()=>{setManualComplaint('');setShowManualVisit(true)}}><FilePlus2 size={16}/> إدخال يدوي</button></div></div><div className="detail-tabs"><button className={`detail-tab ${patientTab==='overview'?'active':''}`} onClick={()=>setPatientTab('overview')}>نظرة عامة</button><button className={`detail-tab ${patientTab==='history'?'active':''}`} onClick={()=>setPatientTab('history')}>التاريخ الصحي</button><button className="detail-tab" onClick={()=>setActive('odontogram')}>مخطط الأسنان</button><button className={`detail-tab ${patientTab==='visits'?'active':''}`} onClick={()=>setPatientTab('visits')}>الزيارات</button></div>{patientTab==='overview'&&<><div className="detail-section"><h3>المعلومات الأساسية</h3><div className="detail-fields"><DetailField label="الشكوى الرئيسية" value={selectedPatient.reason}/><DetailField label="آخر زيارة" value={selectedPatient.visit}/><DetailField label="الحساسية" value="لم يتم توثيقها" warning/><DetailField label="الأدوية الحالية" value="لم يتم توثيقها" warning/></div></div><div className="missing-notice"><AlertCircle size={17}/><div><strong>التاريخ الصحي يحتاج إلى استكمال</strong><span>المعلومة غير المسجلة لا تعني أن المريض لا يعاني منها. أكّد الحساسية والأدوية والتاريخ المرضي قبل الاعتماد.</span></div></div><div className="detail-section"><div className="panel-heading"><h3>آخر السجلات</h3><button className="text-link" onClick={()=>setPatientTab('visits')}>عرض الكل</button></div><div className="live-empty"><FileText size={19}/><strong>لا توجد زيارات سريرية محفوظة لهذا الملف</strong><span>سجّل زيارة بعد اتصال قاعدة بيانات العيادة.</span></div></div></>}{patientTab==='history'&&<div className="detail-section patient-history-section"><div className="panel-heading"><div><h3>التاريخ الصحي</h3><p>حالات صحية وحساسية وأدوية ومعلومات أسنان مسجلة مع حالة المراجعة.</p></div><button className="secondary-button" onClick={()=>setShowHistoryForm(true)}><Plus size={15}/> إضافة معلومة</button></div>{selectedHistoryItems.length===0?<div className="missing-notice"><AlertCircle size={17}/><div><strong>لم يُسجل تاريخ صحي لهذا الملف بعد</strong><span>لا تفسر غياب المعلومة على أنه نفي. أضف المعلومات بعد سؤال المريض والتحقق منها.</span></div></div>:<div className="history-list">{selectedHistoryItems.map((item:any)=><div className="history-item" key={item.id}><div className="history-item-main"><strong>{item.title}</strong><span>{({condition:'حالة صحية',allergy:'حساسية',medication:'دواء',surgery:'جراحة سابقة',family_history:'تاريخ عائلي',social_history:'تاريخ اجتماعي',dental_history:'تاريخ أسنان',other:'أخرى'} as Record<string,string>)[item.category]||item.category}</span>{item.value!==null&&item.value!==undefined&&<p>{typeof item.value==='string'?item.value:JSON.stringify(item.value)}</p>}</div><span className={`state-pill ${item.state==='explicitly_negative'?'approved':item.state==='needs_review'||item.state==='not_recorded'?'review':'neutral'}`}>{({positive:'مذكورة',explicitly_negative:'نفي صريح',not_asked:'لم يُسأل',not_recorded:'غير مسجلة',unknown:'غير معلومة',not_applicable:'لا ينطبق',needs_review:'تحتاج مراجعة'} as Record<string,string>)[item.state]||item.state}</span></div>)}</div>}</div>}{patientTab==='visits'&&<div className="detail-section"><div className="panel-heading"><div><h3>الزيارات السابقة</h3><p>التاريخ والحالة لكل زيارة محفوظة للمريض.</p></div><div className="visit-actions"><button className="secondary-button" onClick={()=>{setManualComplaint('');setShowManualVisit(true)}}><FilePlus2 size={15}/> زيارة يدوية</button><button className="primary-button" onClick={()=>setShowScribe(true)}><Mic size={15}/> توثيق بالصوت</button></div></div>{!currentPatientDetails?.encounters?.length?<div className="live-empty"><CalendarDays size={20}/><strong>لا توجد زيارات محفوظة لهذا المريض</strong><span>بعد انتهاء المعالجة، ستظهر المسودة هنا للمراجعة والاعتماد.</span></div>:<div className="history-list">{currentPatientDetails.encounters.map((visit:any)=><a className="history-item visit-history-item" href={`/encounters/${visit.id}`} key={visit.id}><div className="history-item-main"><strong>{visit.chief_complaint||'زيارة أسنان'}</strong><span>{new Date(visit.started_at||visit.created_at).toLocaleString('ar')}</span></div><StatePill state={({recording:'قيد التسجيل',processing:'قيد المعالجة',needs_review:'تحتاج مراجعة',approved:'معتمد',draft:'مسودة',corrected:'مصحح',cancelled:'ملغي',processing_failed:'فشلت المعالجة'} as Record<string,string>)[visit.status]||visit.status}/><ChevronLeft size={15}/></a>)}</div>}</div>}</div>}</div></section>}

      {active === 'appointments' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">إدارة الوقت</div><h1>المواعيد</h1><p>إدارة المواعيد ومتابعة الحضور والحالة ضمن جدول العيادة.</p></div><button className="primary-button" onClick={()=>{if(patients.length===0){setActive('patients');setShowNewPatient(true)}else{setAppointmentPatientId(selectedPatient?.id || patients[0]?.id || '');setShowNewAppointment(true)}}}><Plus size={17}/> موعد جديد</button></div><div className="panel"><div className="panel-heading"><div><h2>{new Date(appointmentViewDate + 'T12:00:00+03:00').toLocaleDateString(language === 'ar' ? 'ar-YE' : 'en-US',{timeZone:'Asia/Aden',weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2><p>{`${visibleScheduleAppointments.length} موعداً في التاريخ المحدد`}</p></div><div className="month-switch"><button aria-label={language==='ar'?'اليوم السابق':'Previous day'} onClick={()=>void loadAppointmentsForDate(shiftAdenDate(appointmentViewDate,-1))}><ChevronRight size={16}/></button><button aria-label={language==='ar'?'تحديث المواعيد':'Refresh appointments'} onClick={()=>{if(demoMode)notify('لا يمكن مزامنة المواعيد من الخادم لأن قاعدة بيانات العيادة غير متصلة.');else void loadAppointmentsForDate(appointmentViewDate)}}><Activity size={17}/></button><button aria-label={language==='ar'?'اليوم التالي':'Next day'} onClick={()=>void loadAppointmentsForDate(shiftAdenDate(appointmentViewDate,1))}><ChevronLeft size={16}/></button></div></div><label className="agenda-date-picker"><span>{language==='ar'?'تاريخ العرض':'Agenda date'}</span><input type="date" value={appointmentViewDate} onChange={e=>void loadAppointmentsForDate(e.target.value)}/></label><div className="timeline-list roomy">{visibleScheduleAppointments.map(item => renderSavedAppointment(item, item.status === 'arrived' ? 'mint' : 'blue'))}
{visibleScheduleAppointments.length === 0 && <div className="workbench-empty compact"><CalendarDays size={24}/><strong>لا توجد مواعيد في هذا اليوم</strong><span>لا توجد مواعيد في هذا التاريخ. أضف موعداً جديداً أو اختر يوماً آخر.</span><button className="primary-button" type="button" onClick={() => {setAppointmentPatientId(selectedPatient?.id || patients[0]?.id || '');setAppointmentDate(appointmentViewDate);setShowNewAppointment(true)}}><Plus size={15}/> حجز موعد</button></div>}</div></div></section>}

      {active === 'scribe' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">التوثيق السريري</div><h1>تسجيل الزيارة</h1><p>ابدأ بعد التحقق من هوية المريض والموافقة على التسجيل.</p></div><span className="connection-text" role="status">{demoMode ? 'يلزم اتصال قاعدة البيانات وخدمة التوثيق' : activeOrganizationId ? 'تحقق من الميكروفون والموافقة قبل التسجيل' : 'قاعدة البيانات غير متصلة'}</span></div><div className="panel scribe-launch"><div className="scribe-orb"><Mic size={32}/></div><h2>حوّل الحوار إلى مسودة سريرية</h2><p>التسجيل الحقيقي يحتاج صلاحية الميكروفون، تسجيل الموافقة، وتوصيل خدمة التخزين والمعالجة قبل الاستخدام السريري.</p><button className="primary-button" onClick={()=>setShowScribe(true)}><Play size={17}/> فتح مساحة الاستماع</button></div></section>}

      {active === 'odontogram' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">طب الأسنان</div><h1>مخطط الأسنان</h1><p>اختر السن لعرض حالته والملاحظات السريرية المسجلة ضمن ملف المريض.</p></div></div><div className="panel odontogram-panel"><div className="panel-heading"><div><h2>{selectedPatient?.name || 'اختر المريض'}</h2><p>نظام الترقيم FDI · العرض من منظور المريض</p></div><select className="native-select" aria-label="المريض" onChange={e=>setSelectedPatient(patients.find(p=>p.id===e.target.value)||null)} value={selectedPatient?.id||''}>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="dental-chart"><div className="chart-label">الفك العلوي</div><div className="teeth-row">{toothTop.map(t=><button key={t} className={`tooth ${t===selectedTooth?'picked':''} ${toothEntries.some(e=>e.patient_id===selectedPatient?.id&&String(e.tooth_number)===String(t)&&['needs_review','ai_suggested'].includes(e.state))?'flagged':''}`} onClick={()=>setSelectedTooth(t)}><span className="tooth-glyph"><ToothGlyph tooth={t}/></span><small>{t}</small></button>)}</div><div className="jaw-divider"><span>يمين المريض</span><i/><span>يسار المريض</span></div><div className="teeth-row">{toothBottom.map(t=><button key={t} className={`tooth ${t===selectedTooth?'picked':''} ${toothEntries.some(e=>e.patient_id===selectedPatient?.id&&String(e.tooth_number)===String(t)&&['needs_review','ai_suggested'].includes(e.state))?'flagged':''}`} onClick={()=>setSelectedTooth(t)}><span className="tooth-glyph"><ToothGlyph tooth={t}/></span><small>{t}</small></button>)}</div><div className="chart-label">الفك السفلي</div></div><div className="tooth-detail"><div><span className="detail-kicker">السن المحدد · {clinicSettings.tooth_notation||'FDI'}</span><h3>السن {selectedTooth}</h3><p>{currentToothEntry ? `${currentToothEntry.status} · ${currentToothEntry.note||'لا توجد ملاحظة إضافية'} · ${currentToothEntry.state==='clinician_confirmed'?'أكدها الطبيب':'تحتاج مراجعة'}` : 'لا توجد حالة مسجلة لهذا السن.'}</p></div><button className="secondary-button" disabled={!selectedPatient} onClick={()=>{setToothStatus(currentToothEntry?.status||'');setToothNote(currentToothEntry?.note||'');setToothEntryState('needs_review');setShowToothEntry(true)}}>تسجيل حالة / ملاحظة</button></div><div className="legend"><span><i className="legend-dot normal"/> دون حالة مسجلة</span><span><i className="legend-dot flagged"/> يحتاج مراجعة</span><span><i className="legend-dot selected"/> السن المحدد</span></div></div></section>}

      {active === 'endodontics' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">ملف علاجي متخصص</div><h1>علاج العصب</h1><p>كل قناة تحفظ مستقلة مع نوع القياس والوحدة ومصدرها وحالة التحقق.</p></div><button className="primary-button" disabled={!selectedPatient} onClick={()=>setShowEndoForm(true)}><Plus size={17}/> ملف علاج جديد</button></div><div className="panel endo-panel">{!selectedPatient&&<div className="live-empty"><Users size={22}/><strong>اختر ملف مريض أولاً</strong><span>افتح ملف المريض ثم عد إلى علاج العصب.</span><button className="secondary-button" onClick={()=>setActive('patients')}>فتح ملفات المرضى</button></div>}{selectedPatient&&selectedEndodonticCases.length===0&&<div className="missing-notice empty-endo-state"><AlertCircle size={17}/><div><strong>لا توجد ملفات علاج عصب لهذا المريض</strong><span>أنشئ الملف الأول ثم أدخل التشخيص والقياسات بعد التحقق منها.</span><button type="button" className="primary-button" onClick={() => setShowEndoForm(true)}><Plus size={16}/> إضافة أول ملف علاج عصب لهذا المريض</button></div></div>}{selectedEndodonticCases.map(c=><div className="endo-case-card" key={c.id}><div className="endo-case-head"><div><span>السن {c.tooth_number} · {clinicSettings.tooth_notation||'FDI'}</span><strong>{c.diagnosis||'لم يؤكد التشخيص'}</strong></div><StatePill state={c.stage==='completed'?'مكتمل':c.stage==='in_progress'?'قيد التنفيذ':c.stage==='planned'?'مخطط':'مؤجل'}/></div><div className="canal-table-wrap"><table className="canal-table"><thead><tr><th>القناة</th><th>نوع القياس</th><th>الطول</th><th>الحالة</th></tr></thead><tbody>{(c.canals||[]).map((canal:any)=><tr key={canal.id}><td>{canal.canal_name}</td><td>{({working_length:'طول العمل',estimated_length:'طول تقديري',measured_length:'طول مقاس',recheck:'إعادة قياس'} as Record<string,string>)[canal.measurement_type]||canal.measurement_type}</td><td>{canal.length_value==null?'غير مسجل':`${canal.length_value} ${canal.unit}`}</td><td>{canal.state==='clinician_confirmed'?'أكدها الطبيب':'تحتاج مراجعة'}</td></tr>)}</tbody></table></div>{c.follow_up_at&&<p className="endo-followup">موعد المتابعة: {new Date(c.follow_up_at).toLocaleDateString('ar')}</p>}{c.note&&<p className="endo-note">{c.note}</p>}</div>)}</div></section>}

      {active === 'reports' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">المستندات الطبية</div><h1>التقارير والسجلات</h1><p>التقرير يُنشأ من نسخة معتمدة ويحفظ لقطة من المحتوى والهوية المستخدمة.</p></div></div><div className="panel reports-list-panel">{savedReports.length===0?<div className="empty-reports"><div className="empty-icon"><FileText size={24}/></div><h2>لا توجد تقارير محفوظة</h2><p>تُنشأ التقارير من السجلات السريرية المعتمدة. افتح ملف المريض لمراجعة الزيارات والسجلات المتاحة.</p><button className="primary-button" type="button" onClick={() => {setActive('patients');setPatientTab('visits');if(!selectedPatient)notify('اختر ملف مريض أو أنشئ ملفاً لبدء مراجعة السجلات.')}}><ClipboardList size={16}/> فتح السجلات السريرية</button></div>:savedReports.map(report=><a className="saved-report-row" href={`/reports/${report.id}`} key={report.id}><div className="record-icon"><FileText size={17}/></div><div><strong>{({encounter_summary:'ملخص زيارة',dental_examination:'فحص الأسنان',endodontic_report:'تقرير علاج العصب',patient_history:'التاريخ الصحي'} as Record<string,string>)[report.report_type]||'تقرير سريري'}</strong><span>النسخة {report.source_record_version||'—'} · {new Date(report.created_at).toLocaleDateString('ar')}</span></div><StatePill state={report.status==='issued'?'صادر':'جاهز للطباعة'}/><ChevronLeft size={16}/></a>)}</div></section>}

      {active === 'settings' && <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">إعدادات مساحة العمل</div><h1>إعدادات العيادة</h1><p>احفظ هوية العيادة مرة واحدة لاستخدامها في التقارير والملفات.</p></div><button className="primary-button" onClick={saveClinicSettings} disabled={settingsBusy}><SaveIcon/> {settingsBusy?'جارٍ الحفظ...':'حفظ التغييرات'}</button></div><div className="panel settings-panel"><h2>هوية العيادة</h2><div className="settings-grid"><label>اسم العيادة بالعربية<input value={clinicSettings.clinic_name_ar} onChange={e=>updateClinicSetting('clinic_name_ar',e.target.value)} placeholder="اسم العيادة"/></label><label>اسم العيادة بالإنجليزية<input value={clinicSettings.clinic_name_en} onChange={e=>updateClinicSetting('clinic_name_en',e.target.value)} placeholder="Clinic name"/></label><label>رقم الهاتف<input value={clinicSettings.phone} onChange={e=>updateClinicSetting('phone',e.target.value)} placeholder="رقم العيادة"/></label><label>العنوان بالعربية<input value={clinicSettings.address_ar} onChange={e=>updateClinicSetting('address_ar',e.target.value)} placeholder="عنوان العيادة"/></label><label>العنوان بالإنجليزية<input value={clinicSettings.address_en} onChange={e=>updateClinicSetting('address_en',e.target.value)} placeholder="Clinic address"/></label><label>البريد الإلكتروني<input type="email" value={clinicSettings.email} onChange={e=>updateClinicSetting('email',e.target.value)} placeholder="clinic@example.com"/></label><label>الموقع الإلكتروني<input value={clinicSettings.website} onChange={e=>updateClinicSetting('website',e.target.value)} placeholder="https://..."/></label><label>لغة التقارير<select value={clinicSettings.default_report_language} onChange={e=>updateClinicSetting('default_report_language',e.target.value)}><option value="ar">العربية</option><option value="en">English</option><option value="bi">ثنائي اللغة</option></select></label><label>حجم الورق<select value={clinicSettings.paper_size} onChange={e=>updateClinicSetting('paper_size',e.target.value)}><option value="A4">A4</option><option value="Letter">Letter</option></select></label><label>نظام ترقيم الأسنان<select value={clinicSettings.tooth_notation} onChange={e=>updateClinicSetting('tooth_notation',e.target.value)}><option value="FDI">FDI</option><option value="Universal">Universal</option><option value="Palmer">Palmer</option></select></label><label>أيام الاحتفاظ بالصوت<input type="number" min="0" max="3650" value={clinicSettings.audio_retention_days} onChange={e=>updateClinicSetting('audio_retention_days',Number(e.target.value))}/></label></div><div className="settings-footnote"><ShieldCheck size={17}/> {demoMode?'قاعدة بيانات العيادة غير متصلة؛ لن تبقى التعديلات بعد تحديث الصفحة.':'لا يزال يلزم اختبار سياسة الاحتفاظ بالصوت وعمليات الحذف والاستعادة قبل تخزين بيانات مرضى حقيقية.'}</div></div>
        <section className="panel booking-settings-panel">
          <div className="booking-settings-heading">
            <div><span className="section-kicker">المواعيد والحجز</span><h2>رابط حجز المرضى</h2><p>حدد ساعات العيادة وسعة كل موعد، ثم شارك الرابط مع المرضى.</p></div>
            <span className={'booking-publish-status '+(bookingSettings.booking_enabled?'published':'unpublished')}><i/>{bookingSettings.booking_enabled?'الرابط مفعّل':'الرابط متوقف'}</span>
          </div>
          {demoMode && <div className="booking-connection-notice"><AlertCircle size={17}/><span>إعدادات الحجز تحتاج اتصال قاعدة البيانات لتُحفظ وتُشارك مع المرضى.</span></div>}
          {bookingLoading && <div className="booking-loading-line"><LoaderCircle className="spin" size={17}/> جارٍ تحميل إعدادات الحجز</div>}
          <div className="booking-publish-toggle">
            <div><strong>استقبال طلبات الحجز عبر الإنترنت</strong><span>عند التفعيل، سيظهر الرابط للمرضى وتُحجز السعة فور إرسال الطلب حتى تراجعه العيادة.</span></div>
            <label className="booking-switch"><input type="checkbox" checked={bookingSettings.booking_enabled} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,booking_enabled:e.target.checked}))}/><span/></label>
          </div>
          <div className="booking-config-grid">
            <label>اسم رابط الحجز <span className="booking-input-hint">إنجليزي وأرقام وشرطة فقط</span><input value={bookingSettings.public_slug} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,public_slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,50)}))} placeholder="clinic-123abc" dir="ltr" maxLength={50}/></label>
            <label>مدة الموعد<select value={bookingSettings.slot_minutes} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,slot_minutes:Number(e.target.value)}))}><option value={10}>10 دقائق</option><option value={15}>15 دقيقة</option><option value={20}>20 دقيقة</option><option value={30}>30 دقيقة</option><option value={45}>45 دقيقة</option><option value={60}>60 دقيقة</option></select></label>
            <label>العدد الأقصى في كل موعد<input type="number" min={1} max={25} value={bookingSettings.max_bookings_per_slot} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,max_bookings_per_slot:Number(e.target.value)}))}/><small>يمنع النظام تجاوز السعة حتى لو حجز عدة مرضى في الوقت نفسه.</small></label>
            <label>فتح الحجز قبل الموعد (أيام)<input type="number" min={1} max={180} value={bookingSettings.advance_booking_days} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,advance_booking_days:Number(e.target.value)}))}/></label>
            <label>أقل مهلة قبل الحجز (ساعات)<input type="number" min={0} max={168} value={Math.round(bookingSettings.min_notice_minutes/60)} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,min_notice_minutes:Number(e.target.value)*60}))}/></label>
            <label>عنوان صفحة المريض<input value={bookingSettings.public_title_ar} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,public_title_ar:e.target.value}))} placeholder={clinicName}/></label>
            <label>Page title (English)<input value={bookingSettings.public_title_en} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,public_title_en:e.target.value}))} placeholder="Book a dental appointment"/></label>
            <label>رسالة للمرضى<input value={bookingSettings.public_message_ar} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,public_message_ar:e.target.value}))} maxLength={600} placeholder="اختر الوقت المناسب وسيتم تأكيد موعدك من العيادة."/></label>
            <label>Public message<input value={bookingSettings.public_message_en} disabled={demoMode||bookingLoading} onChange={e=>setBookingSettings(current=>({...current,public_message_en:e.target.value}))} maxLength={600} placeholder="Select a time; the clinic will confirm your request."/></label>
          </div>

          <div className="booking-hours-heading"><div><h3>ساعات العمل الأسبوعية</h3><p>فعّل كل فترة على حدة. الأوقات خارج الجدول أو المواعيد الممتلئة لن تظهر للمرضى.</p></div><button type="button" className="secondary-button" disabled={demoMode||bookingLoading} onClick={()=>setBookingHours(defaultBookingHours().map(row=>({...row,enabled:row.weekday<=4||(row.weekday===6&&row.shift==='morning'),start_time:row.shift==='morning'?'08:00':(row.weekday===6?'16:00':'16:00'),end_time:row.shift==='morning'?(row.weekday===6?'13:00':'12:00'):'20:00'})))}>استخدام جدول مقترح</button></div>
          <div className="booking-week-grid">
            {weekdayLabels.map(day=>{
              const morning=bookingHours.find(row=>row.weekday===weekdayLabels.indexOf(day)&&row.shift==='morning')||{enabled:false,start_time:'08:00',end_time:'12:00'};
              const evening=bookingHours.find(row=>row.weekday===weekdayLabels.indexOf(day)&&row.shift==='evening')||{enabled:false,start_time:'16:00',end_time:'20:00'};
              return <article className="booking-day-card" key={day.en}>
                <header><strong>{language==='ar'?day.ar:day.en}</strong><span>{[morning,evening].some(row=>row.enabled)?'يوم عمل':'إجازة / مغلق'}</span></header>
                {[{label:'صباحاً',shift:'morning',row:morning},{label:'مساءً',shift:'evening',row:evening}].map(item=><div className={'booking-shift-editor '+(item.row.enabled?'is-enabled':'')} key={item.shift}>
                  <label className="booking-shift-toggle"><input type="checkbox" checked={item.row.enabled} disabled={demoMode||bookingLoading} onChange={e=>updateBookingHour(weekdayLabels.indexOf(day),item.shift as 'morning'|'evening',{enabled:e.target.checked})}/><span>{item.label}</span></label>
                  <div className="booking-hour-fields"><label><span>من</span><input type="time" value={item.row.start_time} disabled={demoMode||bookingLoading} onChange={e=>updateBookingHour(weekdayLabels.indexOf(day),item.shift as 'morning'|'evening',{start_time:e.target.value})}/></label><label><span>إلى</span><input type="time" value={item.row.end_time} disabled={demoMode||bookingLoading} onChange={e=>updateBookingHour(weekdayLabels.indexOf(day),item.shift as 'morning'|'evening',{end_time:e.target.value})}/></label></div>
                </div>)}
              </article>;
            })}
          </div>
          <div className="booking-share-box">
            <div className="booking-share-icon"><CalendarDays size={20}/></div>
            <div className="booking-share-copy"><strong>الرابط الذي ترسله للمريض</strong><span>لا يمكن الحجز من الرابط قبل حفظ الإعدادات وتفعيل الاستقبال.</span><code dir="ltr">{bookingOrigin&&bookingSettings.public_slug?bookingOrigin+'/book/'+bookingSettings.public_slug:'احفظ إعدادات العيادة لإنشاء الرابط'}</code></div>
            <div className="booking-share-actions"><button type="button" className="secondary-button" disabled={demoMode||!bookingLoaded||!bookingSettings.booking_enabled||!bookingOrigin||!bookingSettings.public_slug} onClick={()=>{const url=bookingOrigin+'/book/'+bookingSettings.public_slug;navigator.clipboard.writeText(url).then(()=>notify('تم نسخ رابط الحجز.')).catch(()=>notify('تعذر نسخ الرابط؛ يمكنك تحديده ونسخه يدوياً.'))}}><CopyIcon/> نسخ الرابط</button><a className="text-link" href={bookingSettings.booking_enabled&&bookingSettings.public_slug?'/book/'+bookingSettings.public_slug:undefined} target="_blank" rel="noreferrer" aria-disabled={!bookingSettings.booking_enabled||!bookingLoaded||demoMode} onClick={e=>{if(!bookingSettings.booking_enabled||!bookingLoaded||demoMode)e.preventDefault()}}>معاينة الصفحة <ChevronLeft size={14}/></a></div>
          </div>
          <div className="booking-settings-footer"><span><ShieldCheck size={16}/> طلب الحجز لا يصبح سجلاً سريرياً إلا بعد اعتماد العيادة.</span><button type="button" className="primary-button" onClick={saveBookingSettings} disabled={demoMode||bookingLoading||bookingSaving}><SaveIcon/>{bookingSaving?'جارٍ حفظ ساعات العمل...':'حفظ ساعات العمل ورابط الحجز'}</button></div>
        </section>
        {settingsDirty && <div className="settings-sticky-save" role="status"><div><strong>توجد تغييرات غير محفوظة</strong><span>{demoMode ? 'قاعدة بيانات العيادة غير متصلة؛ لن تبقى التغييرات بعد تحديث الصفحة.' : 'احفظ التعديلات لتطبيقها على مساحة العيادة.'}</span></div><button className="primary-button" type="button" onClick={saveClinicSettings} disabled={settingsBusy}><SaveIcon/>{settingsBusy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button></div>}</section>}

      <nav className="mobile-dock" aria-label="التنقل السريع">
        <button type="button" className={active==='dashboard'?'active':''} aria-current={active==='dashboard'?'page':undefined} onClick={()=>setActive('dashboard')}><Activity size={19}/><span>الرئيسية</span></button>
        <button type="button" className={active==='patients'?'active':''} aria-current={active==='patients'?'page':undefined} onClick={()=>setActive('patients')}><Users size={19}/><span>المرضى</span></button>
        <button type="button" className={active==='appointments'?'active':''} aria-current={active==='appointments'?'page':undefined} onClick={()=>setActive('appointments')}><CalendarDays size={19}/><span>المواعيد</span></button>
        <button type="button" className={active==='reports'?'active':''} aria-current={active==='reports'?'page':undefined} onClick={()=>setActive('reports')}><FileText size={19}/><span>السجلات</span></button>
      </nav>

      <footer className="app-footer"><span>سِنان <span className="footer-sep">·</span> مساحة عمل سريرية للأسنان</span><span><ShieldCheck size={13}/> الخصوصية والسلامة السريرية أساس التصميم</span></footer>
    </main>



    {showCommandPalette && <div className="command-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) setShowCommandPalette(false)}}><section className="command-palette" role="dialog" aria-modal="true" aria-label="بحث شامل وتنقل سريع">
      <div className="command-searchline"><Search size={19}/><input ref={commandInputRef} value={commandSearch} onChange={event => setCommandSearch(event.target.value)} placeholder="ابحث عن مريض أو افتح وحدة..." aria-label="بحث شامل"/><button type="button" onClick={() => setShowCommandPalette(false)} aria-label="إغلاق البحث">Esc</button></div>
      <div className="command-results">
        {commandNavResults.length > 0 && <div className="command-group"><span className="command-group-label">الانتقال إلى</span>{commandNavResults.map(item => <button type="button" className="command-result" key={item.key} onClick={() => {setActive(item.key);if(item.key==='scribe')setShowScribe(true);setSidebarOpen(false);setShowCommandPalette(false);setCommandSearch('')}}><span className="command-result-icon"><item.icon size={18}/></span><span><strong>{item.label}</strong><small>فتح مساحة {item.label}</small></span><kbd>↵</kbd></button>)}</div>}
        {commandPatientResults.length > 0 && <div className="command-group"><span className="command-group-label">ملفات المرضى</span>{commandPatientResults.map(patient => <button type="button" className="command-result" key={patient.id} onClick={() => {setSelectedPatient(patient);setPatientTab('overview');setActive('patients');setShowCommandPalette(false);setCommandSearch('')}}><span className={'command-result-avatar ' + patient.color}>{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.displayId || patient.id} · {patient.reason}</small></span><ChevronLeft size={16}/></button>)}</div>}
        {commandNavResults.length===0 && commandPatientResults.length===0 && <div className="command-empty"><Search size={24}/><strong>لا توجد نتائج</strong><span>ابحث باسم المريض أو رقم الملف أو اسم الوحدة.</span></div>}
      </div>
      <footer className="command-footer"><span><kbd>Ctrl</kbd> + <kbd>K</kbd> فتح البحث</span><span><kbd>Esc</kbd> إغلاق</span><span>البحث ضمن بيانات هذه العيادة فقط</span></footer>
    </section></div>}


    {showEditPatient && selectedPatient && <div className="modal-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget && !patientSaving) setShowEditPatient(false)}}><div className="modal patient-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
      <div className="modal-head"><div><div className="eyebrow">الملفات السريرية</div><h2 id="edit-patient-title">تعديل بيانات المريض</h2></div><button className="icon-button" type="button" onClick={() => setShowEditPatient(false)} disabled={patientSaving} aria-label="إغلاق"><X size={18}/></button></div>
      <p className="modal-intro">راجع البيانات الأساسية فقط. لا تغيّر الشكوى إلا إذا أكدها المريض، ولا تستبدل التاريخ الصحي أو التشخيصات بهذه الخانات.</p>
      <label className="form-field">اسم المريض <span>*</span><input value={editPatientName} onChange={event => setEditPatientName(event.target.value)} minLength={2} maxLength={180} required/></label>
      <label className="form-field">رقم الهاتف<input type="tel" value={editPatientPhone} onChange={event => setEditPatientPhone(event.target.value)} maxLength={40} placeholder='اتركه فارغاً للإبقاء على الرقم الحالي'/></label>
      <label className="form-field">الشكوى الرئيسية<textarea value={editPatientComplaint} onChange={event => setEditPatientComplaint(event.target.value)} maxLength={2000} rows={3} placeholder="ما ذكره المريض، دون استنتاج تشخيص"/></label>
      {demoMode && <div className="modal-warning"><AlertCircle size={16}/> لا يتوفر الحفظ الدائم حالياً لأن قاعدة بيانات العيادة غير متصلة.</div>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowEditPatient(false)} disabled={patientSaving}>إلغاء</button><button className="primary-button" type="button" onClick={savePatientEdits} disabled={patientSaving || editPatientName.trim().length < 2}><SaveIcon/>{patientSaving ? 'جارٍ حفظ التعديلات...' : 'حفظ التعديلات'}</button></div>
    </div></div>}

    {showNewAppointment && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!appointmentSaving)setShowNewAppointment(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-appointment-title"><div className="modal-head"><div><div className="eyebrow">جدول العيادة</div><h2 id="new-appointment-title">موعد جديد</h2></div><button className="icon-button" onClick={()=>setShowNewAppointment(false)} aria-label="إغلاق" disabled={appointmentSaving}><X size={18}/></button></div><label className="form-field">المريض <span>*</span><select value={appointmentPatientId} onChange={e=>setAppointmentPatientId(e.target.value)} required><option value="">اختر المريض</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name} · {p.displayId||p.id}</option>)}</select></label><div className="settings-grid appointment-fields"><label>التاريخ<input type="date" value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)} required/></label><label>وقت البداية<input type="time" value={appointmentTime} onChange={e=>setAppointmentTime(e.target.value)} required/></label><label>المدة<select value={appointmentDuration} onChange={e=>setAppointmentDuration(e.target.value)}><option value="15">١٥ دقيقة</option><option value="30">٣٠ دقيقة</option><option value="45">٤٥ دقيقة</option><option value="60">٦٠ دقيقة</option><option value="90">٩٠ دقيقة</option></select></label></div><label className="form-field">ملاحظة الموعد (اختيارية)<textarea value={appointmentNote} onChange={e=>setAppointmentNote(e.target.value)} maxLength={2000} rows={3} placeholder="مثلاً: متابعة علاج العصب"/></label>{demoMode&&<div className="modal-warning"><AlertCircle size={16}/> لا يتوفر حفظ دائم لأن قاعدة بيانات العيادة غير متصلة.</div>}<div className="modal-actions"><button className="secondary-button" onClick={()=>setShowNewAppointment(false)} disabled={appointmentSaving}>إلغاء</button><button className="primary-button" onClick={saveAppointment} disabled={appointmentSaving||!appointmentPatientId}><CalendarDays size={16}/>{appointmentSaving?'جارٍ الحفظ...':'حفظ الموعد'}</button></div></div></div>}

    {showNewPatient && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewPatient(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-patient-title"><div className="modal-head"><div><div className="eyebrow">ملف جديد</div><h2 id="new-patient-title">إضافة مريض</h2></div><button className="icon-button" onClick={()=>setShowNewPatient(false)} aria-label="إغلاق"><X size={18}/></button></div><p className="modal-intro">أدخل المعلومات المعروفة فقط. لا تفسّر الحقول الفارغة على أنها نفي مرضي.</p><label className="form-field">اسم المريض <span>*</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم كما هو في ملف العيادة" autoFocus/></label><label className="form-field">الشكوى الرئيسية <textarea value={complaint} onChange={e=>setComplaint(e.target.value)} placeholder="شكوى المريض كما ذكرها، دون إضافة استنتاجات" rows={3}/></label><div className="modal-warning"><AlertCircle size={16}/> سيتم إنشاء سجل محلي للعرض فقط ما لم يتم توصيل قاعدة البيانات.</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setShowNewPatient(false)}>إلغاء</button><button className="primary-button" onClick={createPatient}><Plus size={16}/> إنشاء الملف</button></div></div></div>}

    {showManualVisit && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!manualSaving)setShowManualVisit(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="manual-visit-title"><div className="modal-head"><div><div className="eyebrow">سجل سريري جديد</div><h2 id="manual-visit-title">توثيق زيارة يدوياً</h2></div><button className="icon-button" onClick={()=>setShowManualVisit(false)} aria-label="إغلاق" disabled={manualSaving}><X size={18}/></button></div><div className="scribe-patient"><div className={`avatar ${selectedPatient?.color||'mint'}`}>{selectedPatient?.initials||'؟'}</div><div><strong>{selectedPatient?.name||'لم يتم اختيار مريض'}</strong><span>{selectedPatient?.displayId||selectedPatient?.id||'اختر مريضاً أولاً'}</span></div></div><p className="modal-intro">تنشئ هذه الخطوة مسودة محفوظة في العيادة. ستفتح شاشة المراجعة لإدخال التاريخ الصحي والفحص والخطة. لا يصبح السجل نهائياً قبل اعتماد الطبيب.</p><label className="form-field">الشكوى الرئيسية كما ذكرها المريض<textarea value={manualComplaint} onChange={e=>setManualComplaint(e.target.value)} rows={3} maxLength={2000} placeholder="اكتب ما ذكره المريض دون استنتاج تشخيص"/></label><div className="modal-warning"><ShieldCheck size={16}/> ستظل الحساسية والأدوية ونتائج الفحص غير مسجلة حتى تدخلها وتتحقق منها.</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setShowManualVisit(false)} disabled={manualSaving}>إلغاء</button><button className="primary-button" onClick={createManualVisit} disabled={manualSaving||!selectedPatient}><FilePlus2 size={16}/>{manualSaving?'جارٍ إنشاء المسودة...':'إنشاء المسودة اليدوية'}</button></div></div></div>}

    {showScribe && <ScribeModal patient={selectedPatient} isDemo={demoMode} onClose={()=>setShowScribe(false)} onManual={()=>{setShowScribe(false);setManualComplaint('');setShowManualVisit(true)}} notify={notify}/>}
    {toast && <div className="toast"><CircleCheck size={17}/>{toast}</div>}
  </div></Localized>;
}

function SaveIcon(){return <Check size={16}/>;}
function appointmentStatus(status:string){const map:Record<string,string>={scheduled:'مجدول',confirmed:'مؤكد',arrived:'وصل',in_progress:'قيد التنفيذ',completed:'مكتمل',cancelled:'ملغي',no_show:'لم يحضر'};return map[status]||status||'مجدول'}
function ToothGlyph({tooth}:{tooth:number}) {
  const molar = [16,17,18,26,27,28,36,37,38,46,47,48].includes(tooth);
  const path = molar
    ? 'M16 5 C12 1 7 3 6 7 C3 9 4 15 7 22 C9 27 12 26 14 21 L16 17 L18 21 C20 26 23 27 25 22 C28 15 29 9 26 6 C23 2 19 2 16 5 Z'
    : 'M16 5 C11 1 7 4 7 9 C7 13 10 17 11 22 C12 26 14 26 15 21 L16 16 L17 21 C18 26 20 26 21 22 C22 17 25 13 25 9 C25 4 21 1 16 5 Z';
  return <svg viewBox="0 0 32 30" aria-hidden="true" focusable="false"><path d={path} fill="currentColor" fillOpacity=".09" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M16 8 V13" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}

function StatCard({icon,tone,label,number,foot,alert=false}:{icon:React.ReactNode;tone:string;label:string;number:string;foot:string;alert?:boolean}){return <Localized><div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className={`stat-number ${alert?'alert-number':''}`}>{number}</div><div className="stat-foot">{alert&&<span className="tiny-alert"/>}{foot}</div></div></Localized>}
function Appointment({time,period,patient,type,duration,status,color,active=false,statusKey,onStatusChange}:{time:string;period:string;patient:string;type:string;duration:string;status:string;color:string;active?:boolean;statusKey?:string;onStatusChange?:(status:string)=>void}){return <Localized><div className={`timeline-item ${active?'active-appointment':''}`}><div className="timeline-time"><strong>{time}</strong><span>{period}</span></div><div className="timeline-track"><i className={active?'track-active':''}/></div><div className={`avatar small ${color}`}>{patient.slice(0,1)}</div><div className="appointment-info"><strong>{patient}</strong><span>{type==='dental_visit'?'زيارة أسنان':type}</span><small><Clock3 size={12}/> {duration}</small></div>{onStatusChange&&statusKey?<select className="appointment-state-select" value={statusKey} onChange={event=>onStatusChange(event.target.value)} aria-label="تغيير حالة الموعد"><option value="scheduled">مجدول</option><option value="confirmed">مؤكد</option><option value="arrived">وصل</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option><option value="no_show">لم يحضر</option></select>:<span className={`appointment-state ${status==='وصل'?'checked-in':status==='قيد الانتظار'?'waiting':''}`}>{status}</span>}</div></Localized>}
function ReviewItem({name,detail,state,color,onClick}:{name:string;detail:string;state:string;color:string;onClick:()=>void}){return <Localized><button className="review-item" onClick={onClick}><div className={`avatar small ${color}`}>{name.slice(0,1)}</div><div className="review-info"><strong>{name}</strong><span>{detail}</span><small><AlertCircle size={12}/>{state}</small></div><ChevronLeft size={16}/></button></Localized>}
function StatePill({state}:{state:string}){let c=state.includes('معتمد')?'approved':state.includes('مسودة')?'draft':state.includes('مراجعة')||state.includes('غير')?'review':'neutral';const Icon=c==='review'?AlertCircle:c==='approved'?CircleCheck:c==='draft'?FileText:null;return <Localized><span className={`state-pill ${c}`} aria-label={`الحالة: ${state}`}>{Icon&&<Icon size={12} aria-hidden="true"/>}{state}</span></Localized>}
function DetailField({label,value,warning=false}:{label:string;value:string;warning?:boolean}){return <Localized><div className="detail-field"><span>{label}</span><strong className={warning?'muted-field':''}>{value}</strong></div></Localized>}

function ScribeModal({patient,onClose,onManual,notify,isDemo}:{patient:Patient|null;onClose:()=>void;onManual:()=>void;notify:(message:string)=>void;isDemo:boolean}) {
  type CaptureState='idle'|'recording'|'paused'|'processing'|'upload_failed'|'processing_failed';
  const [consent,setConsent]=useState(false);
  const [capture,setCapture]=useState<CaptureState>('idle');
  const [elapsed,setElapsed]=useState('00:00');
  const [recordingError,setRecordingError]=useState('');
  const [draft,setDraft]=useState('');
  const [media,setMedia]=useState<MediaRecorder|null>(null);
  const [stream,setStream]=useState<MediaStream|null>(null);
  const [chunks,setChunks]=useState(0);
  const [recordingId,setRecordingId]=useState<string|null>(null);
  const [reviewUrl,setReviewUrl]=useState('');
  const recordingIdRef=useRef<string|null>(null);
  const jobIdRef=useRef<string|null>(null);
  const nextChunkRef=useRef(0);
  const secondsRef=useRef(0);
  const uploadQueueRef=useRef<Promise<void>>(Promise.resolve());
  const pendingChunksRef=useRef<Map<number,Blob>>(new Map());
  const finishedCaptureRef=useRef(false);
  const finishingRef=useRef(false);
  const stopRequestedRef=useRef(false);
  const streamRef=useRef<MediaStream|null>(null);
  const mediaRef=useRef<MediaRecorder|null>(null);

  async function uploadChunk(sessionId:string,index:number,blob:Blob) {
    const form=new FormData();
    form.append('file',blob,`chunk-${index}.webm`);
    form.append('chunk_index',String(index));
    const response=await fetch(`/api/recordings/${sessionId}/chunks`,{method:'POST',body:form});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||`تعذر رفع المقطع ${index+1}.`);
  }

  async function start() {
    setRecordingError('');
    if(isDemo){setRecordingError('التسجيل غير متاح لأن خدمة التوثيق أو قاعدة بيانات العيادة غير متصلة. اربط التكاملات المطلوبة لتفعيل الميكروفون.');return;}
    if(!consent){setRecordingError('يجب توثيق الموافقة قبل تشغيل الميكروفون.');return;}
    if(!patient?.id || !/^[0-9a-f-]{36}$/i.test(patient.id)){setRecordingError('اختر ملف مريض محفوظاً في قاعدة بيانات العيادة قبل التسجيل.');return;}
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){setRecordingError('هذا المتصفح لا يدعم تسجيل الصوت المطلوب.');return;}
    let st:MediaStream|null=null;
    try {
      st=await navigator.mediaDevices.getUserMedia({audio:true});
      const rec=new MediaRecorder(st);
      const response=await fetch('/api/recordings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:patient.id,content_type:rec.mimeType||'audio/webm',consent_confirmed:consent})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||'تعذر إنشاء جلسة التسجيل.');
      const sessionId=String(body.recording_id||'');
      if(!sessionId) throw new Error('لم يُرجع الخادم معرّف جلسة التسجيل.');
      recordingIdRef.current=sessionId;setRecordingId(sessionId);
      jobIdRef.current=null;nextChunkRef.current=0;pendingChunksRef.current.clear();uploadQueueRef.current=Promise.resolve();finishedCaptureRef.current=false;finishingRef.current=false;stopRequestedRef.current=false;
      secondsRef.current=0;setChunks(0);setElapsed('00:00');setDraft('');setReviewUrl('');
      rec.ondataavailable=(event)=>{
        if(!event.data?.size) return;
        const index=nextChunkRef.current++;
        pendingChunksRef.current.set(index,event.data);
        setChunks(index+1);
        uploadQueueRef.current=uploadQueueRef.current.then(async()=>{
          try { await uploadChunk(sessionId,index,event.data);pendingChunksRef.current.delete(index); }
          catch(error) { setRecordingError(error instanceof Error?error.message:'تعذر رفع مقطع صوت. سيُعاد رفعه عند إنهاء التسجيل.'); }
        });
      };
      rec.onerror=()=>setRecordingError('حدث خطأ أثناء التقاط الصوت؛ أنهِ التسجيل لحفظ المقاطع التي وصلت إلى الخادم.');
      rec.start(5000);
      mediaRef.current=rec;streamRef.current=st;setMedia(rec);setStream(st);setCapture('recording');
    } catch(error) {
      st?.getTracks().forEach(track=>track.stop());
      setRecordingError(error instanceof Error?error.message:'لم نتمكن من فتح الميكروفون أو بدء جلسة التسجيل.');
    }
  }

  async function setRemoteState(next:'pause'|'resume') {
    const sessionId=recordingIdRef.current;
    if(!sessionId) return;
    try {
      const response=await fetch(`/api/recordings/${sessionId}/${next}`,{method:'POST'});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||'تعذر تحديث حالة التسجيل على الخادم.');
    } catch(error) {
      setRecordingError(error instanceof Error?error.message:'تعذر مزامنة حالة التسجيل. تحقق من الاتصال قبل المتابعة.');
    }
  }
  function pause(){if(mediaRef.current&&capture==='recording'){mediaRef.current.pause();setCapture('paused');void setRemoteState('pause');}}
  function resume(){if(mediaRef.current&&capture==='paused'){mediaRef.current.resume();setCapture('recording');void setRemoteState('resume');}}

  async function processExistingJob() {
    const sessionId=recordingIdRef.current;const jobId=jobIdRef.current;
    if(!sessionId||!jobId) throw new Error('لا توجد مهمة محفوظة قابلة لإعادة المعالجة.');
    const response=await fetch('/api/ai/process-recording',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recording_id:sessionId,job_id:jobId})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error||'حُفظ التسجيل لكن تعذرت معالجته؛ أعد المحاولة بعد التحقق من الإعدادات.');
    setDraft(result.warning||'تم إنشاء مسودة سريرية محفوظة؛ راجع كل معلومة قبل الاعتماد.');
    if(result.encounter_id)setReviewUrl(`/encounters/${result.encounter_id}`);
    setCapture('idle');notify('تم حفظ المسودة؛ وهي تحتاج إلى مراجعة الطبيب واعتماده.');
  }

  async function completeUploadAndProcess() {
    if(finishingRef.current)return;
    finishingRef.current=true;setCapture('processing');setRecordingError('');
    try {
      await uploadQueueRef.current;
      const sessionId=recordingIdRef.current;
      if(!sessionId)throw new Error('لم تُنشأ جلسة تسجيل محفوظة.');
      for(const [index,blob] of [...pendingChunksRef.current.entries()].sort((a,b)=>a[0]-b[0])){
        try{await uploadChunk(sessionId,index,blob);pendingChunksRef.current.delete(index);}
        catch(error){throw new Error(error instanceof Error?`تعذر رفع المقطع ${index+1}: ${error.message}`:`تعذر رفع المقطع ${index+1}.`);}
      }
      if(pendingChunksRef.current.size>0){setCapture('upload_failed');throw new Error('بعض المقاطع لم تصل إلى التخزين الآمن. أبقِ النافذة مفتوحة وحاول إعادة الرفع.');}
      if(!finishedCaptureRef.current){
        const doneRes=await fetch(`/api/recordings/${sessionId}/finish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recording_id:sessionId})});
        const result=await doneRes.json().catch(()=>({}));
        if(!doneRes.ok)throw new Error(result.error||'تم رفع المقاطع لكن تعذر إنهاء التسجيل خادمياً.');
        jobIdRef.current=String(result.job_id||'');
        if(!jobIdRef.current)throw new Error('تم حفظ التسجيل ولم يرجع الخادم معرّف المعالجة. أعد المحاولة للتحقق من الحالة.');
        finishedCaptureRef.current=true;
      }
      await processExistingJob();
    }catch(error){
      const message=error instanceof Error?error.message:'فشلت عملية حفظ التسجيل أو معالجته.';
      setRecordingError(message);
      setCapture(pendingChunksRef.current.size?'upload_failed':(finishedCaptureRef.current?'processing_failed':'upload_failed'));
    }finally{finishingRef.current=false;}
  }

  async function finish(){
    const rec=mediaRef.current;
    if(!rec||!recordingIdRef.current||finishingRef.current||stopRequestedRef.current)return;
    stopRequestedRef.current=true;setCapture('processing');setRecordingError('');
    try {
      if(rec.state!=='inactive') await new Promise<void>(resolve=>{rec.addEventListener('stop',()=>resolve(),{once:true});try{rec.stop();}catch{resolve();}});
      finishedCaptureRef.current=false;
      streamRef.current?.getTracks().forEach(track=>track.stop());
      setElapsed('تم الإيقاف');
      await completeUploadAndProcess();
    } finally { stopRequestedRef.current=false; }
  }
  async function retry(){
    setRecordingError('');
    if(capture==='processing_failed'&&jobIdRef.current){setCapture('processing');try{await processExistingJob();}catch(error){setCapture('processing_failed');setRecordingError(error instanceof Error?error.message:'فشلت إعادة المعالجة.');}return;}
    await completeUploadAndProcess();
  }

  useEffect(()=>{if(capture!=='recording')return;const timer=setInterval(()=>{secondsRef.current+=1;const sec=secondsRef.current;setElapsed(`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`)},1000);return()=>clearInterval(timer)},[capture]);
  function close(){
    if(capture==='recording'||capture==='paused'){const ok=window.confirm('هذه الزيارة لم تُنهَ بعد. إنهاء التسجيل سيحفظ المقاطع ويبدأ المعالجة؛ هل تريد إنهاء التسجيل الآن؟');if(ok)void finish();return;}
    if(capture==='processing')return;
    if(pendingChunksRef.current.size>0){setRecordingError('توجد مقاطع لم تُرفع بعد. أعد محاولة الرفع قبل إغلاق نافذة التسجيل.');return;}
    streamRef.current?.getTracks().forEach(track=>track.stop());onClose();
  }
  return <Localized><div className="modal-backdrop high" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal scribe-modal" role="dialog" aria-modal="true" aria-labelledby="scribe-title"><div className="modal-head"><div><div className="eyebrow">مساحة التوثيق السريرية</div><h2 id="scribe-title">تسجيل الزيارة</h2></div><button className="icon-button" onClick={close} aria-label="إغلاق"><X size={18}/></button></div><div className="scribe-patient"><div className={`avatar ${patient?.color||'mint'}`}>{patient?.initials||'؟'}</div><div><strong>{patient?.name||'لم يتم اختيار مريض'}</strong><span>{patient?.id||'أنشئ أو اختر ملفاً قبل التسجيل'}</span></div><span className="state-pill neutral">مسودة</span></div><div className="consent-check"><input id="record-consent" type="checkbox" checked={consent} disabled={capture!=='idle'} onChange={e=>setConsent(e.target.checked)}/><label htmlFor="record-consent"><strong>تم التحقق من الموافقة اللازمة على التسجيل.</strong><span>أؤكد أن الموافقة جرى أخذها وتوثيقها وفق سياسة العيادة والقانون المنطبق قبل التقاط أي صوت.</span></label></div><div id="record-consent-help" className="scribe-guardrail">{isDemo ? "التسجيل غير متاح قبل ربط قاعدة بيانات العيادة وخدمة التوثيق." : !patient?.id ? "اختر ملف مريض أولاً." : !consent ? "يلزم تأكيد الموافقة قبل تشغيل الميكروفون." : "تم تأكيد الموافقة؛ لن يبدأ التسجيل إلا بعد توفر ملف مريض صالح."}</div><div className={`recording-console ${capture==='recording'?'recording-on':''}`}><div className="microphone-circle">{capture==='recording'?<span className="rec-dot"/>:<Mic size={28}/>}</div><strong>{capture==='recording'?'جارٍ تسجيل الصوت':capture==='paused'?'التسجيل متوقف مؤقتاً':capture==='upload_failed'?'هناك مقاطع تنتظر الرفع':capture==='processing_failed'?'حُفظ التسجيل وتحتاج المعالجة إلى إعادة محاولة':capture==='processing'?'جارٍ حفظ ومعالجة التسجيل':isDemo?'يتطلب اتصال قاعدة البيانات':!patient?.id?'اختر ملف مريض أولاً':'جاهز للتحقق من الموافقة'}</strong><span className="record-timer">{elapsed}</span><div className="record-state-caption">{capture==='recording'?'يتم التقاط الصوت من الميكروفون الفعلي ورفع المقاطع كل ٥ ثوانٍ':capture==='paused'?'يمكنك استئناف التسجيل أو إنهاؤه':capture==='processing'?'لن يُعتمد أي سجل تلقائياً':capture==='upload_failed'?'لن يبدأ التفريغ قبل التأكد من وصول جميع المقاطع':'المسودة لا تصبح سجلاً نهائياً إلا بعد مراجعة الطبيب'}</div></div>{recordingError&&<div className="inline-error"><AlertCircle size={16}/>{recordingError}</div>}{draft&&<div className="inline-success"><Check size={16}/>{draft}</div>}{reviewUrl&&<a className="primary-button" href={reviewUrl}>فتح المسودة ومراجعتها <ChevronLeft size={15}/></a>}<div className="recording-actions">{capture==='idle'?<button className="primary-button record-primary" onClick={start} disabled={!consent || !patient?.id || isDemo} aria-describedby="record-consent-help"><Mic size={18}/> بدء الاستماع</button>:capture==='recording'?<><button className="secondary-button" onClick={pause}>إيقاف مؤقت</button><button className="danger-button" onClick={finish}><SquareIcon/> إنهاء الاستماع</button></>:capture==='paused'?<><button className="primary-button" onClick={resume}><Play size={16}/> استئناف</button><button className="danger-button" onClick={finish}>إنهاء الاستماع</button></>:capture==='processing'?<button className="secondary-button" disabled>جارٍ الحفظ...</button>:<button className="primary-button record-primary" onClick={retry}><Activity size={16}/> {capture==='upload_failed'?'إعادة رفع المقاطع':'إعادة محاولة المعالجة'}</button>}</div><div className="scribe-guardrail"><ShieldCheck size={16}/><span>إنهاء الاستماع لا يعتمد السجل؛ النسخة المستخرجة تبقى مسودة حتى مراجعة الطبيب واعتماده. عدد مقاطع الصوت الملتقطة: {chunks}. لا تُحذف المقاطع من الذاكرة حتى التأكد من رفعها.</span></div><div className="modal-actions"><button className="text-link" onClick={onManual}>متابعة بكتابة يدوية</button><button className="secondary-button" onClick={close}>إغلاق المساحة</button></div></div></div></Localized>;
}
function SquareIcon(){return <span className="square-stop"/>}
