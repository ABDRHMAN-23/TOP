import { redirect } from 'next/navigation';
import {
  ArrowLeft, ArrowUpLeft, BarChart3, Building2, CalendarClock, CheckCircle2,
  ChevronLeft, CircleHelp, ClipboardList, Home, MessageCircle, MessagesSquare,
  Settings2, ShieldCheck, Sparkles, Target, Users, WalletCards, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type QuickLink = {
  href: string;
  title: string;
  description: string;
  label: string;
  tone: 'green' | 'blue' | 'gold';
  icon: typeof Home;
};

const quickLinks: QuickLink[] = [
  { href: '/properties', title: 'مخزون العقارات', description: 'أضف العقارات وحدّث أسعارها ومواصفاتها وحالتها.', label: 'إدارة العقارات', tone: 'green', icon: Home },
  { href: '/aqarflow-assistant', title: 'مساعد المبيعات', description: 'اختبر طريقة التعامل مع الأسئلة والاعتراضات قبل اعتماد الرد.', label: 'تجربة المساعد', tone: 'blue', icon: Sparkles },
  { href: '/aqarflow-inbox', title: 'صندوق المحادثات', description: 'راجع محادثات العملاء وتابع الردود والخطوات التالية.', label: 'فتح المحادثات', tone: 'green', icon: MessagesSquare },
  { href: '/aqarflow-crm', title: 'إدارة العملاء المحتملين', description: 'نظّم بيانات العملاء ومراحل المتابعة والملاحظات.', label: 'إدارة العملاء', tone: 'gold', icon: Users },
  { href: '/aqarflow-operations', title: 'المعاينات والمتابعة', description: 'نظّم المواعيد والمهام المرتبطة بفرص البيع.', label: 'إدارة العمليات', tone: 'blue', icon: CalendarClock },
  { href: '/aqarflow-analytics', title: 'تحليلات المبيعات', description: 'تابع أداء المخزون والعملاء والعمليات ضمن مساحة المكتب.', label: 'عرض التحليلات', tone: 'green', icon: BarChart3 },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect('/login');

  const user = authData.user;
  let ownerId = user.id;
  let activePropertyCount = 0;
  let inventoryReady = true;
  let workspaceLabel = user.email || 'مساحة المكتب';

  try {
    const { data: memberships, error: membershipError } = await supabase
      .from('aqarflow_workspace_memberships')
      .select('owner_id,role')
      .eq('member_id', user.id)
      .neq('owner_id', user.id)
      .limit(2);

    if (membershipError) {
      inventoryReady = false;
    } else if ((memberships || []).length > 1) {
      inventoryReady = false;
    } else if (memberships?.[0]?.owner_id) {
      ownerId = memberships[0].owner_id;
      workspaceLabel = 'مساحة الفريق';
    }

    if (inventoryReady) {
      const { count, error } = await supabase
        .from('aqarflow_properties')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', ownerId)
        .eq('is_active', true);
      if (error) inventoryReady = false;
      else activePropertyCount = count || 0;
    }
  } catch {
    inventoryReady = false;
  }

  const firstName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.split(' ')[0]
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name.split(' ')[0]
      : null;

  return (
    <main dir="rtl" className="af-workspace">
      <div className="af-workspace-shell">
        <header className="af-workspace-header">
          <a href="/" className="af-workspace-brand" aria-label="AqarFlow AI — الرئيسية">
            <span className="af-workspace-brand-mark"><MessagesSquare size={22} /></span>
            <span><strong>AqarFlow<span> AI</span></strong><small>مساحة المبيعات العقارية</small></span>
          </a>
          <div className="af-workspace-header-actions">
            <span className="af-workspace-user"><span className="af-workspace-user-dot" />{workspaceLabel}</span>
            <a href="/settings/whatsapp" className="af-workspace-settings"><Settings2 size={16} /><span>إعدادات واتساب</span></a>
            <a href="/login?next=%2Fdashboard" className="af-workspace-exit">الحساب <ArrowUpLeft size={15} /></a>
          </div>
        </header>

        <section className="af-workspace-welcome">
          <div className="af-workspace-welcome-copy">
            <span className="af-workspace-kicker"><span /> مساحة عمل المكتب العقاري</span>
            <h1>{firstName ? 'أهلًا، ' + firstName : 'أهلًا بك في مساحة مكتبك'}<br /><span>خلّينا نحوّل المحادثات إلى فرص حقيقية.</span></h1>
            <p>من هنا تدير العقارات والعملاء والمعاينات، وتختبر مساعد المبيعات قبل توسيع استخدامه. المعلومات الدقيقة وسمعة المكتب تأتي أولًا.</p>
            <div className="af-workspace-welcome-actions">
              <a href="/aqarflow-assistant" className="af-workspace-primary">جرّب مساعد المبيعات <ArrowLeft size={16} /></a>
              <a href="/properties" className="af-workspace-secondary">أضف عقارًا <Building2 size={16} /></a>
            </div>
          </div>
          <div className="af-workspace-summary">
            <div className="af-workspace-summary-top"><span className="af-workspace-summary-icon"><Home size={19} /></span><span className="af-workspace-summary-label">مخزون المكتب</span><span className="af-workspace-summary-state">{inventoryReady ? 'متصل' : 'يحتاج إعدادًا'}</span></div>
            {inventoryReady ? <><strong className="af-workspace-summary-number">{activePropertyCount}</strong><span className="af-workspace-summary-caption">عقار نشط مسجّل</span></> : <><strong className="af-workspace-summary-number af-workspace-summary-number-small">لنبدأ الإعداد</strong><span className="af-workspace-summary-caption">تحقق من تهيئة قاعدة بيانات AqarFlow أولًا.</span></>}
            <div className="af-workspace-summary-bottom"><span><ShieldCheck size={14} /> {inventoryReady ? 'المساعد يعتمد على بيانات المخزون' : 'لم تُعرض أرقام غير مؤكدة'}</span><a href="/properties" aria-label="فتح مخزون العقارات"><ChevronLeft size={17} /></a></div>
          </div>
        </section>

        {!inventoryReady ? (
          <div role="status" className="af-workspace-setup-alert">
            <CircleHelp size={18} />
            <div><b>مساحة المكتب تحتاج إلى تهيئة</b><p>تعذر قراءة مخزون AqarFlow أو تحديد مساحة العمل. لم نعرض أرقامًا تخمينية. راجع إعداد قاعدة البيانات والصلاحيات قبل إضافة بيانات حقيقية.</p></div>
          </div>
        ) : null}

        <section className="af-workspace-section">
          <div className="af-workspace-section-heading"><div><span>مركز العمل</span><h2>كل أدوات مكتبك، في مكان واحد.</h2></div><p>ابدأ بالمخزون، ثم اختبر أسلوب المساعد، وبعدها تابع المحادثات والعمليات.</p></div>
          <div className="af-workspace-tools">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return <a href={item.href} key={item.href} className={'af-workspace-tool af-workspace-tool-' + item.tone}>
                <span className="af-workspace-tool-icon"><Icon size={21} /></span>
                <span className="af-workspace-tool-arrow"><ArrowUpLeft size={15} /></span>
                <h3>{item.title}</h3><p>{item.description}</p><span className="af-workspace-tool-link">{item.label}<ArrowLeft size={14} /></span>
              </a>;
            })}
          </div>
        </section>

        <section className="af-workspace-bottom-grid">
          <div className="af-workspace-checklist">
            <div className="af-workspace-panel-heading"><span className="af-workspace-panel-icon"><ClipboardList size={18} /></span><div><h2>ابدأ في أربع خطوات</h2><p>إعداد واضح قبل الاعتماد على الأتمتة.</p></div></div>
            <div className="af-workspace-step"><span>01</span><div><b>أضف عقاراتك الحقيقية</b><p>السعر، النوع، المنطقة، المواصفات وحالة التوفر.</p></div><a href="/properties" aria-label="إدارة العقارات"><ArrowLeft size={15} /></a></div>
            <div className="af-workspace-step"><span>02</span><div><b>اختبر طريقة البيع</b><p>راجع الردود على السعر والاعتراضات والبدائل.</p></div><a href="/aqarflow-assistant" aria-label="مساعد المبيعات"><ArrowLeft size={15} /></a></div>
            <div className="af-workspace-step"><span>03</span><div><b>اربط رقم واتساب للأعمال</b><p>تحقق من اتصال Meta وصلاحيات الرقم.</p></div><a href="/settings/whatsapp" aria-label="إعدادات واتساب"><ArrowLeft size={15} /></a></div>
            <div className="af-workspace-step"><span>04</span><div><b>راجع المحادثات والمتابعة</b><p>أبقِ الردود تحت المراجعة إلى أن تختبر الأتمتة وتفعّلها صراحة.</p></div><a href="/aqarflow-inbox" aria-label="صندوق المحادثات"><ArrowLeft size={15} /></a></div>
          </div>

          <aside className="af-workspace-principle">
            <span className="af-workspace-principle-icon"><ShieldCheck size={22} /></span>
            <span className="af-workspace-principle-kicker">قاعدة AqarFlow</span>
            <h2>البيع الذكي لا يساوي الضغط.</h2>
            <p>المساعد الجيد يحترم ميزانية العميل، ولا يخترع توافرًا أو خصمًا، ويقترح بديلًا مناسبًا بدل دفع العميل نحو عقار لا يناسبه.</p>
            <div className="af-workspace-principle-footer"><CheckCircle2 size={17} /><span>الحقيقة والصلاحيات قبل إتمام الصفقة</span></div>
          </aside>
        </section>

        <footer className="af-workspace-footer"><span>© 2026 AqarFlow AI</span><span><ShieldCheck size={13} /> بيانات دقيقة. مبيعات باحترام.</span><a href="/">زيارة الموقع التعريفي <ArrowLeft size={14} /></a></footer>
      </div>
    </main>
  );
}
