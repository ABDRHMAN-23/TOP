'use client';
import { useState } from 'react';

type SalesResult = {
  replyDraft: string;
  factsUsed: string[];
  unknowns: string[];
  nextBestAction: string;
  askOneQuestion: string | null;
  handoffRequired: boolean;
  matchedPropertyIds: string[];
  usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; latencyMs: number; model: string };
};

export default function AqarFlowSalesAssistant() {
  const [message,setMessage]=useState('');
  const [summary,setSummary]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<SalesResult|null>(null);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setLoading(true);setError('');setResult(null);
    try {
      const response=await fetch('/api/aqarflow/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerMessage:message,conversationSummary:summary,buyerProfile:{preferredLanguage:'ar',preferredTone:'warm'}})});
      const body=await response.json();
      if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'تعذر إنشاء مسودة الرد.');
      setResult(body as SalesResult);
    } catch(e) {setError(e instanceof Error?e.message:'حدث خطأ غير متوقع.');}
    finally {setLoading(false);}
  }
  return <section dir="rtl" className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <div className="mb-6"><p className="text-sm font-bold text-blue-700">AQARFLOW AI</p><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">مساعد المبيعات العقارية</h1><p className="mt-2 text-sm leading-6 text-slate-600">مسودة عربية مبنية على مخزون مساحة عملك. لا يختلق النظام سعرًا أو ميزة غير موجودة في السجلات.</p></div>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-bold text-slate-800">رسالة العميل
        <textarea required maxLength={1600} rows={4} value={message} onChange={e=>setMessage(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="مثال: أبحث عن شقة للبيع في عدن بثلاث غرف نوم..." />
        <span className="mt-1 block text-xs text-slate-500">{message.length}/1600</span>
      </label>
      <label className="block text-sm font-bold text-slate-800">ملخص اختياري للمحادثة
        <textarea maxLength={1000} rows={2} value={summary} onChange={e=>setSummary(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-blue-600" placeholder="الميزانية أو المنطقة أو المتطلبات التي أكدها العميل..." />
      </label>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={loading||!message.trim()} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading?'يجري تحليل العقارات والتحقق من الرد…':'إنشاء مسودة رد آمنة'}</button>
    </form>
    {result&&<div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
      <div className="rounded-2xl bg-slate-50 p-4"><h2 className="font-bold text-slate-900">مسودة الرد</h2><p className="mt-2 whitespace-pre-wrap leading-8 text-slate-800">{result.replyDraft}</p>{result.askOneQuestion&&<p className="mt-3 rounded-lg border-r-4 border-blue-600 bg-white p-3 text-sm">السؤال المقترح: {result.askOneQuestion}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3"><p className="text-xs font-bold text-slate-500">العقارات المطابقة</p><p className="mt-1 text-xl font-black">{result.matchedPropertyIds.length}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs font-bold text-slate-500">استهلاك التوكنز / زمن الرد</p><p className="mt-1 font-black">{result.usage?.totalTokens??'—'} / {result.usage?.latencyMs??'—'} ms</p><p className="mt-1 break-all text-xs text-slate-500">{result.usage?.model}</p></div>
      </div>
      {result.factsUsed.length>0&&<div><h3 className="font-bold">حقائق استخدمت في الرد</h3><ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-700">{result.factsUsed.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
      {result.unknowns.length>0&&<div><h3 className="font-bold">نقاط لم تُؤكد</h3><ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-amber-800">{result.unknowns.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
      {result.handoffRequired&&<p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">يوصي النظام بتحويل المحادثة إلى موظف.</p>}
      <button onClick={()=>navigator.clipboard.writeText(result.replyDraft)} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold text-slate-700">نسخ مسودة الرد</button>
    </div>}
  </section>;
}
