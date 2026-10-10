export type GeminiJsonResult = { text: string; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type GeminiJsonInput = { apiKey: string; model: string; systemInstruction: string; prompt: string; responseSchema: Record<string, unknown>; maxOutputTokens?: number; timeoutMs?: number };
export class GeminiRuntimeError extends Error {
  readonly code: 'configuration' | 'timeout' | 'provider_rejected' | 'invalid_response';
  constructor(code: GeminiRuntimeError['code']) {
    super(({configuration:'AI provider configuration is missing.',timeout:'AI provider timed out.',provider_rejected:'AI provider request failed.',invalid_response:'AI provider returned an invalid response.'})[code]);
    this.name='GeminiRuntimeError'; this.code=code;
  }
}
function tokenCount(v: unknown): number | null { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 10000000 ? v : null; }
function extractText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const parts=(payload as Record<string,any>)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.filter((p:unknown)=>p&&typeof p==='object'&&typeof (p as Record<string,unknown>).text==='string').map((p:Record<string,unknown>)=>String(p.text)).join('').trim();
}
export async function generateGeminiJson(input: GeminiJsonInput, fetcher: typeof fetch = fetch): Promise<GeminiJsonResult> {
  if (!input.apiKey || !input.model || !input.systemInstruction || !input.prompt) throw new GeminiRuntimeError('configuration');
  const controller=new AbortController(); const timeout=Math.min(Math.max(input.timeoutMs??18000,1000),25000);
  const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    let response: Response;
    try {
      response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(input.model)+':generateContent',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':input.apiKey},signal:controller.signal,
        body:JSON.stringify({systemInstruction:{parts:[{text:input.systemInstruction}]},contents:[{role:'user',parts:[{text:input.prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:Math.min(Math.max(input.maxOutputTokens??650,128),900),responseMimeType:'application/json',responseSchema:input.responseSchema}})
      });
    } catch (e) { throw new GeminiRuntimeError(controller.signal.aborted || (e instanceof Error && e.name==='AbortError') ? 'timeout':'provider_rejected'); }
    if (!response.ok) throw new GeminiRuntimeError('provider_rejected');
    let payload: unknown; try { payload=await response.json(); } catch { throw new GeminiRuntimeError('invalid_response'); }
    const data=payload as Record<string,any>; const text=extractText(payload);
    if (!text || data?.candidates?.[0]?.finishReason==='MAX_TOKENS') throw new GeminiRuntimeError('invalid_response');
    const usage=data?.usageMetadata && typeof data.usageMetadata==='object' ? data.usageMetadata : {};
    const inputTokens=tokenCount(usage.promptTokenCount); const outputTokens=tokenCount(usage.candidatesTokenCount);
    return {text,inputTokens,outputTokens,totalTokens:tokenCount(usage.totalTokenCount)??(inputTokens!==null&&outputTokens!==null?inputTokens+outputTokens:null)};
  } finally { clearTimeout(timer); }
}
