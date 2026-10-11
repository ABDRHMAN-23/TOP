'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft, ArrowUpLeft, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3, Home,
  Menu, MessageCircle, MessageSquare, MessagesSquare, Send, ShieldCheck,
  Target, TrendingUp, WalletCards, X, Zap,
} from 'lucide-react';

type ChatMessage = { from: 'customer' | 'office'; text: string; time: string; kind?: 'property'; image?: string; propertyTitle?: string; propertyMeta?: string; price?: string };

const demoScenarios: Record<string, {
  label: string;
  title: string;
  objective: string;
  principle: string;
}> = {
  budget: {
    label: 'الميزانية محدودة',
    title: 'فهم الحد الحقيقي للميزانية',
    objective: 'حماية ميزانية العميل قبل اقتراح أي بديل.',
    principle: 'يبدأ بفهم ما إذا كان المبلغ حدًا نهائيًا، ولا يعرض خيارًا أغلى على أنه مناسب.',
  },
  expensive: {
    label: 'السعر غالٍ',
    title: 'معالجة اعتراض السعر',
    objective: 'فهم سبب الاعتراض قبل محاولة توضيح القيمة.',
    principle: 'لا يجادل العميل ولا يدّعي أن السعر ممتاز. يحدد هل المشكلة في الميزانية أم في المقارنة.',
  },
  competitor: {
    label: 'وجدت أرخص',
    title: 'مقارنة عادلة مع المنافس',
    objective: 'إبراز الفروق الحقيقية دون الإساءة لمكتب آخر.',
    principle: 'المقارنة تعتمد على بيانات مؤكدة، وليس وعودًا أو كلامًا عامًا عن أن عروض المكتب أفضل.',
  },
  unavailable: {
    label: 'العقار غير متوفر',
    title: 'تحويل عدم التطابق إلى بدائل',
    objective: 'مواصلة المساعدة دون اختلاق عقار أو الضغط لتغيير الشروط.',
    principle: 'يحدد الشرط المرن الذي يسمح ببحث أفضل، ويحافظ على الشروط الأساسية والميزانية.',
  },
};

const demoConversations: Record<string, ChatMessage[]> = {
  "expensive": [
    {
      "from": "customer",
      "text": "السلام عليكم، شفت إعلان الشقة في المنصورة. ممكن التفاصيل والصور؟",
      "time": "10:42 ص"
    },
    {
      "from": "office",
      "text": "وعليكم السلام، حيّاك الله. أرسل لك معاينة توضيحية للشقة، وبعدها نراجع معًا هل تناسب احتياجك وميزانيتك.",
      "time": "10:42 ص"
    },
    {
      "from": "office",
      "text": "نموذج عقار للمعاينة — التفاصيل والأسعار هنا افتراضية لشرح تجربة المحادثة فقط.",
      "time": "10:42 ص",
      "kind": "property",
      "image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85",
      "propertyTitle": "شقة عائلية بإضاءة طبيعية",
      "propertyMeta": "غرفتان · صالة · مطبخ · حمام · مثال توضيحي",
      "price": "280 دولار شهريًا — سعر افتراضي"
    },
    {
      "from": "customer",
      "text": "الشكل جميل. كم آخر سعر؟ ميزانيتي تقريبًا 220 دولار.",
      "time": "10:44 ص"
    },
    {
      "from": "office",
      "text": "واضح، وأفضّل نكون من البداية ضمن المبلغ الذي يناسبك. المثال المعروض سعره الافتراضي 280 دولار، لذلك لا أريد أقول لك إنه مناسب لميزانيتك. هل 220 حد نهائي، أم فيه مرونة بسيطة إذا كان الفرق يستحق؟",
      "time": "10:44 ص"
    },
    {
      "from": "customer",
      "text": "لا، 280 غالي جدًا. أنا شفت شقق أرخص من كذا.",
      "time": "10:45 ص"
    },
    {
      "from": "office",
      "text": "معك حق تقارن، ومن حقك تختار الأنسب. السعر وحده ما يكفي للحكم؛ المهم نقارن عدد الغرف، حالة الشقة، الموقع، والخدمات المشمولة. ما أبغى أقنعك تدفع أكثر على شيء ما تحتاجه.",
      "time": "10:45 ص"
    },
    {
      "from": "customer",
      "text": "طيب، لكن إيش اللي يخليني أدفع الفرق؟",
      "time": "10:46 ص"
    },
    {
      "from": "office",
      "text": "في هذا المثال، الصور تبيّن مساحة المعيشة والإضاءة وتوزيع الغرف، لكنها وحدها لا تثبت جودة الصيانة أو الخدمات. الأفضل نشوف التفاصيل المؤكدة ونقارنها بخيارك الأرخص بندًا بندًا. إذا ما ظهر فرق فعلي يهمك، الأرخص قد يكون الأنسب لك.",
      "time": "10:46 ص"
    },
    {
      "from": "office",
      "text": "وهذه زاوية ثانية من نموذج العقار نفسه، لتشوف توزيع المساحة بصورة أوضح.",
      "time": "10:46 ص",
      "kind": "property",
      "image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
      "propertyTitle": "المعيشة والتوزيع الداخلي",
      "propertyMeta": "صورة توضيحية وليست توثيقًا لعقار حقيقي",
      "price": "المواصفات الفعلية تحتاج إلى تأكيد المكتب"
    },
    {
      "from": "customer",
      "text": "فهمت. أنا يهمني الهدوء والنظافة، وممكن أرفع شوي لو المكان يستاهل، بس مش 280.",
      "time": "10:48 ص"
    },
    {
      "from": "office",
      "text": "الآن وضحت الصورة: الهدوء والنظافة أهم من الكماليات، والسعر لازم يبقى قريبًا من ميزانيتك. بدل ما أضغط عليك في هذا الخيار، خلّينا نستخدم هذه الشروط للمقارنة ونستبعد أي عقار يتجاوز الحد الذي تحدده.",
      "time": "10:48 ص"
    },
    {
      "from": "customer",
      "text": "تمام، خلينا نقول 230 كحد أقصى إذا كان مناسبًا فعلًا.",
      "time": "10:49 ص"
    },
    {
      "from": "office",
      "text": "اتفقنا: غرفتان إن أمكن، مكان هادئ ونظيف، وبحد أقصى 230 دولار. في هذه المعاينة لا يوجد مخزون حقيقي أتحقق منه، لذلك لن أخترع لك شقة أو سعرًا. في الاستخدام الفعلي سيُعرض فقط ما يطابق هذه الشروط من بيانات المكتب.",
      "time": "10:49 ص"
    },
    {
      "from": "customer",
      "text": "ممتاز. إذا حصلنا على خيار مناسب، أقدر أجي أشوفه بكرة العصر.",
      "time": "10:50 ص"
    },
    {
      "from": "office",
      "text": "ممتاز، المعاينة على الطبيعة هي أفضل خطوة قبل القرار. الموعد المقترح غدًا بعد العصر، لكن المكتب يجب أن يؤكد توفر العقار والموعد أولًا. هل يناسبك بين 4 و6 مساءً إذا تأكد الموعد؟",
      "time": "10:50 ص"
    },
    {
      "from": "customer",
      "text": "نعم، بين 4 و6 مناسب. أرسلوا لي التفاصيل لما تتأكدوا.",
      "time": "10:51 ص"
    },
    {
      "from": "office",
      "text": "تم، في المثال وصلنا إلى اتفاق واضح على الميزانية والشروط وخطوة المعاينة، من دون ضغط أو وعود غير مؤكدة. في الخدمة الفعلية تُرسل التفاصيل والموعد بعد التحقق من العقار وموافقة المكتب.",
      "time": "10:51 ص"
    }
  ],
  "budget": [
    {
      "from": "customer",
      "text": "أبحث عن شقة غرفتين، لكن ميزانيتي 200 دولار فقط.",
      "time": "09:14 ص"
    },
    {
      "from": "office",
      "text": "واضح، خلّينا نحافظ على 200 دولار كحد أساسي وما نضيّع وقتك بخيارات أعلى. هل المنطقة شرط عندك، أم تقبل حيًا قريبًا إذا كان أهدأ وأنسب؟",
      "time": "09:14 ص"
    },
    {
      "from": "customer",
      "text": "ممكن حي قريب، لكن لازم غرفتين ومكان نظيف.",
      "time": "09:15 ص"
    },
    {
      "from": "office",
      "text": "تمام، إذن الشروط الأساسية: غرفتان، النظافة، وبحد أقصى 200 دولار. المنطقة فيها مرونة، لكن ما راح أعتبر السعر الأعلى مناسبًا إلا إذا قلت لي بنفسك إن عندك مجال.",
      "time": "09:15 ص"
    },
    {
      "from": "office",
      "text": "مثال بصري توضيحي لشكل بطاقة العقار التي سيستلمها العميل، وليس إعلانًا حقيقيًا.",
      "time": "09:15 ص",
      "kind": "property",
      "image": "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
      "propertyTitle": "نموذج شقة بغرفتين",
      "propertyMeta": "صور ومواصفات افتراضية للمعاينة",
      "price": "السعر الحقيقي يُعرض بعد التحقق من بيانات المكتب"
    },
    {
      "from": "customer",
      "text": "طيب وإذا ما لقيتوا شيء بـ200؟",
      "time": "09:16 ص"
    },
    {
      "from": "office",
      "text": "أقول لك بصراحة إن ما عندنا خيار مؤكد ضمن الميزانية بدل ما أرفع سقفك. بعدها نقدر نراجع حيًا قريبًا أو توقيت البحث، لكن القرار لك وما في ضغط لزيادة المبلغ.",
      "time": "09:16 ص"
    },
    {
      "from": "customer",
      "text": "هذا مناسب. خلّينا نبدأ بالمنصورة والأحياء القريبة.",
      "time": "09:17 ص"
    },
    {
      "from": "office",
      "text": "اتفقنا. عند ربط مخزون المكتب، ستظهر الخيارات المطابقة فقط، وإذا وجدنا خيارًا مناسبًا نرسل الصور والسعر المؤكد ثم نرتب معاينة بعد تأكيد التوفر.",
      "time": "09:17 ص"
    },
    {
      "from": "customer",
      "text": "تمام، أريد أشوف الصور أولًا وبعدها أحدد موعد.",
      "time": "09:18 ص"
    },
    {
      "from": "office",
      "text": "هذه خطوة ممتازة. الصور والسعر والتفاصيل تُرسل بعد التحقق من العقار الفعلي، ثم تختار إن كنت تريد معاينة. في هذه النسخة نعرض شكل التجربة فقط ولا نملك عقارات حقيقية.",
      "time": "09:18 ص"
    }
  ],
  "competitor": [
    {
      "from": "customer",
      "text": "لقيت شقة أرخص عند مكتب ثاني، ليش آخذ منكم؟",
      "time": "11:02 ص"
    },
    {
      "from": "office",
      "text": "إذا كانت تحقق احتياجك بنفس الجودة والشروط، فمن حقك تختارها. قبل ما نقارن، هل السعر الأقل يشمل نفس عدد الغرف والخدمات، وهل موقع الشقتين متقارب؟",
      "time": "11:02 ص"
    },
    {
      "from": "customer",
      "text": "مش متأكد من الخدمات، لكن الصور متشابهة.",
      "time": "11:03 ص"
    },
    {
      "from": "office",
      "text": "إذًا خلّينا ما نحكم من الصور وحدها. نقارن الإيجار، حالة الصيانة، الخدمات المشمولة، والموقع، وأي رسوم إضافية. إذا ما كان عندنا فرق حقيقي يهمك، ما راح أقول لك إن خيارنا أفضل لمجرد أنه عندنا.",
      "time": "11:03 ص"
    },
    {
      "from": "office",
      "text": "مثال لصورة عقار كما قد تظهر ضمن المحادثة؛ الصور والأسعار هنا للتوضيح فقط.",
      "time": "11:03 ص",
      "kind": "property",
      "image": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85",
      "propertyTitle": "معاينة صورة العقار",
      "propertyMeta": "مثال مرئي — لا يمثل عرضًا حقيقيًا",
      "price": "السعر والمواصفات يلزم تأكيدهما"
    },
    {
      "from": "customer",
      "text": "أنا يهمني ما تكون فيه مصاريف مخفية.",
      "time": "11:04 ص"
    },
    {
      "from": "office",
      "text": "وهذه نقطة مهمة فعلًا. قبل أي قرار، اطلب قائمة واضحة بالإيجار وأي رسوم أو خدمات إضافية، ولا تعتمد على رقم غير مكتمل. نقدر نقارن العرضين على نفس الأساس حتى تكون المقارنة عادلة.",
      "time": "11:04 ص"
    },
    {
      "from": "customer",
      "text": "لو كل شيء واضح وكان الفرق بسيط، ممكن أجي أشوفها.",
      "time": "11:05 ص"
    },
    {
      "from": "office",
      "text": "ممتاز، نخلي الخطوة التالية مقارنة مكتوبة ثم معاينة إذا ناسبتك التفاصيل. الموعد والتوفر يحتاجان تأكيد المكتب، وبعدها تقرر براحتك.",
      "time": "11:05 ص"
    }
  ],
  "unavailable": [
    {
      "from": "customer",
      "text": "أريد شقة غرفتين في المنصورة بسعر 200 دولار. عندكم؟",
      "time": "12:20 م"
    },
    {
      "from": "office",
      "text": "هذه المعاينة ليست متصلة بمخزون عقارات حقيقي، لذلك ما أقدر أؤكد التوفر الآن. لكن أقدر أوضح لك كيف نبحث: نثبت الميزانية وعدد الغرف، ثم نراجع أقرب المناطق إذا وافقت.",
      "time": "12:20 م"
    },
    {
      "from": "customer",
      "text": "الميزانية وعدد الغرف ما أقدر أغيرهم، لكن الحي ممكن.",
      "time": "12:21 م"
    },
    {
      "from": "office",
      "text": "واضح، إذن لا نغيّر الميزانية ولا عدد الغرف. نوسّع البحث جغرافيًا فقط، ونقارن الخيارات التي تثبت بياناتها ضمن 200 دولار.",
      "time": "12:21 م"
    },
    {
      "from": "office",
      "text": "مثال توضيحي لبطاقة عقار وصوره داخل المحادثة — لا يمثل عقارًا متاحًا فعليًا.",
      "time": "12:21 م",
      "kind": "property",
      "image": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
      "propertyTitle": "بديل محتمل — مثال فقط",
      "propertyMeta": "تُستبدل هذه البطاقة ببيانات المخزون الفعلي عند الربط",
      "price": "لا يوجد سعر حقيقي في هذه المعاينة"
    },
    {
      "from": "customer",
      "text": "إذا لقيتوا شيء مناسب، أريد أشوف الصور والسعر قبل ما أجي.",
      "time": "12:22 م"
    },
    {
      "from": "office",
      "text": "هذا حقك. تُرسل لك الصور والسعر والمواصفات المؤكدة أولًا، وبعد موافقتك نطلب تأكيد الموعد والتوفر. ما في داعي تزور العقار قبل ما تعرف تفاصيله الأساسية.",
      "time": "12:22 م"
    },
    {
      "from": "customer",
      "text": "تمام، كذا أفضل.",
      "time": "12:23 م"
    }
  ]
};\n\nconst features = [
  { icon: Target, title: 'يفهم ما وراء السؤال', body: 'يميز بين سؤال عن السعر، واعتراض، وتردد، ومقارنة، وطلب جاهز للمعاينة. لا يستخدم الرد نفسه مع الجميع.' },
  { icon: MessageSquare, title: 'يتقن فن الاعتراضات', body: 'يتعامل مع «غالي»، و«سأفكر»، و«وجدت أرخص» عبر فهم السبب واختيار الخطوة المناسبة، لا عبر المجادلة.' },
  { icon: Home, title: 'يبحث عن البديل المناسب', body: 'إذا لم يتوفر العقار، يرجع إلى مخزون المكتب ويبحث عن خيارات قريبة مع احترام الميزانية والشروط الأساسية.' },
  { icon: ShieldCheck, title: 'يحفظ هيبة المكتب', body: 'لبق وواثق، لا يتوسل لإتمام الصفقة، ولا يرد الإساءة بالإساءة، ولا يقدم وعودًا خارج صلاحياته.' },
  { icon: WalletCards, title: 'يرتكز على بيانات المكتب', body: 'السعر والمواصفات والتوفر تستند إلى سجلات المكتب، لا إلى افتراضات غير مؤكدة.' },
  { icon: TrendingUp, title: 'يتحسن بالاختبار', body: 'نقيس جودة الردود على سيناريوهات جديدة، ونحلل الأخطاء ونحسن القواعد بدل الاكتفاء بعبارة «كن خبير مبيعات».' },
];

const faqs = [
  { q: 'هل يحتاج المكتب إلى إنشاء موقع عقاري مستقل؟', a: 'لا. جوهر الخدمة هو إعداد مخزون العقارات وربطه بقنوات التواصل ومنظومة المبيعات. صفحة المكتب المستقلة ليست شرطًا للاستفادة من الخدمة.' },
  { q: 'ماذا يحدث إذا لم يتوفر العقار المطلوب؟', a: 'يبحث النظام في الخيارات المسجلة عن بديل يناسب الشروط. ولا يقترح سعرًا أعلى من الميزانية الصريحة إلا ضمن مرونة أعلن عنها العميل، وبحدود واضحة. إذا لم يتوفر بديل مناسب، يقول ذلك بصراحة.' },
  { q: 'هل يستطيع منح خصومات أو حجز معاينة وحده؟', a: 'لا ينبغي له ذلك إلا عبر صلاحيات ومسارات متصلة فعلًا. لا يؤكد خصمًا أو موعدًا قبل التأكد من النظام أو موافقة المسؤول.' },
  { q: 'هل الرد التلقائي على واتساب يعمل بمجرد التسجيل؟', a: 'يحتاج إلى ربط واتساب للأعمال وإعداداته واختباره. تفعيل الرد التلقائي يجب أن يكون اختياريًا، مع احترام إيقاف التواصل والتصعيد إلى موظف.' },
  { q: 'هل المعاينة ترد على رسائلي فعلًا؟', a: 'نعم، الرسائل التي تكتبها تُرسل إلى خدمة الرد المباشر لتوليد إجابة جديدة بحسب كلامك وسياق المحادثة. التجربة ليست مرتبطة بمخزون عقاري حقيقي أو بواتساب، وعند إعداد المكتب تُربط الردود ببيانات عقاراته.' }
];

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState('expensive');
  const [messageInput, setMessageInput] = useState('');
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>(demoConversations.expensive);\n  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [isSending, setIsSending] = useState(false);\n\n  useEffect(() => {\n    const transcript = transcriptRef.current;\n    if (transcript) transcript.scrollTop = transcript.scrollHeight;\n  }, [extraMessages, isSending]);
  const [sendError, setSendError] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const scenario = demoScenarios[activeScenario];

  function chooseScenario(key: string) {
    setActiveScenario(key);
    setExtraMessages(demoConversations[key] ?? demoConversations.expensive);
    setMessageInput('');
    setSendError('');
  }

  async function sendDemoMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageInput.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setSendError('');
    setMessageInput('');
    setExtraMessages((current) => [...current, { from: 'customer', text, time: 'الآن' }]);

    const history = extraMessages.slice(-10).map((message) => ({
      role: message.from === 'office' ? 'assistant' : 'user',
      content: message.text,
    }));

    try {
      const response = await fetch('/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, scenario: activeScenario }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const data = payload && typeof payload === 'object' ? payload as { reply?: unknown; error?: unknown } : {};
      if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error(typeof data.error === 'string' ? data.error : 'تعذر الرد الآن. حاول مرة أخرى.');
      }
      setExtraMessages((current) => [...current, { from: 'office', text: data.reply as string, time: 'الآن' }]);
    } catch {
      const normalized = text.toLowerCase();
      let fallback = 'أفهم قصدك. هذه معاينة توضيحية ولا تملك مخزونًا فعليًا لتأكيد عقار أو سعر أو موعد. ما أهم شرط تريد أن نحافظ عليه؟';
      if (/غالي|سعر|ميزاني|أرخص|مكلف/.test(normalized)) fallback = 'أتفهم أن السعر عامل مهم. بدل ما أضغط عليك، خلّينا نقارن السعر بالموقع والمساحة والحالة والخدمات المؤكدة، ونلتزم بالحد الذي يناسب ميزانيتك. كم الحد الأعلى الذي لا تريد تجاوزه؟';
      else if (/صور|صورة|شوف|أشوف/.test(normalized)) fallback = 'أكيد، من حقك تشوف الصور والتفاصيل قبل أي قرار. الصور الظاهرة في المثال توضيحية فقط؛ في الاستخدام الفعلي تُرسل صور العقار المسجل بعد التحقق من أنها تخصه.';
      else if (/موعد|أجي|معاين|بكرة|غد/.test(normalized)) fallback = 'المعاينة خطوة مناسبة بعد التأكد من العقار وتوفره. أقدر أوضح لك الخطوة المقترحة، لكن لا أستطيع تأكيد موعد حقيقي من هذه المعاينة؛ يجب أن يؤكده المكتب أولًا.';
      else if (/واتساب|آلي|ذكاء|روبوت/.test(normalized)) fallback = 'هذه معاينة تفاعلية توضيحية داخل الموقع وليست حساب واتساب حقيقيًا، ولا ترسل رسائل إلى مكتب أو عميل. عند ربط الخدمة الفعلية تُضبط القناة والصلاحيات قبل تفعيل الردود.';
      setExtraMessages((current) => [...current, { from: 'office', text: fallback, time: 'الآن' }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="af-site" dir="rtl">
      <div className="af-announcement">
        <div className="af-wrap af-announcement-inner">
          <span className="af-status-dot" />
          <span>مبيعات عقارية أذكى — من أول رسالة إلى المعاينة</span>
          <a href="#demo">جرّب المحادثة <ArrowLeft size={14} /></a>
        </div>
      </div>

      <header className="af-header">
        <div className="af-wrap af-header-inner">
          <a className="af-brand" href="#top" aria-label="AqarFlow — الرئيسية">
            <span className="af-brand-mark"><MessagesSquare size={22} /></span>
            <span className="af-brand-copy"><strong>AqarFlow</strong><small>REAL ESTATE SALES SYSTEM</small></span>
          </a>
          <nav id="af-site-navigation" className={mobileOpen ? 'af-nav af-nav-open' : 'af-nav'}>
            <a href="#difference" onClick={() => setMobileOpen(false)}>لماذا AqarFlow؟</a>
            <a href="#method" onClick={() => setMobileOpen(false)}>كيف يعمل</a>
            <a href="#demo" onClick={() => setMobileOpen(false)}>جرّب المحادثة</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>الأسئلة الشائعة</a>
          </nav>
          <div className="af-header-actions">
            <a className="af-login-link" href="/login">دخول المكتب</a>
            <a className="af-button af-button-dark af-header-cta" href="#demo">جرّب الآن <ArrowLeft size={16} /></a>
            <button className="af-mobile-toggle" type="button" aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={mobileOpen} aria-controls="af-site-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <section id="top" className="af-hero">
        <div className="af-hero-orb af-hero-orb-one" />
        <div className="af-hero-orb af-hero-orb-two" />
        <div className="af-wrap af-hero-grid">
          <div className="af-hero-copy">
            <div className="af-eyebrow"><span className="af-eyebrow-line" /> منظومة المبيعات العقارية</div>
            <h1>كل محادثة لها فرصة.<br /><span>حوّلها إلى خطوة بيع.</span></h1>
            <p className="af-hero-lead">منظومة مبيعات تفهم دوافع العميل، وتعالج الاعتراضات، وتحوّل المحادثات إلى خطوات بيع واضحة — مع الحفاظ على سمعة مكتبك وهيبته.</p>
            <div className="af-hero-actions">
              <a className="af-button af-button-primary" href="#demo">جرّب المحادثة بنفسك <ArrowLeft size={17} /></a>
              <a className="af-button af-button-ghost" href="#method"><span className="af-play-icon">↙</span> كيف يعمل؟</a>
            </div>
            <div className="af-hero-promises">
              <span><CheckCircleMini /> لا يخترع مواصفات</span>
              <span><CheckCircleMini /> يحترم الميزانية</span>
              <span><CheckCircleMini /> لا يضغط على العميل</span>
            </div>
            <div className="af-hero-note"><ShieldCheck size={17} /><span>إقناع أخلاقي. معلومات دقيقة. سمعة أقوى للمكتب.</span></div>
          </div>

          <div className="af-product-stage" aria-label="معاينة تجربة المبيعات">
            <div className="af-float-tag af-float-top"><span className="af-float-icon af-green"><CheckCheck size={17} /></span><span><b>يفهم الاعتراض</b><small>ولا يكرر الرد نفسه</small></span></div>
            <div className="af-chat-window">
              <div className="af-chat-window-header">
                <div className="af-office-avatar"><Home size={18} /></div>
                <div className="af-chat-heading"><b>مكتب النخبة العقاري</b><span><i /> محادثة عميل · مثال توضيحي</span></div>
                <span className="af-whatsapp-symbol"><MessageCircle size={18} /></span>
              </div>
              <div className="af-chat-context"><span>طلب إيجار</span><span>غرفتان</span><span>المنصورة</span></div>
              <div className="af-chat-messages">
                <div className="af-bubble af-bubble-customer"><p>أبغى شقة غرفتين، وميزانيتي 200 دولار.</p><small>10:42</small></div>
                <div className="af-bubble af-bubble-office"><p>تمام، خلّينا نبحث على هذا الأساس. هل المنصورة شرط أساسي، أو ممكن ننظر في حي قريب إذا لقينا خيارًا أنسب؟</p><small>10:42 <CheckCheck size={12} /></small></div>
                <div className="af-bubble af-bubble-customer"><p>ممكن حي قريب، بس لا ترفعوا السعر.</p><small>10:43</small></div>
                <div className="af-bubble af-bubble-office"><p>أكيد، بخلي الميزانية وعدد الغرف أولويتين. إذا ما لقيت خيارًا مناسبًا ضمنها، بقول لك بصراحة.</p><small>10:43 <CheckCheck size={12} /></small></div>
              </div>
              <div className="af-chat-window-footer"><ShieldCheck size={14} /><span>الميزانية محفوظة كشرط أساسي</span><span className="af-mini-lock">●</span></div>
            </div>
            <div className="af-float-tag af-float-bottom"><span className="af-float-icon af-blue"><Target size={17} /></span><span><b>الخطوة التالية</b><small>بديل مناسب — دون ضغط</small></span><ArrowUpLeft size={15} /></div>
            <div className="af-stage-caption"><span className="af-stage-caption-line" /> معاينة أسلوب المحادثة</div>
          </div>
        </div>
      </section>

      <section className="af-proof-strip" aria-label="مبادئ المنتج">
        <div className="af-wrap af-proof-grid">
          <div><span className="af-proof-icon"><BrainMini /></span><span><b>فهم سياق العميل</b><small>وليس مطابقة كلمات فقط</small></span></div>
          <div><span className="af-proof-icon"><MessagesSquare size={19} /></span><span><b>أسلوب طبيعي ومحترم</b><small>يمثل المكتب كما ينبغي</small></span></div>
          <div><span className="af-proof-icon"><Home size={19} /></span><span><b>عقارات المكتب فقط</b><small>حقائق من مصدرها</small></span></div>
          <div><span className="af-proof-icon"><ShieldCheck size={19} /></span><span><b>حدود واضحة</b><small>صدق وصلاحيات وأمان</small></span></div>
        </div>
      </section>

      <section id="difference" className="af-section af-difference">
        <div className="af-wrap">
          <div className="af-section-heading">
            <span className="af-kicker">الفارق الحقيقي</span>
            <h2>العميل لا يحتاج إلى ردّ سريع فقط.<br /><span>يحتاج إلى من يفهمه.</span></h2>
            <p>الرد التلقائي أصبح ميزة متاحة للجميع. ما نبنيه هو طريقة تفكير بيعية: تفهم الموقف، تختار الأسلوب، وتقود المحادثة إلى خطوة مفيدة دون أن تتنازل عن أخلاق المكتب.</p>
          </div>
          <div className="af-feature-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article className="af-feature-card" key={feature.title}>
                  <div className="af-feature-card-top"><span className="af-feature-icon"><Icon size={21} /></span><span className="af-feature-index">0{index + 1}</span></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                  <span className="af-feature-rule" />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="demo" className="af-section af-demo-section">
        <div className="af-wrap">
          <div className="af-demo-heading">
            <div><span className="af-kicker">جرّبه بنفسك</span><h2>نفس العميل، مواقف مختلفة.<br /><span>والرد يناسب الموقف.</span></h2></div>
            <p>اكتب سؤالك بطريقتك، وستحصل على رد طبيعي يتفاعل مع كلامك وسياق المحادثة. هذه تجربة عامة لا تتصل بمخزون مكتبك أو بواتساب.</p>
          </div>
          <div className="af-demo-layout">
            <div className="af-demo-chat">
              <div className="af-demo-chat-head">
                <div className="af-office-avatar af-office-avatar-small"><Home size={17} /></div>
                <div><b>محادثة مع مكتب عقاري</b><span><i /> متاح للتجربة</span></div>
                <span className="af-demo-menu-dot">•••</span>
              </div>
              <div className="af-scenario-pills" role="group" aria-label="اختر موقف المحادثة">
                {Object.entries(demoScenarios).map(([key, item]) => (
                  <button type="button" key={key} disabled={isSending} className={activeScenario === key ? 'af-scenario-pill active' : 'af-scenario-pill'} onClick={() => chooseScenario(key)}>{item.label}</button>
                ))}
              </div>
              <div className="af-whatsapp-date">اليوم</div>
              <div className="af-demo-transcript af-whatsapp-transcript" aria-live="polite" ref={transcriptRef}>
                {extraMessages.map((message, index) => (
                  <div className={message.from === 'customer' ? 'af-demo-message customer' : 'af-demo-message office'} key={'extra-' + activeScenario + '-' + index}>
                    {message.kind === 'property' ? (
                      <div className="af-property-attachment">
                        <img src={message.image} alt={message.propertyTitle || 'صورة عقار توضيحية'} loading="lazy" />
                        <div className="af-property-attachment-body">
                          <strong>{message.propertyTitle}</strong>
                          <span>{message.propertyMeta}</span>
                          <b>{message.price}</b>
                          <small>صور توضيحية · ليست عرضًا حقيقيًا</small>
                        </div>
                      </div>
                    ) : null}
                    <p>{message.text}</p><small>{message.time} {message.from === 'office' ? <CheckCheck size={12} /> : null}</small>
                  </div>
                ))}
                {isSending ? <div className="af-demo-message office af-typing-bubble"><span>يكتب الآن</span><i /><i /><i /></div> : null}
              </div>
              <form className="af-demo-input-row" onSubmit={sendDemoMessage}>
                <input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} aria-label="اكتب رسالة لتجربة المعاينة" placeholder={isSending ? 'لحظة...' : 'اكتب سؤالك أو اعتراضك هنا...'} maxLength={700} disabled={isSending} />
                <button type="submit" aria-label="إرسال رسالة للمعاينة" disabled={isSending || !messageInput.trim()}>{isSending ? <span className="af-demo-loading">…</span> : <Send size={17} />}</button>
              </form>
              {isSending ? <p className="af-demo-status" role="status">لحظة، نرتّب لك الرد المناسب…</p> : null}
              {sendError ? <p className="af-demo-error" role="alert">{sendError}</p> : null}
              <p className="af-demo-disclaimer"><ShieldCheck size={13} /> معاينة تفاعلية بأسلوب واتساب. الصور والأسعار أمثلة توضيحية، ولا يوجد مخزون عقاري حقيقي متصل.</p>
            </div>
            <aside className="af-strategy-panel">
              <div className="af-strategy-eyebrow"><span className="af-strategy-dot" /> أسلوب المبيعات</div>
              <h3>{scenario.title}</h3>
              <div className="af-strategy-item"><span className="af-strategy-icon"><Target size={17} /></span><div><small>هدف الرد</small><p>{scenario.objective}</p></div></div>
              <div className="af-strategy-item"><span className="af-strategy-icon"><BrainMini /></span><div><small>المبدأ المطبق</small><p>{scenario.principle}</p></div></div>
              <div className="af-strategy-boundary"><ShieldCheck size={17} /><p>تبقى الأسعار والمواصفات مرتبطة ببيانات المكتب الفعلية، ولا تُعرض معلومة غير مؤكدة على أنها حقيقة.</p></div>
              <button className="af-button af-button-dark af-strategy-reset" type="button" disabled={isSending} onClick={() => chooseScenario('expensive')}>إعادة المثال الكامل <ArrowLeft size={15} /></button>
            </aside>
          </div>
        </div>
      </section>

      <section id="method" className="af-section af-method-section">
        <div className="af-wrap">
          <div className="af-section-heading af-section-heading-centered">
            <span className="af-kicker">منهجية وليست قالبًا</span>
            <h2>من أول رسالة، إلى <span>خطوة بيع واضحة.</span></h2>
            <p>تعمل الأجزاء معًا لتقديم تجربة متماسكة، مع إبقاء الحقيقة والصلاحيات فوق أي محاولة للإقناع.</p>
          </div>
          <div className="af-method-grid">
            <div className="af-method-line" />
            <article className="af-method-card"><span className="af-method-number">01</span><span className="af-method-icon"><MessagesSquare size={21} /></span><h3>يفهم الطلب</h3><p>يقرأ رسالة العميل وسياق الحديث، ويحدد ما عرفه وما لا يزال يحتاج إلى تأكيده.</p></article>
            <article className="af-method-card"><span className="af-method-number">02</span><span className="af-method-icon"><Home size={21} /></span><h3>يطابق العقارات</h3><p>يبحث في مخزون المكتب، ويراعي الميزانية والشروط الأساسية وحالة التوفر الموثقة.</p></article>
            <article className="af-method-card"><span className="af-method-number">03</span><span className="af-method-icon"><Target size={21} /></span><h3>يختار استراتيجية</h3><p>سؤال، أو مقارنة، أو توضيح قيمة، أو بديل مناسب — حسب موقف العميل لا حسب نص محفوظ.</p></article>
            <article className="af-method-card"><span className="af-method-number">04</span><span className="af-method-icon"><CalendarDaysMini /></span><h3>يحدد الخطوة التالية</h3><p>معلومات إضافية، صور، معاينة أو تسليم لموظف؛ ولا يؤكد إجراءً قبل تأكيده فعليًا.</p></article>
          </div>
        </div>
      </section>

      <section className="af-values-section">
        <div className="af-wrap af-values-layout">
          <div className="af-values-copy">
            <span className="af-kicker af-kicker-light">هيبة المكتب ليست تفصيلًا</span>
            <h2>يقنع بثقة.<br /><span>ويحترم بلا استثناء.</span></h2>
            <p>الاحتراف لا يعني الإلحاح أو التلاعب. منظومة المبيعات تحافظ على أسلوب المكتب حتى عندما يكون العميل مترددًا أو غاضبًا.</p>
            <a href="#demo" className="af-values-link">شاهد موقفًا آخر <ArrowLeft size={16} /></a>
          </div>
          <div className="af-values-list">
            <div><span><Check size={18} /></span><div><b>لا يرد الإساءة بالإساءة</b><p>تهدئة، احترام وحدود واضحة إذا استمر التجاوز.</p></div></div>
            <div><span><Check size={18} /></span><div><b>لا يخلق استعجالًا وهميًا</b><p>لا يدّعي أن العقار سينفد أو أن هناك عرضًا خاصًا بلا دليل.</p></div></div>
            <div><span><Check size={18} /></span><div><b>لا يبيع ما لا يناسب العميل</b><p>يحترم الميزانية والرفض، ويبحث عن بديل بدل الضغط.</p></div></div>
            <div><span><Check size={18} /></span><div><b>يعرف متى يحيل إلى موظف</b><p>التفاوض خارج الصلاحيات والشكاوى الحساسة تصل إلى المسؤول.</p></div></div>
          </div>
        </div>
      </section>

      <section id="faq" className="af-section af-faq-section">
        <div className="af-wrap af-faq-layout">
          <div className="af-faq-intro"><span className="af-kicker">أسئلة مهمة</span><h2>قبل أن تبدأ،<br /><span>هذه الصورة كاملة.</span></h2><p>نوضّح ما تقدمه المنظومة وما يتطلب تكاملًا أو تحققًا إضافيًا، دون وعود لا يدعمها النظام.</p><a href="#demo" className="af-text-link">اختبر المعاينة التفاعلية <ArrowLeft size={15} /></a></div>
          <div className="af-faq-list">
            {faqs.map((faq, index) => (
              <div className={activeFaq === index ? 'af-faq-item af-faq-active' : 'af-faq-item'} key={faq.q}>
                <button type="button" aria-expanded={activeFaq === index} onClick={() => setActiveFaq(activeFaq === index ? null : index)}><span>{faq.q}</span><ChevronDown size={18} /></button>
                {activeFaq === index ? <p>{faq.a}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="af-final-cta">
        <div className="af-final-cta-glow" />
        <div className="af-wrap af-final-cta-inner">
          <span className="af-final-icon"><Zap size={22} /></span>
          <h2>اجعل كل محادثة فرصة<br /><span>لبناء ثقة وإتمام صفقة مناسبة.</span></h2>
          <p>ابدأ بمعاينة طريقة العمل، ثم انتقل إلى مساحة المكتب لإعداد العقارات وقنوات التواصل.</p>
          <div className="af-final-actions"><a href="#demo" className="af-button af-button-white">جرّب المحادثة <ArrowLeft size={16} /></a><a href="/login" className="af-button af-button-outline-light">دخول المكتب <ArrowUpRight size={16} /></a></div>
        </div>
      </section>

      <footer className="af-footer">
        <div className="af-wrap af-footer-main">
          <a className="af-brand af-brand-footer" href="#top"><span className="af-brand-mark"><MessagesSquare size={21} /></span><span className="af-brand-copy"><strong>AqarFlow</strong><small>REAL ESTATE SALES INTELLIGENCE</small></span></a>
          <p>مبيعات عقارية أكثر احترافًا، ومحادثات تبني الثقة وتقرّب العميل من القرار المناسب.</p>
          <div className="af-footer-links"><a href="#difference">المزايا</a><a href="#method">كيف يعمل</a><a href="#demo">المعاينة</a><a href="/login">دخول المكتب</a></div>
        </div>
        <div className="af-wrap af-footer-bottom"><span>© 2026 AqarFlow</span><span>الصدق أولًا. ثقة العميل دائمًا.</span></div>
      </footer>
    </main>
  );
}

function CheckCircleMini() {
  return <span className="af-mini-check"><Check size={12} /></span>;
}
function BrainMini() {
  return <MessagesSquare size={18} />;
}
function CalendarDaysMini() {
  return <Clock3 size={20} />;
}
