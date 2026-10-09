# دليل النسخ الاحتياطي الخارجي واختبار الاستعادة — TOP / AqarFlow AI

**الحالة الحالية:** هذا دليل تشغيل فقط. لم ينفذ أي أمر تصدير أو استعادة في هذه الجلسة.  
**المشروع المصدر:** `TOP`، المرجع `djpfjbjjybpquvzacmtj`.  
**قاعدة ثابتة:** ممنوع توجيه أوامر الاستعادة إلى قاعدة الإنتاج. لا تُنشئ مشروع اختبار مدفوعًا قبل عرض التكلفة والحصول على موافقة منفصلة.

## 1. ما يجب أن يحتويه الأرشيف

1. PostgreSQL logical archive مع schema والبيانات، إضافة إلى ملفات schema/data قابلة للفحص.
2. سجل schema migrations ومعلومات الإصدار/commit.
3. جرد وتصدير بايتات كل ملفات Storage من كل bucket، وليس فقط صفوف metadata.
4. إعدادات Auth/الدومينات وإعدادات المشروع القابلة للتصدير، مع حفظ الأسرار في مدير أسرار منفصل.
5. manifest وchecksums وسجل واضح لوقت النسخة ونتيجة التحقق والاستعادة.

الرابطان الرسميان: [Database Backups](https://supabase.com/docs/guides/platform/backups) و[Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). تذكّر أن نسخة قاعدة البيانات لا تتضمن ملفات Storage الثنائية.

## 2. تجهيز بيئة النسخ

- استخدم جهازًا أو بيئة تنفيذ موثوقة فيها PostgreSQL client وSupabase CLI، وصلاحية قراءة للمشروع.
- اختر وجهة نسخ خارج المستودع وخارج مجلد المشروع؛ يفضّل أن تكون مشفّرة ومقيدة الوصول.
- اجعل مسار النسخ خاصًا بالمستخدم:
  ```sh
  umask 077
  export BACKUP_DIR="$HOME/secure-backups/TOP-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BACKUP_DIR"/{database,storage,project-config,verification}
  ```
- أدخل connection string في متغير بيئة داخل الجلسة الآمنة، لا في ملف داخل Git ولا في سجل أوامر محفوظ:
  ```sh
  export DATABASE_URL='postgresql://...'
  ```
  استبدل النص داخل علامات الاقتباس برابط الاتصال الفعلي. لا ترسله في المحادثة ولا تنشره في GitHub.
- استخدم اتصالًا موثقًا من صفحة Connect للمشروع. إذا كانت الشبكة لا تدعم الاتصال المباشر، استخدم Session Pooler الموصى به من وثائق Supabase.

## 3. تصدير قاعدة PostgreSQL

أنشئ نسخة أرشيف كاملة قابلة للفهرسة باستخدام `pg_dump`:
```sh
pg_dump --format=custom --no-owner --no-acl \
  --file="$BACKUP_DIR/database/top-full.dump" "$DATABASE_URL"
```

واحتفظ أيضًا بتصدير schema نصي يسهل مراجعته:
```sh
pg_dump --schema-only --no-owner --no-acl \
  --file="$BACKUP_DIR/database/top-schema.sql" "$DATABASE_URL"
```

**تنبيه:** `supabase db dump` خيار رسمي مفيد للحصول على مخطط التطبيق والبيانات، لكنه يستبعد مخططات Supabase المُدارة مثل `auth` و`storage` وبعض مخططات الإضافات افتراضيًا. إذا استُخدمت أوامر CLI، سجّل هذه الحدود وصدّر إعدادات Auth منفصلة. لا تصف نسخة جزئية بأنها نسخة كاملة بلا توثيق ما تستثنيه.

يمكن بالإضافة إلى ذلك توليد تصدير التطبيق المدعوم من Supabase CLI:
```sh
supabase db dump --db-url "$DATABASE_URL" \
  -f "$BACKUP_DIR/database/app-schema.sql"

supabase db dump --db-url "$DATABASE_URL" --data-only \
  -f "$BACKUP_DIR/database/app-data.sql"
```
راجع مخرجات الأمر وإعداداته قبل الاعتماد عليه؛ لا تُشغّل migration أو أمر استعادة في هذه الخطوة.

## 4. جرد وتنزيل ملفات Storage

البكتان اللذان رُصدا هما `business-logos` و`quote-photos`. أعد الفحص عبر Storage API؛ لا تعتمد على استعلام `storage.objects` السابق وحده.

بعد تسجيل الدخول بـSupabase CLI وربط الجلسة بالمشروع المصدر، نفّذ أوامر القراءة/النسخ التالية من مجلد النسخ الآمن. افحص `supabase storage cp --help` أولًا للتأكد من صيغة الإصدار المثبت:
```sh
supabase storage ls ss:///business-logos --recursive --experimental --linked \
  > "$BACKUP_DIR/storage/business-logos-manifest.txt"

supabase storage ls ss:///quote-photos --recursive --experimental --linked \
  > "$BACKUP_DIR/storage/quote-photos-manifest.txt"

supabase storage cp ss:///business-logos \
  "$BACKUP_DIR/storage/business-logos" --recursive --experimental --linked

supabase storage cp ss:///quote-photos \
  "$BACKUP_DIR/storage/quote-photos" --recursive --experimental --linked
```

تحقق من حالة الخروج، وعدد الملفات وحجمها. إن كانت الـmanifest فارغة فاحتفظ بنسخة من ذلك الدليل؛ لا تفترض أن القائمة فارغة قبل نجاح Storage API. احفظ أي metadata إضافية تحتاجها عملية إعادة الرفع، مثل Content-Type والأسماء والمسارات. خيار آخر للنسخ الكثيف هو S3-compatible endpoint من Storage، لكن إعداد مفاتيح S3 أو تفعيل البروتوكول يجب ألا يغير إعدادات الإنتاج دون مراجعة.

مرجع رسمي: [Download Objects](https://supabase.com/docs/guides/storage/management/download-objects).

## 5. الإعدادات وسجل migrations

- احفظ قائمة migrations من Supabase وراجعها مقابل مصدر ملفات migrations، لأن المستودع المفحوص لا يتضمن مجلد `supabase/`.
- صدّر فقط إعدادات Auth/Realtime/Storage القابلة للتصدير عبر Dashboard أو Management API، وفق وثائق Supabase، واحفظها في `project-config`.
- لا تحاول تصدير كلمات مرور أو مفاتيح سرية مخفية. خزّن القيم السرية في مدير أسرار مستقل، مع وصف اسم السر ووجهته دون كتابة القيمة نفسها في manifest.
- خزن نتيجة `supabase projects list`/مرجع المشروع والـcommit المصدر في ملف نصي لا يحتوي أسرارًا.

## 6. الفحص والتشفير

```sh
pg_restore --list "$BACKUP_DIR/database/top-full.dump" \
  > "$BACKUP_DIR/verification/pg-restore-toc.txt"

find "$BACKUP_DIR" -type f -print0 | sort -z | \
  xargs -0 sha256sum > "$BACKUP_DIR/verification/SHA256SUMS.txt"

du -sh "$BACKUP_DIR"
```

- تحقق أن أوامر التصدير انتهت برمز نجاح وأن كل الملفات غير صفرية إلا الملفات التي قد تكون فارغة عن قصد.
- شفّر الأرشيف قبل رفعه إلى أي وجهة خارجية، واحتفظ بمفتاح فك التشفير منفصلًا.
- لا ترفع النسخة إلى GitHub أو إلى bucket عام. لا تضعها في مجلد يمكن نشره مع موقع الويب.

## 7. اختبار استعادة حقيقي

مجرد نجاح `pg_restore --list` يفحص بنية الأرشيف لكنه **ليس** اختبار استعادة.

1. اختر قاعدة محلية/بيئة استعادة فارغة ومصرّحًا بها. إن كان الاختبار يتطلب مشروع Supabase جديدًا أو branch مدفوعًا، احصل على عرض تكلفة وموافقة منفصلة أولًا.
2. تأكد بصريًا من أن `RESTORE_DATABASE_URL` يعود إلى قاعدة اختبار فارغة، وليس إلى مصدر الإنتاج. عرّف المتغير في الجلسة فقط.
3. نفذ الاستعادة إلى قاعدة الاختبار فقط:
   ```sh
   export RESTORE_DATABASE_URL='postgresql://...test-only...'
   pg_restore --exit-on-error --no-owner --no-acl \
     --dbname="$RESTORE_DATABASE_URL" \
     "$BACKUP_DIR/database/top-full.dump"
   ```
   لا تستخدم متغير الاتصال بالإنتاج في هذا الأمر. استعادة أرشيف Supabase كامل إلى قاعدة PostgreSQL مختلفة قد تُظهر اختلافات في المخططات المُدارة والإضافات؛ سجّل الأخطاء ولا تتجاوزها صامتًا. لا تُجرّب الاستعادة على مصدر الإنتاج.
4. قارن عدد المخططات والجداول والصفوف والقيود والفهارس والدوال والسياسات والـ triggers. نفّذ اختبارات القراءة الأساسية، ثم سجل أي اختلافات.
5. اختبر استعادة ملفات Storage في مشروع/بيئة اختبار منفصلة فقط. اربط CLI بالهدف التجريبي، ثم ارفع النسخة من المجلد المحلي؛ لا تنفّذ أوامر الرفع ما دام CLI مربوطًا بالمصدر.
6. افحص عدد الملفات وحجمها وchecksums بعد الاستعادة، وتحقق من Content-Type والمسارات والروابط. أعد اختبار RLS كعضو عادي ومستخدم من مكتب مختلف.
7. وثّق تاريخ ومدة الاستعادة ونسخة CLI والـcommit ونتيجة كل اختبار. لا تعتبر البوابة جاهزة إلا بعد نجاح استعادة فعلية موثقة.

## 8. بوابة الإكمال

- [ ] ملف PostgreSQL كامل أُنشئ ونجح فحص الأرشيف.
- [ ] جرد Storage عبر API اكتمل وكل ملف فعلي نُزّل أو وُثّق أنه غير موجود.
- [ ] إعدادات المشروع وAuth المتاحة حُفظت بأمان، دون تضمين أسرار في Git.
- [ ] checksums حُسبت، والأرشيف مشفر ومحفوظ خارج حساب المصدر.
- [ ] الاستعادة التجريبية نجحت وتمت مقارنة المخطط والصفوف والملفات.
- [ ] تم عرض أي تكلفة مطلوبة والحصول على موافقة منفصلة عليها.
- [ ] تمت مراجعة خطة الرجوع، ثم طلب موافقة مستقلة لتغيير الإنتاج.

**الوضع الحالي لهذه القائمة: جميع البنود أعلاه ما زالت غير معتمدة، إلى أن تُنفذ وتُرفق نتائج فعلية.**
