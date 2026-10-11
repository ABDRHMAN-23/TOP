import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Turn = { role: "customer" | "assistant"; text: string };
type InventoryFixture = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  availability: "available" | "unavailable" | "unknown";
  factsLastVerifiedAt: string | null;
  verifiedFeatures: string[];
};
type Scenario = {
  id: string;
  category: string;
  turns: Turn[];
  latestMessage: string;
  buyerProfile: Record<string, unknown>;
  inventory: InventoryFixture[];
  expectedMoment: string;
  targetAction: string;
  goldReply: string;
  mustDo: string[];
  mustNot: string[];
};
const bank = JSON.parse(readFileSync("data/aqarflow-sales/multiturn-gold-seeds.v1.json", "utf8")) as {
  version: number;
  count: number;
  scenarios: Scenario[];
};
assert.equal(bank.version, 1);
assert.equal(bank.count, bank.scenarios.length);
assert.ok(bank.scenarios.length >= 20, "multi-turn benchmark must contain at least 20 seed examples");

const ids = new Set<string>();
const categories = new Set<string>();
for (const scenario of bank.scenarios) {
  assert.ok(scenario.id && scenario.latestMessage.trim(), "scenario ID and latest customer message are required");
  assert.ok(scenario.goldReply.trim().length >= 15, `${scenario.id}: a usable gold reply is required`);
  assert.ok(scenario.mustDo.length >= 1 && scenario.mustNot.length >= 1, `${scenario.id}: both positive and forbidden criteria are required`);
  assert.ok(Array.isArray(scenario.turns), `${scenario.id}: conversation turns are required`);
  assert.ok(scenario.turns.every((turn) => (turn.role === "customer" || turn.role === "assistant") && turn.text.trim()), `${scenario.id}: invalid conversation turn`);
  assert.ok(!ids.has(scenario.id), `duplicate scenario ID: ${scenario.id}`);
  ids.add(scenario.id);
  categories.add(scenario.category);
  for (const property of scenario.inventory) {
    assert.ok(property.id && property.title, `${scenario.id}: each inventory fixture needs an ID and title`);
    assert.ok(["available", "unavailable", "unknown"].includes(property.availability), `${scenario.id}: invalid availability enum`);
    assert.ok(Array.isArray(property.verifiedFeatures), `${scenario.id}: verifiedFeatures must be an array`);
    if (property.availability === "unknown") {
      assert.equal(property.factsLastVerifiedAt, null, `${scenario.id}: unknown availability must not carry a verification timestamp`);
    }
  }
}
assert.ok(categories.size >= 15, "the multi-turn set must span diverse sales and safety categories");

const byId = (id: string) => bank.scenarios.find((scenario) => scenario.id === id)!;
const hardBudget = byId("MT-BUDGET-HARD-01");
assert.equal(hardBudget.buyerProfile.budgetFlexibility, "hard");
assert.ok(!hardBudget.goldReply.includes("215"), "gold reply must not promote the above-cap property");
assert.ok(hardBudget.goldReply.includes("200"), "gold reply must acknowledge the hard budget");

const nearBudget = byId("MT-BUDGET-NEAR-02");
assert.ok(nearBudget.goldReply.includes("215") && nearBudget.goldReply.includes("15"), "near-budget gold reply must disclose the price and exact overage");
assert.ok(nearBudget.goldReply.includes("ما أعتبره ضمن ميزانيتك"), "near-budget gold reply must not misrepresent fit");

const optOut = byId("MT-OPTOUT-12");
assert.equal(optOut.targetAction, "opt_out");
assert.ok(!/(?:تحب تشوف|أرسل لك تفاصيل|عندنا عقار)/.test(optOut.goldReply), "opt-out reply must not contain a sales attempt");

const unknownAvailability = byId("MT-AVAILABILITY-17");
assert.equal(unknownAvailability.inventory[0].availability, "unknown");
assert.ok(/غير مؤكدة|نتأكد/.test(unknownAvailability.goldReply), "unknown availability must be disclosed");

const rejectedPool = byId("MT-DEALBREAKER-21");
assert.ok(rejectedPool.mustNot.some((rule) => rule.includes("عرض العقار ذي المسبح")), "deal-breaker scenario must forbid the conflicting property");

const human = byId("MT-HANDOFF-13");
assert.equal(human.targetAction, "handoff_to_agent");
assert.ok(human.mustDo.some((rule) => rule.includes("تسليم بشري")), "human request must require handoff");

console.log(`AqarFlow multi-turn gold seed tests passed: ${bank.scenarios.length} cases across ${categories.size} categories.`);
