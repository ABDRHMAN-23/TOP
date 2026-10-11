import assert from "node:assert/strict";
import { inferInventoryHints } from "../lib/aqarflow/sales-profile-inference.ts";
import { inferBasicBuyerProfileHints } from "../lib/aqarflow/runtime-contract.ts";
import { mergeBuyerProfileForConversation } from "../lib/aqarflow/sales-engine.ts";

const noInventory = inferInventoryHints(
  "أبحث عن شقة للإيجار في المنصورة وميزانيتي 200 دولار",
  [],
);
assert.equal(noInventory.intent, "rent");
assert.equal(noInventory.propertyType, "شقة", "explicit property type should be kept even with empty inventory");
assert.ok(noInventory.preferredAreas?.includes("المنصورة"), "explicit area should be kept even with empty inventory");
assert.equal(noInventory.budgetMax, 200, "explicit budget should be retained");
assert.equal(noInventory.currency, "USD");
assert.equal(inferBasicBuyerProfileHints("ميزانيتي 200 دولار حد نهائي وما أقدر أزيد").budgetFlexibility, "hard");
assert.equal(inferBasicBuyerProfileHints("أقدر أزيد قليلًا إذا الموقع ممتاز").budgetFlexibility, "slight");
assert.equal(inferBasicBuyerProfileHints("ميزانيتي مرنة وأستطيع النظر في خيارات أعلى").budgetFlexibility, "flexible");

const changedPreference = inferInventoryHints("لا أريد المنصورة، أريد فيلا في خور مكسر", []);
assert.equal(changedPreference.propertyType, "فيلا");
assert.deepEqual(changedPreference.preferredAreas, ["خور مكسر"], "a rejected area should not overwrite the positively requested area");

const rejectedOnly = inferInventoryHints("ما أبغى المنصورة", []);
assert.deepEqual(rejectedOnly.preferredAreas, [], "explicitly rejected location should be cleared from current preferences");

const noStockTypeCorrection = inferInventoryHints("لا أريد شقة، أريد فيلا", []);
assert.equal(noStockTypeCorrection.propertyType, "فيلا", "the positive end of a correction should win over the rejected type");

const rejectedTypeOnly = inferInventoryHints("لا أريد شقة", []);
assert.equal(rejectedTypeOnly.propertyType, undefined, "a rejected property type must not become a positive preference");
const rejectedPreviousType = mergeBuyerProfileForConversation(
  { propertyType: "شقة", preferredAreas: ["المنصورة"] },
  rejectedTypeOnly,
  "لا أريد شقة",
);
assert.equal(rejectedPreviousType.propertyType, undefined, "rejecting the previously selected type must clear that stale preference");
const featureNegationKeepsType = inferInventoryHints("لا أريد شقة فيها مسبح", []);
assert.equal(featureNegationKeepsType.propertyType, "شقة", "a negated property feature must not erase the requested property type");
assert.ok(featureNegationKeepsType.dealBreakers?.includes("مسبح"));

const availableInventory = inferInventoryHints(
  "أريد شقة في المنصورة، مهم عندي موقف سيارة",
  [{
    property_type: "شقة",
    location_label: "المنصورة، عدن",
    verified_features: ["موقف سيارة", "مصعد"],
  }],
);
assert.equal(availableInventory.propertyType, "شقة");
assert.ok(availableInventory.preferredAreas?.includes("المنصورة"));
assert.ok(availableInventory.mustHaves?.includes("موقف سيارة"), "known required feature should be extracted");
assert.ok(!availableInventory.mustHaves?.includes("مصعد"), "unmentioned feature must not be inferred");

const excludedFeature = inferInventoryHints(
  "أريد شقة بدون مسبح",
  [{ property_type: "شقة", location_label: "المنصورة، عدن", verified_features: ["مسبح", "مصعد"] }],
);
assert.ok(excludedFeature.dealBreakers?.includes("مسبح"), "explicitly rejected feature should become a deal-breaker");

const noStockFeatures = inferInventoryHints("أريد شقة فيها موقف سيارة ومصعد", []);
assert.ok(noStockFeatures.mustHaves?.includes("موقف سيارة"), "common feature should be remembered even with empty inventory");
assert.ok(noStockFeatures.mustHaves?.includes("مصعد"), "multiple known feature preferences should be remembered");

const translatedStockFeature = inferInventoryHints(
  "أريد شقة فيها موقف سيارة",
  [{ property_type: "Apartment", location_label: "Al Mansoura", verified_features: ["Parking"] }],
);
assert.ok(translatedStockFeature.mustHaves?.includes("Parking"), "preference should use the stored inventory label when aliases differ");

const noStockDealBreaker = inferInventoryHints("أريد شقة بدون مسبح", []);
assert.ok(noStockDealBreaker.dealBreakers?.includes("مسبح"), "common deal-breakers should be retained even if inventory is empty");

const negativePropertyFeature = inferInventoryHints("لا أريد شقة فيها مسبح", []);
assert.ok(negativePropertyFeature.dealBreakers?.includes("مسبح"), "negation across a property description should be recognized");

console.log("AqarFlow buyer-profile inference tests passed.");
