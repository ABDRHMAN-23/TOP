# AqarFlow — المستوى الثاني: عمليات المبيعات والمتابعة والمعاينات

## ما الذي يضيفه المستوى الثاني؟

- مركز عمليات على `/aqarflow-operations` لإنشاء المهام وعرضها وبدء تنفيذها وإكمالها أو إلغائها.
- أنواع مهام للمتابعة والاتصال وإرسال المعلومات والمعاينة والمستندات وغيرها، مع أولوية وموعد وملاحظات.
- جدولة معاينات مرتبطة بعميل وعقار اختياري، مع مكان وتوقيت ومنطقة زمنية IANA.
- حالات المعاينة: مجدولة، مؤكدة، مكتملة، ملغاة، ولم يحضر العميل.
- مزامنة `aqarflow_crm_contacts.next_follow_up_at` تلقائيًا مع أقرب مهمة نشطة.
- منع معاينتين نشطتين متداخلتين للعقار نفسه، باستخدام قفل معاملات PostgreSQL وفحص التعارض.
- واجهات API تفحص الجلسة وعضوية مساحة العمل وتتحقق من ملكية العميل والعقار والمحادثة قبل الكتابة.
- لا يوجد حذف تشغيلي في الواجهة؛ يمكن إلغاء المهمة أو المعاينة مع الاحتفاظ بالسجل.

## نموذج مساحة العمل

استُبدل الاعتماد على جدول Quvoto القديم `team_memberships` بجدول `public.aqarflow_workspace_memberships`. يسمح RLS للمستخدم بقراءة عضويته الخاصة، ويسمح لصاحب مساحة العمل بقراءة أعضاء مساحته. لا يستطيع دور `authenticated` إنشاء العضويات أو تغييرها مباشرة؛ إدارة العضويات من خلال واجهة مستقلة ليست جزءًا من هذا المستوى.

## حالة قاعدة Supabase الفعلية — 10 أكتوبر 2026

تم تطبيق الهجرات على مشروع Supabase `TOP` (ref: `djpfjbjjybpquvzacmtj`). المخطط `public` يحتوي 12 جدولًا خاصًا بـAqarFlow، ولا يحتوي جداول Quvoto الـ25 التي أزيلت:

- `aqarflow_workspace_memberships`
- `aqarflow_properties`
- `aqarflow_ai_usage`
- `aqarflow_whatsapp_integrations`
- `aqarflow_whatsapp_events`
- `aqarflow_whatsapp_outbound_requests`
- `aqarflow_crm_contacts`
- `aqarflow_crm_conversations`
- `aqarflow_crm_messages`
- `aqarflow_crm_contact_notes`
- `aqarflow_crm_tasks`
- `aqarflow_crm_viewings`

أُبقي مخطط المصادقة `auth` وجدول `auth.users` دون حذف. كل الجداول الاثني عشر عليها RLS وFORCE RLS. جداول الرسائل والتكامل والمهام والمواعيد وسجل استعمال الذكاء الاصطناعي مغلقة أمام `anon` و`authenticated` على مستوى صلاحيات الجدول، وتُستخدم من الخادم عبر `service_role`. جدول العقارات له سياسات قراءة وكتابة محددة، وجدول العضويات له سياسة قراءة مقيدة بالمالك/العضو.

أُضيفت هجرة `20261010000700_aqarflow_database_hardening.sql` لتفعيل FORCE RLS على العقارات واستخدام الذكاء الاصطناعي والعضويات، وإضافة فهارس لعلاقات المفاتيح الأجنبية. فحوصات Supabase أعادت ملاحظات INFO عن جداول محمية دون سياسات RLS؛ هذا مقصود للجداول التي لا تمنح أي صلاحية مباشرة إلى `anon` أو `authenticated`، وليس سماحًا بالقراءة. كما تظهر فهارس جديدة على أنها غير مستخدمة لأن القاعدة حديثة ولا توجد حركة بيانات تشغيلية بعد.

### ما بقي من تنظيف Quvoto

حاويتا Storage القديمتان `business-logos` و`quote-photos` ما زالتا في Storage، لكن فحص العدد وجد صفر ملفاتهما، وأزيلت السياسات القديمة التي كانت تمنح صلاحيات خاصة بهما. حماية Supabase رفضت حذف صفوف Storage مباشرة عبر SQL؛ يلزم حذفهما من خلال Storage API/لوحة Supabase بعد التأكد من عدم حاجة أي نظام آخر إليهما. لم يُتجاوز هذا الحاجز.

## ملفات التنفيذ والاختبار

- `supabase/migrations/20261010000200_aqarflow_ai_runtime.sql`
- `supabase/migrations/20261010000300_aqarflow_whatsapp_tech_provider.sql`
- `supabase/migrations/20261010000400_aqarflow_crm_inbox.sql`
- `supabase/migrations/20261010000500_aqarflow_crm_lead_pipeline.sql`
- `supabase/migrations/20261010000600_aqarflow_sales_operations.sql`
- `supabase/migrations/20261010000700_aqarflow_database_hardening.sql`
- `app/api/aqarflow/operations/tasks/route.ts`
- `app/api/aqarflow/operations/viewings/route.ts`
- `lib/aqarflow/operations-contract.ts`
- `components/aqarflow/AqarFlowOperations.tsx`
- `app/aqarflow-operations/page.tsx`
- `scripts/test-aqarflow-operations.ts`

يشغّل CI الهجرات على PostgreSQL مؤقت ويختبر عزل المستأجرين وRLS وقيود علاقات العملاء والمواعيد ومزامنة المتابعة، ثم الاختبارات الآلية والبناء:

```bash
npm run test:aqarflow:operations
npm run test:aqarflow:migration
bash scripts/test-aqarflow-migrations.sh
npm run build
npm run build:cloudflare
```

## الحدود الحالية — لا تعني أن المنتج منشور بالكامل

- التعديلات على المصدر موجودة في طلب الدمج #1، وما يزال Draft ولم يُدمج إلى `main`.
- معاينات Vercel لا تُبنى حاليًا لأن حساب Vercel تجاوز حد النشر اليومي؛ نجاح بناء GitHub لا يثبت نشرًا حيًا.
- لم يُختبر حساب Meta/WABA حقيقي لإرسال واستقبال الرسائل من البداية إلى النهاية.
- لا توجد تذكيرات خلفية مؤكدة عبر WhatsApp أو SMS أو البريد، ولا يرسل إنشاء المعاينة رسالة للعميل تلقائيًا.
- تقييم Promptfoo على endpoint حي ومصادق عليه لم يُنفذ بعد.
- لم يُنقل تطبيق `melgarafael/DeskcommCRM` حرفيًا؛ الموجود CRM أصلي داخل TOP.
- إدارة أعضاء مساحة العمل بواجهة مخصصة، والوسائط والأزرار الديناميكية في قوالب WhatsApp، خارج نطاق المستوى الحالي.

## معيار الإغلاق

نجاح CI والبناء هو إثبات للكود والهجرات على PostgreSQL مؤقت، لا يغني عن اختبار التطبيق المنشور. لا يُعلن جاهزًا للإنتاج قبل اكتمال فحص CI الحالي، وإتاحة نشر معاينة، وتجربة Meta الحية، وتقييم Promptfoo على endpoint مصادق عليه.
