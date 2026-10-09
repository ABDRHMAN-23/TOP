import assert from "node:assert/strict";
import {
  buildPersonalizedSalesPrompt,
  buildVerifiedFactTokens,
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

assert.equal(validateSalesDraft({
  replyDraft: "توجد شقة بثلاث غرف ضمن الخيارات المتاحة.",
  factsUsed: ["property-1: 3 bedrooms"],
  unknowns: [],
  nextBestAction: "send_photos",
  askOneQuestion: null,
  handoffRequired: false,
})?.nextBestAction, "send_photos");

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
}), null, "empty replies must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "delete_database",
  askOneQuestion: null,
  handoffRequired: false,
}), null, "unsupported actions must be rejected");

assert.equal(validateSalesDraft({
  replyDraft: "رد",
  factsUsed: [],
  unknowns: [],
  nextBestAction: "ask_one_question",
  askOneQuestion: "هل تريد صورًا؟ وهل تريد معاينة؟",
  handoffRequired: false,
}), null, "multiple explicit questions must be rejected");

console.log("AqarFlow sales-engine tests passed.");
