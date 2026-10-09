import assert from "node:assert/strict";
import {
  buildPersonalizedSalesPrompt,
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
assert.deepEqual(properties[0].verifiedFeatures, ["Balcony"], "features must be cleaned and deduplicated");
assert.equal("inventedAmenity" in properties[0], false, "unlisted fields must not leak into the prompt");
assert.equal(properties[0].currency, "USD");

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
