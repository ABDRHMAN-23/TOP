import type { BuyerProfile, SalesDraft } from './sales-engine';

export const MAX_SALES_MESSAGE_CHARS = 1600;
export const MAX_CONVERSATION_SUMMARY_CHARS = 1000;
export const MAX_REQUEST_BODY_CHARS = 12000;
export const MAX_REQUEST_BODY_BYTES = 32000;

export function buildNoMatchSalesDraft(activeCandidateCount: number): SalesDraft {
  const hasActiveCandidates = Number.isFinite(activeCandidateCount) && activeCandidateCount > 0;
  return {
    replyDraft: hasActiveCandidates
      ? 'لم أجد ضمن العقارات النشطة خيارًا يطابق الشروط المعروفة بالكامل، لذلك لن أقدّم عقارًا على أنه مناسب دون دليل. يمكننا توسيع البحث أو مراجعة أحد الشروط.'
      : 'لا توجد عقارات نشطة مسجلة في المخزون حاليًا، لذلك لن أخمّن تفاصيل غير متوفرة. يمكن إضافة العقارات أولًا أو مراجعة طلب العميل.',
    factsUsed: [],
    unknowns: [hasActiveCandidates ? 'no_eligible_property_match' : 'active_inventory_empty'],
    nextBestAction: 'ask_one_question',
    askOneQuestion: hasActiveCandidates ? 'هل تفضّل توسيع نطاق البحث أو تعديل أحد الشروط؟' : 'هل تريد إضافة العقارات إلى المخزون أولًا أم مراجعة شروط البحث؟',
    handoffRequired: false,
  };
}

export type AqarFlowSalesRequest = { customerMessage: string; conversationSummary: string; buyerProfile: BuyerProfile };
export type AqarFlowSalesRequestResult =
  | { ok: true; value: AqarFlowSalesRequest }
  | { ok: false; code: 'invalid_body' | 'message_required' | 'message_too_long' };

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C-\u001F\u007F]/g, '').trim().slice(0,max) : '';
}
function cleanList(value: unknown, count = 8, chars = 80): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(); const out: string[] = [];
  for (const item of value) {
    const v = cleanText(item,chars); const key = v.toLocaleLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key); out.push(v); if (out.length >= count) break;
  }
  return out;
}
function finiteNumber(value: unknown, max = 1_000_000_000_000): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
export function normalizeBuyerProfile(value: unknown): BuyerProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>; const p: BuyerProfile = {};
  if (['buy','rent','invest','unknown'].includes(String(raw.intent))) p.intent = raw.intent as BuyerProfile['intent'];
  const type = cleanText(raw.propertyType,80); if (type) p.propertyType = type;
  const areas = cleanList(raw.preferredAreas,8,80); if (areas.length) p.preferredAreas = areas;
  const min = finiteNumber(raw.budgetMin); if (min !== null) p.budgetMin = min;
  const max = finiteNumber(raw.budgetMax); if (max !== null) p.budgetMax = max;
  const currency = cleanText(raw.currency,8).toUpperCase(); if (/^[A-Z]{3,8}$/.test(currency)) p.currency = currency;
  const beds = finiteNumber(raw.bedroomsMin,100); if (beds !== null && Number.isInteger(beds)) p.bedroomsMin = beds;
  const must = cleanList(raw.mustHaves,8,100); if (must.length) p.mustHaves = must;
  const breakers = cleanList(raw.dealBreakers,8,100); if (breakers.length) p.dealBreakers = breakers;
  const language = cleanText(raw.preferredLanguage,30); if (language) p.preferredLanguage = language;
  if (['concise','warm','detailed','unknown'].includes(String(raw.preferredTone))) p.preferredTone = raw.preferredTone as BuyerProfile['preferredTone'];
  const timeline = cleanText(raw.timeline,80); if (timeline) p.timeline = timeline;
  return p;
}
export function inferBasicBuyerProfileHints(message: string): BuyerProfile {
  const normalized = message.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const hints: BuyerProfile = {};
  if (/(للإيجار|للايجار|إيجار|ايجار|استئجار|\brent(?:al)?\b|\blease\b|\bto rent\b)/i.test(normalized)) hints.intent = 'rent';
  else if (/(للبيع|شراء|أشتري|اشتري|تملّك|تملك|\bbuy\b|\bpurchase\b|\bfor sale\b)/i.test(normalized)) hints.intent = 'buy';
  const match = normalized.match(/(?:^|\s)(\d{1,2})\s*(?:غرف(?:ة)?(?:\s*نوم)?|غرف نوم|bedrooms?|beds?)/i);
  if (match) { const n = Number(match[1]); if (Number.isInteger(n) && n >= 0 && n <= 20) hints.bedroomsMin = n; }
  return hints;
}
export function parseAqarFlowSalesRequest(value: unknown): AqarFlowSalesRequestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok:false,code:'invalid_body'};
  const raw = value as Record<string, unknown>;
  if (typeof raw.customerMessage !== 'string' || !raw.customerMessage.trim()) return {ok:false,code:'message_required'};
  if (raw.customerMessage.trim().length > MAX_SALES_MESSAGE_CHARS) return {ok:false,code:'message_too_long'};
  return {ok:true,value:{
    customerMessage:cleanText(raw.customerMessage,MAX_SALES_MESSAGE_CHARS),
    conversationSummary:cleanText(raw.conversationSummary,MAX_CONVERSATION_SUMMARY_CHARS),
    buyerProfile:normalizeBuyerProfile(raw.buyerProfile),
  }};
}
