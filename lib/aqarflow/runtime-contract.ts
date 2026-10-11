import type { BuyerProfile, SalesDraft } from './sales-engine';

export const MAX_SALES_MESSAGE_CHARS = 1600;
export const MAX_CONVERSATION_SUMMARY_CHARS = 1000;
export const MAX_REQUEST_BODY_CHARS = 12000;
export const MAX_REQUEST_BODY_BYTES = 32000;

export function buildNoMatchSalesDraft(activeCandidateCount: number, buyerProfile?: BuyerProfile | null): SalesDraft {
  const hasActiveCandidates = Number.isFinite(activeCandidateCount) && activeCandidateCount > 0;
  const areas = Array.isArray(buyerProfile?.preferredAreas)
    ? buyerProfile.preferredAreas.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 2)
    : [];
  const propertyType = typeof buyerProfile?.propertyType === 'string' ? buyerProfile.propertyType.trim().slice(0, 60) : '';
  const context = [
    propertyType ? ` من نوع ${propertyType}` : '',
    areas.length ? ` في ${areas.join(' أو ')}` : '',
  ].join('');
  const budgetGuard = buyerProfile?.budgetMax != null
    ? ' مع الحفاظ على سقف الميزانية الذي حددته'
    : '';
  return {
    replyDraft: hasActiveCandidates
      ? `راجعت الخيارات المسجلة${context}، لكن ما ظهر خيار أقدر أقول لك إنه يطابق شروطك بالكامل. ما أحب أضيّع وقتك بعقار ما يناسبك؛ أقدر أوسّع البحث إلى منطقة أخرى${budgetGuard} أو أراجع معك شرطًا مرنًا.`
      : 'حاليًا لا يظهر في المخزون المسجل خيار أقدر أطابقه مع طلبك بثقة، وما أحب أعطيك مواصفات أو وعودًا غير مؤكدة. خلّينا نحدد أهم شرط تريد الحفاظ عليه قبل توسيع البحث.',
    factsUsed: [],
    unknowns: [hasActiveCandidates ? 'no_eligible_property_match' : 'active_inventory_empty'],
    nextBestAction: 'ask_one_question',
    askOneQuestion: hasActiveCandidates
      ? `هل تقبل توسيع البحث إلى منطقة أخرى${budgetGuard}، أم تفضّل مراجعة شرط آخر؟`
      : 'ما أهم شرط يجب الحفاظ عليه في البحث؟',
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
  if (["hard","slight","flexible"].includes(String(raw.budgetFlexibility))) p.budgetFlexibility = raw.budgetFlexibility as BuyerProfile["budgetFlexibility"];
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
  const normalized = message
    .normalize("NFKC")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase();
  const hints: BuyerProfile = {};

  if (/(للإيجار|للايجار|إيجار|ايجار|استئجار|\brent(?:al)?\b|\blease\b|\bto rent\b)/i.test(normalized)) hints.intent = "rent";
  else if (/(للبيع|شراء|اشتري|تملك|\bbuy\b|\bpurchase\b|\bfor sale\b)/i.test(normalized)) hints.intent = "buy";

  const bedroomMatch = normalized.match(/(?:^|\s)(\d{1,2})\s*(?:غرف(?:ة)?(?:\s*نوم)?|غرف نوم|bedrooms?|beds?)/i);
  if (bedroomMatch) {
    const bedrooms = Number(bedroomMatch[1]);
    if (Number.isInteger(bedrooms) && bedrooms >= 0 && bedrooms <= 20) hints.bedroomsMin = bedrooms;
  }

  // Only infer a money amount when a currency is explicitly named; a bare "200"
  // might be a room count, area, ID, or another quantity.
  const hasUSD = /(?:\busd\b|us\$|\$|دولار)/i.test(normalized);
  const hasSAR = /(?:\bsar\b|ريال سعودي)/i.test(normalized);
  const hasYER = /(?:\byer\b|ريال يمني)/i.test(normalized);
  const currency = hasUSD ? "USD" : hasSAR ? "SAR" : hasYER ? "YER" : null;
  if (currency) {
    const amount = String.raw`(\d{1,3}(?:[,٬]\d{3})*(?:\.\d+)?)`;
    const pattern = currency === "USD"
      ? new RegExp(String.raw`(?:\$\s*${amount}|${amount}\s*(?:usd|us\$|دولار(?:ات)?))`, "gi")
      : currency === "SAR"
        ? new RegExp(String.raw`(?:${amount}\s*(?:sar|ريال سعودي)|(?:sar|ريال سعودي)\s*${amount})`, "gi")
        : new RegExp(String.raw`(?:${amount}\s*(?:yer|ريال يمني)|(?:yer|ريال يمني)\s*${amount})`, "gi");
    const amounts: number[] = [];
    for (const match of normalized.matchAll(pattern)) {
      const candidate = match.slice(1).find(value => typeof value === "string" && value.trim()) || "";
      const parsed = Number(candidate.replace(/[，,٬]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000_000_000) amounts.push(parsed);
      if (amounts.length >= 4) break;
    }
    if (amounts.length) {
      hints.currency = currency;
      if (amounts.length >= 2 && /(?:بين|من|الى|إلى|to|between|and)/i.test(normalized)) {
        hints.budgetMin = Math.min(...amounts);
        hints.budgetMax = Math.max(...amounts);
      } else {
        hints.budgetMax = amounts[amounts.length - 1];
      }
    }
  }

  const firmBudget = /(?:حد نهائي|بحد اقصى|ما اقدر ازيد|لا اقدر ازيد|ما استطيع ازيد|لا استطيع ازيد|ما اقدر اتجاوز|لا اتجاوز|ميزانيتي.{0,35}نهائي|cannot increase|can't increase|firm budget|hard limit|maximum budget)/i.test(normalized);
  const flexibleBudget = /(?:اقدر ازيد.{0,25}(?:قليل|شوي|قليلا)|ممكن ازيد|ممكن نزيد|قابل للتفاوض|قابلة للتفاوض|عندي مرونة|مرن|مرنة|flexible budget|can increase a little|some flexibility)/i.test(normalized);
  if (firmBudget) hints.budgetFlexibility = "hard";
  else if (flexibleBudget) hints.budgetFlexibility = "slight";

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
