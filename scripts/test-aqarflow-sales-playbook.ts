import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSalesPlaybookGuidance, classifySalesMoment } from "../lib/aqarflow/sales-playbook.ts";

type Scenario = {
  id: string;
  category: string;
  customerMessage: string;
  expectedMoment: string;
  objective: string;
  mustNot: string[];
};

const bank = JSON.parse(readFileSync("data/aqarflow-sales/scenarios.v1.json", "utf8")) as {
  version: number;
  count: number;
  scenarios: Scenario[];
};

assert.equal(bank.version, 1, "scenario bank must have a version");
assert.equal(bank.count, bank.scenarios.length, "declared scenario count must match contents");
assert.ok(bank.scenarios.length >= 40, "seed bank should contain at least 40 seed cases");

const ids = new Set<string>();
const messages = new Set<string>();
const categories = new Set<string>();

for (const scenario of bank.scenarios) {
  assert.ok(scenario.id && scenario.customerMessage.trim(), "every scenario needs an ID and customer message");
  assert.ok(scenario.objective.trim(), `${scenario.id}: objective is required`);
  assert.ok(Array.isArray(scenario.mustNot) && scenario.mustNot.length > 0, `${scenario.id}: forbidden behaviors are required`);
  assert.ok(!ids.has(scenario.id), `duplicate scenario ID: ${scenario.id}`);
  assert.ok(!messages.has(scenario.customerMessage), `duplicate scenario message: ${scenario.id}`);
  ids.add(scenario.id);
  messages.add(scenario.customerMessage);
  categories.add(scenario.category);
  const actual = classifySalesMoment(scenario.customerMessage);
  assert.equal(actual, scenario.expectedMoment, `${scenario.id}: expected ${scenario.expectedMoment}, received ${actual}`);
}

assert.ok(categories.size >= 15, "scenario bank must cover at least 15 distinct sales situations");

const price = buildSalesPlaybookGuidance({
  customerMessage: "ميزانيتي 200 دولار حد نهائي، ما أقدر أزيد.",
  buyerProfile: { budgetMax: 200, currency: "USD" },
});
assert.equal(price.moment, "price_objection");
assert.ok(price.do.some((line) => line.includes("200 USD")), "hard budget must be added to contextual guidance");
assert.ok(price.avoid.some((line) => line.includes("خصم")), "price guidance must forbid invented discounts");
assert.ok(price.do.some((line) => line.includes("حد صارم")), "an explicitly final budget must be treated as a hard ceiling even if profile inference is missing");
assert.ok(!price.do.some((line) => line.includes("كاقتراح اختياري")), "a hard budget must not receive an over-budget alternative");
const unspecifiedBudget = buildSalesPlaybookGuidance({
  customerMessage: "ميزانيتي 200 دولار وأبحث عن شقة مناسبة.",
  buyerProfile: { budgetMax: 200, currency: "USD" },
});
assert.ok(unspecifiedBudget.do.some((line) => line.includes("220 USD")), "an unspecified budget may receive one capped near-budget fallback after exact matches fail");
assert.ok(unspecifiedBudget.do.some((line) => line.includes("لا بوصفه ضمن الميزانية")), "the alternative must not be misrepresented as within budget");
const broadFlexBudget = buildSalesPlaybookGuidance({
  customerMessage: "ميزانيتي مرنة وأستطيع النظر في خيارات أعلى.",
  buyerProfile: { budgetMax: 200, currency: "USD" },
});
assert.ok(broadFlexBudget.do.some((line) => line.includes("240 USD")), "broad flexibility should use the configured 20% maximum");
const flexiblePrice = buildSalesPlaybookGuidance({
  customerMessage: "أقدر أزيد قليلًا إذا كان الموقع فعلًا يستاهل.",
  buyerProfile: { budgetMax: 200, currency: "USD", budgetFlexibility: "slight" },
});
assert.ok(flexiblePrice.do.some((line) => line.includes("220 USD")), "slight flexibility should be explicitly capped at 10% over target");
assert.ok(flexiblePrice.do.some((line) => line.includes("أعلى من الميزانية المرجعية")), "the assistant must disclose an above-target alternative");

const optOut = buildSalesPlaybookGuidance({ customerMessage: "لا ترسلوا لي أي رسائل أخرى." });
assert.equal(optOut.moment, "stop_contact");
assert.ok(optOut.avoid.some((line) => line.includes("لا تعرض عقارات")), "opt-out must stop persuasion");

const competitor = buildSalesPlaybookGuidance({ customerMessage: "لقيت شقة أرخص عند مكتب ثاني." });
assert.equal(competitor.moment, "competitor_comparison");
assert.ok(competitor.avoid.some((line) => line.includes("تشوّه سمعة المنافس")), "competitor handling must forbid attacks");

const urgent = buildSalesPlaybookGuidance({ customerMessage: "أحتاج بيتًا اليوم، الأمر ضروري." });
assert.equal(urgent.moment, "urgent_timeline");
assert.ok(urgent.avoid.some((line) => line.includes("لا تَعِد")), "urgent requests must not create unverified promises");

const rejection = buildSalesPlaybookGuidance({ customerMessage: "لا، هذا العقار لا يناسبني." });
assert.equal(rejection.moment, "property_rejection");
assert.ok(rejection.avoid.some((line) => line.includes("العقار المرفوض")), "rejected listing must not be pushed again");

console.log(`AqarFlow sales-playbook tests passed: ${bank.scenarios.length} scenarios across ${categories.size} categories.`);
