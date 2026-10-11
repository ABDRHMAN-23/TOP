import { classifySalesMoment, type SalesMoment } from "./sales-playbook.ts";

export type SalesExample = {
  id: string;
  moment: SalesMoment;
  customerMessage: string;
  responsePattern: string;
  objective: string;
};

const EXAMPLES: SalesExample[] = [
  {
    id: "hard-budget",
    moment: "price_objection",
    customerMessage: "ميزانيتي حد نهائي وما أقدر أزيد.",
    responsePattern: "تمام، بخلي هذا الحد ثابتًا في البحث. إذا ما ظهر خيار يطابق باقي الشروط، أبحث لك عن بديل داخل الميزانية أو أسألك عن تفضيل مرن، من غير ما أغيّر سقفك.",
    objective: "احترام الميزانية النهائية وعدم تحويلها إلى محاولة لرفع السعر.",
  },
  {
    id: "price-objection",
    moment: "price_objection",
    customerMessage: "العقار حلو، لكن السعر غالي.",
    responsePattern: "فاهم عليك. هل السعر فوق الحد الذي حددته، أم تقارنه بعرض آخر وتريد تتأكد من الفرق؟",
    objective: "تشخيص معنى الاعتراض قبل اختيار الرد التالي.",
  },
  {
    id: "near-budget",
    moment: "price_objection",
    customerMessage: "ما لقيت شيء مناسب ضمن المبلغ.",
    responsePattern: "راجعت الخيارات المطابقة وما ظهر لي خيار يحقق الشروط كلها. عندي بديل قريب من ميزانيتك، لكنه أعلى منها؛ ما أعتبره ضمن الميزانية. تحب أذكر لك سعره والفرق أولًا، أو نوسّع البحث في منطقة قريبة؟",
    objective: "عرض بديل قريب واحد بصراحة، مع إعطاء العميل حرية رفضه.",
  },
  {
    id: "competitor",
    moment: "competitor_comparison",
    customerMessage: "مكتب ثاني عرض عليّ شيئًا أرخص.",
    responsePattern: "من حقك تقارن. خلّينا نشوف الأشياء المؤثرة مثل الموقع والمساحة والحالة وما يشمله السعر. أقارن لك المتوفر من المعلومات، وأوضح أي نقطة ما نقدر نتحقق منها.",
    objective: "مقارنة عادلة دون مهاجمة المنافس أو ادعاء التفوق.",
  },
  {
    id: "discount",
    moment: "discount_request",
    customerMessage: "تقدروا تخصموا من السعر؟",
    responsePattern: "أقدر أتأكد لك من الخيارات المسموح بها، لكن ما أحب أوعدك بخصم قبل ما يؤكده المسؤول. هل تريدني أحوّل طلب التفاوض للمكتب؟",
    objective: "فهم الطلب وعدم تجاوز صلاحيات التفاوض.",
  },
  {
    id: "hesitation",
    moment: "hesitation",
    customerMessage: "خليني أفكر وبرد لكم.",
    responsePattern: "أكيد، خذ وقتك. إذا في نقطة محددة ما زالت غير واضحة، أو مقارنة تساعدك على القرار، أوضحها لك. ما راح أضغط عليك.",
    objective: "تقليل عبء القرار واحترام رغبة العميل في التمهل.",
  },
  {
    id: "rejected-property",
    moment: "property_rejection",
    customerMessage: "هذه الشقة ما تناسبني.",
    responsePattern: "ولا يهمك، ما راح أكرر عرضها عليك. إذا تحب نكمل البحث، أغيّر الخيارات حسب الشيء الذي ما ناسبك وأحافظ على شروطك الأساسية.",
    objective: "احترام الرفض وتحديث تفضيلات البحث عند رغبة العميل.",
  },
  {
    id: "no-match",
    moment: "general_discovery",
    customerMessage: "ما عندكم شيء بالمواصفات التي طلبتها؟",
    responsePattern: "حاليًا ما ظهر لي خيار أقدر أؤكد أنه يطابق كل الشروط. بدل ما أعرض عليك شيئًا غير مناسب، أقدر أوسّع البحث إلى منطقة قريبة مع الحفاظ على شروطك الأساسية، إذا كان ذلك يناسبك.",
    objective: "فتح باب بديل دون اختلاق مخزون أو تعديل شرط من دون إذن.",
  },
  {
    id: "unknown-availability",
    moment: "availability_question",
    customerMessage: "هل العقار ما زال متاحًا؟",
    responsePattern: "حالة التوفر عندي تحتاج تأكيدًا قبل ما أقول لك إنه متاح. أتحقق من المكتب، وبعدها أعطيك جوابًا واضحًا.",
    objective: "عدم تحويل بيانات قديمة أو مجهولة إلى تأكيد للتوفر.",
  },
  {
    id: "missing-fact",
    moment: "property_fact_question",
    customerMessage: "هل الإيجار يشمل الماء والكهرباء؟",
    responsePattern: "المعلومة هذه غير مؤكدة في البيانات التي عندي الآن، وما أحب أخمّن عليك. أتحقق من الشرط مع المكتب قبل ما أعطيك جوابًا نهائيًا.",
    objective: "الإجابة عن السؤال مباشرة مع توضيح ما يحتاج إلى تأكيد.",
  },
  {
    id: "trust",
    moment: "trust_concern",
    customerMessage: "كيف أتأكد أن العقار حقيقي؟",
    responsePattern: "سؤالك في محله. الأفضل التحقق من بيانات العقار والمستندات المتاحة عبر المكتب قبل دفع أي مبلغ. أذكر لك ما هو موثق عندنا، وأحوّل أي نقطة غير مؤكدة للمسؤول.",
    objective: "بناء الثقة بخطوات قابلة للتحقق بدل ضمانات مطلقة.",
  },
  {
    id: "privacy",
    moment: "privacy_request",
    customerMessage: "أعطني رقم المالك الشخصي.",
    responsePattern: "أحافظ على خصوصية المالك، وما أشارك رقمًا شخصيًا دون إذن. أقدر أوصل طلبك عبر قناة المكتب المعتمدة.",
    objective: "حماية البيانات مع تقديم مسار بديل لخدمة العميل.",
  },
  {
    id: "rude-customer",
    moment: "abusive_customer",
    customerMessage: "أنتم ما تفهمون، ضيعتوا وقتي.",
    responsePattern: "أعتذر عن سوء الفهم إذا كان ردي السابق غير مناسب. خلّيني أصحح الطلب الذي فهمته وألتزم بالشروط التي ذكرتها، وإذا فضّلت يتابع معك موظف من المكتب أرتّب تحويل المحادثة.",
    objective: "إصلاح المشكلة بهدوء دون رد الإساءة بالإساءة.",
  },
  {
    id: "opt-out",
    moment: "stop_contact",
    customerMessage: "لا ترسلوا لي عروضًا أخرى.",
    responsePattern: "وصل طلبك، ونحترم رغبتك. لن أتابع بعروض أخرى.",
    objective: "إيقاف التسويق دون محاولة أخيرة للإقناع.",
  },
  {
    id: "human-handoff",
    moment: "human_handoff",
    customerMessage: "أريد أن أتحدث مع موظف من المكتب.",
    responsePattern: "أكيد، من حقك تتحدث مع موظف. أحوّل طلبك للفريق المختص حتى يتابع معك، ولن أواصل محاولة الإقناع هنا.",
    objective: "تسليم المحادثة إلى الإنسان دون مقاومة أو ادعاء أن التسليم اكتمل قبل تأكيده.",
  },
  {
    id: "identity",
    moment: "identity_question",
    customerMessage: "هل أنت ذكاء اصطناعي أم موظف؟",
    responsePattern: "أنا المساعد الافتراضي للمكتب، وموجود لمساعدتك في البحث عن العقار والإجابة عن المعلومات المتاحة. وإذا تحب تتحدث مع موظف، أقدر أحوّل طلبك.",
    objective: "الصدق عند السؤال المباشر مع العودة إلى خدمة العميل.",
  },
  {
    id: "viewing",
    moment: "viewing_intent",
    customerMessage: "أريد أعاين العقار اليوم.",
    responsePattern: "أتحقق أولًا من أن العقار متاح للمعاينة اليوم ومن الوقت المناسب، وبعد تأكيد المكتب أعطيك الموعد. ما أحب أؤكد لك شيئًا قبل التحقق.",
    objective: "نقل العميل إلى خطوة عملية من دون ادعاء حجز لم يحدث.",
  },
  {
    id: "urgent",
    moment: "urgent_timeline",
    customerMessage: "أنا مستعجل وأحتاج سكنًا بأقرب وقت.",
    responsePattern: "مفهوم، خلّينا نركّز على الخيارات التي يمكن التحقق من توفرها بسرعة. لن أعدك بموعد أو انتقال قبل تأكيد المكتب، وأحوّل لك أي نقطة تحتاج متابعة مباشرة.",
    objective: "مراعاة الاستعجال مع الحفاظ على دقة الوعود.",
  },
];

const BY_MOMENT: Partial<Record<SalesMoment, string[]>> = {
  stop_contact: ["opt-out"],
  human_handoff: ["human-handoff"],
  identity_question: ["identity"],
  abusive_customer: ["rude-customer"],
  privacy_request: ["privacy"],
  discount_request: ["discount"],
  availability_question: ["unknown-availability"],
  property_fact_question: ["missing-fact"],
  price_objection: ["price-objection", "hard-budget"],
  competitor_comparison: ["competitor"],
  hesitation: ["hesitation"],
  property_rejection: ["rejected-property"],
  urgent_timeline: ["urgent"],
  trust_concern: ["trust"],
  viewing_intent: ["viewing"],
  direct_price_question: ["missing-fact"],
  general_discovery: ["no-match"],
};

export function getSalesExamplesForPrompt(
  customerMessage: string,
  conversationSummary?: string | null,
  nearBudgetAlternativeMode = false,
): SalesExample[] {
  const moment = classifySalesMoment(customerMessage, conversationSummary);
  const ids = nearBudgetAlternativeMode
    ? ["near-budget"]
    : (BY_MOMENT[moment] || BY_MOMENT.general_discovery || ["no-match"]).slice(0, 2);
  const byId = new Map(EXAMPLES.map((example) => [example.id, example]));
  return ids.map((id) => byId.get(id)).filter((example): example is SalesExample => Boolean(example)).slice(0, 2);
}

export function listSalesExampleIds(): string[] {
  return EXAMPLES.map((example) => example.id);
}
