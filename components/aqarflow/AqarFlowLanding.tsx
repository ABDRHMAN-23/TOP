'use client';

import { useState } from 'react';
import {
  ArrowLeft, ArrowDown, BadgeCheck, BrainCircuit, Check, ChevronDown,
  Handshake, HeartHandshake, House, MessageCircle, MessageSquareText, ShieldCheck,
  Sparkles, Target, UserRound, Wallet, Menu, X, RefreshCw, Bot,
} from 'lucide-react';

type DemoTurn = { role: 'customer' | 'assistant'; text: string };
type DemoScenario = {
  id: string;
  label: string;
  kicker: string;
  description: string;
  turns: DemoTurn[];
  outcome: string;
};
const scenarios: DemoScenario[] = [
  {
    id: 'budget',
    label: 'ميزانية محددة',
    kicker: 'احترام الميزانية',
    description: 'لا يدفع العميل إلى عقار أغلى عندما يقول إن ميزانيته حد نهائي.',
    turns: [
      { role: 'customer', text: 'أدور شقة غرفتين في المنصورة، وميزانيتي 200 دولار حد نهائي.' },
      { role: 'assistant', text: 'تمام، بخلي الـ200 دولار سقف ثابت في البحث. ما بعرض عليك سعر أعلى على أنه مناسب. إذا ما لقيت تطابق، أشوف لك خيارًا في حي قريب بنفس الميزانية إذا كان يناسبك.' },
      { role: 'customer', text: 'طيب، وإذا ما في شيء؟' },
      { role: 'assistant', text: 'بقول لك بصراحة إذا ما ظهر خيار يطابق الشروط. بعدها نقدر نراجع تفضيلًا مرنًا—مثل الحي أو التأثيث—من غير ما نغيّر حد الميزانية.' },
    ],
    outcome: 'حافظ على السقف، وفتح باب البدائل من غير ضغط أو إخفاء فرق السعر.',
  },
  {
    id: 'price',
    label: 'اعتراض على السعر',
    kicker: 'تشخيص الاعتراض',
    description: 'لا يرد بعبارات تسويقية محفوظة؛ يفهم أولًا ماذا يعني «غالي».',
    turns: [
      { role: 'customer', text: 'الشقة حلوة، بس سعرها غالي.' },
      { role: 'assistant', text: 'فاهم عليك. بس عشان أساعدك صح: السعر فوق الحد اللي حاطه لنفسك، أو تقارنها بشقة ثانية قريبة بالمواصفات؟' },
      { role: 'customer', text: 'لقيت وحدة أرخص، بس ما أعرف إذا نفس المستوى.' },
      { role: 'assistant', text: 'خلّينا نقارن الأشياء اللي تفرق فعلًا: الموقع، المساحة، حالة الشقة، والخدمات المشمولة. أرسل لي التفاصيل المتوفرة عندك، وبوضح لك الفروق المؤكدة من غير ما أقلّل من عرض المكتب الثاني.' },
    ],
    outcome: 'سؤال تشخيصي واحد ثم مقارنة عادلة، بدل المجادلة أو مدح السعر بلا دليل.',
  },
  {
    id: 'competitor',
    label: 'عرض منافس',
    kicker: 'مقارنة بلا هجوم',
    description: 'يحافظ على ثقة العميل ولا يختلق عيوبًا في عرض مكتب آخر.',
    turns: [
      { role: 'customer', text: 'مكتب ثاني عرض عليّ شقة أرخص من عندكم.' },
      { role: 'assistant', text: 'من حقك تقارن، والأهم تختار اللي يناسبك. هل عندك تفاصيل المساحة والمنطقة وما يشمله السعر؟ أقدر أقارنها بالبيانات الموجودة عندنا نقطة بنقطة.' },
      { role: 'customer', text: 'ما معي كل التفاصيل.' },
      { role: 'assistant', text: 'ولا يهمك. نقارن المتوفر الآن، ونخلّي أي نقطة ناقصة واضحة بدل ما نخمن. وإذا عرضهم أنسب فعلًا لاحتياجك، الأفضل تكون الصورة واضحة لك قبل القرار.' },
    ],
    outcome: 'يكسب المصداقية بالمعلومة، لا بتشويه المنافس.',
  },
  {
    id: 'alternative',
    label: 'لا يوجد تطابق',
    kicker: 'بدائل ذكية',
    description: 'يبحث عن بديل قريب ويشرح الاختلاف بدل إنهاء المحادثة أو دفع عقار غير مناسب.',
    turns: [
      { role: 'customer', text: 'أريد شقة غرفتين في المنصورة، بحدود 200 دولار.' },
      { role: 'assistant', text: 'راجعت الخيارات المسجلة في هذه المعاينة، وما ظهر خيار أقدر أؤكد أنه يطابق كل الشروط. ما أبغى أضيّع وقتك بعقار ما يناسبك.' },
      { role: 'customer', text: 'وش الحل؟' },
      { role: 'assistant', text: 'نقدر نجرّب حيًا قريبًا ونحافظ على الميزانية، أو نراجع تفضيلًا ثانيًا إذا عندك مرونة. أي شرط عندك أساسي وما تحب تتنازل عنه؟' },
    ],
    outcome: 'يحافظ على شروط العميل الأساسية ويطلب الإذن قبل توسيع البحث.',
  },
  {
    id: 'respect',
    label: 'عميل غاضب',
    kicker: 'أدب وهيبة',
    description: 'يحافظ على احترام المكتب حتى عندما تكون لهجة العميل حادة.',
    turns: [
      { role: 'customer', text: 'أنتم ما تفهمون! قلت شقة مش محل.' },
      { role: 'assistant', text: 'معك حق، صار سوء فهم في الطلب وأعتذر عن تضييع وقتك. المطلوب شقة، مش محل. أرجع أضبط البحث على الشقق فقط وألتزم بباقي شروطك.' },
      { role: 'customer', text: 'لا تكرروا الغلط.' },
      { role: 'assistant', text: 'مفهوم. براجع نوع العقار قبل ما أعرض أي خيار عليك، وإذا ما عندي تطابق واضح بقول لك بدل ما أرسل خيارات غير مناسبة.' },
    ],
    outcome: 'يعترف بالخطأ العملي ويصلحه، بلا جدال أو تملق مبالغ فيه.',
  },
  {
    id: 'optout',
    label: 'طلب إيقاف الرسائل',
    kicker: 'احترام رغبة العميل',
    description: 'طلب إيقاف التواصل ليس اعتراضًا بيعيًا ولا فرصة لمحاولة أخيرة.',
    turns: [
      { role: 'customer', text: 'لا ترسلوا لي عروض مرة ثانية.' },
      { role: 'assistant', text: 'وصل طلبك، ونحترم رغبتك. لن أتابع بعروض أخرى.' },
    ],
    outcome: 'في النظام الفعلي يجب تسجيل إيقاف التواصل والتحقق من نجاحه، لا مواصلة التسويق.',
  },
];

const pillars = [
  { icon: BrainCircuit, title: 'يفهم قبل أن يقنع', text: 'يميز بين حد الميزانية، والتردد، والاعتراض على القيمة، والمقارنة مع عرض آخر.' },
  { icon: Target, title: 'يختار الاستراتيجية', text: 'يعرف متى يسأل، ومتى يشرح الفرق، ومتى يقترح بديلًا، ومتى يتوقف عن الإقناع.' },
  { icon: House, title: 'يستند إلى عقارات المكتب', text: 'السعر والمواصفات والتوفر تأتي من بيانات المكتب، لا من خيال النموذج.' },
  { icon: HeartHandshake, title: 'يحفظ سمعة المكتب', text: 'لغة مهذبة وواثقة، حتى عند الغضب؛ مع تسليم الحالات الحساسة إلى موظف.' },
];
const steps = [
  { n: '01', title: 'جرّب المعاينة', text: 'شاهد كيف يتعامل مع الميزانية، الاعتراض، البدائل، والمواقف الحساسة.' },
  { n: '02', title: 'أضف عقاراتك', text: 'سجّل الأسعار والمواصفات والمناطق والتوفر والشروط التي يسمح بها المكتب.' },
  { n: '03', title: 'اربط واتساب', text: 'اربط رقم أعمالك واضبط الصلاحيات، ثم اختبر الردود قبل تفعيل الأتمتة.' },
];

export default function AqarFlowLanding() {
  const [selectedId, setSelectedId] = useState('budget');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const selected = scenarios.find((s) => s.id === selectedId) ?? scenarios[0];

  function chooseScenario(id: string) {
    setSelectedId(id);
    setShowDetails(false);
  }

  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f7f8f5] text-[#192721]">
      <header className="sticky top-0 z-40 border-b border-[#e3e9e1] bg-[#f7f8f5]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="AqarFlow AI">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173d32] text-[#dcf6bd] shadow-sm"><House size={20} /></span>
            <span className="leading-tight"><span className="block text-lg font-black tracking-tight">AqarFlow <span className="text-[#2b7057]">AI</span></span><span className="block text-[11px] font-medium text-[#6f7f74]">مبيعات عقارية بذكاء</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-bold text-[#4c6255] md:flex">
            <a className="transition hover:text-[#173d32]" href="#how">كيف يعمل</a>
            <a className="transition hover:text-[#173d32]" href="#method">عقل المبيعات</a>
            <a className="transition hover:text-[#173d32]" href="#safety">الثقة والضوابط</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a href="#demo" className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-[#244c3e] transition hover:bg-[#e9eee6]">جرّب المعاينة</a>
            <a href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#173d32] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#225442]">دخول المكتب <ArrowLeft size={16} /></a>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce5db] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && <div className="border-t border-[#e3e9e1] px-4 py-4 md:hidden"><nav className="mx-auto flex max-w-7xl flex-col gap-3 text-sm font-bold"><a onClick={() => setMenuOpen(false)} href="#how">كيف يعمل</a><a onClick={() => setMenuOpen(false)} href="#method">عقل المبيعات</a><a onClick={() => setMenuOpen(false)} href="#safety">الثقة والضوابط</a><a onClick={() => setMenuOpen(false)} href="#demo">جرّب المعاينة</a><a href="/login" className="rounded-xl bg-[#173d32] px-4 py-3 text-center text-white">دخول المكتب</a></nav></div>}
      </header>

      <section id="top" className="relative">
        <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#dceacb]/65 blur-3xl" />
        <div className="pointer-events-none absolute right-[-90px] top-28 h-72 w-72 rounded-full bg-[#d4e6de]/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1fr_0.94fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d9e5d5] bg-white/80 px-3.5 py-2 text-xs font-extrabold text-[#2a6b51] shadow-sm"><Sparkles size={14} /> ليس مجرد رد آلي على واتساب</div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.22] tracking-tight sm:text-5xl lg:text-[3.7rem]">تعرّف على <span className="text-[#2b7057]">ملك التسويق</span> العقاري.</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#53665b] sm:text-lg">مساعد مبيعات يفهم العميل، ويعالج اعتراضاته، ويبحث له عن البديل المناسب من عقارات مكتبك—بأسلوب طبيعي وأخلاق مهنية تحفظ هيبة المكتب.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#173d32] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#173d32]/15 transition hover:-translate-y-0.5 hover:bg-[#225442]">شاهد كيف يبيع <ArrowLeft size={17} /></a>
              <a href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#d5e0d4] bg-white px-6 py-3 text-sm font-black text-[#284d3e] transition hover:bg-[#eff4ec]">ابدأ إعداد مكتبك</a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-bold text-[#64766b]">
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-[#31805b]" /> لا يختلق عقارات أو أسعارًا</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-[#31805b]" /> يحترم سقف الميزانية</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-[#31805b]" /> يحيل الحالات إلى موظف</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -right-5 top-12 hidden rounded-2xl border border-[#dce6d8] bg-white px-4 py-3 shadow-xl shadow-[#173d32]/5 sm:block">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#2b7057]"><ShieldCheck size={16} /> بيع باحترام</div>
              <p className="mt-1 text-[11px] text-[#718075]">الثقة قبل الصفقة</p>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-[#dce5da] bg-white shadow-2xl shadow-[#233c2c]/10">
              <div className="flex items-center justify-between bg-[#173d32] px-5 py-4 text-white">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><MessageCircle size={20} /></div><div><p className="font-extrabold">ملك التسويق · معاينة</p><p className="mt-0.5 text-[11px] text-[#d4e6db]">محادثة توضيحية تفاعلية</p></div></div>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold"><span className="h-1.5 w-1.5 rounded-full bg-[#d8f7a7]" /> وضع التجربة</span>
              </div>
              <div className="space-y-4 bg-[#edf2ec] p-4 sm:p-5">
                <div className="mx-auto w-fit rounded-full border border-[#dde6db] bg-white/75 px-3 py-1 text-[10px] font-bold text-[#778579]">اختر موقفًا وشاهد طريقة التعامل</div>
                <div className="mr-auto max-w-[91%] rounded-2xl rounded-tr-sm bg-white px-4 py-3 text-sm leading-7 text-[#34453a] shadow-sm">بدل ما يرسل ردًا محفوظًا، يبدأ بفهم ما يريده العميل ثم يختار الخطوة الأنسب.</div>
                <div className="ml-auto max-w-[91%] rounded-2xl rounded-tl-sm bg-[#d8f4c7] px-4 py-3 text-sm leading-7 text-[#264735] shadow-sm">التسويق مش كثرة كلام؛ التسويق الصحيح هو فهم الحاجة، وشرح القيمة بصدق، وعرض بديل مناسب عند الحاجة.</div>
                <div className="rounded-2xl border border-dashed border-[#cbd9ca] bg-white/65 p-3">
                  <p className="mb-2 text-[11px] font-extrabold text-[#4e6655]">ابدأ بموقف</p>
                  <div className="flex flex-wrap gap-2">
                    {scenarios.map((scenario) => <button key={scenario.id} onClick={() => { chooseScenario(scenario.id); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="rounded-full border border-[#dce6d8] bg-white px-3 py-2 text-[11px] font-extrabold text-[#355344] transition hover:border-[#70a07e] hover:bg-[#f3f8f0]">{scenario.label}</button>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#e9eee7] px-5 py-3.5 text-[11px] text-[#6d7b6f]"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> بيانات توضيحية فقط</span><a href="#demo" className="inline-flex items-center gap-1 font-extrabold text-[#2b7057]">انتقل للتجربة <ArrowDown size={14} /></a></div>
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="border-y border-[#e1e9df] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black tracking-wide text-[#337255]">الفرق الحقيقي</p><h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">ليس روبوتًا يجيب؛ بل عقل مبيعات يختار كيف يتعامل.</h2><p className="mt-4 leading-8 text-[#647368]">يتعلم مبادئ البيع الاستشاري والتفاوض والإقناع وخدمة العملاء، ويطبقها على الحقائق الحقيقية التي يضيفها المكتب.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-[#e0e8dd] bg-[#fbfcfa] p-5 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-[#173d32]/5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4efdf] text-[#2b7057]"><Icon size={23} /></div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-[#617165]">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="demo" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-black text-[#337255]">معاينة عملية قبل التسجيل</p>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">اختبر طريقة تفكيره في مواقف مختلفة.</h2>
              <p className="mt-4 leading-8 text-[#617165]">اختر موقفًا من المحادثات. هذه معاينة مسبقة الإعداد لتوضيح السلوك المستهدف، وليست جلسة ذكاء اصطناعي حية أو محادثة واتساب فعلية.</p>
              <div className="mt-6 grid gap-2">
                {scenarios.map((scenario) => <button key={scenario.id} onClick={() => chooseScenario(scenario.id)} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition ${selectedId === scenario.id ? 'border-[#7fa88b] bg-[#eaf3e5] shadow-sm' : 'border-[#dfe7dc] bg-white hover:bg-[#f1f5ef]'}`}><span><span className="block text-sm font-extrabold">{scenario.label}</span><span className="mt-1 block text-xs text-[#738174]">{scenario.kicker}</span></span><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selectedId === scenario.id ? 'bg-[#173d32] text-white' : 'bg-[#eef2eb] text-[#506f59]'}`}>{selectedId === scenario.id ? <Check size={16} /> : <MessageCircle size={16} />}</span></button>)}
              </div>
              <div className="mt-6 rounded-2xl border border-[#d9e6d5] bg-white p-4">
                <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e4efdf] text-[#2b7057]"><Target size={18} /></div><div><p className="text-sm font-black">ما الذي يجب أن ينجح هنا؟</p><p className="mt-1 text-sm leading-7 text-[#627267]">{selected.outcome}</p></div></div>
                <button onClick={() => setShowDetails(!showDetails)} className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-[#2b7057]">{showDetails ? 'إخفاء معيار السلوك' : 'عرض معيار السلوك'} <ChevronDown className={`transition ${showDetails ? 'rotate-180' : ''}`} size={15} /></button>
                {showDetails && <p className="mt-3 rounded-xl bg-[#f0f5ed] p-3 text-xs leading-6 text-[#456250]">المعيار: الصدق في المعلومات، احترام شروط العميل، رسالة طبيعية ومناسبة للسياق، وخطوة تالية واحدة فقط عند الحاجة. لا يُقاس النجاح بمجرد الإلحاح أو طول الرسالة.</p>}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-[#dbe5d8] bg-white shadow-xl shadow-[#1b3e2c]/8">
              <div className="flex items-center justify-between bg-[#173d32] px-5 py-4 text-white sm:px-6">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><MessageSquareText size={20} /></span><div><h3 className="font-black">معاينة محادثة العميل</h3><p className="mt-1 text-[11px] text-[#d5e7dc]">{selected.kicker} · مثال توضيحي</p></div></div><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold">تجريبي</span>
              </div>
              <div className="border-b border-[#e6ece4] bg-[#f9fbf8] px-5 py-4 sm:px-6"><h4 className="font-black">{selected.label}</h4><p className="mt-1 text-sm leading-6 text-[#667568]">{selected.description}</p></div>
              <div className="space-y-4 bg-[#eef3ed] p-4 sm:p-6">
                {selected.turns.map((turn, index) => <div key={selected.id + '-' + index} className={`flex ${turn.role === 'customer' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%] sm:px-5 ${turn.role === 'customer' ? 'rounded-tr-sm border border-[#e1e8df] bg-white text-[#3e4d41]' : 'rounded-tl-sm bg-[#d8f4c7] text-[#264735]'}`}><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black opacity-65">{turn.role === 'customer' ? <><UserRound size={12} /> العميل</> : <><Bot size={12} /> المساعد في المعاينة</>}</div><p className="whitespace-pre-line text-sm leading-7">{turn.text}</p></div></div>)}
              </div>
              <div className="flex flex-col gap-3 border-t border-[#e6ece4] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-xs leading-6 text-[#708073]">معاينة ثابتة للشرح فقط؛ لا تُرسل رسائل ولا تحفظ بيانات عميل.</p><button onClick={() => { const index = scenarios.findIndex((s) => s.id === selectedId); chooseScenario(scenarios[(index + 1) % scenarios.length].id); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d6e2d3] px-4 py-2 text-xs font-extrabold text-[#325642] transition hover:bg-[#f1f6ef]"><RefreshCw size={14} /> تجربة موقف آخر</button></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-[#e1e9df] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black text-[#337255]">بداية واضحة</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">من بيانات المكتب إلى محادثات أكثر فائدة.</h2><p className="mt-4 leading-8 text-[#647368]">لا تحتاج إلى إنشاء موقع عقاري مستقل. تضيف بياناتك مرة واحدة، والنظام يستخدمها في محادثات العملاء وفق قواعد البيع والصلاحيات التي تحددها.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">{steps.map((step) => <article key={step.n} className="rounded-3xl border border-[#dfe7dc] bg-[#fafcf9] p-6"><p className="text-sm font-black text-[#7ea18a]">{step.n}</p><h3 className="mt-3 text-xl font-black">{step.title}</h3><p className="mt-3 text-sm leading-7 text-[#617165]">{step.text}</p></article>)}</div>
        </div>
      </section>

      <section id="safety" className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
          <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4efdf] text-[#2b7057]"><ShieldCheck size={24} /></div><h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">هيبة المكتب تُبنى بالأدب والصدق.</h2><p className="mt-4 leading-8 text-[#617165]">الإقناع القوي لا يعني الضغط. المساعد يحترم رفض العميل، يوضح المعلومة المجهولة، ولا يهاجم المنافس ولا يخترع ندرة أو خصمًا.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Wallet, title: 'الميزانية حد محترم', text: 'لا يُعرض الخيار الأغلى على أنه مناسب إذا حدّد العميل سقفًا نهائيًا.' },
              { icon: BadgeCheck, title: 'حقائق موثقة', text: 'لا أسعار أو مرافق أو حالة توافر من دون مصدر واضح داخل بيانات المكتب.' },
              { icon: Handshake, title: 'تفاوض بصلاحيات واضحة', text: 'أي خصم أو وعد يحتاج موافقة حقيقية من صاحب الصلاحية.' },
              { icon: HeartHandshake, title: 'احترام في كل الظروف', text: 'طلب موظف أو إيقاف التواصل يوقف مسار الإقناع الآلي.' },
            ].map(({ icon: Icon, title, text }) => <article key={title} className="flex gap-3 rounded-2xl border border-[#e0e8dd] bg-white p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4eb] text-[#2b7057]"><Icon size={19} /></span><div><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-6 text-[#67786a]">{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#173d32] px-6 py-10 text-white sm:px-10 sm:py-14 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-2xl"><p className="text-xs font-black text-[#c5e6b8]">الخطوة التالية</p><h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">اجعل بيانات عقاراتك تعمل لصالح مبيعاتك.</h2><p className="mt-4 leading-8 text-[#deebe1]">ابدأ بإعداد مساحة المكتب، ثم أضف بيانات العقارات وراجع إعدادات واتساب قبل السماح بأي ردود تلقائية.</p></div>
          <div className="mt-7 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0"><a href="#demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-[#173d32] transition hover:bg-[#eef4eb]">استمر في المعاينة <ArrowLeft size={16} /></a><a href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">دخول المكتب</a></div>
        </div>
      </section>

      <footer className="border-t border-[#e1e9df] bg-white px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-[#738174] sm:flex-row sm:items-center sm:justify-between"><a href="#top" className="font-black text-[#294e3d]">AqarFlow AI · ملك التسويق العقاري</a><p>معاينة توضيحية. تفعيل الرد الآلي والتكاملات الحقيقية يتطلب إعدادًا واختبارًا منفصلًا.</p><a href="/login" className="font-extrabold text-[#2b7057]">دخول المكتب</a></div>
      </footer>
    </main>
  );
}
