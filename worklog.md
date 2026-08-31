
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
