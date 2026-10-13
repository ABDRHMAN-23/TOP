'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, ChevronLeft, FileText, LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import SinanMark from '@/components/SinanMark';

type StateValue = 'patient_reported'|'observed'|'ai_suggested'|'clinician_confirmed'|'explicitly_negative'|'unknown'|'not_collected'|'not_applicable'|'needs_review';
type Note = { id: string; status: string; version: number; draft_json: Record<string, unknown>; transcript_text: string | null; approved_at?: string | null; provenance?: Record<string, unknown> | null };
type FieldValue = { value: unknown; state: StateValue; source?: string | null; confidence?: number | null; [key: string]: unknown };
const fields = [
  ['chiefComplaint','الشكوى الرئيسية','ما ذكره المريض سبباً للزيارة.'],
  ['historyOfPresentIllness','تاريخ الحالة الحالية','وصف الأعراض وتسلسلها كما ورد في الزيارة.'],
  ['medicalHistory','التاريخ الصحي','حالات أو معلومات صحية وردت في الحوار.'],
  ['allergies','الحساسية','لا تفسر عدم ذكر الحساسية على أنها عدم وجودها.'],
  ['medications','الأدوية الحالية','تحقق من الاسم والجرعة إن ذُكرا.'],
  ['examinationFindings','نتائج الفحص','لا تعتمد إلا ما شاهده الطبيب وأكده.'],
  ['assessment','التقييم السريري المقترح','كل استنتاج آلي يبقى بحاجة إلى المراجعة.'],
  ['proposedPlan','الخطة المقترحة','ميّز بين المخطط والمنفذ فعلاً.'],
  ['proceduresDiscussed','إجراءات نوقشت','ذكر الإجراء لا يعني أنه نُفّذ.'],
  ['proceduresCompleted','إجراءات مكتملة','تحقق من الإكمال قبل التأكيد.'],
  ['prescriptionsSuggested','أدوية أو وصفات مقترحة','لا تتحول إلى وصفة صادرة من دون اعتماد منفصل.'],
  ['followUp','المتابعة','المواعيد والمدة كما ذُكرت، مع تأكيد الطبيب.'],
] as const;
const states: {value: StateValue; label: string}[] = [
  {value:'ai_suggested',label:'اقتراح آلي — يحتاج مراجعة'}, {value:'patient_reported',label:'ذكره المريض'}, {value:'observed',label:'ملاحظة فحص'}, {value:'clinician_confirmed',label:'أكدها الطبيب'}, {value:'explicitly_negative',label:'نفي صريح'}, {value:'unknown',label:'غير معلوم'}, {value:'not_collected',label:'لم تُجمع المعلومة'}, {value:'not_applicable',label:'لا ينطبق'}, {value:'needs_review',label:'مطلوب مراجعة'},
];
function asField(value: unknown): FieldValue {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    const f = value as Record<string, unknown>;
    const state = states.some(item => item.value === f.state) ? f.state as StateValue : 'ai_suggested';
    return { ...f, value: f.value, state } as FieldValue;
  }
  if (value === null || value === undefined) return { value: '', state: 'not_collected', source: null, confidence: null };
  return { value, state: 'ai_suggested', source: null, confidence: null };
}
function valueToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}
function parseInput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return value;
}
function unwrapPatient(raw: any) { return Array.isArray(raw) ? raw[0] : raw; }

export default function EncounterReviewPage() {
  const params = useParams<{ encounterId: string }>();
  const encounterId = params.encounterId;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [transcript, setTranscript] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, StateValue>>({});
  const [busy, setBusy] = useState(false);
  const [approvedConfirmation, setApprovedConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const hydrate = useCallback((payload: any) => {
    setData(payload.encounter);
    setNote(payload.note);
    setTranscript(payload.note?.transcript_text || (payload.transcript_segments || []).map((s: any) => s.text).join('\n\n'));
    const nextValues: Record<string, string> = {};
    const nextStates: Record<string, StateValue> = {};
    for (const [key] of fields) {
      const field = asField(payload.note?.draft_json?.[key]);
      nextValues[key] = valueToText(field.value);
      nextStates[key] = field.state;
    }
    setValues(nextValues);
    setFieldStates(nextStates);
  }, []);

  const load = useCallback(async () => {
    setError('');
    const response = await fetch(`/api/encounters/${encounterId}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'تعذر تحميل الزيارة.');
    hydrate(payload);
  }, [encounterId, hydrate]);

  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : 'تعذر تحميل الزيارة.')); }, [load]);

  const uncertaintyFlags = useMemo(() => {
    const flags = note?.draft_json?.uncertaintyFlags;
    return Array.isArray(flags) ? flags.filter((v): v is string => typeof v === 'string') : [];
  }, [note]);
  const isApproved = note?.status === 'approved';

  async function saveDraft() {
    if (!note) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const draft = structuredClone(note.draft_json);
      for (const [key] of fields) {
        const oldField = asField(draft[key]);
        draft[key] = { ...oldField, value: parseInput(values[key] ?? ''), state: fieldStates[key] || oldField.state, source: oldField.source ?? null };
      }
      const response = await fetch(`/api/clinical-notes/${note.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: note.version, draft_json: draft, transcript_text: transcript }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'تعذر حفظ النسخة الجديدة.');
      await load();
      setMessage('حُفظت نسخة جديدة من المسودة. ما زالت بحاجة إلى اعتماد منفصل.');
      setApprovedConfirmation(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ.'); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!note || !approvedConfirmation) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/encounters/${encounterId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinical_note_id: note.id, expected_version: note.version, confirmation: true, method: 'clinician_review' }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'تعذر اعتماد السجل.');
      await load();
      setMessage('اعتمد الطبيب هذه النسخة. أصبح التقرير متاحاً للإنشاء.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر اعتماد السجل.'); }
    finally { setBusy(false); }
  }

  async function createReport() {
    if (!note || note.status !== 'approved') return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinical_note_id: note.id, language: 'ar', report_type: 'encounter_summary' }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'تعذر إنشاء التقرير.');
      router.push(`/reports/${payload.report.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء التقرير.'); }
    finally { setBusy(false); }
  }

  const patient = unwrapPatient(data?.patients);
  return <main className="review-page" dir="rtl">
    <header className="review-header"><a href="/" className="review-back"><ArrowRight size={17}/> العودة لمساحة العيادة</a><div className="review-brand"><div className="brand-symbol"><SinanMark className="sinan-mark" /></div><div><strong>سِنان</strong><span>مراجعة السجل السريري</span></div></div><span className={`review-status ${isApproved?'approved':''}`}>{isApproved?'معتمد من الطبيب':note?.status==='needs_review'?'بانتظار المراجعة':note?.status||'جارٍ التحميل'}</span></header>
    {error && <div className="review-error"><AlertCircle size={17}/><span>{error}</span><button onClick={() => load().catch(e => setError(String(e)))}>إعادة المحاولة</button></div>}
    {message && <div className="review-success"><Check size={17}/>{message}</div>}
    {!data && !error && <div className="review-loading"><LoaderCircle size={24}/> جارٍ تحميل الزيارة...</div>}
    {data && <>
      <section className="review-intro"><div><div className="eyebrow">زيارة سريرية · {data.id.slice(0,8)}</div><h1>{patient?.full_name || 'ملف الزيارة'}</h1><p>{patient?.patient_number ? `رقم الملف ${patient.patient_number} · ` : ''}الحالة الحالية: {data.status} · {data.started_at ? new Date(data.started_at).toLocaleString('ar') : 'وقت البدء غير مسجل'}</p></div><div className="review-actions"><button className="review-btn secondary" onClick={() => load().catch(e => setError(String(e)))} disabled={busy}><LoaderCircle size={16}/> تحديث</button><button className="review-btn primary" onClick={saveDraft} disabled={busy || !note || isApproved}><Save size={16}/> {busy?'جارٍ الحفظ...':'حفظ نسخة مراجعة'}</button></div></section>
      {!note ? <section className="review-card"><h2>لا توجد مسودة بعد</h2><p>قد يكون التسجيل لا يزال قيد المعالجة أو أن المعالجة توقفت. لن ينشئ النظام سجلاً سريرياً من دون نتيجة معالجة فعلية.</p><div className="review-actions"><button className="review-btn secondary" onClick={() => router.push('/')}>العودة للعيادة</button></div></section> : <>
        <section className="review-safety"><ShieldCheck size={20}/><div><strong>{isApproved?'هذه نسخة معتمدة':'المسودة لم تعتمد بعد'}</strong><p>راجع الوقائع ومصدرها وحالتها. لا تعني المعلومة غير المسجلة أن الحالة غير موجودة، وذكر إجراء لا يعني أنه نُفّذ.</p></div><span>النسخة {note.version}</span></section>
        {uncertaintyFlags.length > 0 && <section className="review-card uncertainty-card"><h2><AlertCircle size={18}/> نقاط تحتاج انتباهك</h2><ul>{uncertaintyFlags.map((flag,i)=><li key={i}>{flag}</li>)}</ul></section>}
        <section className="review-card"><div className="review-section-head"><div><div className="eyebrow">محتوى المسودة</div><h2>مراجعة المعلومات السريرية</h2><p>يمكن تعديل النص وتغيير حالة كل معلومة. لا تحوّل أي اقتراح إلى حقيقة مؤكدة إلا بعد التحقق منه.</p></div><span className="review-ai-tag">{note?.provenance?.source === 'manual_entry' ? 'إدخال يدوي يحتاج مراجعة' : 'مسودة آلية تحتاج مراجعة'}</span></div>
          <div className="clinical-review-grid">{fields.map(([key,label,hint])=><div className="clinical-field" key={key}><label htmlFor={`field-${key}`}>{label}</label><p>{hint}</p><textarea id={`field-${key}`} value={values[key] ?? ''} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} rows={3} disabled={isApproved} placeholder="غير مسجل — لا تستنتج قيمة غير مذكورة"/><div className="clinical-state"><span>حالة المعلومة</span><select value={fieldStates[key]||'not_collected'} disabled={isApproved} onChange={e=>setFieldStates(v=>({...v,[key]:e.target.value as StateValue}))}>{states.map(state=><option key={state.value} value={state.value}>{state.label}</option>)}</select></div>{asField(note.draft_json[key]).source && <details className="source-evidence"><summary>العبارة المصدرية</summary><p>{String(asField(note.draft_json[key]).source)}</p></details>}</div>)}</div>
        </section>
        <section className="review-card"><div className="review-section-head"><div><div className="eyebrow">مصدر المسودة</div><h2>التفريغ النصي</h2><p>نص مستخرج من الصوت؛ راجع الكلام غير الواضح أو أسماء الأدوية والقياسات قبل الاعتماد.</p></div><span className="review-status">{transcript?'متاح للمراجعة':'لا يوجد تفريغ محفوظ'}</span></div><textarea className="transcript-editor" value={transcript} onChange={e=>setTranscript(e.target.value)} rows={8} disabled={isApproved} placeholder="لا يوجد تفريغ محفوظ لهذه الزيارة."/><div className="transcript-meta">نص التفريغ يحتفظ بنص المصدر الذي يحتاج مراجعته، ولا يعني أن إسناد الجمل للمتحدثين قد تم التحقق منه.</div></section>
        {!isApproved ? <section className="review-approval"><label><input type="checkbox" checked={approvedConfirmation} onChange={e=>setApprovedConfirmation(e.target.checked)}/><span><strong>أؤكد أنني راجعت هذه النسخة سريرياً.</strong><small>الاعتماد مسؤولية الطبيب؛ تحقق من هوية المريض والتاريخ الصحي والحساسية والأدوية والتشخيصات والخطة قبل المتابعة.</small></span></label><button className="review-btn approve" onClick={approve} disabled={busy || !approvedConfirmation || !note}><Check size={17}/> اعتماد النسخة الحالية</button><p>الاعتماد يخص النسخة {note.version} فقط، ويُحفظ في سجل التدقيق.</p></section> : <section className="review-approval approved-panel"><div><Check size={20}/><strong>تم اعتماد النسخة {note.version}</strong><p>يمكن إنشاء لقطة تقرير للطباعة أو الحفظ كـ PDF.</p></div><button className="review-btn primary" onClick={createReport} disabled={busy}><FileText size={17}/> إنشاء التقرير</button></section>}
      </>}
    </>}
    <style jsx>{`
      .review-page{--ink:#19373a;--muted:#718586;--teal:#087f8c;--line:#e4ecea;min-height:100vh;background:#f6f9f8;color:var(--ink);padding:0 22px 50px;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif}
      .review-header{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:22px;justify-content:space-between;max-width:1180px;margin:auto}.review-back{display:flex;align-items:center;gap:8px;color:#65817f;text-decoration:none;font-size:12px}.review-brand{display:flex;align-items:center;gap:10px;margin-right:auto}.review-brand>div:last-child{display:flex;flex-direction:column;gap:3px}.review-brand strong{font-size:17px}.review-brand span{font-size:10px;color:var(--muted)}.review-status{font-size:10px;color:#8b7770;background:#fff5e9;border:1px solid #f1e3cc;border-radius:30px;padding:7px 11px;white-space:nowrap}.review-status.approved{background:#e9f7ef;border-color:#d4eade;color:#237758}.review-intro{max-width:1120px;margin:30px auto 18px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}.review-intro h1{font-size:26px;margin:0;color:#193b3c}.review-intro p{font-size:12px;line-height:1.8;color:#819594;margin:7px 0 0}.review-actions{display:flex;gap:9px;align-items:center}.review-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:9px;min-height:39px;padding:0 14px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}.review-btn:disabled{opacity:.45;cursor:not-allowed}.review-btn.primary{background:#087f8c;color:white}.review-btn.secondary{background:white;color:#55706e;border-color:#dce7e4}.review-btn.approve{background:#0b827d;color:white;min-height:45px;padding-inline:20px}.review-card,.review-safety,.review-approval{max-width:1120px;margin:13px auto 0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:0 5px 18px #2b52520a}.review-card h2{font-size:16px;margin:0;color:#294849}.review-card p{font-size:11px;color:#829593;line-height:1.8}.review-safety{display:flex;align-items:flex-start;gap:12px;background:#eef8f4;border-color:#d7ece4}.review-safety>svg{color:#148778;flex-shrink:0}.review-safety>div{flex:1}.review-safety strong{font-size:12px}.review-safety p{font-size:11px;color:#678984;line-height:1.8;margin:5px 0 0}.review-safety>span{font-size:10px;color:#678984;white-space:nowrap}.review-section-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px}.review-section-head h2{margin:0}.review-section-head p{margin:6px 0 0}.review-ai-tag{font-size:10px;color:#95733f;background:#fff7e9;border:1px solid #f3e5c9;border-radius:25px;padding:7px 10px;white-space:nowrap}.clinical-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.clinical-field{min-width:0;border:1px solid #e7efec;border-radius:10px;padding:14px}.clinical-field>label{font-size:12px;font-weight:700;color:#365958}.clinical-field>p{font-size:10px;margin:5px 0 10px;min-height:27px}.clinical-field textarea,.transcript-editor{width:100%;border:1px solid #dfe9e6;background:#fbfdfc;border-radius:8px;padding:10px;color:#28494a;line-height:1.8;font:12px inherit;resize:vertical;min-height:75px}.clinical-field textarea:focus,.transcript-editor:focus{outline:2px solid #8cd3c8;outline-offset:1px}.clinical-field textarea:disabled,.transcript-editor:disabled{background:#f7faf8;color:#637b79}.clinical-state{display:flex;align-items:center;gap:10px;margin-top:9px}.clinical-state>span{font-size:10px;color:#8a9c99;white-space:nowrap}.clinical-state select{min-width:0;flex:1;border:1px solid #dfe9e6;background:white;border-radius:7px;min-height:34px;padding:5px 7px;font:10px inherit;color:#416362}.clinical-state select:disabled{opacity:.7}.source-evidence{margin-top:8px;font-size:10px;color:#588580}.source-evidence summary{cursor:pointer}.source-evidence p{background:#f6faf8;padding:9px;border-radius:7px;white-space:pre-wrap}.uncertainty-card{background:#fffaf0;border-color:#f0e5cc}.uncertainty-card h2{display:flex;align-items:center;gap:8px;color:#87632c}.uncertainty-card ul{margin:13px 0 0;padding-right:19px;color:#765f3a;font-size:11px;line-height:2}.transcript-editor{min-height:180px;font-family:inherit;white-space:pre-wrap}.transcript-meta{font-size:10px;color:#8ba09c;line-height:1.8;margin-top:8px}.review-approval{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f8fbfa}.review-approval>label{display:flex;align-items:flex-start;gap:10px;flex:1;cursor:pointer}.review-approval input{accent-color:#087f8c;margin-top:4px}.review-approval label span{display:flex;flex-direction:column;gap:5px}.review-approval label strong,.review-approval>div strong{font-size:12px}.review-approval label small,.review-approval p{font-size:10px;line-height:1.8;color:#879b98}.review-approval p{margin:8px 0 0}.approved-panel{background:#edf8f2;border-color:#d9ece2}.approved-panel>div>svg{color:#1b8d73;vertical-align:middle;margin-left:8px}.review-error,.review-success{display:flex;gap:9px;align-items:center;max-width:1120px;margin:13px auto 0;padding:12px 14px;border-radius:9px;font-size:11px;line-height:1.7}.review-error{background:#fff0ef;color:#a23e3c;border:1px solid #f1d5d2}.review-error span{flex:1}.review-error button{background:transparent;border:0;text-decoration:underline;color:inherit}.review-success{background:#eaf7ef;color:#2d7e5b;border:1px solid #d6ecdf}.review-loading{max-width:1120px;margin:40px auto;display:flex;gap:10px;align-items:center;color:#708b88}.review-loading svg{animation:spin 1.4s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:760px){.review-page{padding:0 12px 30px}.review-header{height:auto;min-height:62px;gap:10px;flex-wrap:wrap;padding:12px 0}.review-back{font-size:10px}.review-brand{margin-right:0}.review-brand span{display:none}.review-intro{align-items:flex-start;flex-direction:column;margin-top:22px}.review-intro h1{font-size:22px}.review-actions{width:100%}.review-actions>*{flex:1}.review-card,.review-safety,.review-approval{padding:15px;border-radius:11px}.clinical-review-grid{grid-template-columns:1fr}.clinical-field>p{min-height:0}.review-safety{flex-wrap:wrap}.review-safety>span{margin-right:32px}.review-section-head{gap:8px;flex-wrap:wrap}.review-approval{align-items:stretch;flex-direction:column}.review-approval .review-btn{width:100%}}
      
      /* Refined clinical review: calmer hierarchy, visible source states and stronger mobile rhythm. */
      .review-page{background:linear-gradient(145deg,#eff5f2 0%,#f5f7f5 58%,#f6f3ed 100%);color:#142f3b;padding-inline:clamp(13px,3.2vw,40px)}
      .review-header{position:sticky;top:0;z-index:20;max-width:1260px;height:76px;background:rgba(246,250,247,.9);backdrop-filter:blur(18px);border-bottom:1px solid rgba(208,224,216,.85)}
      .review-back{border:1px solid #dbe7e1;background:rgba(255,255,255,.72);padding:9px 12px;border-radius:12px;transition:background .18s,border-color .18s,color .18s}
      .review-back:hover{background:#fff;border-color:#a8d4c5;color:#08776d}
      .review-brand{gap:11px}.review-brand .brand-symbol{width:43px;height:43px;border-radius:15px;background:linear-gradient(145deg,#20b49e,#08766f);box-shadow:0 8px 18px rgba(9,104,96,.18)}
      .review-brand strong{font-size:19px;letter-spacing:-.4px;color:#15343f}.review-brand span{font-size:10px;color:#7a9193}
      .review-status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:8px 12px;background:#fff5e6;border-color:#f0dfbd;color:#966a2b;font-weight:700}
      .review-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(166,122,48,.1)}
      .review-status.approved{background:#e7f7ee;border-color:#cfeadd;color:#19755b}
      .review-intro{position:relative;overflow:hidden;max-width:1120px;margin:25px auto 16px;padding:24px 26px;border:1px solid #d7e7df;border-radius:22px;background:linear-gradient(110deg,rgba(255,255,255,.98),rgba(241,250,245,.98));box-shadow:0 10px 28px rgba(21,63,64,.045)}
      .review-intro:after{content:"";position:absolute;left:-45px;bottom:-130px;width:260px;height:260px;border:1px solid rgba(8,127,118,.1);border-radius:50%;box-shadow:0 0 0 25px rgba(8,127,118,.025),0 0 0 52px rgba(8,127,118,.02);pointer-events:none}
      .review-intro>div{position:relative;z-index:1}.review-intro .eyebrow{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#e8f7ef;border:1px solid #d4ece0;color:#08796f;margin-bottom:9px}
      .review-intro h1{font-size:clamp(24px,2.4vw,32px);font-weight:750;letter-spacing:-.55px;color:#173743}.review-intro p{color:#70878b;font-size:11px}
      .review-actions{gap:9px}.review-btn{min-height:42px;padding-inline:15px;border-radius:12px;transition:transform .16s,box-shadow .16s,background .16s,border-color .16s}
      .review-btn:hover:not(:disabled){transform:translateY(-1px)}.review-btn.primary,.review-btn.approve{background:linear-gradient(135deg,#0b8d80,#07645e);box-shadow:0 7px 17px rgba(7,112,102,.12)}
      .review-btn.primary:hover:not(:disabled),.review-btn.approve:hover:not(:disabled){box-shadow:0 10px 22px rgba(7,112,102,.19)}
      .review-btn.secondary{background:rgba(255,255,255,.9);border-color:#d5e4dc;color:#41626a}.review-btn.secondary:hover:not(:disabled){background:#f5fbf7;border-color:#a8d5c6}
      .review-card,.review-safety,.review-approval{border-radius:20px;border-color:#dce8e1;padding:24px;box-shadow:0 9px 26px rgba(22,58,66,.04);margin-top:14px}
      .review-card h2{font-size:16px;letter-spacing:-.15px;color:#1b414b}.review-card p{color:#7a9092;line-height:1.9}
      .review-safety{align-items:center;background:linear-gradient(110deg,#edf8f2,#f5faf6);border-color:#d3eade;padding:17px 20px}
      .review-safety>svg{width:39px;height:39px;padding:10px;border-radius:13px;background:#dcf2e7;color:#0b8374}
      .review-safety strong{font-size:12px;color:#21685f}.review-safety p{color:#6f9186}
      .review-safety>span{border:1px solid #d3e9df;background:rgba(255,255,255,.75);padding:7px 10px;border-radius:999px}
      .uncertainty-card{background:linear-gradient(120deg,#fffaf0,#fffdf8);border-color:#eedfbd}.uncertainty-card ul{padding:12px 23px 0 0}
      .clinical-review-grid{gap:13px}.clinical-field{position:relative;overflow:hidden;padding:16px;border:1px solid #e0ebe4;border-radius:16px;background:linear-gradient(145deg,#fff,#fcfdfa);box-shadow:0 4px 14px rgba(21,61,65,.025);transition:border-color .18s,box-shadow .18s}
      .clinical-field:focus-within{border-color:#a7d7c6;box-shadow:0 0 0 3px rgba(30,157,130,.065)}
      .clinical-field>label{display:block;font-size:12px;color:#254c56;line-height:1.7}.clinical-field>p{font-size:10px;color:#84989a;line-height:1.75;margin:5px 0 11px}
      .clinical-field textarea,.transcript-editor{border:1px solid #dce8e1;border-radius:11px;background:#fbfdfb;color:#274852;padding:12px;font-family:inherit;font-size:12px;line-height:1.95;transition:border-color .18s,background .18s}
      .clinical-field textarea:focus,.transcript-editor:focus{outline:3px solid rgba(64,177,150,.14);border-color:#82c7b3;background:#fff}
      .clinical-field textarea:disabled,.transcript-editor:disabled{border-color:#e5ece6;background:#f4f7f4;color:#61797b}
      .clinical-state{gap:10px;margin-top:11px;padding-top:10px;border-top:1px solid #edf2ed}.clinical-state>span{font-weight:600;color:#7f9494}
      .clinical-state select{border-radius:10px;border-color:#dce7e0;background:#fff;min-height:38px;font-size:10px}
      .source-evidence{padding:9px 10px;border:1px dashed #d5e7dd;border-radius:11px;background:#f6fbf7;line-height:1.8}.source-evidence summary{font-weight:700;color:#147e70}.source-evidence p{margin-bottom:0;color:#587771}
      .review-section-head{align-items:center;gap:15px}.review-ai-tag{border-radius:999px;background:#fff4de;border-color:#efddb9;color:#8b682e;font-weight:700}
      .transcript-editor{min-height:210px;background:linear-gradient(#fbfdfb,#f8fbf8);font-size:13px}
      .transcript-meta{padding:10px 12px;border-radius:11px;background:#f5f9f6;border:1px solid #e7eee8;color:#758c8d;line-height:1.9}
      .review-approval{background:linear-gradient(120deg,#fff,#f7faf7);gap:16px}.review-approval>label{background:#f8fbf8;border:1px solid #e3ede5;border-radius:14px;padding:13px}
      .review-approval input{width:18px;height:18px;accent-color:#087f76}.review-approval label strong,.review-approval>div strong{color:#254c53}.review-approval p{color:#829794}
      .approved-panel{background:linear-gradient(110deg,#eaf8f0,#f6fbf7);border-color:#cde8d8}
      .review-error,.review-success{border-radius:13px;box-shadow:0 5px 16px rgba(22,58,66,.035)}
      .review-loading{padding:45px 20px;border:1px solid #dce8e1;border-radius:18px;background:rgba(255,255,255,.75)}
      .sinan-mark{display:block;width:25px;height:25px;color:currentColor}
      @media(max-width:760px){.review-header{position:relative;height:auto;min-height:64px;gap:9px;padding:11px 0}.review-back{padding:8px 9px;font-size:10px}.review-brand{gap:7px}.review-brand .brand-symbol{width:36px;height:36px;border-radius:12px}.review-brand strong{font-size:16px}.review-status{font-size:9px;padding:7px 9px}.review-intro{padding:19px 16px;border-radius:18px}.review-intro:after{left:-160px}.review-actions{flex-wrap:wrap}.review-actions>*{flex:1}.review-card,.review-safety,.review-approval{padding:16px;border-radius:16px}.review-safety{align-items:flex-start}.clinical-review-grid{gap:10px}.clinical-field{padding:13px}.clinical-state{align-items:flex-start;flex-direction:column}.clinical-state select{width:100%}.transcript-editor{min-height:180px}}

      @media print{.review-page{padding:0;background:white}.review-header,.review-actions,.review-approval,.review-error,.review-success,.review-loading{display:none!important}.review-intro{margin:0 auto 15px}.review-card,.review-safety{box-shadow:none;border:1px solid #ddd;break-inside:avoid;padding:12px;margin-top:9px}.clinical-review-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.clinical-field textarea{border:0;background:white;min-height:0}.clinical-field{break-inside:avoid}.transcript-editor{border:0;background:white}.review-intro h1{font-size:20px}}
    `}</style>
  </main>;
}
