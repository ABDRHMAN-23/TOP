import { createAdminClient } from "@/lib/supabase/admin";
import { runtimeEnv } from "@/lib/runtime-env";
import {
  buildPersonalizedSalesPrompt,
  mergeBuyerProfileForConversation,
  validateSalesDraft,
  type BuyerProfile,
  type SalesDraft,
  type VerifiedProperty,
} from "@/lib/aqarflow/sales-engine";
import { generateGeminiJson, GeminiRuntimeError } from "@/lib/aqarflow/gemini-runtime";
import { rankPropertyCandidates } from "@/lib/aqarflow/ranked-inventory";
import { buildNoMatchSalesDraft, normalizeBuyerProfile } from "@/lib/aqarflow/runtime-contract";
import { inferInventoryHints } from "@/lib/aqarflow/sales-profile-inference";
import { decideAutomaticReply } from "@/lib/aqarflow/automatic-reply-policy";
import {
  decryptMetaAccessToken,
  sendMetaWhatsAppText,
  sha256Hex,
  WhatsAppCloudApiError,
  type MetaWebhookEvent,
} from "@/lib/aqarflow/whatsapp-cloud";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AutoReplyIntegration = {
  id: string;
  owner_user_id: string;
  phone_number_id: string;
  graph_api_version: string;
  status: "active" | "needs_reauth" | "disconnected" | string;
  auto_reply_enabled: boolean;
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  token_expires_at: string | null;
};

export type HandleAutoReplyInput = {
  integration: AutoReplyIntegration;
  event: MetaWebhookEvent;
  contactId: string;
  conversationId: string;
  contactOptedOut: boolean;
  priorBuyerProfile: unknown;
  nowMs?: number;
};

export type HandleAutoReplyResult = {
  action: "sent" | "already_sent" | "opted_out" | "handoff" | "skipped" | "failed";
  reason: string;
};

type PropertyRow = {
  id: string;
  title: string;
  property_type: string | null;
  purpose: string | null;
  price: number | string | null;
  currency: string | null;
  area: number | string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location_label: string | null;
  verified_features: string[] | null;
  availability: "available" | "unavailable" | "unknown";
  facts_last_verified_at: string | null;
};

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    replyDraft: { type: "string" },
    factsUsed: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    nextBestAction: {
      type: "string",
      enum: ["send_photos", "compare_properties", "book_viewing", "answer_question", "ask_one_question", "handoff_to_agent"],
    },
    askOneQuestion: { type: "string" },
    handoffRequired: { type: "boolean" },
  },
  required: ["replyDraft", "factsUsed", "unknowns", "nextBestAction", "askOneQuestion", "handoffRequired"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function mapProperty(row: PropertyRow): VerifiedProperty {
  return {
    id: row.id,
    title: row.title,
    propertyType: row.property_type,
    purpose: row.purpose,
    price: numberOrNull(row.price),
    currency: row.currency,
    area: numberOrNull(row.area),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    locationLabel: row.location_label,
    verifiedFeatures: Array.isArray(row.verified_features) ? row.verified_features : [],
    availability: row.availability,
    factsLastVerifiedAt: row.facts_last_verified_at,
  };
}

async function setHandoff(admin: AdminClient, ownerId: string, conversationId: string, reason: string): Promise<HandleAutoReplyResult> {
  const { error } = await admin.from("aqarflow_crm_conversations")
    .update({ handoff_required: true, updated_at: new Date().toISOString() })
    .eq("owner_user_id", ownerId).eq("id", conversationId);
  if (error) return { action: "failed", reason: "handoff_persist_failed" };
  return { action: "handoff", reason };
}

async function recordUsage(
  admin: AdminClient,
  ownerId: string,
  requestId: string,
  values: {
    model: string;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    resultValidated: boolean;
    outcome: "success" | "invalid_output" | "provider_error";
  },
): Promise<void> {
  try {
    await admin.rpc("aqarflow_record_webhook_ai_usage", {
      p_owner_user_id: ownerId,
      p_request_id: requestId,
      p_model: values.model.slice(0, 100),
      p_latency_ms: Math.min(Math.max(Math.round(values.latencyMs), 0), 120000),
      p_input_tokens: values.inputTokens,
      p_output_tokens: values.outputTokens,
      p_result_validated: values.resultValidated,
      p_outcome: values.outcome,
    });
  } catch {
    // Usage telemetry may fail without exposing the prompt or duplicating a customer message.
  }
}

async function saveIncomingDraft(
  admin: AdminClient,
  ownerId: string,
  event: MetaWebhookEvent,
  draft: SalesDraft,
): Promise<void> {
  await admin.from("aqarflow_crm_messages")
    .update({
      ai_draft: draft.replyDraft,
      facts_used: draft.factsUsed,
      unknowns: draft.unknowns,
    })
    .eq("owner_user_id", ownerId)
    .eq("provider_message_id", event.messageId)
    .eq("direction", "inbound");
}

export async function handleWhatsAppAutomaticReply(
  admin: AdminClient,
  input: HandleAutoReplyInput,
): Promise<HandleAutoReplyResult> {
  const { integration, event } = input;
  const policy = decideAutomaticReply({
    enabled: integration.auto_reply_enabled,
    integrationStatus: integration.status,
    contactOptedOut: input.contactOptedOut,
    eventKind: event.kind,
    messageType: event.messageType,
    messageText: event.messageText,
    senderPhoneNumber: event.senderPhoneNumber,
    providerTimestamp: event.providerTimestamp,
    nowMs: input.nowMs,
  });

  if (policy.action === "opt_out") {
    const { error } = await admin.from("aqarflow_crm_contacts")
      .update({ ai_auto_reply_opted_out: true, updated_at: new Date().toISOString() })
      .eq("owner_user_id", integration.owner_user_id).eq("id", input.contactId);
    return error
      ? { action: "failed", reason: "opt_out_persist_failed" }
      : { action: "opted_out", reason: policy.reason };
  }

  if (policy.action === "handoff") {
    return setHandoff(admin, integration.owner_user_id, input.conversationId, policy.reason);
  }

  if (policy.action === "skip") {
    return { action: "skipped", reason: policy.reason };
  }
  const recipientPhoneNumber = event.senderPhoneNumber;
  if (!recipientPhoneNumber) return { action: "skipped", reason: "missing_sender" };

  const { data: conversation, error: conversationError } = await admin.from("aqarflow_crm_conversations")
    .select("buyer_profile,handoff_required,status")
    .eq("owner_user_id", integration.owner_user_id).eq("id", input.conversationId).maybeSingle();
  if (conversationError || !conversation) return { action: "failed", reason: "conversation_context_unavailable" };
  if (conversation.handoff_required) return { action: "skipped", reason: "human_handoff_already_active" };
  if (conversation.status !== "open") return { action: "skipped", reason: "conversation_not_open" };

  const text = event.messageText || "";
  const encryptionKey = runtimeEnv("META_TOKEN_ENCRYPTION_KEY");
  const apiKey = runtimeEnv("GEMINI_API_KEY");
  const model = runtimeEnv("AQARFLOW_GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!apiKey || !encryptionKey) {
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "server_configuration_missing");
  }
  if (!integration.access_token_ciphertext || !integration.access_token_iv) {
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "whatsapp_credentials_missing");
  }
  if (integration.token_expires_at && Date.parse(integration.token_expires_at) <= Date.now() + 60_000) {
    await admin.from("aqarflow_whatsapp_integrations").update({ status: "needs_reauth", updated_at: new Date().toISOString() })
      .eq("owner_user_id", integration.owner_user_id).eq("id", integration.id);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "whatsapp_credentials_expired");
  }

  const { data: rows, error: propertyError } = await admin.from("aqarflow_properties")
    .select("id,title,property_type,purpose,price,currency,area,bedrooms,bathrooms,location_label,verified_features,availability,facts_last_verified_at")
    .eq("owner_user_id", integration.owner_user_id).eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(50);
  if (propertyError) return setHandoff(admin, integration.owner_user_id, input.conversationId, "inventory_unavailable");

  const candidates = (rows || []).map((row: unknown) => mapProperty(row as PropertyRow));
  const previousProfile = normalizeBuyerProfile(conversation.buyer_profile);
  const extractedProfile = inferInventoryHints(text, (rows || []) as PropertyRow[]);
  const buyerProfile = mergeBuyerProfileForConversation(previousProfile, extractedProfile, text);

  const { error: profileError } = await admin.from("aqarflow_crm_conversations")
    .update({ buyer_profile: buyerProfile, updated_at: new Date().toISOString() })
    .eq("owner_user_id", integration.owner_user_id).eq("id", input.conversationId);
  if (profileError) return { action: "failed", reason: "buyer_profile_persist_failed" };

  const ranked = rankPropertyCandidates(buyerProfile, candidates);
  const selected = ranked.filter((match) => match.eligible).slice(0, 5).map((match) => match.property);
  let draft: SalesDraft | null = null;
  let reservationId: string | null = null;
  let usageModel = "deterministic-no-match";
  let inputTokens: number | null = 0;
  let outputTokens: number | null = 0;
  const generationStartedAt = Date.now();

  if (!selected.length) {
    draft = validateSalesDraft(buildNoMatchSalesDraft(candidates.length, buyerProfile), []);
  } else {
    const { data: reserved, error: reserveError } = await admin.rpc("aqarflow_reserve_webhook_ai_request", {
      p_owner_user_id: integration.owner_user_id,
    });
    if (reserveError || typeof reserved !== "string" || !reserved) {
      return setHandoff(admin, integration.owner_user_id, input.conversationId, "ai_quota_unavailable");
    }
    reservationId = reserved;
    usageModel = model;

    const { data: history, error: historyError } = await admin.from("aqarflow_crm_messages")
      .select("direction,message_text,provider_message_id,created_at")
      .eq("owner_user_id", integration.owner_user_id).eq("conversation_id", input.conversationId)
      .order("created_at", { ascending: false }).limit(12);
    if (historyError) {
      await recordUsage(admin, integration.owner_user_id, reservationId, {
        model, latencyMs: Date.now() - generationStartedAt, inputTokens: null, outputTokens: null,
        resultValidated: false, outcome: "provider_error",
      });
      return setHandoff(admin, integration.owner_user_id, input.conversationId, "conversation_history_unavailable");
    }
    const summary = (history || [])
      .filter((message: any) => message.provider_message_id !== event.messageId)
      .reverse()
      .map((message: any) => {
        const role = message.direction === "inbound" ? "العميل" : "المكتب";
        const body = typeof message.message_text === "string" ? message.message_text.trim() : "";
        return body ? `${role}: ${body}` : "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(-1000);

    let promptPayload: Record<string, unknown>;
    try {
      promptPayload = JSON.parse(buildPersonalizedSalesPrompt({
        customerMessage: text,
        conversationSummary: summary,
        buyerProfile,
        properties: selected,
      })) as Record<string, unknown>;
    } catch {
      await recordUsage(admin, integration.owner_user_id, reservationId, {
        model, latencyMs: Date.now() - generationStartedAt, inputTokens: null, outputTokens: null,
        resultValidated: false, outcome: "invalid_output",
      });
      return setHandoff(admin, integration.owner_user_id, input.conversationId, "prompt_construction_failed");
    }
    const systemInstruction = typeof promptPayload.system === "string" ? promptPayload.system : "";
    delete promptPayload.system;
    let generated;
    try {
      generated = await generateGeminiJson({
        apiKey,
        model,
        systemInstruction,
        prompt: JSON.stringify(promptPayload),
        responseSchema: OUTPUT_SCHEMA,
        maxOutputTokens: 650,
        timeoutMs: 18000,
      });
    } catch (error) {
      await recordUsage(admin, integration.owner_user_id, reservationId, {
        model, latencyMs: Date.now() - generationStartedAt, inputTokens: null, outputTokens: null,
        resultValidated: false, outcome: "provider_error",
      });
      if (error instanceof GeminiRuntimeError && error.code === "timeout") {
        return setHandoff(admin, integration.owner_user_id, input.conversationId, "ai_provider_timeout");
      }
      return setHandoff(admin, integration.owner_user_id, input.conversationId, "ai_provider_error");
    }
    inputTokens = generated.inputTokens;
    outputTokens = generated.outputTokens;
    try {
      const decoded: unknown = JSON.parse(generated.text);
      if (isRecord(decoded) && (typeof decoded.askOneQuestion !== "string" || !decoded.askOneQuestion.trim())) {
        decoded.askOneQuestion = null;
      }
      draft = validateSalesDraft(decoded, selected);
    } catch {
      draft = null;
    }
    await recordUsage(admin, integration.owner_user_id, reservationId, {
      model,
      latencyMs: Date.now() - generationStartedAt,
      inputTokens,
      outputTokens,
      resultValidated: Boolean(draft),
      outcome: draft ? "success" : "invalid_output",
    });
  }

  if (!draft) return setHandoff(admin, integration.owner_user_id, input.conversationId, "ai_draft_failed_validation");

  // Actions that require an external operation or a person are never claimed as completed by a text-only auto reply.
  if (draft.handoffRequired || draft.nextBestAction === "handoff_to_agent"
    || draft.nextBestAction === "book_viewing" || draft.nextBestAction === "send_photos") {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "draft_requires_human_or_external_action");
  }

  const providerAt = event.providerTimestamp ? Date.parse(event.providerTimestamp) : Number.NaN;
  if (!Number.isFinite(providerAt) || Date.now() < providerAt || Date.now() - providerAt >= 24 * 60 * 60 * 1000) {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "customer_service_window_expired");
  }

  const { data: latestConversation, error: latestConversationError } = await admin.from("aqarflow_crm_conversations")
    .select("status,handoff_required")
    .eq("owner_user_id", integration.owner_user_id).eq("id", input.conversationId).maybeSingle();
  if (latestConversationError || !latestConversation) {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return { action: "failed", reason: "conversation_state_recheck_failed" };
  }
  if (latestConversation.handoff_required) {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return { action: "skipped", reason: "human_handoff_activated_during_generation" };
  }
  if (latestConversation.status !== "open") {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return { action: "skipped", reason: "conversation_closed_during_generation" };
  }

  const idempotencyKey = "ai_reply_" + (await sha256Hex(integration.id + ":" + event.messageId + ":v1")).slice(0, 48);
  const requestHash = await sha256Hex(integration.phone_number_id + "\n" + event.senderPhoneNumber + "\n" + draft.replyDraft + "\n" + input.conversationId);
  const { data: existing, error: existingError } = await admin.from("aqarflow_whatsapp_outbound_requests")
    .select("request_hash,status,provider_message_id")
    .eq("owner_user_id", integration.owner_user_id).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingError) {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "outbound_idempotency_check_failed");
  }
  if (existing) {
    if (existing.request_hash === requestHash && existing.status === "sent" && existing.provider_message_id) {
      return { action: "already_sent", reason: "idempotent_outbound_already_sent" };
    }
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "outbound_send_needs_manual_review");
  }

  const { error: claimError } = await admin.from("aqarflow_whatsapp_outbound_requests").insert({
    owner_user_id: integration.owner_user_id,
    integration_id: integration.id,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    phone_number_id: integration.phone_number_id,
    recipient_phone_number: recipientPhoneNumber,
    status: "pending",
  });
  if (claimError) {
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "outbound_send_claim_failed");
  }

  let token: string;
  try {
    token = await decryptMetaAccessToken(integration.access_token_ciphertext, integration.access_token_iv, encryptionKey);
  } catch {
    await admin.from("aqarflow_whatsapp_outbound_requests")
      .update({ status: "failed", failure_code: "token_decryption_failed" })
      .eq("owner_user_id", integration.owner_user_id).eq("idempotency_key", idempotencyKey);
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, "token_decryption_failed");
  }

  let sent: { messageId: string };
  try {
    sent = await sendMetaWhatsAppText({
      graphApiVersion: integration.graph_api_version,
      phoneNumberId: integration.phone_number_id,
      accessToken: token,
      to: recipientPhoneNumber,
      text: draft.replyDraft,
    });
  } catch (error) {
    const knownRejection = error instanceof WhatsAppCloudApiError && error.httpStatus >= 400 && error.httpStatus < 500;
    await admin.from("aqarflow_whatsapp_outbound_requests")
      .update({ status: knownRejection ? "failed" : "unknown", failure_code: error instanceof WhatsAppCloudApiError ? error.code : "provider_error" })
      .eq("owner_user_id", integration.owner_user_id).eq("idempotency_key", idempotencyKey);
    await saveIncomingDraft(admin, integration.owner_user_id, event, draft);
    return setHandoff(admin, integration.owner_user_id, input.conversationId, knownRejection ? "whatsapp_send_rejected" : "whatsapp_send_unknown");
  }

  const sentAt = new Date().toISOString();
  const { error: sentUpdateError } = await admin.from("aqarflow_whatsapp_outbound_requests")
    .update({ status: "sent", provider_message_id: sent.messageId, sent_at: sentAt })
    .eq("owner_user_id", integration.owner_user_id).eq("idempotency_key", idempotencyKey);
  if (sentUpdateError) return setHandoff(admin, integration.owner_user_id, input.conversationId, "sent_but_outbound_state_unconfirmed");

  const { data: latestStatusRows } = await admin.from("aqarflow_whatsapp_events")
    .select("provider_status,provider_timestamp,received_at")
    .eq("owner_user_id", integration.owner_user_id).eq("provider_message_id", sent.messageId)
    .eq("event_kind", "delivery_status")
    .order("provider_timestamp", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false }).limit(1);
  const providerStatus = latestStatusRows?.[0]?.provider_status || "sent";

  const { error: messageError } = await admin.from("aqarflow_crm_messages").upsert({
    owner_user_id: integration.owner_user_id,
    conversation_id: input.conversationId,
    direction: "outbound",
    channel: "whatsapp",
    message_type: "text",
    message_text: draft.replyDraft,
    ai_draft: draft.replyDraft,
    facts_used: draft.factsUsed,
    unknowns: draft.unknowns,
    provider_message_id: sent.messageId,
    provider_status: providerStatus,
    created_at: sentAt,
    sent_at: sentAt,
  }, { onConflict: "owner_user_id,provider_message_id", ignoreDuplicates: true });
  if (messageError) return setHandoff(admin, integration.owner_user_id, input.conversationId, "sent_but_crm_persist_failed");

  const { data: conversationAfterSend, error: conversationReadError } = await admin.from("aqarflow_crm_conversations")
    .select("last_message_at")
    .eq("owner_user_id", integration.owner_user_id).eq("id", input.conversationId).maybeSingle();
  if (conversationReadError || !conversationAfterSend) {
    return { action: "failed", reason: "sent_but_conversation_state_unavailable" };
  }
  const conversationPatch: Record<string, unknown> = { updated_at: sentAt, buyer_profile: buyerProfile };
  const latestMessageAt = conversationAfterSend.last_message_at ? Date.parse(conversationAfterSend.last_message_at) : Number.NaN;
  if (!Number.isFinite(latestMessageAt) || Date.parse(sentAt) >= latestMessageAt) {
    conversationPatch.last_message_at = sentAt;
    conversationPatch.last_message_preview = draft.replyDraft.slice(0, 500);
  }
  // Never clear a handoff or reopen a conversation here: another inbound message
  // may have required a human while the provider was processing this send.
  const { error: conversationUpdateError } = await admin.from("aqarflow_crm_conversations")
    .update(conversationPatch)
    .eq("owner_user_id", integration.owner_user_id).eq("id", input.conversationId);
  if (conversationUpdateError) return { action: "failed", reason: "sent_but_conversation_update_failed" };

  const { data: confirmedStatusRows } = await admin.from("aqarflow_whatsapp_events")
    .select("provider_status,provider_timestamp,received_at")
    .eq("owner_user_id", integration.owner_user_id).eq("provider_message_id", sent.messageId)
    .eq("event_kind", "delivery_status")
    .order("provider_timestamp", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false }).limit(1);
  const confirmedStatus = confirmedStatusRows?.[0]?.provider_status;
  if (confirmedStatus && confirmedStatus !== providerStatus) {
    await admin.from("aqarflow_whatsapp_outbound_requests").update({ provider_status: confirmedStatus })
      .eq("owner_user_id", integration.owner_user_id).eq("provider_message_id", sent.messageId);
    await admin.from("aqarflow_crm_messages").update({ provider_status: confirmedStatus })
      .eq("owner_user_id", integration.owner_user_id).eq("provider_message_id", sent.messageId);
  }

  return { action: "sent", reason: "validated_auto_reply_sent" };
}
