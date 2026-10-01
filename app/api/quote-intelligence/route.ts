import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function ask(prompt: string) {
  const url = process.env.GEMMA_API_URL;
  if (!url) throw new Error('Quote Intelligence AI is not configured.');
  const headers: Record<string,string> = {'Content-Type':'application/json'};
  if (process.env.GEMMA_API_KEY) headers.Authorization='Bearer '+process.env.GEMMA_API_KEY;
  const system='You are QUVOTO Quote Intelligence. Review contractor quote drafts. Never invent market facts. Use only supplied quote history and draft data. Identify missing costs, suspicious arithmetic, unusually low/high values versus the user history, missing commercial terms, and useful follow-up questions. Do not change prices automatically. Return JSON only: summary, warnings, suggestions, questions, confidence. Arrays for warnings/suggestions/questions; confidence low|medium|high.';
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({model:process.env.GEMMA_MODEL||'gemma-4-31b-it',temperature:.1,response_format:{type:'json_object'},system,prompt,messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  if(!res.ok) throw new Error('Quote Intelligence provider returned an error.');
  const raw=await res.json(); let p=raw?.output??raw?.text??raw?.response??raw?.choices?.[0]?.message?.content??raw;
  if(typeof p==='string'){try{p=JSON.parse(p.replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim())}catch{throw new Error('Quote Intelligence returned invalid data.');}}
  return {summary:String(p?.summary||''),warnings:Array.isArray(p?.warnings)?p.warnings.map(String):[],suggestions:Array.isArray(p?.suggestions)?p.suggestions.map(String):[],questions:Array.isArray(p?.questions)?p.questions.map(String):[],confidence:['low','medium','high'].includes(p?.confidence)?p.confidence:'low'};
}

export async function POST(req:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:'Sign in to review a quote.'},{status:401});
    const body=await req.json();
    if(!Array.isArray(body?.items)||body.items.length===0)return NextResponse.json({error:'Add at least one quote item first.'},{status:400});
    const {data:quotes}=await supabase.from('quotes').select('quote_number,items,subtotal,total,currency,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
    const prompt=JSON.stringify({draft:{client_name:body.client_name||'',items:body.items,subtotal:body.subtotal,total:body.total,currency:body.currency||'GBP',vat_rate:body.vat_rate||0,discount:body.discount||0,notes:body.notes||[]},history:quotes||[]});
    return NextResponse.json(await ask(prompt));
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Quote review failed.'},{status:500})}
}