import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runtimeEnv } from "@/lib/runtime-env";
import { readBoundedUtf8Body } from "@/lib/aqarflow/http-body";
import {
  buildAllowedSalesContextNumbers,
  buildPersonalizedSalesPrompt,
  mergeBuyerProfile,
  validateSalesDraft,
  type BuyerProfile,
  type SalesDraft,
  type VerifiedProperty,
} from "@/lib/aqarflow/sales-engine";
import { generateGeminiJson } from "@/lib/aqarflow/gemini-runtime";
import { inferInventoryHints } from "@/lib/aqarflow/sales-profile-inference";
import { buildNoMatchSalesDraft } from "@/lib/aqarflow/runtime-contract";
import { rankPropertyCandidates, selectPropertiesForSalesReply } from "@/lib/aqarflow/ranked-inventory";
import { classifySalesMoment } from "@/lib/aqarflow/sales-playbook";
import { sha256Hex } from "@/lib/aqarflow/whatsapp-cloud";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const MAX_MESSAGE_CHARS = 500;
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

// These listings are fictional fixtures used only to illustrate the sales engine.
// They are never written to a workspace or sent to WhatsApp.
function getDemoInventory(): VerifiedProperty[] {
  const verifiedAt = new Date().toISOString();
  return [
    {
      id: "public-demo-rent-200",
      title: "شقة تجريبية بغرفتين — المنصورة",
      propertyType: "شقة",
      purpose: "rent",
      price: 200,
      currency: "USD",
      area: 95,
      bedrooms: 2,
      bathrooms: 1,
      locationLabel: "المنصورة، عدن",
      verifiedFeatures: ["مطبخ مجهز", "خزان ماء"],
      availability: "available",
      factsLastVerifiedAt: verifiedAt,
    },
    {
      id: "public-demo-rent-185",
      title: "شقة تجريبية بغرفتين — الشيخ عثمان",
      propertyType: "شقة",
      purpose: "rent",
      price: 185,
      currency: "USD",
      area: 88,
      bedrooms: 2,
      bathrooms: 1,
      locationLabel: "الشيخ عثمان، عدن",
      verifiedFeatures: ["موقف سيارة", "مطبخ مجهز"],
      availability: "available",
      factsLastVerifiedAt: verifiedAt,
    },
    {
      id: "public-demo-rent-215",
      title: "شقة تجريبية بغرفتين — المنصورة",
      propertyType: "شقة",
      purpose: "rent",
      price: 215,
      currency: "USD",
      area: 110,
      bedrooms: 2,
      bathrooms: 2,
      locationLabel: "المنصورة، عدن",
      verifiedFeatures: ["مصعد", "شرفة", "مكيف"],
      availability: "available",
      factsLastVerifiedAt: verifiedAt,
    },
    {
      id: "public-demo-rent-160",
      title: "شقة تجريبية بغرفة نوم — المعلا",
      propertyType: "شقة",
      purpose: "rent",
      price: 160,
      currency: "USD",
      area: 62,
      bedrooms: 1,
      bathrooms: 1,
      locationLabel: "المعلا، عدن",
      verifiedFeatures: ["مفروش", "مكيف"],
      availability: "available",
      factsLastVerifiedAt: verifiedAt,
    },
  ];
}

function demoResponse(draft: SalesDraft) {
  return NextResponse.json({
    ...draft,
    demo: true,
    demoNote: "الرد مبني على مخزون توضيحي خيالي. لا تُرسل رسائل واتساب ولا تُحفظ المحادثة.",
  }, { headers: { "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const body = await readBoundedUtf8Body(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: body.code === "too_large" ? "الطلب أطول من الحد المسموح." : "تعذر قراءة الطلب." }, {
      status: body.code === "too_large" ? 413 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let decoded: unknown;
  try { decoded = JSON.parse(body.text); }
  catch { return NextResponse.json({ error: "صيغة الطلب غير صحيحة." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }

  if (!isRecord(decoded) || typeof decoded.customerMessage !== "string" || !decoded.customerMessage.trim()) {
    return NextResponse.json({ error: "اكتب سؤالًا قصيرًا لتجربة المعاينة." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const customerMessage = decoded.customerMessage.trim().slice(0, MAX_MESSAGE_CHARS);

  // Cloudflare supplies cf-connecting-ip. The forwarded-for fallback is intended for
  // local/test hosting only; production must sit behind the configured Cloudflare edge.
  const ip = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || ip.length > 128) {
    return NextResponse.json({ error: "المعاينة الحية غير مهيأة على هذه القناة." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const salt = runtimeEnv("AQARFLOW_PUBLIC_DEMO_SALT")
    || runtimeEnv("SUPABASE_SECRET_KEY")
    || runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!salt) {
    return NextResponse.json({ error: "المعاينة الحية غير مهيأة على الخادم." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "المعاينة الحية غير متاحة حاليًا." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }

  let visitorHash: string;
  try { visitorHash = await sha256Hex(salt + "\npublic-sales-demo\n" + ip); }
  catch { return NextResponse.json({ error: "تعذر بدء المعاينة بأمان." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }

  const { data: allowed, error: quotaError } = await admin.rpc("aqarflow_consume_public_demo_quota", {
    p_visitor_key_hash: visitorHash,
  });
  if (quotaError) {
    return NextResponse.json({ error: "المعاينة الحية غير مهيأة بعد؛ يمكنك استخدام الأمثلة التوضيحية أعلاه." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: "وصلت إلى حد تجارب المعاينة مؤقتًا. يمكنك مواصلة استكشاف أمثلة المواقف أعلاه." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const inventory = getDemoInventory();
  const inventoryRows = inventory.map((property) => ({
    property_type: property.propertyType || null,
    location_label: property.locationLabel || null,
    verified_features: property.verifiedFeatures || [],
  }));
  const buyerProfile: BuyerProfile = mergeBuyerProfile({}, inferInventoryHints(customerMessage, inventoryRows));
  const moment = classifySalesMoment(customerMessage);

  // These choices demonstrate the required policy without pretending a real CRM action happened.
  if (moment === "stop_contact") {
    return demoResponse({
      replyDraft: "وصل طلبك، ونحترم رغبتك. لن أتابع بعروض أخرى.",
      factsUsed: [],
      unknowns: [],
      nextBestAction: "answer_question",
      askOneQuestion: null,
      handoffRequired: false,
    });
  }
  if (moment === "human_handoff") {
    return demoResponse({
      replyDraft: "أكيد، من حقك تتحدث مع مسؤول من المكتب. في النظام الفعلي سيحوَّل طلبك للمراجعة البشرية بدل مواصلة الإقناع الآلي.",
      factsUsed: [],
      unknowns: [],
      nextBestAction: "handoff_to_agent",
      askOneQuestion: null,
      handoffRequired: true,
    });
  }

  const ranked = rankPropertyCandidates(buyerProfile, inventory);
  const selection = selectPropertiesForSalesReply(buyerProfile, ranked);
  const selected = selection.properties;

  if (!selected.length) {
    const draft = validateSalesDraft(buildNoMatchSalesDraft(inventory.length, buyerProfile), []);
    if (!draft) return NextResponse.json({ error: "تعذر إنشاء معاينة موثوقة." }, { status: 500, headers: { "Cache-Control": "no-store" } });
    return demoResponse(draft);
  }

  const apiKey = runtimeEnv("GEMINI_API_KEY");
  if (!apiKey) {
    return NextResponse.json({ error: "المعاينة الحية غير مهيأة الآن؛ استخدم أمثلة المحادثة الجاهزة." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let promptPayload: Record<string, unknown>;
  try {
    promptPayload = JSON.parse(buildPersonalizedSalesPrompt({
      customerMessage,
      conversationSummary: "",
      buyerProfile,
      properties: selected,
      nearBudgetAlternativeMode: selection.nearBudgetAlternativeMode,
    })) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "تعذر تحضير المعاينة بأمان." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  const systemInstruction = typeof promptPayload.system === "string" ? promptPayload.system : "";
  delete promptPayload.system;

  try {
    const model = runtimeEnv("AQARFLOW_GEMINI_MODEL") || "gemini-3.5-flash-lite";
    const generated = await generateGeminiJson({
      apiKey,
      model,
      systemInstruction,
      prompt: JSON.stringify(promptPayload),
      responseSchema: OUTPUT_SCHEMA,
      maxOutputTokens: 500,
      timeoutMs: 12_000,
    });
    let draftInput: unknown = JSON.parse(generated.text);
    if (isRecord(draftInput) && (typeof draftInput.askOneQuestion !== "string" || !draftInput.askOneQuestion.trim())) {
      draftInput = { ...draftInput, askOneQuestion: null };
    }
    const validated = validateSalesDraft(draftInput, selected, buildAllowedSalesContextNumbers(buyerProfile, selected));
    if (!validated) return NextResponse.json({ error: "رفض النظام الرد لأنه لم يجتز التحقق من الحقائق. جرّب صياغة أخرى." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return demoResponse(validated);
  } catch {
    return NextResponse.json({ error: "تأخر رد المعاينة الحية؛ جرّب أحد الأمثلة الجاهزة." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
