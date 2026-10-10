'use client';
import { useCallback,useEffect,useRef,useState } from 'react';

type Connection={id:string;waba_id:string;phone_number_id:string;display_phone_number:string|null;verified_name:string|null;graph_api_version:string;status:string;last_verified_at:string;token_expires_at:string|null};
type SignupMetadata={wabaId:string;phoneNumberId:string};
type MetaLoginResponse={authResponse?:{code?:string};status?:string};
type MetaSdk={init:(options:{appId:string;cookie:boolean;xfbml:boolean;version:string})=>void;login:(callback:(response:MetaLoginResponse)=>void,options:Record<string,unknown>)=>void};
declare global{interface Window{FB?:MetaSdk;fbAsyncInit?:()=>void;}}

const TRUSTED_META_ORIGINS=new Set(['https://www.facebook.com','https://web.facebook.com']);
export default function WhatsAppConnectionManager({appId,configId,graphVersion}:{appId:string;configId:string;graphVersion:string}){
 const [connections,setConnections]=useState<Connection[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const signup=useRef<SignupMetadata|null>(null);const code=useRef<string|null>(null);const finishing=useRef(false);
 const finishRef=useRef<(c:string,m:SignupMetadata)=>Promise<void>>(async()=>{});
 const refresh=useCallback(async()=>{
  const r=await fetch('/api/integrations/whatsapp/connect',{cache:'no-store'});const b=await r.json();
  if(!r.ok)throw new Error(b.error||'تعذر تحميل اتصالات واتساب.');
  setConnections((b.integrations||[]) as Connection[]);
 },[]);
 const finish=useCallback(async(c:string,m:SignupMetadata)=>{
  if(finishing.current)return;finishing.current=true;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/integrations/whatsapp/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c,wabaId:m.wabaId,phoneNumberId:m.phoneNumberId})});
   const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر ربط حساب واتساب.');
   setNotice('تم التحقق من الحساب وحفظ الاتصال بصورة مشفرة.');signup.current=null;code.current=null;await refresh();
  }catch(e){setError(e instanceof Error?e.message:'تعذر إكمال الربط.');}
  finally{finishing.current=false;setBusy(false);}
 },[refresh]);
 useEffect(()=>{finishRef.current=finish;},[finish]);
 useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل الاتصالات.')).finally(()=>setLoading(false));},[refresh]);
 useEffect(()=>{
  if(!appId||!configId||!graphVersion)return;
  let script=document.querySelector<HTMLScriptElement>('script[data-aqarflow-meta-sdk]');
  const initialize=()=>{if(window.FB)window.FB.init({appId,cookie:true,xfbml:false,version:graphVersion});};
  window.fbAsyncInit=initialize;
  if(!script){script=document.createElement('script');script.src='https://connect.facebook.net/en_US/sdk.js';script.async=true;script.defer=true;script.crossOrigin='anonymous';script.dataset.aqarflowMetaSdk='true';script.onload=initialize;document.head.appendChild(script);}
  else if(window.FB)initialize();
  const onMessage=(event:MessageEvent)=>{
   if(!TRUSTED_META_ORIGINS.has(event.origin))return;
   let data:unknown=event.data;
   if(typeof data==='string'){try{data=JSON.parse(data);}catch{return;}}
   if(!data||typeof data!=='object')return;
   const outer=data as Record<string,unknown>;
   if(outer.type!=='WA_EMBEDDED_SIGNUP')return;
   const inner=(outer.data&&typeof outer.data==='object'?outer.data:outer) as Record<string,unknown>;
   const wabaId=typeof inner.waba_id==='string'?inner.waba_id:'';
   const phoneNumberId=typeof inner.phone_number_id==='string'?inner.phone_number_id:'';
   if(!/^\d{5,40}$/.test(wabaId)||!/^\d{5,40}$/.test(phoneNumberId))return;
   signup.current={wabaId,phoneNumberId};
   if(code.current)void finishRef.current(code.current,signup.current);
  };
  window.addEventListener('message',onMessage);
  return()=>{window.removeEventListener('message',onMessage);if(window.fbAsyncInit===initialize)window.fbAsyncInit=undefined;};
 },[appId,configId,graphVersion]);
 async function beginSignup(){
  setError('');setNotice('');
  if(!appId||!configId||!graphVersion){setError('إعدادات Meta العامة غير مكتملة. اضبط META_APP_ID وMETA_GRAPH_API_VERSION وNEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID على بيئة التطوير أولًا.');return;}
  if(!window.FB){setError('لم يتم تحميل Meta SDK. تحقق من حظر السكربت ثم أعد المحاولة.');return;}
  signup.current=null;code.current=null;finishing.current=false;setBusy(true);
  window.FB.login((response)=>{
   const returnedCode=response.authResponse?.code;
   if(!returnedCode){setBusy(false);setError('لم يُرجع Meta رمز التفويض. أكمل خطوات التسجيل في النافذة ثم أعد المحاولة.');return;}
   code.current=returnedCode;
   if(signup.current)void finishRef.current(returnedCode,signup.current);
   else {setBusy(false);setNotice('تم استلام رمز Meta؛ بانتظار بيانات WABA ورقم الهاتف من نافذة التسجيل. أكمل خطوات Meta إذا كانت النافذة لا تزال مفتوحة.');}
  },{config_id:configId,response_type:'code',override_default_response_type:true,extras:{setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:3}});
 }
 async function disconnect(phoneNumberId:string){
  if(!confirm('سيتم فصل الاتصال ومسح رمز الوصول المشفر من قاعدة البيانات. هل تريد المتابعة؟'))return;
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/integrations/whatsapp/connect',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneNumberId})});const b=await r.json();if(!r.ok)throw new Error(b.error||'تعذر فصل الاتصال.');setNotice('تم فصل الاتصال ومسح رمز الوصول المخزن.');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'تعذر فصل الاتصال.');}finally{setBusy(false);}
 }
 return <div dir="rtl" className="space-y-5">
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
   <p className="text-sm font-bold text-blue-700">WHATSAPP CLOUD API</p><h2 className="mt-2 text-xl font-black">ربط رقم واتساب للأعمال</h2>
   <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">سيُفتح تدفق Meta Embedded Signup. بعد التفويض، يتحقق الخادم من انتماء رقم الهاتف إلى حساب الأعمال، ثم يخزن رمز الوصول مشفرًا. لن تُرسل رسائل تلقائيًا؛ سيبقى الرد تحت مراجعة المالك من صندوق المحادثات.</p>
   {!appId||!configId||!graphVersion?<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">يلزم إعداد App ID وConfig ID وإصدار Graph API قبل تفعيل الربط الحي.</p>:null}
   {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
   <button disabled={busy||!appId||!configId||!graphVersion} onClick={beginSignup} className="mt-5 min-h-12 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'جارٍ إتمام الربط…':'بدء الربط عبر Meta'}</button>
  </section>
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="border-b p-5"><h2 className="font-black">الاتصالات المحفوظة</h2></div>
   {loading?<p className="p-6 text-sm text-slate-500">يجري التحميل…</p>:connections.length===0?<p className="p-6 text-sm text-slate-500">لا توجد أرقام مرتبطة حتى الآن.</p>:<div className="divide-y">{connections.map(c=><article key={c.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">{c.verified_name||'WhatsApp Business'} · {c.display_phone_number||c.phone_number_id}</h3><p className="mt-1 text-xs text-slate-500">الحالة: {c.status==='active'?'نشط':c.status==='needs_reauth'?'يحتاج إعادة تفويض':c.status} · الإصدار {c.graph_api_version}</p><p className="mt-1 text-xs text-slate-500">آخر تحقق: {new Date(c.last_verified_at).toLocaleString('ar')}</p></div><button disabled={busy} onClick={()=>disconnect(c.phone_number_id)} className="self-start rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">فصل الرقم</button></article>)}</div>}
  </section>
 </div>;
}
