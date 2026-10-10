# AqarFlow AI — المستوى الثالث: الأتمتة والتنبيهات الداخلية

## ما نُفّذ في هذا المستوى
- سجل تنبيهات داخلي خاص بمساحة العمل والمستلم، مع RLS وFORCE RLS ومنع صلاحيات القراءة المباشرة لـ`anon` و`authenticated`.
- مولّد SQL آمن ينشئ تنبيهًا مرة واحدة لمهمة متابعة تستحق خلال 15 دقيقة/متأخرة بحد أقصى 24 ساعة، أو لمعاينة تبدأ خلال 30 دقيقة/تأخرت ساعة كحد أقصى.
- مفتاح حدث فريد لكل المهمة أو المعاينة والمستلم؛ تكرار تشغيل الجدولة لا يكرر التنبيه.
- إسناد تنبيه المهمة إلى عضو الفريق المكلف إن وُجد، وإلا إلى صاحب مساحة العمل. تنبيه المعاينة يذهب لصاحب المساحة.
- endpoint من الخادم إلى الخادم `POST /api/aqarflow/automation/dispatch` محمي بـ`CRON_SECRET`، وAPI لقراءة الإشعارات ووضع علامة «مقروء»، وصفحة عربية `/aqarflow-automation`.
- الحد الآمن مقصود: هذا المستوى ينشئ تنبيهات داخل التطبيق فقط ولا يرسل WhatsApp تلقائيًا، ولا يرسل رسائل للعميل أو ينشئ التزامات مالية. يجب أن يوافق الإنسان على أي رسالة خارجية.

## إعداد الجدولة
اضبط `CRON_SECRET` كسر خادمي عشوائي بطول 32 حرفًا على الأقل عبر Cloudflare Worker Secrets، ولا تستخدم متغير `NEXT_PUBLIC_*`. أُضيف غلاف العامل `worker.ts` ومعالج `scheduled` وجدول Cron `*/5 * * * *` في `wrangler.jsonc`. الغلاف يستدعي endpoint داخل العامل نفسه، ولا يرسل السر إلى عنوان عام. يجب نشر نسخة Cloudflare بعد ضبط السر حتى تبدأ الجدولة؛ بناء GitHub وحده لا يفعّل Cron في الإنتاج. يسجل العامل عدد التنبيهات فقط ولا يسجل السر.

## الملفات والهجرات
- `supabase/migrations/20261010000800_aqarflow_automation_notifications.sql`
- `supabase/migrations/20261010000900_aqarflow_notification_recipient_index.sql` — فهرس إضافي لعلاقة المستلم بعد فحص أداء Supabase.
- `app/api/aqarflow/automation/dispatch/route.ts`
- `app/api/aqarflow/notifications/route.ts`
- `app/aqarflow-automation/page.tsx`
- `components/aqarflow/AqarFlowAutomation.tsx`

## التحقق والحدود
CI يطبق هذه الهجرة على PostgreSQL مؤقت ويختبر صلاحيات الجدول ودالة dispatch وعدم تكرار التنبيه. نجاح CI لا يثبت أن هجرة قاعدة Supabase المتصلة طُبقت أو أن scheduler خارجي أُعد. يُضاف `CRON_SECRET` إلى أسرار Worker قبل استخدام endpoint. لا دمج ولا نشر حي يُفترضان من هذا التغيير.
