import { classifySalesMoment } from "./sales-playbook.ts";

export type AutomaticReplyInput = {
  enabled: boolean;
  integrationStatus: string;
  contactOptedOut: boolean;
  eventKind: "inbound_message" | "delivery_status";
  messageType: string | null;
  messageText: string | null;
  senderPhoneNumber: string | null;
  providerTimestamp: string | null;
  nowMs?: number;
};

export type AutomaticReplyDecision =
  | { action: "send"; reason: "eligible_text_inbound" }
  | { action: "opt_out"; reason: "customer_requested_no_contact" }
  | { action: "handoff"; reason: "customer_requested_human" }
  | { action: "skip"; reason: string };

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Fail-closed gate for automatic replies. It intentionally does not generate or
 * send a message; the caller must still ground and validate the reply, check
 * WhatsApp credentials, claim an idempotency key, and verify the service window.
 */
export function decideAutomaticReply(input: AutomaticReplyInput): AutomaticReplyDecision {
  if (input.eventKind !== "inbound_message") return { action: "skip", reason: "not_inbound_message" };
  if (input.messageType !== "text") return { action: "skip", reason: "unsupported_message_type" };
  if (typeof input.messageText !== "string" || !input.messageText.trim()) {
    return { action: "skip", reason: "empty_message" };
  }
  if (!input.senderPhoneNumber) return { action: "skip", reason: "missing_sender" };

  // Honor a contact's explicit opt-out or human request even if AI automation is disabled.
  const moment = classifySalesMoment(input.messageText);
  if (moment === "stop_contact") {
    return { action: "opt_out", reason: "customer_requested_no_contact" };
  }
  if (moment === "human_handoff") {
    return { action: "handoff", reason: "customer_requested_human" };
  }

  if (input.contactOptedOut) return { action: "skip", reason: "contact_opted_out" };
  if (!input.enabled) return { action: "skip", reason: "auto_reply_disabled" };
  if (input.integrationStatus !== "active") return { action: "skip", reason: "integration_not_active" };

  const receivedAt = input.providerTimestamp ? Date.parse(input.providerTimestamp) : Number.NaN;
  const now = input.nowMs ?? Date.now();
  if (!Number.isFinite(receivedAt)) return { action: "skip", reason: "timestamp_unverified" };
  if (receivedAt > now) return { action: "skip", reason: "timestamp_in_future" };
  if (now - receivedAt >= CUSTOMER_SERVICE_WINDOW_MS) return { action: "skip", reason: "outside_service_window" };
  return { action: "send", reason: "eligible_text_inbound" };
}
