'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, LoaderCircle, Printer, ShieldCheck, AlertCircle } from 'lucide-react';
import SinanMark from '@/components/SinanMark';

const labels: Record<string,string> = {
  chiefComplaint:'الشكوى الرئيسية', historyOfPresentIllness:'تاريخ الحالة الحالية', medicalHistory:'التاريخ الصحي', allergies:'الحساسية', medications:'الأدوية',
  examinationFindings:'نتائج الفحص', assessment:'التقييم السريري', proposedPlan:'الخطة المقترحة', proceduresDiscussed:'إجراءات نوقشت', proceduresCompleted:'إجراءات مكتملة', prescriptionsSuggested:'أدوية أو وصفات مقترحة', followUp:'المتابعة', uncertaintyFlags:'ملاحظات عدم اليقين',
};
function unwrap(value: unknown): unknown { return value && typeof value === 'object' && !Array.isArray(value) && 'value' in value ? (value as {value:unknown}).value : value; }
function text(value: unknown): string {
  const inner = unwrap(value);
  if (inner === null || inner === undefined || inner === '') return 'لم تُسجل المعلومة';
  if (Array.isArray(inner)) return inner.length ? inner.map((v)=>typeof v==='string'?v:JSON.stringify(v)).join('، ') : 'لا توجد عناصر مسجلة في هذه المسودة';
  if (typeof inner === 'object') return JSON.stringify(inner, null, 2);
  return String(inner);
}
function stateText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('state' in value)) return 'حالة المعلومة غير محددة';
  const v = (value as {state:unknown}).state;
  const map:Record<string,string>={patient_reported:'ذكره المريض',observed:'ملاحظة فحص',ai_suggested:'اقتراح آلي يحتاج مراجعة',clinician_confirmed:'أكدها الطبيب',explicitly_negative:'نفي صريح',unknown:'غير معلوم',not_collected:'لم تُجمع المعلومة',not_applicable:'لا ينطبق',needs_review:'مطلوب مراجعة'};
  return typeof v==='string'?(map[v]||'حالة المعلومة غير محددة'):'حالة المعلومة غير محددة';
}
export default function PrintableReportPage() {
  const params = useParams<{reportId:string}>();
  const [payload,setPayload]=useState<any>(null); const [error,setError]=useState('');
  const load=useCallback(async()=>{setError('');const response=await fetch(`/api/reports/${params.reportId}`,{cache:'no-store'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'تعذر تحميل التقرير.');setPayload(body)},[params.reportId]);
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل التقرير.'))},[load]);
  const fields=useMemo(()=>{const clinical=payload?.report?.content_snapshot?.clinicalNote;return clinical&&typeof clinical==='object'?Object.entries(clinical).filter(([key])=>key!=='uncertaintyFlags'):[]},[payload]);
  if(error)return <main className="print-page"><div className="print-error"><AlertCircle/>{error}<a href="/">العودة للعيادة</a></div></main>;
  if(!payload)return <main className="print-page"><div className="print-loading"><LoaderCircle/> جارٍ تحميل التقرير...</div></main>;
  const report=payload.report; const patient=payload.patient; const clinic=report.clinic_identity_snapshot||{};
  return <main className="print-page" dir="rtl">
    <div className="print-toolbar"><a href={`/encounters/${report.encounter_id}`}><ArrowRight size={16}/> العودة إلى السجل</a><div><span><ShieldCheck size={15}/> لقطة من النسخة المعتمدة {report.source_record_version}</span><button onClick={()=>window.print()}><Printer size={16}/> طباعة / حفظ PDF</button></div></div>
    <article className="clinical-report">
      <header className="report-clinic-header"><div className="report-clinic-symbol"><SinanMark className="sinan-mark" /></div><div className="report-clinic-names"><h1>{clinic.clinic_name_ar||'العيادة'}</h1>{clinic.clinic_name_en&&<p dir="ltr">{clinic.clinic_name_en}</p>}<div className="report-contact">{[clinic.address_ar,clinic.phone,clinic.email].filter(Boolean).join(' · ')||'بيانات التواصل غير مضبوطة في إعدادات العيادة'}</div></div><div className="report-document-type"><span>سِنان</span><strong>تقرير سريري</strong><small>{report.report_type==='endodontic_report'?'علاج العصب':report.report_type==='dental_examination'?'فحص الأسنان':report.report_type==='patient_history'?'التاريخ الصحي':'ملخص الزيارة'}</small></div></header>
      <div className="report-rule"/>
      <section className="report-patient-data"><div><span>اسم المريض</span><strong>{patient?.full_name||'اسم غير متاح'}</strong></div><div><span>رقم الملف</span><strong>{patient?.patient_number||String(report.patient_id).slice(0,8)}</strong></div><div><span>تاريخ التقرير</span><strong>{new Date(report.created_at).toLocaleDateString('ar')}</strong></div><div><span>رقم التقرير</span><strong>{String(report.id).slice(0,8)}</strong></div></section>
      <div className="report-approved"><ShieldCheck size={17}/><div><strong>مبني على نسخة سريرية معتمدة</strong><span>رقم النسخة: {report.source_record_version} · تاريخ الإنشاء: {new Date(report.created_at).toLocaleString('ar')}</span></div></div>
      <section className="report-content"><h2>معلومات الزيارة</h2>{fields.length===0?<p className="report-missing">لا توجد حقول سريرية محفوظة في هذه اللقطة.</p>:fields.map(([key,value])=><div className="report-field" key={key}><div><h3>{labels[key]||key}</h3><span className="report-state">{stateText(value)}</span></div><p>{text(value)}</p>{value&&typeof value==='object'&&!Array.isArray(value)&&'source'in value&&(value as any).source&&<blockquote>المصدر: {String((value as any).source)}</blockquote>}</div>)}
      {Array.isArray((report.content_snapshot?.clinicalNote as any)?.uncertaintyFlags)&&(report.content_snapshot.clinicalNote as any).uncertaintyFlags.length>0&&<div className="report-field"><div><h3>ملاحظات تتطلب الانتباه</h3><span className="report-state">راجعها الطبيب</span></div><ul>{(report.content_snapshot.clinicalNote as any).uncertaintyFlags.map((flag:string,i:number)=><li key={i}>{flag}</li>)}</ul></div>}</section>
      <footer className="report-footer"><div><strong>{clinic.clinic_name_ar||'العيادة'}</strong><span>تم إنشاء التقرير من نسخة محددة للسجل المعتمد. أي تصحيح لاحق يجب أن يكون في نسخة جديدة قابلة للتتبع.</span></div><div><span>سجل التقرير</span><strong>{String(report.id).slice(0,12)}</strong></div></footer>
    </article>
    <style jsx>{`
      .print-page{min-height:100vh;background:#eef3f1;padding:20px;color:#193739;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif}.print-toolbar{max-width:940px;margin:0 auto 15px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px}.print-toolbar a,.print-toolbar>div,.print-toolbar>div>span{display:flex;align-items:center;gap:8px;text-decoration:none;color:#52716e}.print-toolbar>div>span{font-size:10px}.print-toolbar button{display:flex;align-items:center;gap:7px;border:0;background:#087f8c;color:white;border-radius:8px;padding:10px 13px;font-size:11px;font-weight:700;cursor:pointer}.clinical-report{max-width:940px;min-height:1000px;margin:0 auto;background:#fff;border:1px solid #dfe7e4;box-shadow:0 6px 30px #2347440a;padding:42px 48px;display:flex;flex-direction:column}.report-clinic-header{display:flex;align-items:center;gap:14px}.report-clinic-symbol{width:45px;height:45px;display:grid;place-items:center;background:#e5f5f0;color:#087f8c;border-radius:12px;flex-shrink:0}.report-clinic-names{flex:1;min-width:0}.report-clinic-names h1{font-size:21px;margin:0;color:#193a3b}.report-clinic-names p{font-size:12px;color:#6d8885;margin:3px 0}.report-contact{font-size:10px;color:#819491;margin-top:5px;line-height:1.7}.report-document-type{display:flex;flex-direction:column;gap:4px;text-align:left;align-items:flex-start}.report-document-type span{color:#087f8c;font-size:11px;font-weight:700}.report-document-type strong{font-size:13px}.report-document-type small{font-size:10px;color:#839693}.report-rule{height:2px;background:#0c858a;margin:22px 0}.report-patient-data{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;background:#f6faf8;border:1px solid #e6efeb;border-radius:9px;padding:14px 15px}.report-patient-data>div{display:flex;flex-direction:column;gap:6px;min-width:0}.report-patient-data span{font-size:10px;color:#819491}.report-patient-data strong{font-size:11px;overflow-wrap:anywhere}.report-approved{display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid #edf2ef;padding:15px 0;color:#19846d}.report-approved>div{display:flex;flex-direction:column;gap:4px}.report-approved strong{font-size:11px}.report-approved span{color:#829490;font-size:10px}.report-content{flex:1;margin-top:22px}.report-content>h2{font-size:15px;margin:0 0 13px;padding-bottom:10px;border-bottom:1px solid #e6eeeb}.report-field{padding:13px 0;border-bottom:1px solid #edf2ef;break-inside:avoid}.report-field>div{display:flex;justify-content:space-between;align-items:center;gap:12px}.report-field h3{margin:0;font-size:12px;color:#315353}.report-field p,.report-field ul{font-size:11px;line-height:1.9;color:#526d6b;margin:7px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.report-field ul{padding-right:19px}.report-state{font-size:9px;color:#788f8a;background:#f5f8f6;border-radius:20px;padding:5px 8px;white-space:nowrap}.report-field blockquote{margin:8px 0 0;border-right:2px solid #8fcab6;padding:4px 10px;color:#688580;font-size:10px;line-height:1.8;background:#f8fbfa}.report-missing{font-size:11px;color:#849793}.report-footer{display:flex;justify-content:space-between;gap:15px;border-top:1px solid #dde8e4;margin-top:25px;padding-top:14px}.report-footer>div{display:flex;flex-direction:column;gap:5px}.report-footer strong{font-size:10px}.report-footer span{font-size:9px;color:#869994;line-height:1.7;max-width:470px}.report-loading,.print-error{max-width:940px;margin:80px auto;display:flex;align-items:center;gap:12px;color:#6e8883}.print-error{flex-wrap:wrap}.print-error a{color:#087f8c}@media(max-width:680px){.print-page{padding:9px}.print-toolbar{align-items:flex-start}.print-toolbar>div{align-items:flex-end;flex-direction:column}.clinical-report{padding:20px 15px;min-height:900px}.report-clinic-header{align-items:flex-start;flex-wrap:wrap}.report-document-type{margin-right:auto}.report-patient-data{grid-template-columns:repeat(2,minmax(0,1fr))}.report-footer{flex-direction:column}}
      .print-page{background:radial-gradient(ellipse at 15% 0%,rgba(173,218,199,.22),transparent 35%),#edf3f0;padding:24px 18px 48px;color:#173541}
      .print-toolbar{max-width:1000px;min-height:48px;padding:0 4px;margin-bottom:16px}
      .print-toolbar a{padding:9px 12px;border:1px solid #d7e5dd;border-radius:12px;background:rgba(255,255,255,.78);transition:background .16s,border-color .16s}
      .print-toolbar a:hover{background:#fff;border-color:#a9d3c4;color:#08786d}.print-toolbar>div{gap:11px}
      .print-toolbar>div>span{padding:9px 12px;border:1px solid #d8e9df;border-radius:999px;background:rgba(248,253,249,.85);color:#54776d}
      .print-toolbar button{border-radius:12px;padding:11px 15px;background:linear-gradient(135deg,#0a8c7e,#08645e);box-shadow:0 7px 17px rgba(8,112,101,.14);transition:transform .16s,box-shadow .16s}
      .print-toolbar button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(8,112,101,.2)}
      .clinical-report{position:relative;overflow:hidden;max-width:1000px;min-height:1120px;border:1px solid #dce7e0;border-radius:4px 4px 22px 22px;box-shadow:0 22px 60px rgba(23,57,64,.10);padding:clamp(24px,4.7vw,55px)}
      .clinical-report:before{content:"";position:absolute;top:0;right:0;left:0;height:7px;background:linear-gradient(90deg,#d5ad6a,#0a8076 40%,#23b9a2 70%,#d6ae6e)}
      .report-clinic-header{padding:5px 0 20px;gap:16px}.report-clinic-symbol{width:52px;height:52px;border-radius:17px;background:linear-gradient(145deg,#e3f7ed,#d6f0e5);color:#08796f;border:1px solid #cde8dc}
      .report-clinic-symbol .sinan-mark{width:29px;height:29px}.report-clinic-names h1{font-size:23px;letter-spacing:-.35px;color:#163943}
      .report-document-type{padding:10px 13px;border:1px solid #dcebe2;border-radius:14px;background:#f7fbf7}.report-document-type span{font-size:12px;color:#087f76}.report-document-type strong{font-size:14px;color:#20444c}
      .report-rule{height:3px;border-radius:999px;margin:16px 0 21px;background:linear-gradient(90deg,#0b8077,#50bea2 70%,#e4c487)}
      .report-patient-data{gap:10px;border-radius:15px;border-color:#e1ebe4;background:linear-gradient(120deg,#f7fbf8,#f0f7f2);padding:17px}
      .report-patient-data>div{padding:2px 8px;position:relative}.report-patient-data>div+div{border-right:1px solid #e0eae3}
      .report-patient-data span{font-size:10px;color:#748b8b}.report-patient-data strong{font-size:12px;color:#254952}
      .report-approved{gap:12px;margin-top:14px;padding:14px 15px;border:1px solid #d7ebdf;border-radius:13px;background:#f1faf4;color:#0f866e}
      .report-approved>svg{width:34px;height:34px;padding:8px;background:#dcf4e6;border-radius:11px}.report-approved strong{font-size:11px;color:#24695c}.report-approved span{line-height:1.8;color:#78948b}
      .report-content{margin-top:25px}.report-content>h2{padding-bottom:13px;border-bottom:1px solid #dfeae3;font-size:16px;color:#204651}
      .report-field{padding:15px 14px;margin:9px 0;border:1px solid #e7eee8;border-radius:13px;background:linear-gradient(120deg,#fff,#fbfdfb)}
      .report-field h3{font-size:12px;color:#2d5259}.report-field p,.report-field ul{font-size:11px;line-height:2;color:#4f6d70}
      .report-state{border:1px solid #e4ece5;border-radius:999px;background:#f5f8f4;color:#65827e;padding:6px 10px;font-weight:600}
      .report-missing{padding:16px;border:1px dashed #dce8df;border-radius:12px;background:#f8fbf8}
      .report-footer{padding-top:17px;border-top:1px solid #dce8e0;margin-top:26px}.report-footer strong{color:#2a5056}.report-footer span{color:#7d9190;line-height:1.85}
      .print-loading,.print-error{padding:22px;border:1px solid #dce8e1;border-radius:16px;background:rgba(255,255,255,.8)}
      @media(max-width:680px){.print-page{padding:10px 8px 28px}.print-toolbar{align-items:stretch;flex-direction:column;margin-bottom:10px}.print-toolbar>div{align-items:stretch;flex-direction:column}.print-toolbar>div>span{white-space:normal;line-height:1.7}.clinical-report{min-height:0;padding:23px 14px;border-radius:5px 5px 17px 17px}.report-clinic-header{gap:10px}.report-clinic-symbol{width:43px;height:43px;border-radius:13px}.report-clinic-names h1{font-size:19px}.report-contact{overflow-wrap:anywhere}.report-document-type{width:100%;margin:3px 0 0;flex-direction:row;align-items:center;justify-content:space-between;text-align:right}.report-patient-data{gap:8px;padding:11px}.report-patient-data>div{padding:5px}.report-patient-data>div+div{border-right:0}.report-field{padding:12px 10px}.report-field>div{align-items:flex-start;flex-direction:column;gap:7px}.report-state{white-space:normal}}

      
      /* SINAN printable report refinement */
      .print-page{background:radial-gradient(ellipse at 15% 0%,rgba(173,218,199,.22),transparent 35%),#edf3f0;padding:24px 18px 48px;color:#173541}
      .print-toolbar{max-width:1000px;min-height:48px;padding:0 4px;margin-bottom:16px}
      .print-toolbar a{padding:9px 12px;border:1px solid #d7e5dd;border-radius:12px;background:rgba(255,255,255,.78);transition:background .16s,border-color .16s}
      .print-toolbar a:hover{background:#fff;border-color:#a9d3c4;color:#08786d}
      .print-toolbar>div{gap:11px}
      .print-toolbar>div>span{padding:9px 12px;border:1px solid #d8e9df;border-radius:999px;background:rgba(248,253,249,.85);color:#54776d}
      .print-toolbar button{border-radius:12px;padding:11px 15px;background:linear-gradient(135deg,#0a8c7e,#08645e);box-shadow:0 7px 17px rgba(8,112,101,.14);transition:transform .16s,box-shadow .16s}
      .print-toolbar button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(8,112,101,.2)}
      .clinical-report{position:relative;overflow:hidden;max-width:1000px;min-height:1120px;border:1px solid #dce7e0;border-radius:4px 4px 22px 22px;box-shadow:0 22px 60px rgba(23,57,64,.10);padding:clamp(24px,4.7vw,55px)}
      .clinical-report:before{content:"";position:absolute;top:0;right:0;left:0;height:7px;background:linear-gradient(90deg,#d5ad6a,#0a8076 40%,#23b9a2 70%,#d6ae6e)}
      .report-clinic-header{padding:5px 0 20px;gap:16px}
      .report-clinic-symbol{width:52px;height:52px;border-radius:17px;background:linear-gradient(145deg,#e3f7ed,#d6f0e5);color:#08796f;border:1px solid #cde8dc}
      .report-clinic-symbol .sinan-mark{width:29px;height:29px}
      .report-clinic-names h1{font-size:23px;letter-spacing:-.35px;color:#163943}
      .report-document-type{padding:10px 13px;border:1px solid #dcebe2;border-radius:14px;background:#f7fbf7}
      .report-document-type span{font-size:12px;color:#087f76}
      .report-document-type strong{font-size:14px;color:#20444c}
      .report-rule{height:3px;border-radius:999px;margin:16px 0 21px;background:linear-gradient(90deg,#0b8077,#50bea2 70%,#e4c487)}
      .report-patient-data{gap:10px;border-radius:15px;border-color:#e1ebe4;background:linear-gradient(120deg,#f7fbf8,#f0f7f2);padding:17px}
      .report-patient-data>div{padding:2px 8px;position:relative}
      .report-patient-data>div+div{border-right:1px solid #e0eae3}
      .report-patient-data span{font-size:10px;color:#748b8b}
      .report-patient-data strong{font-size:12px;color:#254952}
      .report-approved{gap:12px;margin-top:14px;padding:14px 15px;border:1px solid #d7ebdf;border-radius:13px;background:#f1faf4;color:#0f866e}
      .report-approved>svg{width:34px;height:34px;padding:8px;background:#dcf4e6;border-radius:11px}
      .report-approved strong{font-size:11px;color:#24695c}
      .report-approved span{line-height:1.8;color:#78948b}
      .report-content{margin-top:25px}
      .report-content>h2{padding-bottom:13px;border-bottom:1px solid #dfeae3;font-size:16px;color:#204651}
      .report-field{padding:15px 14px;margin:9px 0;border:1px solid #e7eee8;border-radius:13px;background:linear-gradient(120deg,#fff,#fbfdfb)}
      .report-field h3{font-size:12px;color:#2d5259}
      .report-field p,.report-field ul{font-size:11px;line-height:2;color:#4f6d70}
      .report-state{border:1px solid #e4ece5;border-radius:999px;background:#f5f8f4;color:#65827e;padding:6px 10px;font-weight:600}
      .report-missing{padding:16px;border:1px dashed #dce8df;border-radius:12px;background:#f8fbf8}
      .report-footer{padding-top:17px;border-top:1px solid #dce8e0;margin-top:26px}
      .report-footer strong{color:#2a5056}
      .report-footer span{color:#7d9190;line-height:1.85}
      .print-loading,.print-error{padding:22px;border:1px solid #dce8e1;border-radius:16px;background:rgba(255,255,255,.8)}
      @media(max-width:680px){
        .print-page{padding:10px 8px 28px}
        .print-toolbar{align-items:stretch;flex-direction:column;margin-bottom:10px}
        .print-toolbar>div{align-items:stretch;flex-direction:column}
        .print-toolbar>div>span{white-space:normal;line-height:1.7}
        .clinical-report{min-height:0;padding:23px 14px;border-radius:5px 5px 17px 17px}
        .report-clinic-header{gap:10px}
        .report-clinic-symbol{width:43px;height:43px;border-radius:13px}
        .report-clinic-names h1{font-size:19px}
        .report-contact{overflow-wrap:anywhere}
        .report-document-type{width:100%;margin:3px 0 0;flex-direction:row;align-items:center;justify-content:space-between;text-align:right}
        .report-patient-data{gap:8px;padding:11px}
        .report-patient-data>div{padding:5px}
        .report-patient-data>div+div{border-right:0}
        .report-field{padding:12px 10px}
        .report-field>div{align-items:flex-start;flex-direction:column;gap:7px}
        .report-state{white-space:normal}
      }
      
      @media print{.print-page{padding:0;background:#fff}.print-toolbar{display:none}.clinical-report{max-width:none;min-height:0;border:0;box-shadow:none;padding:0;margin:0}.report-patient-data,.report-field,.report-approved{break-inside:avoid}.report-footer{margin-top:20px}}
    `}</style>
  </main>;
}
