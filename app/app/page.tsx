'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, CircleAlert, FileText, Loader2, Lock, Mic, Plus, RotateCcw, Save, Square, Trash2, Camera, Calculator } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Item = { description: string; quantity: number; unit: string; price: number };
type Analysis = {
  transcript: string;
  client?: { name?: string; email?: string; phone?: string; address?: string };
  items?: Item[];
  notes?: string[];
  currency?: string;
};

type PlanInfo = {
  plan: string;
  label: string;
  used: number;
  quota: number | null;
  templates: string[];
  currencies: string[];
  languages: string[];
  features: { customLogo: boolean; removeBrand: boolean; tracking: boolean; fullStats: boolean; csv: boolean; customization: boolean; teamUsers: number };
};

export default function AppPage() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [manualNotes, setManualNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [savedQuoteUrl, setSavedQuoteUrl] = useState('');
  const [intelligence, setIntelligence] = useState<{summary:string;warnings:string[];suggestions:string[];questions:string[];confidence:string}|null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [template, setTemplate] = useState('modern');
  const [currency, setCurrency] = useState('GBP');
  const [language, setLanguage] = useState('en');
  const [siteNotes, setSiteNotes] = useState('');
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [labourHours, setLabourHours] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    fetch('/api/billing')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setPlanInfo(data);
        if (!data.templates.includes(template)) setTemplate(data.templates[0] || 'modern');
        if (!data.currencies.includes(currency)) setCurrency(data.currencies[0] || 'GBP');
        if (!data.languages.includes(language)) setLanguage(data.languages[0] || 'en');
      })
      .catch(() => {});
  }, []);

  const start = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const recorder = new MediaRecorder(stream);
      media.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      recorder.onstop = () => {
        setAudio(new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' }));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      setError('Microphone permission was not granted.');
    }
  };

  const stop = () => {
    media.current?.stop();
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const reset = () => {
    if (recording) stop();
    setSeconds(0);
    setAudio(null);
    setManualNotes('');
    setAnalysis(null);
    setItems([]);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setTemplate('modern');
    setCurrency('GBP');
    setLanguage('en');
    setSiteNotes(''); setPhotoFiles([]); setLabourHours(''); setLabourRate('');
    setError('');
    setSaved('');
    setSavedQuoteUrl('');
  };

  const analyze = async () => {
    if (!audio && !manualNotes.trim()) return;
    setLoading(true);
    setError('');
    setSaved('');
    try {
      const form = new FormData();
      if (audio) form.append('audio', audio, 'voice.webm');
      if (manualNotes.trim()) form.append('notes', manualNotes.trim());
      const response = await fetch('/api/analyze', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed.');
      setAnalysis(data);
      setClientName(data.client?.name || '');
      setClientEmail(data.client?.email || '');
      setClientPhone(data.client?.phone || '');
      setClientAddress(data.client?.address || '');
      setItems(Array.isArray(data.items) && data.items.length ? data.items : [{ description: '', quantity: 1, unit: 'item', price: 0 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, key: keyof Item, value: string | number) => {
    setItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const addItem = () => setItems((current) => [...current, { description: '', quantity: 1, unit: 'item', price: 0 }]);
  const removeItem = (index: number) => setItems((current) => current.filter((_, i) => i !== index));
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);

  const reviewQuote = async () => {
    if (!items.length) return;
    setReviewing(true); setIntelligence(null); setError('');
    try {
      const res = await fetch('/api/quote-intelligence', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client_name:clientName, items, subtotal, total:subtotal, currency, language }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote review failed.');
      setIntelligence(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Quote review failed.'); }
    finally { setReviewing(false); }
  };

  const saveQuote = async () => {
    setSaving(true);
    setError('');
    setSaved('');
    setSavedQuoteUrl('');
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          client_address: clientAddress,
          items,
          notes: analysis?.notes?.length ? analysis.notes : manualNotes ? [manualNotes] : [],
          currency,
          template,
          language
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please sign in before saving.');
      setSaved(data.quote_number || 'Quote saved');
      if (data.public_token) setSavedQuoteUrl(window.location.origin + '/q/' + data.public_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save quote.');
    } finally {
      setSaving(false);
    }
  };

  const signIn = async () => {
    const email = window.prompt('Enter your email for a magic sign-in link');
    if (!email) return;
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback?next=/app' }
    });
    if (authError) setError(authError.message);
    else setSaved('Check your email for the magic sign-in link.');
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <a href="/" aria-label="QUVOTO home" className="inline-flex items-center gap-2.5"><img src="/logo.svg" alt="QUVOTO" className="h-9 w-9"/><span className="text-lg font-black tracking-[-0.04em] text-[#0A1E3D] sm:text-xl">QUVOTO</span></a>
          <div className="flex items-center gap-2">
            {planInfo && <a href="/pricing" className="hidden rounded-full bg-[#2F8CFF]/10 px-3 py-2 text-xs font-bold text-[#1769E0] sm:inline-flex">{planInfo.label} · {planInfo.quota === null ? 'Unlimited' : planInfo.used + '/' + planInfo.quota}</a>}
            <a href="/advisor" className="hidden min-h-11 items-center rounded-xl bg-[#1769E0]/10 px-3.5 text-sm font-bold text-[#1769E0] sm:inline-flex">Advisor</a><button onClick={signIn} className="min-h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold hover:bg-slate-50">Sign in</button>
            <button onClick={reset} aria-label="Start a new quote" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#0A1E3D] px-3.5 text-sm font-semibold text-white"><RotateCcw size={15}/><span className="hidden sm:inline">New</span></button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#2F8CFF]/10 px-3 py-1 text-xs font-bold text-[#1769E0]"><Mic size={14}/>VOICE-FIRST QUOTING</div>
          <h1 className="text-[2rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">Turn a field note into a professional quote.</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-500 sm:text-base sm:leading-7">Speak naturally, review the extracted details, then save the quote to your workspace.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-8">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-slate-400">STEP 1</p><h2 className="mt-1 text-2xl font-bold">Capture the job</h2></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{String(seconds / 60 | 0).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</span>
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-5 text-center sm:mt-6 sm:rounded-[1.7rem] sm:p-7">
              <button onClick={recording ? stop : start} className={'mx-auto flex h-24 w-24 items-center justify-center rounded-full text-white shadow-xl transition ' + (recording ? 'bg-red-500 animate-pulse' : 'bg-[#1769E0] hover:bg-blue-700')}>
                {recording ? <Square size={28}/> : <Mic size={34}/>}
              </button>
              <p className="mt-4 font-semibold">{recording ? 'Recording… tap to stop' : audio ? 'Recording ready' : 'Tap to record'}</p>
              <p className="mt-1 text-sm text-slate-500">Use your normal job-site language.</p>
            </div>

            <div className="mt-6">
              <label className="text-sm font-bold">Manual notes</label>
              <textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} className="mt-2 min-h-36 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-[#1769E0] focus:ring-4 focus:ring-blue-50" placeholder="Replace kitchen tap. Two hours labour. Parts £85. Client is James..."/>
            </div>

            {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
            {saved && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700"><div>{saved}</div>{savedQuoteUrl && <div className="mt-3 flex flex-wrap gap-2"><a href={savedQuoteUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#1769E0] px-3 py-2 text-xs font-bold text-white">Open quote</a><button onClick={() => navigator.clipboard?.writeText(savedQuoteUrl)} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800">Copy public link</button></div>}</div>}

            <button onClick={analyze} disabled={loading || (!audio && !manualNotes.trim())} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1769E0] py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin" size={18}/>Analyzing…</> : <><ChevronRight size={18}/>Analyze job</>}
            </button>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-slate-400">STEP 2</p><h2 className="mt-1 text-2xl font-bold">Review quote</h2></div>
              <FileText className="text-slate-300"/>
            </div>

            {!analysis ? (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                <FileText className="mx-auto mb-3" size={32}/>
                <p className="font-semibold text-slate-600">Your extracted quote will appear here.</p>
                <p className="mt-1 text-sm">Nothing is sent to a client until you review it.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="rounded-xl border p-3" placeholder="Client name"/>
                  <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="rounded-xl border p-3" placeholder="Client email"/>
                  <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="rounded-xl border p-3" placeholder="Client phone"/>
                  <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="rounded-xl border p-3" placeholder="Client address"/>
                </div>

                <div className="rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b p-4"><span className="font-bold">Line items</span><button onClick={addItem} className="flex items-center gap-1 text-sm font-bold text-[#1769E0]"><Plus size={16}/>Add</button></div>
                  <div className="divide-y">
                    {items.map((item, index) => (
                      <div key={index} className="grid gap-2 p-4 sm:grid-cols-[1.5fr_.6fr_.7fr_.8fr_auto]">
                        <input value={item.description} onChange={(e) => updateItem(index,'description',e.target.value)} className="rounded-lg border p-2.5" placeholder="Description"/>
                        <input type="number" min="0" value={item.quantity} onChange={(e) => updateItem(index,'quantity',Number(e.target.value))} className="rounded-lg border p-2.5" />
                        <input value={item.unit} onChange={(e) => updateItem(index,'unit',e.target.value)} className="rounded-lg border p-2.5" placeholder="unit"/>
                        <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index,'price',Number(e.target.value))} className="rounded-lg border p-2.5" placeholder="£"/>
                        <button onClick={() => removeItem(index)} className="rounded-lg p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-bold">Quote style & billing options</span>
                    {planInfo && <span className="text-xs font-semibold text-slate-400">{planInfo.label} plan</span>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-bold text-slate-500">PDF template
                      <select value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                        {[['modern','Modern'],['classic','Classic'],['bold','Bold'],['minimal','Minimal'],['technical','Technical']].map(([id,label]) =>
                          <option key={id} value={id} disabled={!!planInfo && !planInfo.templates.includes(id)}>{label}{planInfo && !planInfo.templates.includes(id) ? ' · Locked' : ''}</option>
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-500">Currency
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                        {['GBP','USD','EUR','AED','SAR','CAD','AUD','CHF','SEK','NOK'].map((code) =>
                          <option key={code} value={code} disabled={!!planInfo && !planInfo.currencies.includes(code)}>{code}{planInfo && !planInfo.currencies.includes(code) ? ' · Locked' : ''}</option>
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-500">Language
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                        {[['en','English'],['ar','Arabic'],['es','Spanish'],['fr','French']].map(([id,label]) =>
                          <option key={id} value={id} disabled={!!planInfo && !planInfo.languages.includes(id)}>{label}{planInfo && !planInfo.languages.includes(id) ? ' · Locked' : ''}</option>
                        )}
                      </select>
                    </label>
                  </div>
                  {planInfo && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Lock size={13}/><span>Locked options stay unavailable when the quote is saved.</span><a href="/pricing" className="ml-auto font-bold text-[#1769E0]">See plans</a></div>}
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span className="font-semibold">Subtotal</span><span className="text-2xl font-black">{currency} {subtotal.toFixed(2)}</span></div>

                <div className="rounded-2xl border border-[#1769E0]/15 bg-[#1769E0]/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-bold text-[#0A1E3D]">Quote Intelligence</p><p className="mt-1 text-xs leading-5 text-slate-500">Review this draft against your quote history before you send it.</p></div>
                    <button onClick={reviewQuote} disabled={reviewing} className="min-h-11 rounded-xl bg-[#1769E0] px-4 text-sm font-bold text-white disabled:opacity-60">{reviewing ? <Loader2 className="animate-spin" size={16}/> : 'Review quote'}</button>
                  </div>
                  {intelligence && <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-white p-4 text-sm leading-6 text-slate-700"><span className="font-bold">Advisor:</span> {intelligence.summary}</div>
                    {intelligence.warnings.map((x,i)=><div key={i} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><CircleAlert size={17} className="mt-0.5 shrink-0"/><span>{x}</span></div>)}
                    {intelligence.suggestions.map((x,i)=><div key={i} className="rounded-xl bg-white p-3 text-sm text-slate-600"><span className="font-bold text-[#1769E0]">Suggestion:</span> {x}</div>)}
                  </div>}
                </div>

                <div className="rounded-2xl bg-[#0A1E3D] p-5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300"><Check size={17}/>Ready for the next step</div>
                  <p className="mt-1 text-sm text-slate-300">Save this reviewed quote to your QUVOTO workspace.</p>
                  <button onClick={saveQuote} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-slate-900 disabled:opacity-60">
                    {saving ? <Loader2 className="animate-spin" size={17}/> : <Save size={17}/>}Save quote
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
