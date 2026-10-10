import assert from "node:assert/strict";
import {
  buildPersonalizedSalesPrompt,
  buildVerifiedFactTokens,
  findUnsupportedNumericClaims,
  matchVerifiedProperties,
  mergeBuyerProfile,
  sanitizeVerifiedProperties,
  validateSalesDraft,
} from "../lib/aqarflow/sales-engine.ts";

const prior = {
  intent: "buy" as const,
  budgetMax: 100000,
  preferredAreas: ["Aden"],
  mustHaves: ["3 bedrooms"],
};

const merged = mergeBuyerProfile(prior, {
  budgetMax: null,
  preferredAreas: [],
  mustHaves: ["3 bedrooms", "balcony"],
});

assert.equal(merged.budgetMax, 100000, "null extraction must not erase known budget");
assert.deepEqual(merged.preferredAreas, ["Aden"], "empty extraction must not erase known areas");
assert.deepEqual(merged.mustHaves, ["3 bedrooms", "balcony"], "new preferences should merge");
assert.deepEqual(
  mergeBuyerProfile({ mustHaves: ["balcony", "parking"] }, { mustHaves: ["sea view"] }).mustHaves,
  ["balcony", "parking", "sea view"],
  "partial extraction must not erase previously captured requirements",
);

const malformedProfile = mergeBuyerProfile(
  { preferredAreas: "Aden" as unknown as string[], mustHaves: ["parking"] },
  { preferredAreas: "Sanaa" as unknown as string[], mustHaves: null as unknown as string[] },
);
assert.deepEqual(malformedProfile.preferredAreas, [], "malformed preference strings must not be split into characters");
assert.deepEqual(malformedProfile.mustHaves, ["parking"], "malformed extracted arrays must not erase valid prior preferences");

const properties = sanitizeVerifiedProperties([
  {
    id: "property-1",
    title: "Apartment A",
    price: 98000,
    currency: "usd",
    bedrooms: 3,
    verifiedFeatures: ["Balcony", "Balcony", "  "],
    description: "A real listing",
    inventedAmenity: "private pool",
  },
  { title: "Missing ID should be ignored" },
  null,
]);

assert.equal(properties.length, 1, "records without a stable ID must be excluded");
assert.equal(
  sanitizeVerifiedProperties([
    { id: "same", title: "First", bedrooms: 2 },
    { id: "same", title: "Conflicting second", bedrooms: 9 },
  ])[0].bedrooms,
  2,
  "duplicate IDs must not introduce conflicting facts",
);
assert.deepEqual(properties[0].verifiedFeatures, ["Balcony"], "features must be cleaned and deduplicated");
assert.equal("inventedAmenity" in properties[0], false, "unlisted fields must not leak into the prompt");
assert.equal(properties[0].currency, "USD");

const absentAvailabilityProof = sanitizeVerifiedProperties([
  { id: "availability-no-proof", title: "Listing", availability: "available" },
])[0];
assert.equal(absentAvailabilityProof.availability, "unknown", "availability without a verification timestamp must remain unknown");

const freshAvailability = sanitizeVerifiedProperties([
  {
    id: "availability-fresh",
    title: "Fresh listing",
    availability: "available",
    factsLastVerifiedAt: new Date().toISOString(),
  },
])[0];
assert.equal(freshAvailability.availability, "available", "freshly verified availability may be used");

const staleAvailability = sanitizeVerifiedProperties([
  {
    id: "availability-stale",
    title: "Stale listing",
    availability: "available",
    factsLastVerifiedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
])[0];
assert.equal(staleAvailability.availability, "unknown", "availability older than seven days must not be stated as current");
assert.ok(
  !buildVerifiedFactTokens([staleAvailability]).some((token) => token.includes("availability=available")),
  "stale availability must not become a verified fact token",
);

const matches = matchVerifiedProperties(
  { intent: "buy", budgetMax: 100000, currency: "USD", bedroomsMin: 3, preferredAreas: ["Aden"] },
  [
    { id: "fit", title: "Fit", purpose: "sale", price: 98000, currency: "USD", bedrooms: 3, locationLabel: "Aden" },
    { id: "over-budget", title: "Over budget", purpose: "sale", price: 120000, currency: "USD", bedrooms: 4, locationLabel: "Aden" },
    { id: "unknown-currency", title: "Unknown currency", purpose: "sale", price: 50000, bedrooms: 3, locationLabel: "Aden" },
  ],
);
assert.equal(matches[0].property.id, "fit", "eligible, matching properties should rank first");
assert.equal(matches.find((match) => match.property.id === "over-budget")?.eligible, false, "known budget violations must be excluded");
assert.ok(matches.find((match) => match.property.id === "unknown-currency")?.unknowns.includes("budget_comparison_unavailable"), "unknown currency must not be treated as a budget match");

const availabilityMatches = matchVerifiedProperties(
  { intent: "buy" },
  [
    { id: "fresh-available", title: "Available home", purpose: "sale", availability: "available", factsLastVerifiedAt: new Date().toISOString() },
    { id: "fresh-unavailable", title: "Unavailable home", purpose: "sale", availability: "unavailable", factsLastVerifiedAt: new Date().toISOString() },
    { id: "unknown-status", title: "Unknown status home", purpose: "sale" },
  ],
);
assert.equal(availabilityMatches.find((m) => m.property.id === "fresh-unavailable")?.eligible, false, "verified unavailable properties must never be eligible");
assert.equal(availabilityMatches.find((m) => m.property.id === "fresh-available")?.eligible, true, "freshly verified available property may be eligible");
assert.ok(availabilityMatches.find((m) => m.property.id === "unknown-status")?.unknowns.includes("availability_unknown"), "unknown availability must be explicit");

const typeMatches = matchVerifiedProperties(
  { propertyType: "villa", dealBreakers: ["pool"] },
  [
    { id: "villa-safe", title: "Villa", propertyType: "Villa", verifiedFeatures: [] },
    { id: "flat-mismatch", title: "Apartment", propertyType: "Apartment", verifiedFeatures: [] },
    { id: "villa-pool", title: "Pool villa", propertyType: "Villa", verifiedFeatures: ["Swimming pool"] },
  ],
);
assert.equal(typeMatches.find((m) => m.property.id === "villa-safe")?.eligible, true, "requested property type should match");
assert.equal(typeMatches.find((m) => m.property.id === "flat-mismatch")?.eligible, false, "known property type mismatch must be excluded");
assert.equal(typeMatches.find((m) => m.property.id === "villa-pool")?.eligible, false, "verified deal breakers must exclude a listing");

assert.doesNotThrow(() => matchVerifiedProperties(
  { preferredAreas: "Aden" as unknown as string[] },
  [{ id: "malformed-profile", title: "Property", locationLabel: "Aden" }],
), "malformed preference input must not crash property matching");

const tokens = buildVerifiedFactTokens(properties);
assert.ok(tokens.includes("property-1: bedrooms=3"));
assert.ok(tokens.includes("property-1: feature=Balcony"));
assert.ok(!tokens.some((token) => token.includes("private pool")), "unverified amenities must never become fact tokens");

const prompt = buildPersonalizedSalesPrompt({
  customerMessage: "أريد شقة بثلاث غرف ضمن ميزانيتي",
  buyerProfile: prior,
  properties,
});

assert.match(prompt, /verified_properties/);
assert.match(prompt, /Do not invent a view/);
assert.match(prompt, /Apartment A/);
assert.doesNotMatch(prompt, /A real listing/, "free-form property descriptions must not enter model context");

assert.equal(validateSalesDraft({
  replyDraft: "توجد شقة بثلاث غرف ضمن الخيارات المتاحة.",
  factsUsed: ["property-1: bedrooms=3"],
  unknowns: [],
  nextBestAction: "send_photos",
  askOneQuestion: null,
  handoffRequired: false,
}, properties)?.nextBestAction, "send_photos");

assert.deepEqual(
  findUnsupportedNumericClaims("شقة من 3 غرف بسعر 98,000 ومساحتها 120 مترًا.", properties),
  ["120"],
  "numeric copy must not introduce a property area absent from the verified inventory",
);
assert.deepEqual(
  findUnsupportedNumericClaims("الشقة فيها ٣ غرف بسعر ٩٨٬٠٠٠ دولار.", properties),
  [],
  "Arabic digits and thousands separators should normalize to verified values",
);
assert.equal(validateSalesDraft({
  replyDraft: "هذه الشقة بسعر 90,000 دولار.",
  factsUsed: ["property-1: price=98000 USD"],
  unknowns: [],
  nextBestAction: "answer_question",
  askOneQuestion: null,
  handoffRequired: false,
}, properties), null, "unsupported numeric claims must prevent a draft from passing validation");
assert.equal(validateSalesDraft({
  replyDraft: "هذه الشقة فيها 3 غرف وسعرها 98,000 دولار.",
  factsUsed: ["property-1: bedrooms=3", "property-1: price=98000 USD"],
  unknowns: [],
  nextBestAction: "answer_question",
  askOneQuestion: null,
  handoffRequired: false,
}, properties)?.nextBestAction, "answer_question", "numbers supported by verified inventory should pass");

assert.equal(validateSalesDraft({
  replyDraft: "توجد شقة بثلاث غرف.",
  factsUsed: ["property-1: bedrooms=3"],
  unknowns: [],
  nextBestAction: "send_photos",
  askOneQuestion: null,
  handoffRequired: false,
}, properties)?.nextBestAction, "send_photos", "an exact verified fact token should pass");

assert.equal(validateSalesDraft({
  replyDraft: "توجد شقة مع مسبح خاص.",
  factsUsed: ["property-1: feature=private pool"],
  unknowns: [],
  nextBestAction: "send_photos",
  askOneQuestion: null,
  handoffRequired: false,
}, properties), null, "an invented or unknown fact citation must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد صالح شكليًا",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "answer_question",
  askOneQuestion: [],
  handoffRequired: false,
}, properties), null, "non-string question fields must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد صالح شكليًا",
  factsUsed: [],
  unknowns: [42],
  nextBestAction: "answer_question",
  askOneQuestion: null,
  handoffRequired: false,
}, properties), null, "non-string unknowns must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد صالح شكليًا",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "answer_question",
  askOneQuestion: null,
  handoffRequired: "false",
}, properties), null, "handoffRequired must be a boolean");

assert.equal(validateSalesDraft({
  replyDraft: "",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "send_photos",
  askOneQuestion: null,
  handoffRequired: false,
}, properties), null, "empty replies must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "delete_database",
  askOneQuestion: null,
  handoffRequired: false,
}, properties), null, "unsupported actions must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "ask_one_question",
  askOneQuestion: "هل تريد صورًا؟ وهل تريد معاينة؟",
  handoffRequired: false,
}, properties), null, "multiple explicit questions must be rejected");

console.log("AqarFlow sales-engine tests passed.");
