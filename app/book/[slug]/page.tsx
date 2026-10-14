'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, CheckCircle2, ChevronLeft, Clock3, LoaderCircle, Phone, ShieldCheck, Stethoscope } from 'lucide-react';
import { LanguageButton, useLanguage } from '../../i18n';

type ClinicInfo = {
  clinic_name_ar:string; clinic_name_en:string; title_ar:string; title_en:string;
  message_ar:string|null; message_en:string|null; timezone:string; slot_minutes:number;
  advance_booking_days:number; min_notice_minutes:number; require_phone:boolean;
  hours:Array<{weekday:number;shift:'morning'|'evening';start_time:string;end_time:string}>;
};
type Slot = {start_at:string;end_at:string;time:string;remaining:number;shift:'morning'|'evening'};

function dateInZone(timeZone:string, value=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const get=(key:string)=>parts.find(part=>part.type===key)?.value||'';
  return get('year')+'-'+get('month')+'-'+get('day');
}
function moveDate(date:string, days:number) {
  const value=new Date(date+'T12:00:00Z');
  value.setUTCDate(value.getUTCDate()+days);
  return value.getUTCFullYear()+'-'+String(value.getUTCMonth()+1).padStart(2,'0')+'-'+String(value.getUTCDate()).padStart(2,'0');
}
function localTime(iso:string, timezone:string, language:string) {
  return new Intl.DateTimeFormat(language==='ar'?'ar-YE':'en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit'}).format(new Date(iso));
}
function localDateLabel(date:string, timezone:string, language:string) {
  return new Intl.DateTimeFormat(language==='ar'?'ar-YE':'en-US',{timeZone:timezone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00Z'));
}
function text(ar:string,en:string,language:string) { return language==='ar'?ar:en; }

export default function PublicClinicBookingPage() {
  const params=useParams<{slug:string}>();
  const slug=String(params?.slug||'');
  const {language}=useLanguage();
  const [clinic,setClinic]=useState<ClinicInfo|null>(null);
  const [date,setDate]=useState('');
  const [slots,setSlots]=useState<Slot[]>([]);
  const [selectedSlot,setSelectedSlot]=useState<Slot|null>(null);
  const [fullName,setFullName]=useState('');
  const [age,setAge]=useState('');
  const [phone,setPhone]=useState('');
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [website,setWebsite]=useState('');
  const [loadingClinic,setLoadingClinic]=useState(true);
  const [loadingSlots,setLoadingSlots]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [confirmation,setConfirmation]=useState<{reference:string;start_at:string}|null>(null);

  useEffect(()=>{
    let cancelled=false;
    setLoadingClinic(true);setError('');
    fetch('/api/public/booking/'+encodeURIComponent(slug),{cache:'no-store'})
      .then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Unable to open booking');return body.clinic as ClinicInfo;})
      .then(async data=>{
        if(cancelled)return;
        setClinic(data);
        const today=dateInZone(data.timezone||'Asia/Aden');
        setDate(today);
        setLoadingClinic(false);
        setLoadingSlots(true);
        const response=await fetch('/api/public/booking/'+encodeURIComponent(slug)+'/availability?date='+today,{cache:'no-store'});
        const body=await response.json().catch(()=>({}));
        if(cancelled)return;
        if(!response.ok)throw new Error(body.error||'Unable to load appointment times');
        setSlots(Array.isArray(body.slots)?body.slots:[]);
      })
      .catch(err=>{if(!cancelled){setError(err instanceof Error?err.message:'Unable to open the booking page');setLoadingClinic(false);}})
      .finally(()=>{if(!cancelled)setLoadingSlots(false);});
    return()=>{cancelled=true;};
  },[slug]);

  async function changeDate(nextDate:string) {
    setDate(nextDate);setSelectedSlot(null);setSlots([]);setError('');
    if(!nextDate||!clinic)return;
    setLoadingSlots(true);
    try{
      const response=await fetch('/api/public/booking/'+encodeURIComponent(slug)+'/availability?date='+nextDate,{cache:'no-store'});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||text('تعذر تحميل المواعيد المتاحة.','Unable to load available times.',language));
      setSlots(Array.isArray(body.slots)?body.slots:[]);
    }catch(err){setError(err instanceof Error?err.message:text('تعذر تحميل الأوقات.','Unable to load times.',language));}
    finally{setLoadingSlots(false);}
  }

  const maxDate=useMemo(()=>clinic&&date?moveDate(dateInZone(clinic.timezone||'Asia/Aden'),clinic.advance_booking_days):undefined,[clinic,date]);
  const groupedSlots=useMemo(()=>({
    morning:slots.filter(slot=>slot.shift==='morning'),
    evening:slots.filter(slot=>slot.shift==='evening'),
  }),[slots]);

  async function submitBooking(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');
    if(!clinic||!selectedSlot){setError(text('اختر موعداً متاحاً أولاً.','Choose an available time first.',language));return;}
    if(fullName.trim().length<2){setError(text('أدخل الاسم الكامل.','Enter the patient’s full name.',language));return;}
    const parsedAge=Number(age);
    if(!Number.isInteger(parsedAge)||parsedAge<1||parsedAge>120){setError(text('أدخل عمراً صحيحاً بين 1 و120 سنة.','Enter an age from 1 to 120.',language));return;}
    if(!termsAccepted){setError(text('وافق على استخدام بياناتك لإدارة طلب الحجز.','Please consent to use of your details for this booking request.',language));return;}
    setSubmitting(true);
    try{
      const response=await fetch('/api/public/booking/'+encodeURIComponent(slug),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({full_name:fullName.trim(),age_years:parsedAge,phone:phone.trim(),start_at:selectedSlot.start_at,idempotency_key:window.crypto.randomUUID(),terms_accepted:termsAccepted,website}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||text('تعذر إرسال طلب الحجز.','Could not submit the booking request.',language));
      setConfirmation({reference:body.booking.reference,start_at:body.booking.start_at});
      setSlots(current=>current.filter(slot=>slot.start_at!==selectedSlot.start_at));
      setSelectedSlot(null);
    }catch(err){setError(err instanceof Error?err.message:text('حدث خطأ أثناء الحجز. حاول مرة أخرى.','Booking failed. Please try again.',language));}
    finally{setSubmitting(false);}
  }

  if(loadingClinic) return <main className="public-booking-shell"><div className="public-booking-loading"><LoaderCircle className="spin" size={26}/><span>{text('جارٍ فتح صفحة الحجز...','Loading booking page…',language)}</span></div></main>;
  if(!clinic) return <main className="public-booking-shell"><section className="public-booking-unavailable"><span className="public-booking-brand"><Stethoscope size={22}/></span><h1>{text('رابط الحجز غير متاح','Booking link unavailable',language)}</h1><p>{error||text('الرابط غير مفعّل حالياً. تواصل مع العيادة للحجز.','This booking link is not currently active. Please contact the clinic.',language)}</p></section></main>;

  if(confirmation) return <main className="public-booking-shell"><header className="public-booking-topbar"><span className="public-booking-brand"><Stethoscope size={21}/></span><strong>{language==='ar'?clinic.clinic_name_ar:clinic.clinic_name_en}</strong><LanguageButton/></header><section className="booking-confirmation">
    <span className="booking-confirmation-icon"><CheckCircle2 size={34}/></span>
    <p className="booking-kicker">{text('تم إرسال طلبك','Request received',language)}</p>
    <h1>{text('طلب الحجز قيد مراجعة العيادة','Your appointment request is awaiting clinic review',language)}</h1>
    <p>{text('احتفظ برقم الطلب. سيظهر الموعد للطبيب، وستتواصل معك العيادة لتأكيده.','Keep this reference. The clinic has received your request and will contact you to confirm the appointment.',language)}</p>
    <div className="booking-confirmation-details"><span>{text('رقم الطلب','Reference',language)}</span><strong dir="ltr">{confirmation.reference}</strong><span>{text('التاريخ والوقت المطلوب','Requested date and time',language)}</span><strong>{localDateLabel(date,clinic.timezone,language)} · {localTime(confirmation.start_at,clinic.timezone,language)}</strong></div>
    <button className="public-booking-primary" onClick={()=>{setConfirmation(null);setFullName('');setAge('');setPhone('');setTermsAccepted(false);setWebsite('')}}>{text('العودة إلى صفحة الحجز','Back to booking',language)}</button>
  </section><footer className="public-booking-footer"><ShieldCheck size={15}/>{text('لن تُطلب منك تفاصيل صحية في هذا النموذج.','This form does not ask for medical details.',language)}</footer></main>;

  return <main className="public-booking-shell">
    <header className="public-booking-topbar"><span className="public-booking-brand"><Stethoscope size={21}/></span><div className="public-booking-clinic-name"><strong>{language==='ar'?clinic.clinic_name_ar:clinic.clinic_name_en}</strong><span>{text('حجز موعد لدى العيادة','Clinic appointment booking',language)}</span></div><LanguageButton/></header>
    <div className="public-booking-layout">
      <section className="public-booking-intro">
        <span className="booking-kicker">{text('مواعيد العيادة','CLINIC APPOINTMENTS',language)}</span>
        <h1>{(language==='ar'?clinic.title_ar:clinic.title_en)||text('احجز موعدك','Book an appointment',language)}</h1>
        <p>{(language==='ar'?clinic.message_ar:clinic.message_en)||text('اختر اليوم والوقت المناسبين من المواعيد المتاحة. بعد الإرسال ستراجع العيادة طلبك وتتواصل معك لتأكيده.','Choose an available date and time. The clinic will review your request and contact you to confirm.',language)}</p>
        <div className="booking-trust-points"><span><ShieldCheck size={17}/>{text('بياناتك للحجز فقط','Booking details only',language)}</span><span><Clock3 size={17}/>{text('أوقات يحددها الطبيب','Times set by the clinic',language)}</span></div>
        <div className="public-booking-help"><Phone size={17}/><div><strong>{text('تحتاج مساعدة؟','Need help?',language)}</strong><span>{text('أرسل الطلب مرة واحدة، وستتواصل العيادة معك للتأكيد.','Submit once; the clinic will contact you to confirm.',language)}</span></div></div>
      </section>
      <form className="public-booking-card" onSubmit={submitBooking}>
        <div className="booking-card-heading"><div><span className="booking-step-number">01</span><h2>{text('بيانات المريض','Patient details',language)}</h2></div><span className="booking-required-note">* {text('مطلوب','Required',language)}</span></div>
        <div className="public-booking-fields">
          <label>{text('الاسم الكامل','Full name',language)}<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={120} required placeholder={text('اكتب اسم المريض','Enter patient name',language)}/></label>
          <div className="public-booking-field-row"><label>{text('العمر بالسنوات','Age in years',language)}<input inputMode="numeric" type="number" min="1" max="120" step="1" value={age} onChange={e=>setAge(e.target.value)} required placeholder={text('العمر','Age',language)}/></label><label>{text('رقم الهاتف','Phone number',language)}<input type="tel" autoComplete="tel" inputMode="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} required placeholder={text('رقم للتواصل والتأكيد','Contact number',language)}/></label></div>
        </div>
        <div className="booking-card-heading booking-time-heading"><div><span className="booking-step-number">02</span><h2>{text('اختر الموعد','Choose a time',language)}</h2></div><span className="booking-slot-length">{clinic.slot_minutes} {text('دقيقة','min',language)}</span></div>
        <label className="booking-date-field"><span><CalendarDays size={16}/>{text('التاريخ','Date',language)}</span><input type="date" value={date} min={clinic?dateInZone(clinic.timezone):undefined} max={maxDate} onChange={e=>void changeDate(e.target.value)} required/></label>
        <div className="booking-selected-date">{date?localDateLabel(date,clinic.timezone,language):''}</div>
        {loadingSlots?<div className="booking-slots-loading"><LoaderCircle className="spin" size={19}/>{text('جارٍ تحميل الأوقات المتاحة...','Loading available times…',language)}</div>:slots.length===0?<div className="booking-no-slots"><CalendarDays size={22}/><strong>{text('لا توجد أوقات متاحة في هذا اليوم','No available times on this date',language)}</strong><span>{text('اختر يوماً آخر. الأوقات المعروضة تتحدث بحسب الحجوزات الفعلية.','Choose another day. Availability reflects current bookings.',language)}</span></div>:<>
          {groupedSlots.morning.length>0&&<div className="booking-shift"><h3>{text('الفترة الصباحية','Morning',language)}</h3><div className="booking-slot-grid">{groupedSlots.morning.map(slot=><button type="button" key={slot.start_at} className={'booking-slot '+(selectedSlot?.start_at===slot.start_at?'selected':'')} onClick={()=>setSelectedSlot(slot)}>{localTime(slot.start_at,clinic.timezone,language)}</button>)}</div></div>}
          {groupedSlots.evening.length>0&&<div className="booking-shift"><h3>{text('الفترة المسائية','Evening',language)}</h3><div className="booking-slot-grid">{groupedSlots.evening.map(slot=><button type="button" key={slot.start_at} className={'booking-slot '+(selectedSlot?.start_at===slot.start_at?'selected':'')} onClick={()=>setSelectedSlot(slot)}>{localTime(slot.start_at,clinic.timezone,language)}</button>)}</div></div>}
        </>}
        {selectedSlot&&<div className="booking-selected-summary"><CheckCircle2 size={17}/><span>{text('الموعد المختار','Selected appointment',language)}</span><strong>{localDateLabel(date,clinic.timezone,language)} · {localTime(selectedSlot.start_at,clinic.timezone,language)}</strong></div>}
        <label className="booking-consent"><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/><span>{text('أوافق على استخدام اسمي وعمري ورقم هاتفي لإدارة طلب الحجز والتواصل لتأكيده.','I agree to the use of my name, age, and phone number to manage this booking and contact me for confirmation.',language)}</span></label>
        <input className="booking-honeypot" aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)} name="website"/>
        {error&&<div className="booking-form-error" role="alert">{error}</div>}
        <button className="public-booking-primary" type="submit" disabled={submitting||loadingSlots||!selectedSlot||!termsAccepted}>{submitting?<><LoaderCircle className="spin" size={18}/>{text('جارٍ إرسال طلبك...','Submitting request…',language)}</>:text('إرسال طلب الحجز','Submit booking request',language)}<ChevronLeft size={17}/></button>
        <p className="booking-confirm-note">{text('سيُحجز الوقت بطلبك حتى تراجعه العيادة، وسيتم إبلاغك عند التأكيد أو الرفض.','Your requested time is held while the clinic reviews it. The clinic will tell you whether it is confirmed.',language)}</p>
      </form>
    </div>
    <footer className="public-booking-footer"><ShieldCheck size={15}/>{text('لا تدخل أي شكوى أو معلومات صحية هنا.','Do not enter symptoms or medical information here.',language)} <span>·</span> سِنان</footer>
  </main>;
}
