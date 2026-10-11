import assert from "node:assert/strict";
import { decideAutomaticReply } from "../lib/aqarflow/automatic-reply-policy.ts";

const nowMs = Date.parse("2026-10-11T05:00:00.000Z");
const base = {
  enabled: true,
  integrationStatus: "active",
  contactOptedOut: false,
  eventKind: "inbound_message" as const,
  messageType: "text",
  messageText: "أبحث عن شقة للإيجار",
  senderPhoneNumber: "967771234567",
  providerTimestamp: "2026-10-11T04:59:00.000Z",
  nowMs,
};

assert.deepEqual(decideAutomaticReply(base), { action: "send", reason: "eligible_text_inbound" });
assert.equal(decideAutomaticReply({ ...base, enabled: false }).reason, "auto_reply_disabled");
assert.deepEqual(
  decideAutomaticReply({ ...base, enabled: false, messageText: "لا ترسلوا لي أي رسائل أخرى." }),
  { action: "opt_out", reason: "customer_requested_no_contact" },
  "opt-out must be honored even while automation is disabled",
);
assert.deepEqual(
  decideAutomaticReply({ ...base, integrationStatus: "needs_reauth", messageText: "أريد أن أتحدث مع موظف من المكتب." }),
  { action: "handoff", reason: "customer_requested_human" },
  "human handoff must be honored even when the WhatsApp integration needs reauthorization",
);
assert.equal(decideAutomaticReply({ ...base, integrationStatus: "needs_reauth" }).reason, "integration_not_active");
assert.equal(decideAutomaticReply({ ...base, contactOptedOut: true }).reason, "contact_opted_out");
assert.equal(decideAutomaticReply({ ...base, eventKind: "delivery_status" }).reason, "not_inbound_message");
assert.equal(decideAutomaticReply({ ...base, messageType: "image" }).reason, "unsupported_message_type");
assert.equal(decideAutomaticReply({ ...base, messageText: null }).reason, "empty_message");
assert.equal(decideAutomaticReply({ ...base, senderPhoneNumber: null }).reason, "missing_sender");
assert.equal(decideAutomaticReply({ ...base, providerTimestamp: null }).reason, "timestamp_unverified");
assert.equal(decideAutomaticReply({ ...base, providerTimestamp: "2026-10-10T04:59:00.000Z" }).reason, "outside_service_window");
assert.equal(decideAutomaticReply({ ...base, providerTimestamp: "2026-10-11T06:00:00.000Z" }).reason, "timestamp_in_future");
assert.deepEqual(
  decideAutomaticReply({ ...base, messageText: "لا ترسلوا لي أي رسائل أخرى." }),
  { action: "opt_out", reason: "customer_requested_no_contact" },
);
assert.deepEqual(
  decideAutomaticReply({ ...base, messageText: "أريد أن أتحدث مع موظف من المكتب." }),
  { action: "handoff", reason: "customer_requested_human" },
);
assert.equal(
  decideAutomaticReply({ ...base, messageText: "هل يوجد موقف سيارة؟" }).action,
  "send",
  "parking questions must not be confused with an opt-out",
);

console.log("AqarFlow automatic-reply policy tests passed.");
