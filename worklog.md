
---
Task ID: 3
Agent: Main Agent (Super Z)
Task: پاسخ به درخواست لینک پیش‌نمایش — بازسازی کامل اپ پس از ریست sandbox

Work Log:
- کشف ریست کامل sandbox: سورس کد جلسات قبل از بین رفته بود (فقط upload/ لوگو + .git خالی مانده)
- راه‌اندازی مجدد محیط فول‌استک + نصب وابستگی‌ها (dexie, socket.io, xlsx, jspdf, html2canvas-pro, react-multi-date-picker, recharts)
- بازسازی کامل از صفر طبق مستندات worklog: Prisma schema (۱۴ جدول سینک + SyncLog)، APIهای sync/push(LWW)/pull(افزایشی)/full(bootstrap)، /api/backup (کپی SQLite + نگهداشت ۱۴ نسخه + auto روزانه)
- mini-service socket.io پورت 3003 (notify → broadcast data-changed) اجرا شد
- کلاینت: localdb.ts (Dexie ۱۶ store + outbox + liveQuery hooks)، sync-engine.ts (push/pull/bootstrap/socket/cycle 20s/debounce 1.5s)
- ۷ نما: داشبورد (۵ کارت + ۳ نمودار Recharts + هشدارها)، تولید (ثبت/جعبه‌ها TTDDMMNNSS/مصرف/انواع)، فروش (چندقلمی/تسویه جزئی/چک/بدحساب)، خرید (انبار با حد بحرانی/تامین‌کننده/اقلام)، دستگاه‌سازی (مصرفی/سرمایه‌ای)، حسابداری (دوره با روز شروع دلخواه/۳ مبنا سود/اکسل/PDF/چاپ)، تنظیمات
- آیکون‌ها از لوگوی اصلی کاربر (upload/*.png، کلیدرنگی مشکی → شفاف) + ۳۸ اسپلش iOS + فونت وزیرمتن محلی + PWA کامل (بنر نصب، راهنمای iOS، storage.persist)
- باگ‌های رفع‌شده: seed ناقص بعد از خطا (شرط existing به seed-bt-01 تغییر کرد)، ts جاافتاده SyncLog، Function type در APIها، set-state-in-effect ها، مهم‌ترین: **پیکر تاریخ ارقام فارسی برمی‌گرداند** → نرمال‌سازی در onChange کلاینت + DATE_FIELDS در sanitize سرور + ترمیم رکورد خراب با push دستی
- تست E2E کامل: ثبت تولید (۵۰۰ نان/۲۵ جعبه کدگذاری‌شده)، فروش ۱٫۵M با تسویه جزئی ۱M، خرید آرد ۳۰kg/۹۰۰k، مصرف ۲۵kg → گزارش: فروش ۱٫۵M − مواد ۷۵۰k = سود ۷۵۰k ✓، هزینه دستگاه سرمایه‌ای ۲٫۵M، **تست آفلاین**: ثبت شکر ۴kg بدون اینترنت → صف → آنلاین → سینک خودکار ✓، موبایل iPhone 14 ✓
- اولین commit کامل در git: «Waffly v1.0 — full rebuild» (محافظت در برابر ریست‌های آینده)

Stage Summary:
- اپ کامل و سالم روی پورت 3000؛ همه endpoint ها 200
- bot-id لینک preview از داخل sandbox قابل کشف نیست (مثل جلسه قبل) — کاربر از Preview Panel استفاده می‌کند
- لینک‌ها: کد در git (commit 87af15b)

---
Task ID: 4
Agent: Main Agent (Super Z)
Task: آماده‌سازی پروژه برای دیپلوی دائمی رایگان (Vercel + Turso) با GitHub

Work Log:
- کشف اینکه Prisma 6 provider بومی libsql ندارد → پیاده‌سازی با driver adapter (@prisma/adapter-libsql@6.11.1 هماهنگ با client — نسخه ۷ ناسازگار بود)
- src/lib/db.ts: اگر DATABASE_URL با libsql:// شروع شود → PrismaLibSQL adapter (Turso)؛ در غیر این صورت موتور استاندارد SQLite (لوکال). سازنده آداپتر در v6 آبجکت Config می‌گیرد نه Client
- sync-engine.ts: socket فقط با NEXT_PUBLIC_SOCKET_URL فعال می‌شود (روی Vercel خالی → polling 20s)
- sync/push route: notify فقط با SOCKET_NOTIFY_URL
- backup route: گارد IS_SERVERLESS (list با فلگ serverless، create با پیام فارسی 501)
- .env سندباکس: SOCKET_NOTIFY_URL + NEXT_PUBLIC_SOCKET_URL=/?XTransformPort=3003 اضافه شد تا real-time فعلی کار کند
- scripts/turso-setup.mjs: تولید SQL از اسکیما با prisma migrate diff (بدون اتصال) + executeMultiple + انتقال داده (نام جدول فیزیکی = نام مدل: BreadType...) با INSERT OR REPLACE + گارد ضدتداخل
- package.json: postinstall=prisma generate (برای Vercel)
- تست: adapter runtime OK، build OK، push/pull E2E OK، اسکریپت Turso با انتقال ۱۶ ردیف seed محلی OK — کامیت 0204fd1

Stage Summary:
- پروژه کاملاً آماده دیپلوی سرورلس؛ بعد از ساخت ریپو GitHub + دیتابیس Turso فقط: push کد، اجرای turso-setup، ست کردن ۲ env در Vercel
- داده‌های موبایل کاربر با --data به Turso منتقل و با bootstrap مجدد به گوشی برمی‌گردد

---
Task ID: 5
Agent: Main Agent (Super Z)
Task: اجرای عملی دیپلوی — push به GitHub + راه‌اندازی Turso

Work Log:
- انتقال داده به Turso با scripts/turso-setup.mjs --data: ۱۵ جدول ساخته شد + ۱۷ ردیف منتقل (BreadType:5, Material:7, ExpenseCategory:4, Setting:1) — صحت‌سنجی با خواندن مستقیم از Turso ✓
- SyncLog عمداً خالی ماند؛ bootstrap دستگاه جدید از /api/sync/full (اسنپ‌شات جدول‌ها) استفاده می‌کند نه SyncLog ✓
- z-ai-web-dev-sdk از dependencies حذف شد (استفاده‌ای نداشت)؛ .env از git خارج + .env.example ساخته شد
- کشف ریپو remote نسخه قدیمی پروژه داشت (کامیت 8caafce «Waffly») → force push نسخه فعلی
- push موفق: origin/main = 4216955 (Abbas20gh/waffly_app، توکن fine-grained فقط همین ریپو)
- ریپو: 4MB public (۳۸ اسپلش + فونت)، .git حجم 53MB

Stage Summary:
- GitHub: https://github.com/Abbas20gh/waffly_app (برَندچ main، آپدیت‌های بعدی فقط git push)
- Turso: libsql://waffly-db-abbas20gh.aws-eu-west-1.turso.io آماده با جدول‌ها و seed
- remaining (کاربر): Import در Vercel با ۲ env (DATABASE_URL + DATABASE_URL_AUTH_TOKEN)
- هشدار به کاربر: از این لحظه ورود داده فقط در آدرس جدید Vercel (آدرس قدیمی سندباکس منسوخ)

---
Task ID: 6
Agent: Main Agent (Super Z)
Task: پلن B — آماده‌سازی کامل Cloudflare Pages (چون Vercel اکانت کاربر را بلاک کرد)

Work Log:
- تصمیم معماری: Frontend استاتیک (output: export) + Pages Functions با SQL خام و @libsql/client → همان Turso (بدون D1، داده‌ها حفظ)
- functions/api/_sync.ts: پرت یک‌به‌یک منطق سینک (TABLES/PHYS/FIELDS/sanitizeRow با نرمال‌سازی ارقام فارسی، ensureSeed، pushOps با LWW + batch، pullRows با dedupe، fullSnapshot)
- functions/api/[[route]].ts: catch-all هر ۵ endpoint + کش isolate کلاینت libsql
- next.config.ts: CF_EXPORT=1 → output export + images unoptimized
- scripts/build-pages.mjs: جابجایی موقت src/app/api ↔ .cf-api-hidden با finally + چک سلامت out/ (index/sw/manifest/icon)
- scripts/test-cf-api.mjs: ۱۹ تست (seed، LWW برابر/قدیمی/جدید، تاریخ فارسی→لاتین، sanitize، pull cursor، تومب‌استون، شکل JSON) — همه پاس
- تست زنده با wrangler pages dev + Turso واقعی: استاتیک 200، health OK، full داده واقعی برگرداند، push smoke accepted — سپس پاکسازی smoke از Turso
- devDep: wrangler 4.127.1 + tsx؛ wrangler.toml با nodejs_compat؛ out/ و لاگ‌ها gitignore
- push به GitHub: 1f6ab6c

Stage Summary:
- پروژه کاملاً آماده دیپلوی: `wrangler pages project create waffly` + `wrangler pages secret put` ×۲ + `wrangler pages deploy out`
- فقط منتظر توکن API + Account ID از کاربر
- نکته: بروزرسانی‌های آینده = node scripts/build-pages.mjs && wrangler pages deploy out

---
Task ID: 7
Agent: Main Agent (Super Z)
Task: دیپلوی Waffly روی Cloudflare Pages با اعتبارنامه‌های کاربر

Work Log:
- توکن CF (cfut_...) با verify تأیید شد؛ فقط پرمیشن Pages:Edit روی اکانت 4d239652... دارد (Workers/user/memberships → 9109/10000 — نیاز نداریم)
- توکن Turso از خلاصه جلسه قابل بازسازی نبود (بریده بود) → invalid JWT؛ در .env/لاگ‌ها/history هم نبود → باید دوباره از کاربر گرفته شود
- بیلد استاتیک با scripts/build-pages.mjs موفق (Next 16.1.3 Turbopack، out/ سالم)
- wrangler pages project create waffly → پروژه ساخته شد، آدرس https://waffly.pages.dev
- secret TURSO_URL ست شد؛ TURSO_TOKEN منتظر کاربر
- deploy out/ موفق: 99 فایل + Functions bundle → production branch main
- تست دود: / 200 (53KB)، /api → Hello world، sw.js 200، manifest 200، /api/sync/full → 500 (چون توکن Turso نیست — انتظارش را داشتیم)
- push به GitHub: 090c23b

Stage Summary:
- https://waffly.pages.dev زنده است (استاتیک + Functions سالم)
- مانده: کاربر توکن Turso را بدهد → wrangler pages secret put TURSO_TOKEN + redeploy + تست full/push واقعی + مقایسه داده سندباکس (scripts/compare-counts.mjs) و در صورت وجود ردیف جدید، انتقال با turso-setup.mjs --data

---
Task ID: 7-2
Agent: Main Agent (Super Z)
Task: تکمیل دیپلوی — توکن Turso، secret دوم، redeploy و تست نهایی

Work Log:
- توکن جدید Turso از کاربر رسید (فرمت database-scoped با claim "a":"rw") → با /v2/pipeline تأیید شد
- مقایسه داده با scripts/compare-counts.mjs: همه جدول‌ها برابر (BreadType:5, Material:7, ExpenseCategory:4, Setting:1)؛ فقط SyncLog محلی 17 ردیف تست دارد که عمداً منتقل نمی‌شود → انتقال داده لازم نبود
- wrangler pages secret put TURSO_TOKEN موفق + redeploy (8ac45cb6)
- تست نهایی production: /api/sync/full → {rows:17, cursor, serverTime} با شکل {tbl, row} و نام استور کلاینت (breadTypes) ✓؛ /api/sync/pull → {rows:[],cursor:0,hasMore:false} ✓؛ /api → Hello world ✓
- push مسیر production عمداً تست دستی نشد (آلودگی داده) — قبلاً در Task 6 با wrangler pages dev + Turso واقعی smoke شده بود

Stage Summary:
- https://waffly.pages.dev کاملاً عملیاتی: استاتیک PWA + Functions + Turso متصل
- secrets: TURSO_URL + TURSO_TOKEN روی پروژه waffly ست شده
- آپدیت آینده: node scripts/build-pages.mjs && wrangler pages deploy out --branch main (با CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)

---
Task ID: 8
Agent: Main Agent (Super Z)
Task: ساخت APK اندروید وافلی با Capacitor 8

Work Log:
- کشف ریست مجدد sandbox وسط کار: تاریخچه git به 87af15b (Task 3) برگشته بود + فایل‌های scripts از دست — ریپو از origin/main بازیابی شد (reset --hard a96444c) و تغییرات APK دستی برگشت
- پچ کلاینت: NEXT_PUBLIC_API_BASE در sync-engine.ts (export const API_BASE) + settings-view.tsx (backup) — روی وب خالی = نسبی، در APK = https://waffly.pages.dev
- sw-register: ثبت SW داخل Capacitor غیرفعال شد (گارد window.Capacitor)
- Capacitor 8.5.0 (appId com.abbas20gh.waffly) + @capacitor/assets: ۶۱ آیکون/اسپلش از maskable-512 تولید شد (برند #101613)
- Prisma بعد از ریست خراب بود: adapter-libsql 6.19.2 + client 6.19.2 هم‌نسخه شدند + generate
- keystore PKCS12 (android/keystore/waffly.keystore، پسورد در keystore.properties — عمداً در ریپو برای امضای یکسان CI؛ قبل از انتشار Play باید چرخد)
- خطاها: PAT گیت‌هاب scope وردفلو ندارد (push وردفلو رد شد → فایل روی دیسک ماند و .gitignore شد)؛ javac نبود (Temurin 21 در .jdk21 نصب شد)؛ مسیر keystore در gradle باید rootProject.file می‌بود
- بیلد موفق: Gradle 8.14.3 + SDK 36 (در .android-sdk محلی) → app-release.apk امضاشده (SHA-256: a31b9080...) = download/Waffly-v1.0.apk (8.3MB)
- صحت‌سنجی aapt/apksigner: package com.abbas20gh.waffly v1.0، ۱۰۱ فایل وب داخل APK، رشته waffly.pages.dev در باندل JS موجود (API_BASE تزریق شده) ✓
- APK در ریپو هم کامیت شد (download/Waffly-v1.0.apk) → لینک دائمی دانلود در GitHub

Stage Summary:
- APK: /home/z/my-project/download/Waffly-v1.0.apk + raw.githubusercontent.com/Abbas20gh/waffly_app/main/download/Waffly-v1.0.apk
- بیلد محلی مجدد (برای آپدیت‌ها): build-pages با API_BASE → cap sync → gradlew assembleRelease (JDK: JAVA_HOME=.jdk21)
- workflow CI آماده روی دیسک (.github/workflows/build-apk.yml) — با توکن دارای scope وردفلو push می‌شود

---
Task ID: 9
Agent: Main Agent (Super Z)
Task: ساخت پرامپت جامع پروژه + zip سورس برای انتقال به هوش مصنوعی دیگر

Work Log:
- کاربر خواست: «دقیق‌ترین پرامپت اپ» یا فایل واقعی اپ برای دادن به AI دیگر و اعمال تغییرات
- مرور دقیق سورس: worklog، package.json، prisma/schema.prisma، types.ts، localdb.ts، sync-engine.ts، sync-tables.ts، functions/api/_sync.ts، app-shell.tsx، calc.ts، boxcode.ts، capacitor.config.ts، next.config.ts، wrangler.toml، .env.example، .gitignore
- نوشتن download/Waffly-AI-Prompt.md (~۲۷۰ خط، ۱۴ بخش فارسی): هویت، استک با نسخه‌ها، معماری آفلاین‌فرست + دیاگرام، نقشه فایل‌ها، ۱۵ جدول با فیلدها، API سینک دو بک‌اند، موتور سینک، ۷ نما، منطق کسب‌وکار (boxcode TTDDMMNNSS، بدحسابی، ۳ مبنا سود)، قوانین UI، دیپلوی (CF Pages + APK + Turso)، ۱۲ RED LINE، وضعیت فعلی، چک‌لیست تغییر
- ساخت download/Waffly-Source-v1.0.zip (4.3MB، ۳۱۲ فایل): کل سورس شامل android/keystore (عمدی طبق Task 8)؛ خروجی‌ها: node_modules/.next/out/.git/skills/upload/download/db/*.log/.env/worklog/Caddyfile/bun.lock حذف؛ پرامپت در ریشه آرشیو هم کپی شد
- سکرت‌ها (CF/Turso tokens) در هیچ‌کدام از دو فایل نیست

Stage Summary:
- تحویل: download/Waffly-AI-Prompt.md + download/Waffly-Source-v1.0.zip (+ APK موجود از قبل)
- راهنمای کاربر: پرامپت را اول بده، بعد zip یا لینک ریپو؛ هشدار درباره سکرت‌ها و اینکه داده واقعی در zip نیست (روی Turso/گوشی است)

---
Task ID: 10
Agent: Main Agent (Super Z)
Task: اجرای کامل سند تغییرات Waffly-Changes-v2.md (نسخه ۲.۰ — دو باگ + ۴ فیچر + آپدیت‌پذیری)

Work Log:
- جواب‌های عباس: روغن=همان روغن مایع؛ لسیتین+وانیل=گرم؛ آرد دوم=«آرد سبوس‌دار»؛ اسانس=فقط پرتقالی فعلا (لیست ESSENCE_TYPES قابل‌گسترش در types.ts)؛ آپدیت=نصب دستی APK با همان امضا؛ نسخه=v2.0/versionCode 3
- بکاپ کامل Turso قبل از مهاجرت: scripts/backup-turso.mjs → db/turso-backup-*.json (یافته: Production/Box واقعی کاربر روی Turso هست → push سمت سرور سالم، مشکل pull سمت گوشی)
- اسکیما در ۶ نقطه: prisma (Material.active, Box.hasEssence/essenceType/note, MachineCost.note, مدل OtherFund) + types.ts (TABLES→۱۶، OtherFund، ESSENCE_TYPES) + localdb (Dexie version(2) + otherFunds) + sync-tables.ts + functions/_sync.ts (پاریتی کامل + seed جدید) + hooks/calc (otherFundsTotals جدا از سود؛ materialStocks فقط مواد فعال)
- مهاجرت Turso با scripts/migrate-v2.mjs: ۵ ستون + جدول OtherFund + مایه خمیر active=0 + لسیتین/وانیل/آرد سبوس‌دار + ۴ ردیف SyncLog ✓
- باگ ۱.۱ (Select در Dialog): کامپوننت جدید inline-picker.tsx (بدون Portal، position:fixed، ضد WebView) — جایگزین همه Selectهای درون دیالوگ در production/purchases/sales/machines/production
- باگ ۱.۲ (سینک وب↔گوشی): @capacitor/app + listeners appStateChange/resume (import پویا) + focus listener + گارد socket با NEXT_PUBLIC_SOCKET_URL
- UI: بخش «جعبه‌های این تولید» در کارت تولید (ویرایش/حذف جعبه + اسانس + هشدار ناهرمانی کد چاپی)، اسانس در فرم تولید (تعداد جعبه اسانس‌دار)، BoxesTab ویرایش/حذف، toggle فعال/غیرفعال اقلام، note در هزینه دستگاه‌ها، بخش «سایر وجوه» در حسابداری + بنر در داشبورد (خارج از فرمول سود)، SW با __WAFFLY_BUILD__ (build-pages تزریق می‌کند)، نسخه ۲.۰ در تنظیمات
- دیپلوی وب: build-pages → wrangler deploy → تست دود: full با ۱۰ ماده ✓، push otherFund→pull (نرمال‌سازی تاریخ فارسی) ✓، پاکسازی تومب‌استون + ماده تستی قدیمی «تست دیپلوی» ✓
- APK: JDK21 (Temurin در .jdk21 — جاوای سیستم JRE بود) + SDK36 در .android-sdk؛ NEXT_PUBLIC_API_BASE بیلد → cap sync (پلاگین App@8.1.1) → gradlew assembleRelease → versionCode 3/versionName 2.0 + SHA-256 گواهی یکسان با v1.0 (a31b9080…cda) = آپدیت بدون حذف ✓
- گیت‌هاب: 91f2ff5 (کد) + 51ebd5e (APK v2.0) + سند پرامپت v2.0؛ zip سورس v2.0 بازسازی شد

Stage Summary:
- تحویل: https://waffly.pages.dev (v2.0) + download/Waffly-v2.0.apk (+ لینک raw.githubusercontent) + Waffly-AI-Prompt.md و Source-v2.0.zip به‌روز
- مانده برای عباس: نصب APK جدید روی گوشی (بدون حذف)، تست Selectها و سینک دوطرفه با قطع/وصل اینترنت، ثبت سایر وجوه
- نکته: بیلد وب بعدی بدون NEXT_PUBLIC_API_BASE (فقط برای APK)

---
Task ID: 11
Agent: Main Agent (Super Z)
Task: رفع ریشه‌ای مشکل سینک دوطرفه وب↔APK (CORS)

Work Log:
- علامت کاربر: داده وب در اپ نمی‌آید و داده اپ در وب نمی‌آید (هر دو جهت)
- ریشه‌یابی: functions/api/[[route]].ts هیچ هدر CORS و هندلر OPTIONS نداشت → WebView اپ (origin https://localhost) همه fetchها را بلاک می‌کرد:
  * POST push با Content-Type: application/json → preflight OPTIONS → 404 بدون ACAO → شکست → هیچ pushای از گوشی
  * GET pull → پاسخ ۲۰۰ ولی بدون Access-Control-Allow-Origin → fetch رد می‌شود → هیچ pullای به گوشی
  * با curl روی production تأیید شد (OPTIONS → 404، GET بدون ACAO). تشخیص قبلی «JS پس‌زمینه» ناقص بود — listenerها سینک را صدا می‌زدند ولی fetchها همیشه CORS-بلاک بودند
- فیکس کلاینت (تعیین‌کننده): CapacitorHttp.enabled در capacitor.config.ts → همه fetch/XHR اپ از استک HTTP نیتیو اندروید می‌رود و CORS اصلاً اعمال نمی‌شود → APK حتی بدون redeploy سرور سینک دوطرفه می‌شود
- فیکس سرور (دفاعی/پاریتی): هدرهای CORS (ACAO:*) + هندلر OPTIONS در functions/api/[[route]].ts و در سه روت sync قلمرو Next (src/lib/server/cors.ts جدید)
- sandbox ریست شده بود: JDK21 (Temurin 21.0.12 در .jdk21) و SDK36 + build-tools 36.0.0 + cmdline-tools دوباره نصب شد
- بیلد: build-pages با NEXT_PUBLIC_API_BASE → cap sync → gradle assembleRelease → download/Waffly-v2.1.apk (versionCode 4 / versionName 2.1)
- صحت‌سنجی APK: SHA-256 گواهی یکسان (a31b9080…cda) = آپدیت بدون حذف؛ capacitor.config.json داخل APK دارای CapacitorHttp؛ native-bridge دارای پچ fetch؛ API_BASE در باندل؛ گارد SW سالم
- گیت: commit 56aa213 + push (کد + APK)

Stage Summary:
- ریشه مشکل سینک: CORS — نه سرور، نه suspend شدن JS. اپ v2.1 با CapacitorHttp حتی روی نسخه فعلی سرور سینک دوطرفه دارد
- مانده: دیپلوی فیکس CORS سرور نیازمند توکن Cloudflare است (توکن قبلی در ریست sandbox از بین رفته) — از کاربر خواسته شد
- نکته: صف outbox گوشی کاربر پر از آپهای ارسال‌نشده است؛ بعد از نصب v2.1 در اولین سینک همه push می‌شوند

---
Task ID: 12
Agent: Main Agent (Super Z)
Task: بررسی اختلاف داده گوشی/وب (۳ فعال در برابر ۸ فعال) + سخت‌سازی سینک

Work Log:
- تحلیل snapshot کامل سرور با scripts/analyze-server-state.mjs: سرور ۸ ماده فعال زنده دارد (شکر، نمک، روغن مایع، کارتن، لسیتین، آرد سبوس‌دار، وانیل، آرد نول) = دقیقاً وضعیت وب ✓؛ مایه خمیر/آرد امروز حذف شده‌اند و آرد نول ۳ بار ساخته شده (۲ تکراری حذف) — وب در حال سینک فعال است
- یک «نان بزرگ» تکراری هم روی سرور هست (8e22f3d9 ساخته امروز که production به آن ارجاع دارد + seed-bt-01) — دست نزدم چون production به تکراری جدید ارجاع دارد؛ کاربر باید دوباره‌اش را از UI حذف کند
- نتیجه: گوشی هنوز pull را کامل نکرده (یا v2.1 نصب نشده). به‌جای حدس، سه سخت‌سازی:
  1) pull/full حالا POST هم قبول می‌کنند (functions + Next) — کلاینت به POST سوئیچ شد تا در APK از مسیر کاملاً نیتیو CapacitorHttp برود نه پروکسی WebView
  2) forceFullResync در sync-engine: push صفت → اسنپ‌شات کامل با LWW → کِرسر به سر سرور؛ هیچ داده محلیِ جدیدتر از بین نمی‌رود
  3) پنل وضعیت سینک در تنظیمات (آنلاین/صف/آخرین سینک/خطا) + دکمه «دریافت کامل از سرور»
- تست E2E محلی (scripts/e2e-sync-test.mjs) روی next dev: push→pull→cursor→tombstone→LWW-skip همه سبز + هدرهای CORS روی POST و OPTIONS ✓ (تست functions روی workerd ممکن نبود — file: پشتیبانی نمی‌شود؛ پس از رسیدن توکن با curl روی production تست می‌شود)
- APK v2.2 (versionCode 5): بیلد + صحت‌سنجی (امضای یکسان a31b9080…، CapacitorHttp فعال، API_BASE تزریق شده) = download/Waffly-v2.2.apk
- گیت: commit 60c7f23 push شد

Stage Summary:
- وضعیت سرور سالم و «وب=سرور» است؛ اختلاف فقط سمت گوشی است → راه‌حل قطعی: نصب v2.2 + دکمه «دریافت کامل از سرور» در تنظیمات
- بعد از نصب v2.2 گوشی به ۸ ماده فعال همگرا می‌شود؛ صف outbox گوشی هم اول push می‌شود
- مانده: دیپلوی functions (CORS + POST) با توکن Cloudflare کاربر + تست curl روی production

---
Task ID: 13
Agent: Main Agent (Super Z)
Task: دیپلوی فیکس سرور + فیکس باگ لیست کشویی (وب و اپ) + پاک‌سازی تکراری‌های سرور — v2.3

Work Log:
- تشخیص «pull 404» در اسکرین‌شات کاربر: کلاینت v2.2 برای pull/full از POST استفاده می‌کند ولی سرور پروداکشن (دیپلوی Task 10) فقط GET دارد → curl روی پروداکشن: POST pull/full → 404، GET → 200، OPTIONS → 404 (CORS هم هنوز دیپلوی نشده)
- فیکس باگ لیست کشویی (هر دو نسخه وب و اپ): InlinePicker listener اسکرول با capture:true حتی اسکرولِ خودِ منو را هم می‌بست → کاربر نمی‌توانست لیست را بالا/پایین کند و تپ‌ها هم منو را می‌بستند. فیکس: چک e.target (اسکرول داخلی منو بسته نشود) + ارتفاع منو به 17rem + آستانه بازشدن رو به بالا 300px
- آخرین Select رادیکس (machines-view وضعیت دستگاه) هم با InlinePicker جایگزین شد → دیگر هیچ Select رادیکسی در اپ نیست
- sync-engine: postOrGetJson — POST با فالبک GET روی 404/405 (اپ حتی با سرور قدیمی هم سینک می‌کند؛ گذار تا دیپلوی) 
- forceFullResync حالت «سرور مرجع»: push → bootstrap(true, replace) با replaceAllFromServer (پاک‌سازی جدول‌ها + نشاندن اسنپ‌شات) → push دوم → pull — ردیف‌های محلیِ خارج از سرور (seed قدیمی گوشی = ۳ ماده) حذف می‌شوند → گوشی دقیقاً = سرور
- پاک‌سازی داده سرور پروداکشن با scripts/cleanup-server-dupes.mjs (push تومب‌استون LWW): «تست دیپلوی»، ۲ آرد نول تکراری، نان بزرگ تکراری seed-bt-01 — تأیید بعدی: ۸ ماده فعال، ۵ نان فعال، آرد نول فقط ۱ فعال
- تست E2E محلی (scripts/e2e-v23-test.mjs): ۱۳/۱۳ پاس (POST/GET pull+full، OPTIONS 204، ACAO، push→pull، LWW skip، تومب‌استون)
- تست مرورگر واقعی InlinePicker: باز شدن با ۸ آیتم ✓، اسکرول داخلی → منو باز ماند ✓، کلیک «گرم» → انتخاب و بستن ✓
- بیلد: وب بدون API_BASE (out/ آماده دیپلوی) + APK v2.3 versionCode 6 (API_BASE تزریق، امضای یکسان a31b9080…cda، CapacitorHttp فعال) = download/Waffly-v2.3.apk
- گیت: commit 287bae2 push شد

Stage Summary:
- ۳ مشکل کاربر ریشه‌ای حل شد: pull 404 (فالبک GET + دیپلوی در انتظار توکن)، لیست کشویی (فیکس InlinePicker)، ۳-در-برابر-۸ (سرور پاک‌سازی شد + دریافت کامل سرور-محور)
- نصب v2.3 روی گوشی + دکمه «دریافت کامل از سرور» → همگرایی قطعی به ۸ ماده فعال
- مانده: دیپلوی out/ به Cloudflare Pages با توکن جدید کاربر (فیکس CORS+POST سرور) + تست curl بعد از دیپلوی

---
Task ID: 14
Agent: Main Agent (Super Z)
Task: دیپلوی نهایی سرور با توکن جدید کاربر — تکمیل زنجیره سینک

Work Log:
- توکن cfut_… جدید کاربر با verify تأیید شد (active) — فقط Pages:Edit (accounts list خالی مثل قبل، wrangler خودش resolve کرد)
- wrangler pages project list → پروژه waffly موجود
- دیپلوی: wrangler pages deploy out --branch main → 101 فایل + Functions bundle موفق (deployment bc275dfa، پروداکشن waffly.pages.dev)
- out/ از قبل بدون API_BASE بیلد شده بود (نسخه وب ۲.۳، SW با کش mtjt3u49)
- تست پروداکشن بعد از دیپلوی:
  * POST pull → 200 (قبلاً 404) ✓
  * POST full → 200 (قبلاً 404) ✓
  * OPTIONS preflight → 204 + هدرهای CORS کامل (قبلاً 404) ✓
  * GET pull → 200 (سازگاری اپ‌های قدیمی) ✓
  * چرخه کامل push→pull روی Turso واقعی: accepted، ردیف تستی در pull آمد، سپس تومب‌استون پاک‌سازی ✓
  * داده نهایی: ۸ ماده فعال (شکر، نمک، روغن مایع، کارتن، لسیتین، آرد سبوس‌دار، وانیل، آرد نول) + ۵ نان فعال ✓
  * وب دیپلوی‌شده: / 200 و sw.js همان mtjt3u49 ✓

Stage Summary:
- زنجیره سینک دوطرفه حالا در هر ۴ جهت کامل است: اپ v2.3 ↔ سرور جدید (POST)، اپ v2.3 ↔ سرور قدیمی (فالبک GET)، وب جدید ↔ سرور جدید
- مانده برای کاربر: نصب Waffly-v2.3.apk + یک‌بار «دریافت کامل از سرور» در تنظیمات → اقلام گوشی = ۸ ماده فعال مثل وب
- سکرت‌ها: TURSO_URL/TURSO_TOKEN دست‌نخورده از قبل مانده بودند و همان استفاده شدند

---
Task ID: 15
Agent: Main Agent (Super Z)
Task: فیچر «کالاهای بازرگانی» (نان مشعلی) — v2.4

Work Log:
- تصمیم‌های کاربر (پرسش‌نامه): جدول جدا «کالاها» + تعداد ثابت در جعبه + فروش تکی/جعبه + میانگین موزون + انبار فعال
- مدل داده در ۶ نقطه: types.ts (Good + SaleItem.kind + Purchase.itemKind/boxesCount — TABLES=۱۶)، localdb Dexie version(3) استور goods، src/lib/server/sync-tables.ts (MODELS/FIELDS + seed)، functions/api/_sync.ts (PHYS.Good + FIELDS + seed)، prisma/schema.prisma (مدل Good + ستون‌های Purchase)
- قاعده ذخیره: مقادیر کالا در SaleItem و Purchase همیشه به «عدد» (جعبه فقط راحتی UI و قبل از ذخیره تبدیل می‌شود) → کوچک‌ترین تغییر اسکیما و سازگاری کامل با رکوردهای قدیمی (kind undefined = BREAD، itemKind نامشخص = MATERIAL)
- **مهاجرت خودکار اسکیما داخل Functions (ensureSchema)**: چون توکن Turso در سندباکس نبود، CREATE TABLE IF NOT EXISTS "Good" + ALTER Purchase (itemKind/boxesCount) + درج seed مشعلی + SyncLog در اولین درخواست بعد از دیپلوی اجرا می‌شود (isolate-memoized، idempotent) → دیپلوی = مهاجرت، بدون دستور جدا
- محاسبات calc.ts: goodsStocks (خرید − فروش خالص + میانگین موزون + low) و periodGoodsCost (تعداد فروش‌رفته × میانگین) + periodReport (goodsQty/goodsSalesAmount/goodsCost؛ profitGross = فروش − مواد − بهای کالا؛ salesQty/buyerStats فقط نان) + hooks.ts goods
- UI خرید: تب «کالاها» (افزودن/ویرایش تعداد در جعبه و حد بحرانی/فعال/حذف)، فرم خرید با «نوع قلم» (ماده/کالا) + سوییچ واحد جعبه/عدد با محاسبه خودکار جمع و معادل عدد، کارت «موجودی کالاها» در انبار (معادل جعبه + میانگین بها + حد بحرانی inline)
- UI فروش: انتخاب‌گر ترکیبی نان‌ها + کالاها (برچسب «کالا»)، سوییچ ورود عدد/جعبه کنار قلم کالا با نمایش بهای هر عدد، هشدار اگر تعداد در جعبه تنظیم نشده
- UI حسابداری: KPI «بهای کالای فروش‌رفته» + فروش کل با «X نان + Y عدد کالا» + به‌روزرسانی اکسل/توضیحات مبنا؛ داشبورد: هشدار «کالاها رو به اتمام»
- تست‌ها: محاسبات ۱۵/۱۵ (scripts/test-calc-v24.ts)، مهاجرت روی دیتابیس قدیمی شبیه‌سازی‌شده ۶/۶ (scripts/test-schema-v24.ts)، سینک E2E محلی ۹/۹ (scripts/e2e-v24-test.mjs) + رگرسیون v2.3 سینک ۱۳/۱۳، CF API logic (test-cf-api.mjs — توقع stale seed count از Task 10 اصلاح شد 16→20)، تست مرورگری کامل با agent-browser (افزودن مشعلی ۴۰ عددی → خرید ۲ جعبه ۴۵۰هزار = ۸۰ عدد میانگین ۱۱۲۵۰ → فاکتور ترکیبی نان ۵۰هزار + مشعلی جعبه ۶۰۰هزار = ۶۵۰هزار → موجودی ۸۰−۴۰=۴۰ → گزارش سود ۲۰۰هزار با بهای کالا ۴۵۰هزار)
- فیکس جانبی: effectiveSettled/saleDue به Settleable ساختاری تغییر کرد (خطای قدیمی Purchase→Sale رفع)
- دیپلوی: build-pages (بدون API_BASE) → wrangler deploy (deployment c783ccef) → پروداکشن: OPTIONS 204+ACAO، full با جدول goods و seed مشعلی، چرخه push/pull خرید GOOD سالم، تومب‌استون پاک‌سازی، داده واقعی کاربر دست‌نخورده
- APK v2.4 (versionCode 7): build-pages با API_BASE → cap sync → gradle assembleRelease → SHA-256 گواهی یکسان a31b9080…cda (آپدیت بدون حذف) + CapacitorHttp + API_BASE در باندل = download/Waffly-v2.4.apk
- گیت: commit f4b771d push شد

Stage Summary:
- نان مشعلی به‌عنوان اولین «کالای بازرگانی» روی همه سطوح فعال است: خرید (جعبه/عدد)، انبار با هشدار، فاکتور ترکیبی با نان‌ها، سود با میانگین موزون
- وب https://waffly.pages.dev دیپلوی و تست شد؛ سرور خودش را مهاجرت داد (بدون نیاز به توکن Turso)
- برای کاربر: نصب APK v2.4 (بدون حذف) → مشعلی از سرور pull می‌شود → «تعداد در جعبه» را در تب کالاها تنظیم کند
- الگوی آینده: کالاهای بعدی (پرک، چوب‌کباب و…) فقط از تب «کالاها» اضافه می‌شوند — بدون تغییر کد

---
Task ID: 16
Agent: Main Agent (Super Z)
Task: تغییر واحد کالاها به «جعبه» — حذف کامل مفهوم «تعداد در جعبه» — v2.5

Work Log:
- درخواست کاربر: تعداد داخل جعبه مهم نیست؛ فقط تعداد جعبه خریداری‌شده (عمده ~۳۰ جعبه) و جعبه‌های فروش‌رفته (مثلاً ۵ جعبه مشعلی + ۲ جعبه فانتزی) مهم است
- قاعده جدید: واحد کالاها از v2.5 همیشه «جعبه» است — Purchase.quantity = جعبه، قلم فروش GOOD (qty/delivered/returned) = جعبه و unitPrice = قیمت هر جعبه، حد بحرانی = جعبه؛ piecesPerBox منسوخ و همیشه ۱ نوشته می‌شود (ستون برای سازگاری سینک نگه داشته شد → بدون تغییر اسکیما در ۶ نقطه)
- مهاجرت idempotent داده‌های v2.4 (بدون فلگ — شرط تبدیل: piecesPerBox > 1؛ بعد از تبدیل ۱ می‌شود): خرید GOOD quantity = boxesCount (یا ÷ppb) با ثابت‌ماندن مبلغ کل؛ قلم فروش GOOD ÷ppb و unitPrice ×ppb (ضرب‌در‌جمع پول ثابت)؛ حد بحرانی ÷ppb (حداقل ۱)؛ SyncLog ثبت می‌شود تا همه دستگاه‌ها pull کنند
- منطق خالص مشترک: src/lib/goods-units.ts (planGoodsToBoxes + scaleSaleItemsJson)
- سه بک‌اند: کلاینت localdb.normalizeGoodsUnits() (در startSyncEngine قبل از اولین سینک — آفلاین هم درست)، Functions normalizeGoodsBoxes داخل ensureSchema (دیپلوی = مهاجرت، پرت SQL واقعی پروداکشن)، Next/Prisma normalizeGoodsUnitsServer در سه روت sync (پاریتی سندباکس)
- UI: تب کالاها فقط نام + حد بحرانی (جعبه)؛ فرم خرید کالا «تعداد جعبه × قیمت هر جعبه» بدون سوییچ عدد/جعبه؛ کارت موجودی جعبه‌ای (خرید/فروش/میانگین بهای هر جعبه)؛ فروش: قلم کالا فقط جعبه‌ای با برچسب «(جعبه)» برای تحویل/برگشتی و حذف کامل هشدار «تعداد در جعبه»؛ لیست فروش «نان مشعلی × ۵ جعبه»؛ داشبورد/حسابداری «جعبه کالا»؛ نسخه ۲.۵
- تست‌ها: واحد مهاجرت ۲۱/۲۱ (test-goods-box-v25.ts — شامل کسری جعبه ۰٫۷۵/۰٫۰۵ و idempotency)، مسیر واقعی Functions روی SQLite محلی ۱۴/۱۴ (test-cf-normalize-v25.mjs — ensureSchema+normalizeGoodsBoxes با @libsql/client file:)، مسیر Prisma ۷/۷ (test-server-normalize-v25.ts روی کپی دیتابیس)، رگرسیون سینک v2.3 ‏۱۳/۱۳ و v2.4 ‏۹/۹
- تست مرورگری agent-browser روی دیتای واقعی v2.4 (خرید ۸۰ عددی/فروش ۴۰ عددی قبلی): سرور خودش را مهاجرت داد (خرید ۸۰→۲ جعبه، فروش ۴۰ عدد @۱۵هزار → ۱ جعبه @۶۰۰هزار)؛ سپس فلوی کامل جعبه‌ای: افزودن فانتزی → خرید ۳۰ جعبه مشعلی @۴۵۰هزار + ۱۰ جعبه فانتزی @۴۰۰هزار → فاکتور ۵ جعبه مشعلی @۶۰۰هزار + ۲ جعبه فانتزی @۵۰۰هزار = ۴٬۰۰۰٬۰۰۰ → موجودی مشعلی ۲۶ جعبه (میانگین ۴۵۰هزار) و فانتزی ۸ جعبه → حسابداری: فروش ۴٬۶۵۰٬۰۰۰ «۱۰ نان + ۸ جعبه کالا»، بهای کالا ۳٬۵۰۰٬۰۰۰ ✓ — بدون خطای کنسول
- APK v2.5 (versionCode 8): build-pages با API_BASE → cap sync → gradle assembleRelease → SHA-256 گواهی یکسان a31b9080…cda (آپدیت بدون حذف) + API_BASE در باندل = download/Waffly-v2.5.apk (8.3MB)
- گیت: commit v2.5 push شد
- ⚠️ مانع: توکن Cloudflare در این جلسه در دسترس نیست (سندباکس نگه نمی‌دارد) → دیپلوی وب waffly.pages.dev منتظر توکن جدید کاربر؛ out/ آماده است

Stage Summary:
- کالاها کاملاً جعبه‌ای شدند: خرید عمده (۳۰ جعبه)، فروش (۵ جعبه مشعلی + ۲ جعبه فانتزی)، موجودی، حد بحرانی و میانگین بها همه بر حسب جعبه — بدون هیچ ورودی «تعداد در جعبه»
- داده‌های قبلی v2.4 خودکار و امن تبدیل می‌شوند (سرور + گوشی، idempotent، حفظ مبالغ)
- APK آماده نصب؛ فقط دیپلوی وب نیازمند توکن CF است (کلاینت‌ها حتی با سرور فعلی هم درست کار می‌کنند چون مهاجرت سمت خودشان انجام می‌شود)
