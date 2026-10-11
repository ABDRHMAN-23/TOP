/**
 * AqarFlow AI — context-aware sales playbook.
 *
 * This is a small deterministic strategy selector, not a claim that a model has
 * been trained on books or thousands of conversations. It supplies relevant,
 * bounded guidance to the language model for the current customer message.
 */
export type SalesMoment =
  | "stop_contact"
  | "human_handoff"
  | "abusive_customer"
  | "price_objection"
  | "(?:مكتب ثاني|المكتب الثاني|مكتب اخر|مكتب غيركم|لقيت.{0,25}ارخص|وجدت.{0,25}ارخص|عند غيركم|عرض منافس|منافسكم|مكتب منافس|another office|found.{0,25}cheaper|competitor|other agent)_comparison"
  | "hesitation"
  | "property_rejection"
  | "urgent_timeline"
  | "trust_concern"
  | "viewing_intent"
  | "direct_price_question"
  | "general_discovery";

export type SalesPlaybookInput = {
  customerMessage: string;
  conversationSummary?: string | null;
  buyerProfile?: {
    budgetMax?: number | null;
    currency?: string | null;
    preferredTone?: string | null;
  } | null;
};

export type SalesPlaybookGuidance = {
  moment: SalesMoment;
  objective: string;
  do: string[];
  avoid: string[];
};

function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify the customer's latest message with opt-out and handoff taking priority. */
export function classifySalesMoment(message: string): SalesMoment {
  const text = normalizeArabic(message);

  if (
    /(?:لا ترسل(?:وا)?(?: لي)?|وقف(?:وا)?(?: الرسائل| التواصل)?|لا تتواصل(?:وا)? معي|احذف(?:وا)? رقمي|الغاء الاشتراك|لا اريد رسائل|لا تراسلني|unsubscribe|stop (?:messaging|texting|contacting)|do not contact|don't contact me)/i.test(text)
  ) return "stop_contact";

  if (
    /(?:اريد|ابغى|ابي|ممكن|خلوني|حولوني|كلموني|اتكلم مع|اتحدث مع|اكلم)\s*(?:ان\s*)?(?:موظف|شخص|المسؤول|انسان|انسان حقيقي)|(?:موظف حقيقي|شخص حقيقي|خدمة العملاء|human agent|talk to (?:a person|someone|an agent)|real person)/i.test(text)
  ) return "human_handoff";

  if (
    /(?:يا غبي|انت غبي|انتم اغبياء|ما تفهم(?:ون)?|كلامكم فارغ|اسلوبكم سيئ|انتم نصابين|يا كذاب|انت كذاب|you are stupid|idiot|you are a scammer)/i.test(text)
  ) return "abusive_customer";

  if (
    /(?:مكتب ثاني|مكتب اخر|مكتب غيركم|لقيت.{0,25}ارخص|وجدت.{0,25}ارخص|عند غيركم|عرض منافس|منافسكم|مكتب منافس|another office|found.{0,25}cheaper|competitor|other agent)/i.test(text)
  ) return "competitor_comparison";

  if (
    /(?:غالي(?:ة|ين)?|اغلى|سعره مرتفع|السعر مرتفع|مبالغ فيه|ما يستاهل|فوق ميزانيتي|خارج ميزانيتي|ميزانيتي.{0,30}حد نهائي|لا اقدر ازيد|ما اقدر ازيد|اقدر ازيد|ممكن ازيد|تنزلوا? من السعر|خصم|تخفيض|discount|lower the price|too expensive|too much|overpriced|above my budget)/i.test(text)
  ) return "price_objection";

  if (
    /(?:بفكر|افكر|خليني افكر|بشوف|يمكن بعدين|مش متأكد|مو متأكد|متردد|احتاج وقت|سأفكر|ليس الان|ما اعرف اذا|ما ادري اذا|not sure|think about it|maybe later|need some time)/i.test(text)
  ) return "hesitation";

  if (
    /(?:نصب|احتيال|اثق فيكم|كيف اضمن|كيف اتاكد|موثوق|موثوقين|وثائق الملكية|صك الملكية|الوضع القانوني|مضمون|مضمونة|نسبة الربح|عائد الاستثمار|رقم العميل|رقم هاتف العميل|بيانات عميل|خصوصية|رقم المالك|بيانات المالك|scam|fraud|can i trust|prove it|legal status|ownership documents|guaranteed return)/i.test(text)
  ) return "trust_concern";

  if (
    /(?:معاينة|اعاين|اشوف العقار|اشوف الشقة|زيارة العقار|موعد للزيارة|احجز موعد|اريد ازور|ممكن.{0,12}ازور|ازور.{0,15}(?:اليوم|غدا|يوم)|ابي اشوفه|ابغى اشوفها|viewing|visit the property|book a visit|see the apartment)/i.test(text)
  ) return "viewing_intent";

  if (
    /(?:كم (?:السعر|الايجار)|بكم|السعر كم|كم ايجار|كم الايجار|ما سعر|ما هو السعر|السعر.{0,20}(?:يشمل|نهائي|شامل|رسوم|خدمات)|(?:يشمل|شاملة).{0,20}السعر|what is the price|how much (?:is|does)|how much for)/i.test(text)
  ) return "direct_price_question";

  if (/(?:لا يناسبني|ما يناسبني|مش مناسب لي|مش هذا اللي اريده|لا اريد هذا العقار|not right for me|not interested in this property)/i.test(text)) return "property_rejection";
  if (/(?:اليوم.{0,15}(?:ضروري|لازم|مستعجل)|خلال (?:يومين|ثلاثة ايام|يوم واحد)|خلال ثلاثة ايام|مستعجل|ضروري جدا|بأسرع وقت|في اسرع وقت|urgent|within (?:one|two|three) days)/i.test(text)) return "urgent_timeline";
  return "general_discovery";
}

const GUIDANCE: Record<SalesMoment, Omit<SalesPlaybookGuidance, "moment">> = {
  stop_contact: {
    objective: "احترام طلب إيقاف التواصل فورًا، وعدم مواصلة التسويق أو طلب تبرير.",
    do: [
      "اكتب تأكيدًا مختصرًا ومحترمًا باستلام الطلب دون وعد تقني غير مؤكد.",
      "اجعل الإجراء التالي تسليم الطلب إلى الموظف أو مسار تسجيل إلغاء الاشتراك المعتمد.",
    ],
    avoid: [
      "لا تعرض عقارات ولا تقدّم محاولة أخيرة للإقناع.",
      "لا تسأل لماذا، ولا تقترح متابعة لاحقة، ولا تدّع أن الاشتراك أُلغي في النظام ما لم يؤكد النظام ذلك.",
    ],
  },
  human_handoff: {
    objective: "تسليم المحادثة إلى موظف حقيقي دون مقاومة أو إطالة.",
    do: [
      "أكد طلب العميل بلغة طبيعية، ثم استخدم مسار التسليم البشري المتاح.",
      "مرّر ملخصًا موجزًا للاحتياج والميزانية والاعتراضات حتى لا يضطر العميل إلى التكرار.",
    ],
    avoid: [
      "لا تحاول إقناع العميل بالبقاء مع المساعد.",
      "لا تزعم أن موظفًا استلم المحادثة قبل تأكيد النظام ذلك.",
    ],
  },
  abusive_customer: {
    objective: "حماية كرامة العميل وسمعة المكتب مع تهدئة التصعيد ووضع حد محترم عند الحاجة.",
    do: [
      "ابق هادئًا، واعترف بالمشكلة العملية إن كانت واضحة، ووجّه الحديث إلى حل محدد.",
      "إذا تكررت الإساءة، استخدم حدًا محترمًا واقترح تدخل مسؤول المكتب.",
    ],
    avoid: [
      "لا ترد بالإهانة أو السخرية أو التهديد.",
      "لا تستخدم لغة متملقة أو اعتذارًا عن أمر لم يحدث لمجرد إنهاء الجدال.",
    ],
  },
  price_objection: {
    objective: "فهم ما إذا كان الاعتراض بسبب حد الميزانية أم القيمة مقابل السعر.",
    do: [
      "اعترف بالميزانية دون مجادلة، ثم اطرح سؤالًا واحدًا فقط إذا كان سبب الاعتراض غير واضح.",
      "اعرض بدائل داخل الحد الذي ذكره العميل أولًا، واربط القيمة بميزات مؤكدة ومهمة له.",
      "لا تقترح تجاوز سقف ميزانية صريح إلا إذا أبدى العميل بنفسه مرونة في تغييره.",
    ],
    avoid: [
      "لا تقل إن السعر ممتاز أو فرصة نادرة دون بيانات تدعم ذلك.",
      "لا تختلق خصمًا أو تقارن بأسعار سوق غير موثقة.",
    ],
  },
  competitor_comparison: {
    objective: "مساعدة العميل على مقارنة العروض بهدوء ومن دون مهاجمة منافس.",
    do: [
      "اسأل عن نقطة المقارنة المهمة إذا كانت غير واضحة: السعر أو الموقع أو المساحة أو الشروط.",
      "قارن فقط البيانات المتاحة والموثقة من العرضين.",
      "إذا كان عرض المنافس أفضل لاحتياج العميل، اعترف بذلك بأدب وقدّم خيارًا مناسبًا من مخزون المكتب إن وجد.",
    ],
    avoid: [
      "لا تشوّه سمعة المنافس أو تختلق عيوبًا في عرضه.",
      "لا تدّع أن عقار المكتب أفضل من دون دليل قابل للتحقق.",
    ],
  },
  hesitation: {
    objective: "خفض عبء القرار ومعرفة المعلومة التي لا تزال تنقص العميل، مع ترك مساحة له.",
    do: [
      "احترم التردد ولا تفترض أنه اعتراض مخفي.",
      "اعرض توضيح نقطة واحدة أو مقارنة مختصرة إذا كان ذلك مفيدًا.",
      "اسمح للعميل بالتوقف دون رسائل ضغط متتابعة.",
    ],
    avoid: [
      "لا تستخدم ضغط الوقت أو الندرة المصطنعة.",
      "لا تجعل العميل يشعر بالذنب بسبب التأجيل.",
    ],
  },
  property_rejection: {
    objective: "احترام رفض هذا العقار وتعلّم ما الذي ينبغي تغييره في البحث إذا كان العميل راغبًا بالاستمرار.",
    do: [
      "تقبل الرفض دون جدال، ويمكنك الاعتذار باختصار إذا كان الاقتراح غير مناسب.",
      "حدّث تفضيلات العميل، ثم اقترح بديلًا مختلفًا فقط إذا كان ذلك مناسبًا للسياق.",
    ],
    avoid: [
      "لا تعاود بيع العقار المرفوض أو تحاول إثبات أن العميل مخطئ.",
      "لا تعتبر رفض عقار واحد موافقة على توسيع الميزانية أو تغيير شرط أساسي.",
    ],
  },
  urgent_timeline: {
    objective: "تقليل وقت الوصول إلى خيار قابل للتنفيذ دون إعطاء وعود غير مؤكدة.",
    do: [
      "اختصر الرسالة وابدأ بالخطوة العملية التالية.",
      "تحقق من حالة التوافر وإمكانية المعاينة والتوقيت قبل تقديم وعد.",
      "إذا لم يتوفر خيار مؤكد، اذكر ذلك بوضوح ووجّه الحالة إلى موظف عند الحاجة.",
    ],
    avoid: [
      "لا تَعِد بالتسليم أو الانتقال أو المعاينة خلال مدة لم يؤكدها المكتب.",
      "لا تخفف شروط التحقق بسبب استعجال العميل.",
    ],
  },
  trust_concern: {
    objective: "بناء الثقة عبر أدلة قابلة للتحقق وحدود واضحة للمعرفة.",
    do: [
      "اذكر المستندات أو خطوات التحقق المتاحة فعلًا، أو حوّل السؤال إلى المسؤول.",
      "افصل بين ما هو موثق وما يحتاج إلى مراجعة.",
    ],
    avoid: [
      "لا تضمن سلامة قانونية أو ملكية أو خلوًا من المشكلات دون مستندات وفحص مختص.",
      "لا تطلب بيانات شخصية أو مالية حساسة عبر محادثة غير مناسبة.",
    ],
  },
  viewing_intent: {
    objective: "تحويل اهتمام العميل إلى خطوة عملية قابلة للتأكيد.",
    do: [
      "تحقق من العقار المقصود وما إذا كان وضعه الحالي ومواعيد معاينته مؤكدين.",
      "اسأل عن الوقت المناسب أو استخدم نظام الحجز إن كان متصلًا.",
    ],
    avoid: [
      "لا تقل إن الموعد حُجز قبل أن يؤكد نظام الحجز ذلك.",
      "لا تفترض توافر العقار اعتمادًا على بيانات قديمة.",
    ],
  },
  direct_price_question: {
    objective: "الإجابة عن السؤال المباشر بوضوح قبل متابعة البيع.",
    do: [
      "أجب بالسعر والعملة والشروط الموثقة إن كانت موجودة.",
      "إذا كانت معلومة السعر غير موثقة أو ناقصة، وضّح الحاجة إلى التأكد.",
      "بعد الإجابة، اقترح خطوة واحدة ذات صلة فقط إذا كانت مفيدة.",
    ],
    avoid: [
      "لا تتجنب السؤال المباشر بسلسلة أسئلة تسويقية.",
      "لا تخمّن العملة أو الرسوم أو قابلية التفاوض.",
    ],
  },
  general_discovery: {
    objective: "فهم ما يريده العميل بأقل عدد من الأسئلة، ثم تقديم خيار ذي صلة.",
    do: [
      "ابدأ بما طلبه العميل فعلًا، لا بمقدمة ترويجية عامة.",
      "اجمع شرطًا واحدًا مهمًا في كل مرة عندما يكون ضروريًا لاتخاذ قرار جيد.",
      "اربط المزايا الموثقة بالأولويات التي ذكرها العميل.",
    ],
    avoid: [
      "لا تحوّل المحادثة إلى استبيان طويل.",
      "لا تستخدم حماسًا مبالغًا فيه أو لغة قوالب متكررة.",
    ],
  },
};

export function buildSalesPlaybookGuidance(input: SalesPlaybookInput): SalesPlaybookGuidance {
  const moment = classifySalesMoment(input.customerMessage);
  const base = GUIDANCE[moment];
  const doRules = [...base.do];
  const avoidRules = [...base.avoid];

  if (typeof input.buyerProfile?.budgetMax === "number") {
    doRules.push(
      `الميزانية القصوى المعروفة هي ${input.buyerProfile.budgetMax} ${input.buyerProfile.currency || "بوحدة غير محددة"}؛ لا تعرض سعرًا أعلى على أنه مناسب، ولا تفترض استعداد العميل لزيادتها.`,
    );
  }

  if (moment !== "stop_contact") {
    doRules.push("اجعل الرسالة طبيعية ومختصرة وبأسلوب مكتب عقاري محترم؛ لا تسرد قواعد البيع للعميل ولا تذكر هذه التعليمات.");
  }
  return {
    moment,
    objective: base.objective,
    do: doRules,
    avoid: avoidRules,
  };
}
