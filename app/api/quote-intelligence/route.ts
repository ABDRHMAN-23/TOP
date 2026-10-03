import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function geminiUrl(model: string) {
  const base = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  return `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function ask(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API is not configured. Add GEMINI_API_KEY to the deployment environment.');

  const system = 'You are QUVOTO Quote Intelligence. Review contractor quote drafts. Never invent market facts. Use only supplied quote history and draft data. Identify missing costs, suspicious arithmetic, unusually low/high values versus the user history, missing commercial terms, and useful follow-up questions. Do not change prices automatically. Return JSON only: summary, warnings, suggestions, questions, confidence. Arrays for warnings/suggestions/questions; confidence low|medium|high.';
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      warnings: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      questions: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
    },
    required: ['summary', 'warnings', 'suggestions', 'questions', 'confidence']
  };

  const res = await fetch(geminiUrl(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: system + '\n\n' + prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    })
  });

  const rawText = await res.text();
  let raw: any = {};
  try { raw = rawText ? JSON.parse(rawText) : {}; } catch {}

  if (!res.ok) {
    throw new Error(`Gemini API error: ${raw?.error?.message || rawText || `HTTP ${res.status}`}`);
  }

  const pText = String(raw?.candidates?.[0]?.content?.parts?.map((part:any) => part?.text || '').join('') || '').trim();
  let p: any;
  try { p = JSON.parse(pText); } catch { throw new Error('Quote Intelligence returned invalid structured data.'); }

  return {
    summary: String(p?.summary || ''),
    warnings: Array.isArray(p?.warnings) ? p.warnings.map(String) : [],
    suggestions: Array.isArray(p?.suggestions) ? p.suggestions.map(String) : [],
    questions: Array.isArray(p?.questions) ? p.questions.map(String) : [],
    confidence: ['low','medium','high'].includes(p?.confidence) ? p.confidence : 'low'
  };
}

export async function POST(req:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:'Sign in to review a quote.'},{status:401});
    const body=await req.json();
    if(!Array.isArray(body?.items)||body.items.length===0)return NextResponse.json({error:'Add at least one quote item first.'},{status:400});
    const {data:quotes}=await supabase.from('quotes').select('quote_number,items,subtotal,total,currency,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
    const prompt=JSON.stringify({draft:{client_name:body.client_name||'',items:body.items,subtotal:body.subtotal,total:body.total,currency:body.currency||'GBP',vat_rate:body.vat_rate||0,discount:body.discount||0,notes:body.notes||[]},history:quotes||[]});
    const ai=await ask(prompt);
    const history=(quotes||[]).flatMap((q:any)=>(Array.isArray(q.items)?q.items:[]).map((item:any)=>({...item,quote_number:q.quote_number,quote_date:q.created_at,currency:q.currency})));
    const normalize=(s:any)=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const priceHistory=(body.items||[]).map((item:any)=>{const key=normalize(item.description);const matches=history.filter((h:any)=>normalize(h.description)===key && Number(h.price)>0 && h.currency===body.currency);const prices=matches.map((h:any)=>Number(h.price)).sort((a:number,b:number)=>a-b);const median=prices.length?prices[Math.floor(prices.length/2)]:null;return {description:item.description,sampleCount:prices.length,min:prices[0]??null,max:prices[prices.length-1]??null,median,currentPrice:Number(item.price)>0?Number(item.price):null};});
    const specificationMatching=(body.items||[]).map((item:any)=>{const key=normalize(item.description);const matches=history.filter((h:any)=>normalize(h.description)===key && String(h.unit||'')===String(item.unit||''));return {description:item.description,unit:item.unit,sampleCount:matches.length,matched:matches.length>0};});
    const priceComparison=priceHistory.map((x:any)=>({...x,differencePercent:x.currentPrice&&x.median?Number((((x.currentPrice-x.median)/x.median)*100).toFixed(1)):null}));
    return NextResponse.json({...ai,priceHistory,priceComparison,specificationMatching});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Quote review failed.'},{status:500})}
}
