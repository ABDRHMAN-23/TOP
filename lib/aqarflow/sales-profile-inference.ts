import type { BuyerProfile } from "./sales-engine.ts";
import { inferBasicBuyerProfileHints } from "./runtime-contract.ts";

function normalizePhrase(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـ]/g, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function typeFamily(value: string): string | null {
  const text = normalizePhrase(value);
  if (/(شقة|شقق|apartment|flat)/i.test(text)) return "apartment";
  if (/(فيلا|فلل|villa)/i.test(text)) return "villa";
  if (/(بيت|منزل|house|home)/i.test(text)) return "house";
  if (/(أرض|ارض|اراضي|land|plot)/i.test(text)) return "land";
  if (/(مكتب|office)/i.test(text)) return "office";
  if (/(محل|تجاري|commercial|shop|store)/i.test(text)) return "commercial";
  return null;
}

function isNegatedAreaMention(normalizedMessage: string, phrase: string): boolean {
  const needle = normalizePhrase(phrase);
  if (!needle) return false;
  let offset = 0;
  while (offset < normalizedMessage.length) {
    const index = normalizedMessage.indexOf(needle, offset);
    if (index < 0) return false;
    const start = Math.max(0, index - 52);
    const prefix = normalizedMessage.slice(start, index).split(/[,،;؛.!؟?]/).pop() || "";
    if (/(?:لا اريد|ما اريد|ما ابغى|ما ابغي|مش عايز|مش عاوز|بدون|not|don't want|do not want)(?:\s+[^\s,،;؛.!؟?]+){0,3}\s*$/i.test(prefix)) return true;
    offset = index + needle.length;
  }
  return false;
}

function positiveRequestTail(normalizedMessage: string): string {
  const parts = normalizedMessage.split(/(?:[,،;؛.]+(?=\s*(?:ابغى|ابغي|ابي|اريد|احتاج|لازم|want|need|looking for))|\bbut\b|\binstead\b|\brather than\b|لكن|ولكن|بل|بدل(?:ا)? من)/i);
  return parts[parts.length - 1] || normalizedMessage;
}

const AREA_ALIAS_GROUPS = [
  ["المنصورة", "المنصوره", "mansoura", "al mansoura", "al-mansoura"],
  ["خور مكسر", "خورمكسر", "khormaksar", "khor makser", "khor maksar"],
  ["كريتر", "crater", "صيرة", "sira"],
  ["المعلا", "المعلا", "mualla", "al mualla", "al-mualla"],
  ["التواهي", "التواهي", "tawahi", "at tawahi"],
  ["الشيخ عثمان", "الشيخ عثمان", "sheikh uthman", "shaikh othman"],
  ["دار سعد", "دارسعد", "dar saad", "dar sad"],
  ["عدن", "aden"],
];

export type InventoryHintRow = { property_type: string | null; location_label: string | null; verified_features: string[] | null };

const PROPERTY_FAMILY_LABELS: Record<string, string> = {
  apartment: "شقة",
  villa: "فيلا",
  house: "بيت",
  land: "أرض",
  office: "مكتب",
  commercial: "محل تجاري",
};

export function inferInventoryHints(message: string, rows: InventoryHintRow[]): Partial<BuyerProfile> {
  const hints = inferBasicBuyerProfileHints(message);
  const normalizedMessage = normalizePhrase(message);
  const negativeIntent = /(?:ما ابغي|ما ابغى|ما اريد|لا اريد|مش عايز|مش عاوز|بدون|لا احتاج|لا احتج|do not want|don't want|without)/i.test(normalizedMessage);

  if (!hints.propertyType) {
    const positiveTail = positiveRequestTail(normalizedMessage);
    const requestedFamily = typeFamily(positiveTail) || (!negativeIntent ? typeFamily(normalizedMessage) : null);
    if (requestedFamily) {
      const record = rows.find((row) => row.property_type && typeFamily(row.property_type) === requestedFamily);
      // Keep explicit property type even when this workspace has zero current listings of that type.
      hints.propertyType = record?.property_type || PROPERTY_FAMILY_LABELS[requestedFamily] || null;
    } else if (!negativeIntent) {
      const types = rows.map((row) => row.property_type).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      const match = types.find((type) => {
        const normalizedType = normalizePhrase(type);
        return normalizedType.length >= 3 && normalizedMessage.includes(normalizedType)
          && !isNegatedAreaMention(normalizedMessage, normalizedType);
      });
      if (match) hints.propertyType = match;
    }
  }

  const areaMatches: string[] = [];
  let rejectedAreaMention = false;

  // Parse known Aden area names from the customer's message independently of inventory.
  // Otherwise a new request cannot be remembered when there are zero listings to compare.
  for (const group of AREA_ALIAS_GROUPS) {
    const mentions = group
      .map((alias) => ({ alias, index: normalizedMessage.indexOf(normalizePhrase(alias)) }))
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index);
    for (const mention of mentions) {
      if (isNegatedAreaMention(normalizedMessage, mention.alias)) {
        rejectedAreaMention = true;
        continue;
      }
      const matchedListing = rows.find((row) => {
        const label = typeof row.location_label === "string" ? normalizePhrase(row.location_label) : "";
        return label && group.some((alias) => label.includes(normalizePhrase(alias)));
      });
      if (matchedListing?.location_label) {
        const pieces = matchedListing.location_label.split(/[,،/|؛;–—-]+/)
          .map((part) => part.trim()).filter((part) => part.length >= 3);
        const propertyAlias = group.find((candidate) => normalizePhrase(matchedListing.location_label || "").includes(normalizePhrase(candidate)));
        const labelPiece = propertyAlias
          ? pieces.find((piece) => normalizePhrase(piece).includes(normalizePhrase(propertyAlias)))
          : null;
        areaMatches.push(labelPiece || mention.alias);
      } else {
        areaMatches.push(mention.alias);
      }
      // One alias is enough for this group; do not add spelling variants of the same place.
      break;
    }
  }

  // Also preserve a specific location label already present in inventory, including places
  // not represented in the small common-area alias list.
  for (const row of rows) {
    const label = typeof row.location_label === "string" ? row.location_label.trim() : "";
    if (!label) continue;
    const pieces = label.split(/[,،/|؛;–—-]+/).map((part) => part.trim()).filter((part) => part.length >= 3);
    for (const piece of pieces) {
      const normalizedPiece = normalizePhrase(piece);
      if (normalizedPiece.length >= 3 && normalizedMessage.includes(normalizedPiece)) {
        if (isNegatedAreaMention(normalizedMessage, normalizedPiece)) rejectedAreaMention = true;
        else areaMatches.push(piece);
      }
    }
  }

  const cleanAreas = [...new Map(areaMatches.map((area) => [normalizePhrase(area), area])).values()].slice(0, 3);
  if (cleanAreas.length) hints.preferredAreas = cleanAreas;
  else if (rejectedAreaMention) hints.preferredAreas = [];

  const knownFeatures = [...new Set(rows.flatMap((row) => Array.isArray(row.verified_features) ? row.verified_features : []))]
    .filter((value) => typeof value === "string" && value.trim().length >= 3);
  const mustHaves: string[] = [];
  const dealBreakers: string[] = [];
  for (const feature of knownFeatures) {
    const normalizedFeature = normalizePhrase(feature);
    if (!normalizedFeature || !normalizedMessage.includes(normalizedFeature)) continue;
    const featureIndex = normalizedMessage.indexOf(normalizedFeature);
    const prefix = normalizedMessage.slice(Math.max(0, featureIndex - 28), featureIndex);
    if (/(?:بدون|ما ابغي|ما ابغى|ما اريد|لا اريد|مش عايز|مش عاوز|without|don't want|do not want)\s*$/.test(prefix)) {
      dealBreakers.push(feature);
    } else if (/(?:لازم|ضروري|اهم شيء|مهم عندي|احتاج|اريد|ابغى|ابي|must have|need|want|require)/i.test(normalizedMessage)) {
      mustHaves.push(feature);
    }
  }
  if (mustHaves.length) hints.mustHaves = [...new Set(mustHaves)].slice(0, 8);
  if (dealBreakers.length) hints.dealBreakers = [...new Set(dealBreakers)].slice(0, 8);
  return hints;
}
