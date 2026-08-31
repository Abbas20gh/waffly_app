
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
