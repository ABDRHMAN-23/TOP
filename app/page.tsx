'use client';

import { useState, type FormEvent } from 'react';
import {
  ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3, Home,
  Menu, MessageCircle, MessageSquare, MessagesSquare, Send, ShieldCheck,
  Sparkles, Target, TrendingUp, WalletCards, X, Zap,
} from 'lucide-react';

type ChatMessage = { from: 'customer' | 'office'; text: string; time: string };

const demoScenarios: Record<string, {
  label: string;
  title: string;
  objective: string;
  principle: string;
  messages: ChatMessage[];
}> = {
  budget: {
    label: 'الميزانية محدودة',
    title: 'فهم الحد الحقيقي للميزانية',
    objective: 'حماية ميزانية العميل قبل اقتراح أي بديل.',
    principle: 'يبدأ بفهم ما إذا كان المبلغ حدًا نهائيًا، ولا يعرض خيارًا أغلى على أنه مناسب.',
    messages: [
      { from: 'customer', text: 'أبحث عن شقة بغرفتين في المنصورة، وميزانيتي 200 دولار.', time: '10:42' },
      { from: 'office', text: 'تمام، خلّينا نلتزم بالـ200 دولار ونبحث على هذا الأساس. هل المنصورة شرط أساسي عندك، أو ممكن ننظر في حي قريب إذا لقينا خيارًا أنسب؟', time: '10:42' },
      { from: 'customer', text: 'ممكن حي قريب، المهم تكون نظيفة وقريبة من الخدمات.', time: '10:43' },
      { from: 'office', text: 'وصلت. بخلي غرفتين والميزانية أولويتين، وأوسّع البحث للمنطقة القريبة فقط. ما بعرض عليك خيارًا أعلى من ميزانيتك إلا إذا أنت حبيت تغيّر هذا الشرط.', time: '10:43' },
    ],
  },
  expensive: {
    label: 'السعر غالٍ',
    title: 'معالجة اعتراض السعر',
    objective: 'فهم سبب الاعتراض قبل محاولة توضيح القيمة.',
    principle: 'لا يجادل العميل ولا يدّعي أن السعر ممتاز. يحدد هل المشكلة في الميزانية أم في المقارنة.',
    messages: [
      { from: 'customer', text: 'السعر غالي بالنسبة لي.', time: '11:08' },
      { from: 'office', text: 'أتفهمك، والأهم نلقى شيء يناسبك فعلًا. هل السعر أعلى من الحد اللي حددته، أو أنك تقارنه بشقة ثانية شفتها؟', time: '11:08' },
      { from: 'customer', text: 'لقيت شقة أرخص، بس ما أعرف إذا نفس المستوى.', time: '11:09' },
      { from: 'office', text: 'خلّينا نقارن بهدوء: الموقع، المساحة، حالة الشقة، والخدمات المشمولة. إذا كان فرق السعر له سبب واضح بنبيّنه لك، وإذا الخيار الثاني أنسب لاحتياجك بقول لك بصراحة.', time: '11:09' },
    ],
  },
  competitor: {
    label: 'وجدت أرخص',
    title: 'مقارنة عادلة مع المنافس',
    objective: 'إبراز الفروق الحقيقية دون الإساءة لمكتب آخر.',
    principle: 'المقارنة تعتمد على بيانات مؤكدة، وليس وعودًا أو كلامًا عامًا عن أن عروض المكتب أفضل.',
    messages: [
      { from: 'customer', text: 'المكتب الثاني عنده شقة أرخص من عندكم.', time: '12:14' },
      { from: 'office', text: 'ممكن جدًا تلاقي أسعار مختلفة، ومن حقك تقارن. خلّينا نشوف التفاصيل المتوفرة: هل الشقة الثانية بنفس المنطقة وعدد الغرف، وهل الخدمات أو التأمين داخل السعر؟', time: '12:14' },
      { from: 'customer', text: 'ما سألت عن الخدمات للحين.', time: '12:15' },
      { from: 'office', text: 'هذه نقطة تستحق التأكد قبل المقارنة. اسأل عن المبلغ النهائي وما يشمله، وبعدها نقدر نقارن الخيارين بوضوح من غير ما تدفع زيادة على شيء ما تحتاجه.', time: '12:15' },
    ],
  },
  unavailable: {
    label: 'العقار غير متوفر',
    title: 'تحويل عدم التطابق إلى بدائل',
    objective: 'مواصلة المساعدة دون اختلاق عقار أو الضغط لتغيير الشروط.',
    principle: 'يحدد الشرط المرن الذي يسمح ببحث أفضل، ويحافظ على الشروط الأساسية والميزانية.',
    messages: [
      { from: 'customer', text: 'ما عندكم شقة بالمواصفات اللي طلبتها؟', time: '13:26' },
      { from: 'office', text: 'راجعت الخيارات المسجلة، وما ظهر لي خيار يطابق كل شروطك بثقة. بدل ما أرسل لك شيء ما يناسبك، خلّيني أبحث في حي قريب مع الحفاظ على ميزانيتك وعدد الغرف.', time: '13:26' },
      { from: 'customer', text: 'تمام، بس لا ترفعوا السعر.', time: '13:27' },
      { from: 'office', text: 'أكيد، بخلي سقف السعر كما حددته. إذا ما ظهر خيار مناسب ضمنه، بوضح لك ذلك بدل ما أضيّع وقتك بعرض غير مناسب.', time: '13:27' },
    ],
  },
};

const features = [
  { icon: Target, title: 'يفهم ما وراء السؤال', body: 'يميز بين سؤال عن السعر، واعتراض، وتردد، ومقارنة، وطلب جاهز للمعاينة. لا يستخدم الرد نفسه مع الجميع.' },
  { icon: MessageSquare, title: 'يتقن فن الاعتراضات', body: 'يتعامل مع «غالي»، و«سأفكر»، و«وجدت أرخص» عبر فهم السبب واختيار الخطوة المناسبة، لا عبر المجادلة.' },
  { icon: Home, title: 'يبحث عن البديل المناسب', body: 'إذا لم يتوفر العقار، يرجع إلى مخزون المكتب ويبحث عن خيارات قريبة مع احترام الميزانية والشروط الأساسية.' },
  { icon: ShieldCheck, title: 'يحفظ هيبة المكتب', body: 'لبق وواثق، لا يتوسل لإتمام الصفقة، ولا يرد الإساءة بالإساءة، ولا يقدم وعودًا خارج صلاحياته.' },
  { icon: WalletCards, title: 'يرتكز على بيانات المكتب', body: 'السعر والمواصفات والتوفر من سجلات العقارات، لا من تخمين النموذج أو ذاكرته العامة.' },
  { icon: TrendingUp, title: 'يتحسن بالاختبار', body: 'نقيس جودة الردود على سيناريوهات جديدة، ونحلل الأخطاء ونحسن القواعد بدل الاكتفاء بعبارة «كن خبير مبيعات».' },
];

const faqs = [
  { q: 'هل يحتاج المكتب إلى إنشاء موقع عقاري مستقل؟', a: 'لا. جوهر الخدمة هو إعداد مخزون العقارات وربطه بمساعد المبيعات ومحادثات العملاء. صفحة المكتب المستقلة ليست شرطًا للاستفادة من عقل المبيعات.' },
  { q: 'ماذا يحدث إذا لم يتوفر العقار المطلوب؟', a: 'يبحث النظام في الخيارات المسجلة عن بديل يناسب الشروط. ولا يقترح سعرًا أعلى من الميزانية الصريحة إلا ضمن مرونة أعلن عنها العميل، وبحدود واضحة. إذا لم يتوفر بديل مناسب، يقول ذلك بصراحة.' },
  { q: 'هل يستطيع منح خصومات أو حجز معاينة وحده؟', a: 'لا ينبغي له ذلك إلا عبر صلاحيات ومسارات متصلة فعلًا. لا يؤكد خصمًا أو موعدًا قبل التأكد من النظام أو موافقة المسؤول.' },
  { q: 'هل الرد التلقائي على واتساب يعمل بمجرد التسجيل؟', a: 'يحتاج إلى ربط واتساب للأعمال وإعداداته واختباره. تفعيل الرد التلقائي يجب أن يكون اختياريًا، مع احترام إيقاف التواصل والتصعيد إلى موظف.' },
  { q: 'هل هذه المحادثة المعروضة حقيقية؟', a: 'هذه معاينة تفاعلية توضيحية بمواقف وبيانات تجريبية. لا ترسل رسائل ولا تتصل بعقارات مكتبك. عند إعداد المكتب، تكون الردود مبنية على بياناته الفعلية.' },
];

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState('budget');
  const [messageInput, setMessageInput] = useState('');
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const scenario = demoScenarios[activeScenario];

  function chooseScenario(key: string) {
    setActiveScenario(key);
    setExtraMessages([]);
    setMessageInput('');
  }

  function sendDemoMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageInput.trim();
    if (!text) return;
    const normalized = text.toLowerCase();
    let reply = 'فهمت عليك. خلّيني أتأكد من احتياجك قبل ما أقترح عليك خيارًا. أهم شيء عندك الآن السعر، أو الموقع، أو مواصفات العقار؟';
    if (/غالي|سعر|ميزاني|دولار|ريال|خصم/.test(normalized)) reply = 'أتفهمك، والأهم نلقى خيارًا يناسب ميزانيتك فعلًا. هل المبلغ الذي حددته حد نهائي، أم عندك مساحة بسيطة إذا كان الفرق يقابله شيء مهم بالنسبة لك؟';
    else if (/أرخص|ارخص|منافس|مكتب ثاني|مكتب آخر/.test(normalized)) reply = 'من حقك تقارن. خلّينا نقارن المعلومات المتاحة عن الموقع والمواصفات والسعر النهائي، من غير ما نفترض أن أي خيار أفضل قبل ما نتأكد.';
    else if (/ما عندكم|غير متوفر|مش موجود|ما لقيت/.test(normalized)) reply = 'إذا ما ظهر خيار يطابق الشروط، أبحث في البدائل القريبة مع الحفاظ على الشروط الأساسية. أي شرط عندك ممكن يكون مرنًا: المنطقة أم المساحة؟';
    else if (/موظف|مسؤول|شخص حقيقي/.test(normalized)) reply = 'أكيد، أرفع طلبك إلى مسؤول المكتب حتى يتابع معك مباشرة.';
    else if (/لا ترسل|لا تتواصل|وقف الرسائل|احذف رقمي/.test(normalized)) reply = 'وصل طلبك، وسنحترم رغبتك في إيقاف الرسائل.';
    setExtraMessages((current) => [
      ...current,
      { from: 'customer', text, time: 'الآن' },
      { from: 'office', text: reply, time: 'الآن' },
    ]);
    setMessageInput('');
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
          <a className="af-brand" href="#top" aria-label="AqarFlow AI — الرئيسية">
            <span className="af-brand-mark"><MessagesSquare size={22} /></span>
            <span className="af-brand-copy"><strong>AqarFlow<span> AI</span></strong><small>REAL ESTATE SALES INTELLIGENCE</small></span>
          </a>
          <nav className={mobileOpen ? 'af-nav af-nav-open' : 'af-nav'}>
            <a href="#difference" onClick={() => setMobileOpen(false)}>لماذا AqarFlow؟</a>
            <a href="#method" onClick={() => setMobileOpen(false)}>كيف يعمل</a>
            <a href="#demo" onClick={() => setMobileOpen(false)}>جرّب المساعد</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>الأسئلة الشائعة</a>
          </nav>
          <div className="af-header-actions">
            <a className="af-login-link" href="/login">دخول المكتب</a>
            <a className="af-button af-button-dark af-header-cta" href="#demo">جرّب الآن <ArrowLeft size={16} /></a>
            <button className="af-mobile-toggle" type="button" aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'} onClick={() => setMobileOpen(!mobileOpen)}>
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
            <div className="af-eyebrow"><span className="af-eyebrow-line" /> مساعد المبيعات العقارية من AqarFlow</div>
            <h1>ليس مجرد ردّ.<br /><span>بل عقل يعرف كيف يبيع.</span></h1>
            <p className="af-hero-lead">مساعد يتعامل مع العملاء بأدب وذكاء، يفهم اعتراضاتهم، ويقترح العقار المناسب من مخزون مكتبك — ويحافظ على هيبتك في كل محادثة.</p>
            <div className="af-hero-actions">
              <a className="af-button af-button-primary" href="#demo">شاهد طريقة تفكيره <ArrowLeft size={17} /></a>
              <a className="af-button af-button-ghost" href="#method"><span className="af-play-icon">↙</span> كيف يعمل؟</a>
            </div>
            <div className="af-hero-promises">
              <span><CheckCircleMini /> لا يخترع مواصفات</span>
              <span><CheckCircleMini /> يحترم الميزانية</span>
              <span><CheckCircleMini /> لا يضغط على العميل</span>
            </div>
            <div className="af-hero-note"><ShieldCheck size={17} /><span>إقناع أخلاقي. معلومات دقيقة. سمعة أقوى للمكتب.</span></div>
          </div>

          <div className="af-product-stage" aria-label="معاينة شكل مساعد المبيعات">
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
            <div><span className="af-kicker">جرّبه بنفسك</span><h2>نفس العميل، مواقف مختلفة.<br /><span>والرد يتغيّر بذكاء.</span></h2></div>
            <p>اختر موقفًا وشاهد كيف تتغير استراتيجية المحادثة. هذه معاينة تفاعلية ببيانات تجريبية، وليست اتصالًا حيًا بواتساب أو بعقارات مكتبك.</p>
          </div>
          <div className="af-demo-layout">
            <div className="af-demo-chat">
              <div className="af-demo-chat-head">
                <div className="af-office-avatar af-office-avatar-small"><Home size={17} /></div>
                <div><b>محادثة توضيحية</b><span><i /> مثال تفاعلي</span></div>
                <span className="af-demo-menu-dot">•••</span>
              </div>
              <div className="af-scenario-pills" role="group" aria-label="اختر موقف المحادثة">
                {Object.entries(demoScenarios).map(([key, item]) => (
                  <button type="button" key={key} className={activeScenario === key ? 'af-scenario-pill active' : 'af-scenario-pill'} onClick={() => chooseScenario(key)}>{item.label}</button>
                ))}
              </div>
              <div className="af-demo-transcript" aria-live="polite">
                {scenario.messages.map((message, index) => (
                  <div className={message.from === 'customer' ? 'af-demo-message customer' : 'af-demo-message office'} key={activeScenario + '-' + index}>
                    <p>{message.text}</p><small>{message.time} {message.from === 'office' ? <CheckCheck size={12} /> : null}</small>
                  </div>
                ))}
                {extraMessages.map((message, index) => (
                  <div className={message.from === 'customer' ? 'af-demo-message customer' : 'af-demo-message office'} key={'extra-' + activeScenario + '-' + index}>
                    <p>{message.text}</p><small>{message.time} {message.from === 'office' ? <CheckCheck size={12} /> : null}</small>
                  </div>
                ))}
              </div>
              <form className="af-demo-input-row" onSubmit={sendDemoMessage}>
                <input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} aria-label="اكتب رسالة لتجربة المعاينة" placeholder="اكتب اعتراضًا أو سؤالًا للتجربة..." maxLength={240} />
                <button type="submit" aria-label="إرسال رسالة للمعاينة"><Send size={17} /></button>
              </form>
              <p className="af-demo-disclaimer"><ShieldCheck size={13} /> لا يتم إرسال رسائل حقيقية أو حفظ بيانات من هذه التجربة.</p>
            </div>
            <aside className="af-strategy-panel">
              <div className="af-strategy-eyebrow"><span className="af-strategy-dot" /> كيف يختار الرد</div>
              <h3>{scenario.title}</h3>
              <div className="af-strategy-item"><span className="af-strategy-icon"><Target size={17} /></span><div><small>هدف الرد</small><p>{scenario.objective}</p></div></div>
              <div className="af-strategy-item"><span className="af-strategy-icon"><BrainMini /></span><div><small>المبدأ المطبق</small><p>{scenario.principle}</p></div></div>
              <div className="af-strategy-boundary"><ShieldCheck size={17} /><p>يبقى السعر والتوفر والمواصفات مرتبطًا ببيانات المكتب الفعلية. لا يصنع المساعد عرضًا من خياله.</p></div>
              <button className="af-button af-button-dark af-strategy-reset" type="button" onClick={() => chooseScenario('budget')}>إعادة المثال الأساسي <ArrowLeft size={15} /></button>
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
            <p>الاحتراف لا يعني الإلحاح، والذكاء لا يعني التلاعب. المساعد الذي يمثّل مكتبك يحافظ على أسلوبه حتى عندما يكون العميل مترددًا أو غاضبًا.</p>
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
          <div className="af-faq-intro"><span className="af-kicker">أسئلة مهمة</span><h2>قبل أن تبدأ،<br /><span>هذه الصورة كاملة.</span></h2><p>نوضّح ما يفعله المساعد وما يتطلب تكاملًا أو تحققًا إضافيًا، دون وعود لا يدعمها النظام.</p><a href="#demo" className="af-text-link">اختبر المعاينة التفاعلية <ArrowLeft size={15} /></a></div>
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
          <p>ابدأ بمعاينة طريقة العمل، ثم انتقل إلى مساحة المكتب لإعداد العقارات والمساعد.</p>
          <div className="af-final-actions"><a href="#demo" className="af-button af-button-white">جرّب المحادثة <ArrowLeft size={16} /></a><a href="/login" className="af-button af-button-outline-light">دخول المكتب <ArrowUpRight size={16} /></a></div>
        </div>
      </section>

      <footer className="af-footer">
        <div className="af-wrap af-footer-main">
          <a className="af-brand af-brand-footer" href="#top"><span className="af-brand-mark"><MessagesSquare size={21} /></span><span className="af-brand-copy"><strong>AqarFlow<span> AI</span></strong><small>REAL ESTATE SALES INTELLIGENCE</small></span></a>
          <p>عقل مبيعات عقاري يساعد مكتبك على البيع باحتراف — وبأخلاق.</p>
          <div className="af-footer-links"><a href="#difference">المزايا</a><a href="#method">كيف يعمل</a><a href="#demo">المعاينة</a><a href="/login">دخول المكتب</a></div>
        </div>
        <div className="af-wrap af-footer-bottom"><span>© 2026 AqarFlow AI</span><span>الصدق أولًا. ثقة العميل دائمًا.</span></div>
      </footer>
    </main>
  );
}

function CheckCircleMini() {
  return <span className="af-mini-check"><Check size={12} /></span>;
}
function BrainMini() {
  return <Sparkles size={18} />;
}
function CalendarDaysMini() {
  return <Clock3 size={20} />;
}
