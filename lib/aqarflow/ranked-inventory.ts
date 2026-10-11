import { matchVerifiedProperties, type BuyerProfile, type PropertyMatch, type VerifiedProperty } from './sales-engine.ts';

const MATCH_BATCH_SIZE = 5;
export const MAX_PROPERTY_CANDIDATES = 50;


/**
 * When exact matches are absent, optionally return one verified, near-budget
 * alternative for consideration. A stated hard ceiling is always respected.
 * This does not mark the alternative eligible or within budget.
 */
export function selectNearBudgetAlternative(
  buyer: BuyerProfile | null | undefined,
  ranked: PropertyMatch[],
): VerifiedProperty | null {
  const profile = buyer || {};
  if (profile.budgetMax == null || !profile.currency || profile.budgetFlexibility === "hard") return null;
  const ceilingRate = profile.budgetFlexibility === "flexible" ? 0.2 : 0.1;
  const upperBound = profile.budgetMax * (1 + ceilingRate);
  const currency = profile.currency.toUpperCase();

  const alternatives = ranked.filter((match) => {
    if (match.eligible || match.conflicts.length !== 1 || match.conflicts[0] !== "above_budget_maximum") return false;
    const property = match.property;
    if (property.availability !== "available" || property.price == null || !property.currency) return false;
    if (property.currency.toUpperCase() !== currency || property.price <= profile.budgetMax! || property.price > upperBound) return false;
    // Do not promote a higher-priced option if a stated required feature or property type is unverified.
    if (match.unknowns.some((unknown) =>
      unknown.startsWith("must_have_unverified:")
      || unknown === "property_type_unknown"
      || unknown === "bedrooms_unknown"
      || unknown === "budget_comparison_unavailable"
      || unknown === "availability_unknown"
    )) return false;
    return true;
  });

  alternatives.sort((a, b) =>
    (a.property.price! - profile.budgetMax!) - (b.property.price! - profile.budgetMax!)
    || b.score - a.score
  );
  return alternatives[0]?.property || null;
}

export function rankPropertyCandidates(buyer: BuyerProfile | null | undefined, rawCandidates: unknown): PropertyMatch[] {
  if (!Array.isArray(rawCandidates)) return [];
  const candidates: unknown[] = [];
  const seen = new Set<string>();
  for (const candidate of rawCandidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    candidates.push(candidate);
    if (candidates.length >= MAX_PROPERTY_CANDIDATES) break;
  }
  const index = new Map<string, number>();
  candidates.forEach((item, i) => {
    const id = (item as Record<string, unknown>).id;
    if (typeof id === 'string') index.set(id.trim(), i);
  });
  const scored: Array<{ match: PropertyMatch; index: number }> = [];
  for (let offset = 0; offset < candidates.length; offset += MATCH_BATCH_SIZE) {
    for (const match of matchVerifiedProperties(buyer, candidates.slice(offset, offset + MATCH_BATCH_SIZE))) {
      scored.push({ match, index: index.get(match.property.id) ?? Number.MAX_SAFE_INTEGER });
    }
  }
  scored.sort((a,b) => Number(b.match.eligible)-Number(a.match.eligible) || b.match.score-a.match.score || a.index-b.index);
  return scored.map(({match}) => match);
}
