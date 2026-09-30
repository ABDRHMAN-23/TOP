'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, FileText, Loader2, Mic, Plus, RotateCcw, Save, Square, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Item = { description: string; quantity: number; unit: string; price: number };
type Analysis = {
  transcript: string;
  client?: { name?: string; email?: string; phone?: string; address?: string };
  items?: Item[];
  notes?: string[];
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
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => timer.current && clearInterval(timer.current), []);

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
    setError('');
    setSaved('');
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

  const saveQuote = async () => {
    setSaving(true);
    setError('');
    setSaved('');
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
          currency: 'GBP',
          template: 'modern',
          language: 'en'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please sign in before saving.');
      setSaved(data.quote_number || 'Quote saved');
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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/" className="text-xl font-black tracking-tight">Voice<span className="text-blue-600">Quote</span></a>
          <div className="flex items-center gap-3">
            <button onClick={signIn} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Sign in</button>
            <button onClick={reset} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><RotateCcw size={15}/>New</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"><Mic size={14}/>VOICE-FIRST QUOTING</div>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Turn a field note into a professional quote.</h1>
          <p className="mt-3 max-w-2xl text-slate-500">Speak naturally, review the extracted details, then save the quote to your workspace.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-slate-400">STEP 1</p><h2 className="mt-1 text-2xl font-bold">Capture the job</h2></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{String(seconds / 60 | 0).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</span>
            </div>

            <div className="mt-6 rounded-[1.7rem] bg-slate-50 p-7 text-center">
              <button onClick={recording ? stop : start} className={'mx-auto flex h-24 w-24 items-center justify-center rounded-full text-white shadow-xl transition ' + (recording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700')}>
                {recording ? <Square size={28}/> : <Mic size={34}/>}
              </button>
              <p className="mt-4 font-semibold">{recording ? 'Recording… tap to stop' : audio ? 'Recording ready' : 'Tap to record'}</p>
              <p className="mt-1 text-sm text-slate-500">Use your normal job-site language.</p>
            </div>

            <div className="mt-6">
              <label className="text-sm font-bold">Manual notes</label>
              <textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} className="mt-2 min-h-36 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" placeholder="Replace kitchen tap. Two hours labour. Parts £85. Client is James..."/>
            </div>

            {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
            {saved && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{saved}</div>}

            <button onClick={analyze} disabled={loading || (!audio && !manualNotes.trim())} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
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
                  <div className="flex items-center justify-between border-b p-4"><span className="font-bold">Line items</span><button onClick={addItem} className="flex items-center gap-1 text-sm font-bold text-blue-600"><Plus size={16}/>Add</button></div>
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

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span className="font-semibold">Subtotal</span><span className="text-2xl font-black">£{subtotal.toFixed(2)}</span></div>

                <div className="rounded-2xl bg-slate-900 p-5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300"><Check size={17}/>Ready for the next step</div>
                  <p className="mt-1 text-sm text-slate-300">Save this reviewed quote to your VoiceQuote workspace.</p>
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
