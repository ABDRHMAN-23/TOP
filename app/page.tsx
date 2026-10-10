import { ArrowLeft, ArrowUpLeft, Building2, Bot, ChartNoAxesCombined, CheckCircle2, ChevronLeft, CircleDollarSign, Clock3, Home, MessageCircle, Search, ShieldCheck, Sparkles, Users, Workflow } from 'lucide-react';

const metrics = [
  { label: 'عقارات معروضة', value: '١٢٨', note: 'معاينة توضيحية', icon: Building2 },
  { label: 'عملاء محتملون', value: '٣٤٦', note: 'بيانات تجريبية', icon: Users },
  { label: 'متابعات اليوم', value: '٢٤', note: 'بيانات تجريبية', icon: Clock3 },
  { label: 'فرص بيع نشطة', value: '٥٨', note: 'بيانات تجريبية', icon: CircleDollarSign },
];

const features = [
  { icon: Users, title: 'إدارة العملاء المحتملين', text: 'رتّب الاستفسارات، قيّم جاهزية العميل، واعرف الخطوة التالية لكل فرصة.' },
  { icon: Home, title: 'إدارة العقارات', text: 'اعرض الوحدات والأسعار والتفاصيل في مساحة منظمة وسهلة التصفح.' },
  { icon: MessageCircle, title: 'صندوق محادثات موحّد', text: 'صمّم سير عمل لمتابعة محادثات العملاء من مكان واحد. ربط واتساب يأتي لاحقًا.' },
  { icon: Bot, title: 'مساعد المبيعات الذكي', text: 'واجهة جاهزة لمساعدة فريقك في إعداد الردود وخطط المتابعة عند تفعيل التكامل.' },
  { icon: ChartNoAxesCombined, title: 'تقارير المبيعات', text: 'تابع مراحل الفرص والنشاط ومؤشرات الأداء من لوحة واضحة.' },
  { icon: Workflow, title: 'المتابعات والأتمتة', text: 'نظّم المهام والتذكيرات وسير المتابعة قبل تفعيل الخدمات الخلفية.' },
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="AqarFlow AI">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-900/15"><Building2 size={23}/></span>
            <span><span className="block text-lg font-black tracking-tight">AqarFlow <span className="text-blue-700">AI</span></span><span className="block text-xs font-medium text-slate-500">منصة المبيعات العقارية الذكية</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#overview" className="transition hover:text-blue-700">نظرة عامة</a>
            <a href="#features" className="transition hover:text-blue-700">المميزات</a>
            <a href="#workflow" className="transition hover:text-blue-700">طريقة العمل</a>
          </nav>
          <a href="#overview" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-900/10 transition hover:bg-blue-800">استكشف الواجهة <ArrowLeft size={16}/></a>
        </div>
      </header>

      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -left-28 -top-24 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl"/>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.92fr]">
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-800"><Sparkles size={14}/> تجربة الواجهة — وضع العرض</div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.25] tracking-tight sm:text-6xl">كل فرصك العقارية،<br/><span className="text-blue-700">في مسار واحد أوضح.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">واجهة موحّدة لإدارة العقارات والعملاء والمتابعات ومحادثات المبيعات، مع مساحة جاهزة لمساعد الذكاء الاصطناعي وتقارير الأداء.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#overview" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800">عرض لوحة العمل <ArrowLeft size={17}/></a>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">استعراض المميزات</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600"/> واجهة عربية RTL</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600"/> مناسبة للهاتف</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600"/> عرض دون قاعدة بيانات</span>
            </div>
          </div>

          <div id="overview" className="relative rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/[0.07] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div><p className="text-xs font-bold text-blue-700">AQARFLOW AI</p><h2 className="mt-1 text-xl font-black">لوحة العمل</h2><p className="mt-1 text-xs text-slate-500">معاينة ببيانات تجريبية</p></div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">وضع العرض</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {metrics.map(({label,value,note,icon:Icon}) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">{label}</span><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={17}/></span></div><p className="mt-3 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-[11px] text-slate-400">{note}</p></div>)}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold">مسار فرص البيع</h3><p className="mt-1 text-xs text-slate-500">مثال بصري لمراحل متابعة العميل</p></div><ChartNoAxesCombined size={20} className="text-blue-700"/></div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
                <div><div className="mb-2 h-2 rounded-full bg-slate-300"/><span className="text-slate-600">جديد</span><p className="mt-1 text-base">١٨</p></div>
                <div><div className="mb-2 h-2 rounded-full bg-blue-300"/><span className="text-slate-600">تواصل</span><p className="mt-1 text-base">١٢</p></div>
                <div><div className="mb-2 h-2 rounded-full bg-blue-500"/><span className="text-slate-600">معاينة</span><p className="mt-1 text-base">٧</p></div>
                <div><div className="mb-2 h-2 rounded-full bg-emerald-500"/><span className="text-slate-600">تفاوض</span><p className="mt-1 text-base">٤</p></div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-700"/><p className="leading-6 text-blue-950"><span className="font-extrabold">واجهة مستقلة عن الخدمات الخلفية.</span> الأرقام هنا للعرض فقط، ولا يتم حفظها أو إرسالها إلى قاعدة بيانات.</p></div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl"><p className="text-sm font-extrabold text-blue-700">مساحة العمل</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">الأدوات الأساسية، بتجربة واحدة</h2><p className="mt-4 leading-7 text-slate-600">هذه واجهة العرض الأولية. يمكن تفعيل كل تكامل وربط البيانات لاحقًا بعد التأكد من تجربة الموقع.</p></div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({icon:Icon,title,text}) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-900/[0.04]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={21}/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{text}</p></article>)}
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
          <div><h2 className="text-2xl font-black">نبدأ بالواجهة، ثم نكمل التكاملات لاحقًا</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">لا يتطلب هذا العرض تسجيل دخول أو إعداد قاعدة بيانات أو مفاتيح دفع. ستظل وظائف الحفظ والذكاء الاصطناعي والرسائل الحقيقية غير مفعّلة إلى أن يحين وقت ربطها.</p></div>
          <a href="#overview" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">العودة إلى الأعلى <ArrowUpLeft size={17}/></a>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-slate-500 sm:px-8 sm:flex-row sm:items-center sm:justify-between"><span className="font-black text-slate-700">AqarFlow AI</span><span>واجهة تجريبية فقط · لا توجد بيانات حقيقية أو تكاملات نشطة</span></footer>
    </main>
  );
}
