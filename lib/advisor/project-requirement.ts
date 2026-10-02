export type ProjectRequirement = {
  requiredQuantity?: number;
  requiredUnit?: 'm' | 'kg' | 'l' | 'pcs';
  searchQuery: string;
};

const REQUEST_WORDS = /(?:need|requires?|want|order|buy|quote)\s+(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i;
const EXPLICIT_FOR_QUANTITY = /\bfor\s+(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\s+(?:of\s+)?/i;
const UNIT_PATTERN = /(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)/i;

function normalizeUnit(raw?: string): ProjectRequirement['requiredUnit'] {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value.startsWith('m')) return 'm';
  if (value.startsWith('kg')) return 'kg';
  if (value.startsWith('l')) return 'l';
  return 'pcs';
}

export function extractProjectRequirement(question: string): ProjectRequirement {
  const normalized = question.replace(/×/g, 'x').replace(/\s+/g, ' ').trim();

  // Prefer explicit request verbs. This prevents product dimensions such as
  // "3m copper pipe" or "15kg adhesive" from becoming project quantities.
  let match = normalized.match(REQUEST_WORDS);
  if (!match) match = normalized.match(EXPLICIT_FOR_QUANTITY);

  // A bare quantity is accepted only when it is not embedded in a likely
  // product specification. For example, "30m of 22mm pipe" is a quantity,
  // while "3m copper pipe" is a product length.
  if (!match && !/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*(?:m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i.test(normalized)) {
    const bare = normalized.match(/\b(\d+(?:\.\d+)?)\s*(m|metres?|meters?|kg|kilograms?|l|litres?|liters?|pcs?|pieces?|units?)\b/i);
    if (bare) {
      const after = normalized.slice((bare.index ?? 0) + bare[0].length).trim();
      const before = normalized.slice(0, bare.index ?? 0).trim();
      const looksLikeProductSpec = /^(?:copper|pipe|tube|cable|wire|adhesive|sealant|paint|board|timber|plaster|cement|screws?|bolts?)/i.test(after)
        || /(?:22|28|15|20|25|32|40|50)\s*mm\s*$/i.test(before);
      if (!looksLikeProductSpec) match = bare;
    }
  }

  const requiredQuantity = match ? Number(match[1]) : undefined;
  const requiredUnit = normalizeUnit(match?.[2]);

  const searchQuery = normalized
    .replace(match?.[0] || '', ' ')
    .replace(/\b(?:i|we|you|please|need|requires?|want|for|of|order|buy|quote|get|find|me)\b/gi, ' ')
    .replace(/[,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    requiredQuantity,
    requiredUnit,
    searchQuery: searchQuery || question,
  };
}
