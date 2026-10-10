import {
  ArrowLeft,
  ArrowUpLeft,
  Bell,
  Bot,
  Building2,
  Check,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  House,
  LayoutDashboard,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';

const metrics = [
  { label: 'إجمالي العقارات', value: '١٢٨', delta: '+١٢ هذا الشهر', icon: House },
  { label: 'العملاء المحتملون', value: '٣٤٦', delta: '+١٨٪ عن الشهر الماضي', icon: Users },
  { label: 'مواعيد المعاينة', value: '٢٤', delta: '٨ مواعيد اليوم', icon: Clock3 },
  { label: 'قيمة الفرص', value: '٢٫٤ م', delta: 'قيمة توضيحية', icon: CircleDollarSign },
];

const leads = [
  { initials: 'م ع', name: 'محمد العريقي', property: 'شقة — خور مكسر', stage: 'معاينة', tone: 'blue' },
  { initials: 'س ح', name: 'سارة حسين', property: 'فيلا — عدن الجديدة', stage: 'عميل جديد', tone: 'amber' },
  { initials: 'ع م', name: 'عمر منصور', property: 'مكتب — المنصورة', stage: 'تفاوض', tone: 'green' },
];

const features = [
  { icon: Users, number: '01', title: 'كل عميل في مكانه الصحيح', text: 'تابع مصدر العميل واهتماماته وآخر تواصل والخطوة التالية دون تشتت بين الجداول والمحادثات.' },
  { icon: House, number: '02', title: 'محفظة عقارية مرتبة', text: 'اجمع تفاصيل العقارات وأسعارها وتوفرها، واربط كل عقار بالعملاء والفرص المناسبة.' },
  { icon: MessageCircle, number: '03', title: 'متابعة لا تسقط من الحساب', text: 'نظّم المهام والمواعيد وسجل التواصل حتى يعرف الفريق ما الذي يحتاج إلى متابعة اليوم.' },
  { icon: Bot, number: '04', title: 'ذكاء اصطناعي عند الحاجة', text: 'مساحة مهيأة لمساعد يختصر تفاصيل العميل ويقترح ردودًا وخطوات متابعة عند تفعيل التكامل.' },
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f6f8fc] text-[#14213d]">
      <header className="relative z-10 border-b border-white/10 bg-[#101d38] text-white">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="AqarFlow AI">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6e5ff] text-[#183c7a]"><Building2 size={22} /></span>
            <span className="text-lg font-black tracking-tight">AqarFlow<span className="text-[#91b8ff]"> AI</span><span className="mt-0.5 block text-[10px] font-medium tracking-wide text-slate-400">REAL ESTATE WORKSPACE</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a className="transition hover:text-white" href="#product">المنتج</a>
            <a className="transition hover:text-white" href="#features">المميزات</a>
            <a className="transition hover:text-white" href="#how-it-works">كيف يعمل</a>
          </nav>
          <a href="#product" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#14213d] transition hover:bg-[#e9f0ff]">استكشف المنصة <ArrowLeft size={16} /></a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#101d38] text-white">
        <div className="pointer-events-none absolute -left-32 top-0 h-[430px] w-[430px] rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute right-1/3 top-20 h-72 w-72 rounded-full bg-indigo-400/10 blur-[90px]" />
        <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-[#c8d9ff]"><span className="h-1.5 w-1.5 rounded-full bg-[#7aa8ff]" /> مساحة عمل مصممة للعقار</div>
            <h1 className="max-w-xl text-[2.65rem] font-black leading-[1.28] tracking-tight sm:text-6xl">أدر علاقاتك العقارية،<span className="mt-1 block text-[#91b8ff]">لا تفاصيلها المتناثرة.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-300 sm:text-lg">من أول استفسار إلى إتمام الصفقة؛ مساحة واحدة تجمع العقارات والعملاء والفرص ومتابعات الفريق في تجربة واضحة.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#product" className="inline-flex items-center gap-2 rounded-lg bg-[#d6e5ff] px-5 py-3.5 text-sm font-extrabold text-[#142f62] transition hover:bg-white">استعرض مساحة العمل <ArrowLeft size={17} /></a>
              <a href="#features" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">اكتشف المميزات</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-[#91b8ff}" /> تجربة عربية من اليمين إلى اليسار</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-[#91b8ff]" /> معاينة تعمل دون قاعدة بيانات</span>
            </div>
          </div>

          <div id="product" className="relative min-w-0 rounded-2xl border border-white/15 bg-[#f9fbff] p-2 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-[#14213d] sm:rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#315ca8]"><LayoutDashboard size={18} /></div><div><p className="text-sm font-extrabold">مساحة العمل</p><p className="mt-0.5 text-[10px] text-slate-400">نظرة عامة على نشاطك</p></div></div>
                <div className="flex items-center gap-2"><span className="hidden rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 sm:inline">بيانات تجريبية</span><button aria-label="بحث" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><Search size={15} /></button><button aria-label="الإشعارات" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><Bell size={15} /></button></div>
              </div>
              <div className="grid min-w-0 sm:grid-cols-[150px_1fr]">
                <aside className="hidden border-l border-slate-100 bg-[#fbfcff] p-3 sm:block">
                  <p className="mb-2 px-2 text-[9px] font-bold text-slate-400">مساحة العمل</p>
                  <div className="flex items-center gap-2 rounded-lg bg-[#eaf1ff] px-2.5 py-2.5 text-[11px] font-bold text-[#2854a0]"><LayoutDashboard size={14} /> نظرة عامة</div>
                  <div className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[11px] text-slate-500"><House size={14} /> العقارات</div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[11px] text-slate-500"><Users size={14} /> العملاء</div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[11px] text-slate-500"><Workflow size={14} /> فرص البيع</div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[11px] text-slate-500"><MessageCircle size={14} /> المحادثات</div>
                  <div className="mt-7 rounded-xl bg-[#13264b] p-3 text-white"><Sparkles size={16} className="text-[#a8c5ff]" /><p className="mt-2 text-[10px] font-bold">مساعد AqarFlow</p><p className="mt-1 text-[9px] leading-4 text-slate-300">مساحة جاهزة للمساعدة الذكية</p></div>
                </aside>
                <div className="min-w-0 p-3 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-2"><div><h2 className="text-base font-black sm:text-lg">صباح الخير 👋</h2><p className="mt-1 text-[10px] text-slate-500 sm:text-xs">إليك ملخص النشاط في مساحة العمل</p></div><span className="rounded-lg border border-slate-200 px-2.5 py-2 text-[9px] font-semibold text-slate-500">آخر ٣٠ يومًا⌄</span></div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {metrics.map(({ label, value, delta, icon: Icon }, index) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-1"><span className="truncate text-[9px] font-semibold text-slate-500 sm:text-[10px]">{label}</span><Icon size={15} className="shrink-0 text-[#4772bd]" /></div><p className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{value}</p><p className={`mt-1 text-[8px] leading-4 sm:text-[9px] ${index === 3 ? 'text-slate-400' : 'text-emerald-600'}`}>{delta}</p></div>)}
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-xl border border-slate-100 p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold">حركة فرص البيع</p><p className="mt-1 text-[9px] text-slate-400">توزيع توضيحي للفرص</p></div><span className="text-[9px] font-bold text-[#4772bd]">عرض التقرير <ChevronLeft size={12} className="inline" /></span></div><div className="mt-5 flex h-20 items-end gap-2 sm:h-24">{[34, 52, 43, 70, 57, 82, 62, 92, 73, 58, 78, 96].map((height, i) => <div key={i} className="flex flex-1 items-end"><div style={{ height: `${height}%` }} className={`w-full rounded-t-sm ${i === 11 ? 'bg-[#244f9d]' : 'bg-[#d7e4fb]'}`} /></div>)}</div><div className="mt-2 flex justify-between text-[8px] text-slate-400"><span>الأسبوع الأول</span><span>الأسبوع الأخير</span></div></div>
                    <div className="rounded-xl border border-slate-100 p-3 sm:p-4"><p className="text-xs font-extrabold">مراحل الفرص</p><p className="mt-1 text-[9px] text-slate-400">نظرة سريعة على خط المبيعات</p><div className="mt-4 space-y-3">{[{name:'عميل جديد',n:'٣٤',w:'85%',c:'bg-[#9bb9f0]'},{name:'تواصل',n:'٢٢',w:'63%',c:'bg-[#648bd4]'},{name:'معاينة',n:'١٤',w:'43%',c:'bg-[#315ca8]'},{name:'تفاوض',n:'٧',w:'25%',c:'bg-[#172f5c]'}].map(item => <div key={item.name}><div className="mb-1 flex justify-between text-[9px]"><span className="text-slate-500">{item.name}</span><span className="font-bold">{item.n}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.c}`} style={{width:item.w}} /></div></div>)}</div></div>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-100 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-extrabold">آخر العملاء المحتملين</p><span className="text-[9px] font-bold text-[#4772bd]">عرض الكل <ChevronLeft size={12} className="inline" /></span></div><div className="space-y-3">{leads.map((lead) => <div key={lead.name} className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf2fb] text-[9px] font-extrabold text-[#315ca8]">{lead.initials}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{lead.name}</p><p className="mt-0.5 truncate text-[9px] text-slate-400">{lead.property}</p></div><span className={`shrink-0 rounded-md px-2 py-1 text-[8px] font-bold ${lead.tone === 'blue' ? 'bg-blue-50 text-blue-700' : lead.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{lead.stage}</span></div>)}</div></div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-2 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheck size={19} /></span><span><span className="block text-xs font-extrabold text-slate-800">واجهة مستقلة</span><span className="mt-0.5 block text-[10px] text-slate-500">جاهزة للمعاينة دون إعدادات</span></span></div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-8 sm:grid-cols-3 sm:px-8 sm:py-10">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-5 sm:border-b-0 sm:border-l sm:pb-0 sm:pl-6"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#315ca8]"><LayoutDashboard size={21} /></span><div><p className="font-extrabold">رؤية موحّدة</p><p className="mt-1 text-xs leading-5 text-slate-500">كل مؤشرات العمل في شاشة واحدة</p></div></div>
          <div className="flex items-center gap-4 border-b border-slate-100 pb-5 sm:border-b-0 sm:border-l sm:pb-0 sm:pl-6"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#315ca8]"><Workflow size={21} /></span><div><p className="font-extrabold">خطوات أوضح</p><p className="mt-1 text-xs leading-5 text-slate-500">حوّل المتابعة اليومية إلى سير عمل منظم</p></div></div>
          <div className="flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#315ca8]"><ShieldCheck size={21} /></span><div><p className="font-extrabold">خصوصية أولًا</p><p className="mt-1 text-xs leading-5 text-slate-500">معاينة الواجهة لا تحفظ بيانات حقيقية</p></div></div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-black tracking-[0.18em] text-[#315ca8]">BUILT FOR REAL ESTATE</p><h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">أدوات أقل تشتتًا.<br />مساحة أكبر لإنجاز الصفقات.</h2></div><p className="max-w-md text-sm leading-7 text-slate-500">تجربة مصممة حول دورة العمل العقاري اليومية، لا لوحة عامة تحتاج إلى تكييفها من الصفر.</p></div>
        <div className="mt-10 grid gap-0 border-y border-slate-200 sm:grid-cols-2 sm:gap-x-12">
          {features.map(({ icon: Icon, number, title, text }) => <article key={number} className="grid grid-cols-[44px_1fr] gap-4 border-b border-slate-200 py-7 last:border-b-0 sm:py-9 [&:nth-last-child(2)]:sm:border-b-0"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#315ca8] shadow-sm ring-1 ring-slate-200"><Icon size={20} /></span><div><div className="flex items-center gap-3"><span className="text-[10px] font-black tracking-widest text-slate-400">{number}</span><h3 className="text-base font-extrabold sm:text-lg">{title}</h3></div><p className="mt-2 max-w-lg text-sm leading-7 text-slate-500">{text}</p></div></article>)}
        </div>
      </section>

      <section id="how-it-works" className="mx-5 mb-8 overflow-hidden rounded-2xl bg-[#eaf0fb] sm:mx-8 lg:mx-auto lg:max-w-[1264px]">
        <div className="grid gap-8 px-6 py-10 sm:px-10 sm:py-12 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-xs font-black tracking-widest text-[#315ca8]">ابدأ من هنا</p><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">جرّب شكل مساحة عملك قبل ربط الخدمات.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">هذه معاينة تصميمية ببيانات افتراضية. تسجيل الدخول والحفظ والذكاء الاصطناعي والرسائل الحقيقية ستُفعّل في مرحلة الربط التالية.</p></div>
          <a href="#product" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#142d5c] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#203f79]">العودة إلى المعاينة <ArrowUpLeft size={17} /></a>
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><a href="/" className="text-sm font-black text-[#14213d]">AqarFlow AI</a><span>نسخة معاينة · الأرقام والأنشطة المعروضة تجريبية</span><span>© 2026 AqarFlow AI</span></footer>
    </main>
  );
}
