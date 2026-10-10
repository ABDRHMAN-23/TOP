import { matchVerifiedProperties, type BuyerProfile, type PropertyMatch } from './sales-engine.ts';

const MATCH_BATCH_SIZE = 5;
export const MAX_PROPERTY_CANDIDATES = 50;

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
