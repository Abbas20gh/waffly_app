# 🍦 Waffly — سند مشخصات کامل پروژه (پرامپت زمینه‌ای برای هوش مصنوعی)

> **به هوش مصنوعیِ دریافت‌کننده:** این سند توصیف ۱۰۰٪ دقیق اپ «Waffly» است — اپی واقعی که همین الان روی این کد و این زیرساخت در حال استفاده است و داده واقعی روی سرور دارد. قبل از نوشتن یا تغییر هر خط کد، **کل این سند را بخوان**. بخش «قوانین حیاتی» (بخش ۱۲) قراردادهای غیرقابل‌نقض پروژه است؛ اگر درخواست کاربر با آن‌ها تضاد داشت، اول هشدار بده و راه امن را پیشنهاد کن.

---

## ۱) هویت پروژه

| مورد | مقدار |
|---|---|
| نام اپ | **Waffly** (وافلی) |
| کاربرد | حسابداری و مدیریت تولید «نان بستنی ایتالیایی» (نان سنتی وافلی): تولید روزانه، فروش، خرید مواد، دستگاه‌سازی، گزارش دوره حسابداری |
| زبان و جهت UI | فارسی، **RTL کامل**، تاریخ شمسی (جلالی)، اعداد فارسی در نمایش |
| پلتفرم‌ها | ۱) وب PWA روی Cloudflare Pages ۲) اپ اندروید Capacitor (APK) |
| آدرس production | https://waffly.pages.dev |
| دیتابیس مرکزی | Turso: `libsql://waffly-db-abbas20gh.aws-eu-west-1.turso.io` |
| ریپو گیت‌هاب | https://github.com/Abbas20gh/waffly_app (برنچ `main`) |
| نسخه فعلی | **v2.7.1** (versionCode 13) — APK امضاشده: `download/Waffly-v2.7.1.apk` (نسخه‌های قبلی هم نگه‌داری شده‌اند) |
| وضعیت | **زنده و در حال استفاده واقعی** — داده واقعی روی Turso و گوشی کاربر است؛ از دست رفتن داده فاجعه است |

## ۲) استک فناوری (با نسخه‌های دقیق)

- **فریمورک:** Next.js 16.1.x (App Router + Turbopack) + React 19 + TypeScript
- **استایل:** Tailwind CSS 4 + shadcn/ui (کامپوننت‌های Radix در `src/components/ui/`) + lucide-react
- **دیتای محلی کلاینت:** Dexie 4 روی IndexedDB (اسم دیتابیس: `waffly`)
- **ORM سمت Node:** Prisma 6.19 + `@prisma/adapter-libsql` (اگر `DATABASE_URL` با `libsql://` شروع شود از آداپتر Turso استفاده می‌کند، وگرنه موتور SQLite لوکال — فایل `src/lib/db.ts`)
- **بک‌اند production:** Cloudflare Pages Functions با **SQL خام** و `@libsql/client` (پوشه `functions/api/`)
- **دیتابیس:** Turso (libsql ابری) — منبع حقیقت
- **اپ اندروید:** Capacitor 8.5 (`com.abbas20gh.waffly`) + Gradle 8.14.3 + Android SDK 36 + JDK 21 (Temurin)
- **نمودار:** Recharts — **خروجی گزارش:** xlsx + jspdf + html2canvas-pro — **تاریخ:** react-multi-date-picker
- **PWA:** `public/manifest.webmanifest` + Service Worker دستی `public/sw.js` + آیکون‌های ۴۸ تا ۵۱۲ + maskable-512 + ۳۸ اسپلش iOS + فونت وزیرمتن لوکال (`public/fonts/`)
- **DevOps:** wrangler 4.127 (deploy)، توکن CF فقط پرمیشن Pages:Edit دارد

## ۳) معماری آفلاین‌فرست (مهم‌ترین ویژگی اپ — نباید شکسته شود)

```
[UI نماهای React] ← liveQuery ← [Dexie / IndexedDB] ← putRemoteRows (LWW)
       ↓ putRecord/putMany                    ↑
  [outbox صف] ── push (batch 400) ──→ سرور سینک (CF Functions / Next API)
                                          ↕
                                    [Turso — منبع حقیقت]
       ↑ pull افزایشی با cursor (batch 300) ← SyncLog
```

- **همه نوشتن‌ها اول لوکال هستند:** `putRecord`/`putMany` در Dexie می‌نویسند، رکورد را در `outbox` صف می‌کنند و `notifyChange()` صدا می‌زنند. UI هرگز منتظر شبکه نمی‌ماند و هرگز روی خطا کرش نمی‌کند.
- **نمایش داده:** نماها مستقیم از Dexie با `liveQuery`/هوک‌های `src/lib/hooks.ts` می‌خوانند، نه از سرور.
- **سینک دوطرفه:** push صف outbox با LWW + pull افزایشی بر اساس cursor از جدول `SyncLog` + bootstrap اولیه با snapshot کامل.
- **تریگرهای سینک:** بعد از هر تغییر داده (debounce ۱.۵ ثانیه)، هر ۲۰ ثانیه (polling)، رویداد `online`، و `visibilitychange`.
- **وضعیت سینک:** استور ماژول‌لول با `useSyncExternalStore` (`useSyncStore`) → کامپوننت `SyncBadge` در هدر (آنلاین/در حال سینک/در صف/خطا/آخرین سینک).
- **Real-time اختیاری:** socket.io فقط وقتی `NEXT_PUBLIC_SOCKET_URL` ست باشد فعال می‌شود (فقط محیط سندباکس)؛ در production فقط polling.

## ۴) نقشه فایل‌ها

```
├── prisma/schema.prisma            ← اسکیمای ۱۵ جدول (۱۴ سینک‌پذیر + SyncLog)
├── src/
│   ├── app/
│   │   ├── page.tsx                ← تک‌صفحه؛ ناوبری نماها با state (نه روت)
│   │   ├── layout.tsx              ← RTL، فونت وزیرمتن، متادیتا PWA
│   │   ├── globals.css             ← تم سبز تیره، کلاس waffly-num
│   │   └── api/                    ← بک‌اند Node (dev/standalone): sync/push|pull|full + backup
│   ├── components/waffly/          ← app-shell + ۷ نما + sync-badge + sw-register + pwa-install + jalali-date + bits
│   ├── components/ui/              ← shadcn/ui
│   └── lib/
│       ├── types.ts                ← TABLES (۱۴ استور منطقی camelCase) + اینترفیس‌ها + SyncOp
│       ├── localdb.ts              ← Dexie (۱۴ استور + outbox + meta) + putRecord/putMany/removeRecord/putRemoteRows + uid() + کاربر فعال
│       ├── sync-engine.ts          ← pushOutbox/pullIncremental/bootstrap/syncNow/scheduleSync/startSyncEngine + API_BASE
│       ├── server/sync-tables.ts   ← نسخه سرورِ Node: MODELS/FIELDS/sanitizeRow/ensureSeed
│       ├── db.ts                   ← Prisma client با آداپتر libsql شرطی
│       ├── calc.ts                 ← منطق کسب‌وکار (تسویه، بدحسابی، موجودی، سود دوره)
│       ├── boxcode.ts              ← کد کوتاه معنادار جعبه ۵ رقمی MMDDS (ماه + روز + شمارهٔ همان روز — v2.5.2)
│       ├── jalali.ts               ← ابزار تاریخ شمسی (تبدیل، مقایسه، بازه، جمع روز)
│       └── export.ts               ← خروجی اکسل/PDF/چاپ
├── functions/api/
│   ├── [[route]].ts                ← catch-all همه endpointها روی Cloudflare
│   └── _sync.ts                    ← نسخه SQL خامِ سینک (پاریتی کامل با sync-tables.ts) + seed + کش isolate کلاینت libsql
├── scripts/
│   ├── build-pages.mjs             ← بیلد استاتیک CF: مخفی‌کردن src/app/api → next build با CF_EXPORT=1 → restore + چک سلامت out/
│   ├── turso-setup.mjs             ← ساخت جدول‌ها در Turso (prisma migrate diff → executeMultiple) + انتقال داده با --data
│   ├── compare-counts.mjs          ← مقایسه تعداد ردیف‌ها بین SQLite لوکال و Turso
│   ├── test-cf-api.mjs             ← ۱۹ تست سینک (LWW، نرمال‌سازی تاریخ، تومب‌استون، cursor…)
│   └── gen-icons.mjs / gen-ios-splash.mjs / gen-apk-assets.mjs
├── android/                        ← پروژه گریدل کامل Capacitor + keystore/keystore.properties
├── public/                         ← manifest + sw.js + icons/ + splash/ + fonts/ + logo.svg
├── capacitor.config.ts             ← appId: com.abbas20gh.waffly، webDir: out
├── next.config.ts                  ← CF_EXPORT=1 → output:export + images unoptimized؛ وگرنه standalone
├── wrangler.toml                   ← پروژه Pages «waffly»، nodejs_compat، خروجی out/
├── .env.example                    ← قالب متغیرهای محیطی
└── mini-services/sync-service/     ← سرویس socket.io پورت 3003 (فقط برای real-time سندباکس — در production بی‌اثر)
```

## ۵) دیتابیس — ۱۷ جدول فیزیکی (۱۶ سینک‌پذیر + SyncLog)

نام فیزیکی جدول = نام مدل Prisma (PascalCase مثل `BreadType`) — بدون `@@map`. نام منطقی (در API/کلاینت) camelCase مثل `breadTypes`. نگاشت کامل در `PHYS` داخل `functions/api/_sync.ts`.

**ستون‌های مشترک همه جدول‌های سینک‌پذیر:** `id` (TEXT، ساخته‌شده سمت کلاینت با `crypto.randomUUID()`)، `updatedAt` (REAL، میلی‌ثانیه Date.now) ، `deleted` (INTEGER 0/1 تومب‌استون).

| # | استور منطقی | فیلدهای اختصاصی (به‌جز id/updatedAt/deleted) |
|---|---|---|
| 1 | breadTypes | name, code (کد داخلی ۲ رقمی — فقط برای سازگاری سینک، از v2.5.1 خودکار ساخته می‌شود و در UI نیست), active(0/1) |
| 2 | productions | date, breadTypeId, totalProduced, boxesCount, perBoxCount, waste, carriedFrom? (تاریخ اصلی اگر از دیروز منتقل شده), note?, createdBy? — ایندکس date |
| 3 | boxes | code (کد معنادار کوتاه MMDD+S از v2.5.2 — کدهای قدیمی ۱۰ رقمی TTDDMMNNSS معتبرند), productionId, breadTypeId, count, date, hasEssence (0/1 — اسانس در سطح هر جعبه), essenceType? (مثل پرتقالی — لیست ثابت ESSENCE_TYPES در types.ts، قابل‌گسترش), note? — ایندکس code/date/productionId |
| 4 | materials | name, unit (کیلوگرم/گرم/…), minStock, active (0/1 — غیرفعال فقط از انتخاب‌گرها حذف می‌شود، رکوردهای تاریخی می‌مانند) |
| 5 | consumptions | date, materialId, quantity, note?, createdBy? — ایندکس date |
| 6 | customers | name, phone?, address?, cooperationType? |
| 7 | sales | date, customerId, items (رشته JSON آرایه SaleItem: {breadTypeId, qty, unitPrice, delivered, returned, returnCost, kind?, boxId?, boxCode? از v2.7}), totalAmount, settledStatus (PAID/PARTIAL/UNPAID), paidAmount, paymentMethod (CASH/CARD/TRANSFER/CHECK), checkDueDate?, checkNumber?, checkBank?, paymentDate? (تاریخ وصول واقعی), note?, createdBy?, accountId? (v2.7) — ایندکس date/customerId |
| 8 | suppliers | name, phone?, address? |
| 9 | purchases | date, materialId, quantity, cost, supplierId?, settledStatus, paidAmount, note?, createdBy?, accountId? (v2.7 — حساب برداشت) — ایندکس date |
| 10 | machines | name, kind (BAKING=تجهیزات نانوایی / BUSINESS=دستگاه‌سازی تجاری), startDate, status (IN_PROGRESS/DONE/PAUSED), note? |
| 11 | machineCosts | machineId, kind (CONSUMABLE مصرفی / CAPITAL سرمایه‌ای), name, quantity, date, cost, note? — ایندکس machineId |
| 12 | expenseCategories | name, includeInProfit (0/1 — آیا در محاسبه سود دوره بیاید) |
| 13 | expenses | date, categoryId, amount, description?, createdBy?, accountId? (v2.7) — ایندکس date |
| 14 | otherFunds | date, type (IN ورود / OUT خروج), amount, **description (الزامی — منشأ پول)**, accountId? (v2.7) — ⚠️ **هرگز در فرمول‌های سود calc.ts استفاده نشود**؛ فقط کارت جدا «سایر وجوه» در dashboard/accounting — ایندکس date |
| 15 | accounts (جدول v2.7) | name, kind (BANK حساب بانکی / CASH صندوق نقدی), initialBalance (موجودی اولیه), note?, active — موجودی فعلی = initialBalance + Σورود − Σخروج (مشتق از sales.paidAmount/purchases.paidAmount/expenses.amount/otherFunds با accountId؛ هیچ جدول تراکنش موازی وجود ندارد) |
| 16 | settings | businessName (پیش‌فرض Waffly), monthStartDay (روز شروع دوره حسابداری، پیش‌فرض ۱), badDebtDays (آستانه بدحسابی، پیش‌فرض ۳۰), checkAlertDays (هشدار سررسید چک، پیش‌فرض ۷) — رکورد واحد با id=`main` |
| 17 | SyncLog | seq (autoincrement)، tbl، rid، ts — ثبت هر تغییر برای pull افزایشی؛ tbl با **نام منطقی camelCase** ذخیره می‌شود |

**Seed اولیه (ensureSeed — فقط وقتی DB خالی است، گارد وجود `seed-bt-01`):** Setting `main` + ۵ نوع نان + ۱۰ ماده اولیه (آرد، شکر، مایه خمیر **active=0**، نمک، روغن مایع، کارتن بسته‌بندی، لسیتین گرم، وانیل گرم، آرد سبوس‌دار) + ۴ سرفصل هزینه. اسکریپت مهاجرت داده‌های موجود: `scripts/migrate-v2.mjs` (idempotent — ستون‌ها + جدول + seed + ثبت SyncLog).

## ۶) API سینک — دو پیاده‌سازی موازی با پاریتی اجباری

⚠️ **دو بک‌اند وجود دارد و باید همیشه یکسان باشند:**
1. **production (Cloudflare):** `functions/api/[[route]].ts` + `functions/api/_sync.ts` — SQL خام روی Turso با `@libsql/client`، secrets پروژه Pages: `TURSO_URL` + `TURSO_TOKEN`
2. **Node (dev/standalone):** `src/app/api/sync/{push,pull,full}/route.ts` + `src/lib/server/sync-tables.ts` — با Prisma

### Endpointها (هر دو بک‌اند)
| متد/مسیر | ورودی | خروجی | رفتار |
|---|---|---|---|
| `GET /api` | — | Hello world | health |
| `POST /api/sync/push` | `{ops:[{tbl,row}]}` | `{accepted}` | LWW: اگر ردیف سرور جدیدتر یا هم‌زمان بود skip ولی در `accepted` شمرده می‌شود تا outbox کلاینت پاک شود؛ batch درج با `INSERT OR REPLACE` |
| `GET /api/sync/pull?since=&limit=` | cursor | `{rows:[{tbl,row}], cursor, hasMore}` | افزایشی از SyncLog با seq>since، به‌ترتیب، صفحه‌بندی |
| `GET /api/sync/full` | — | `{rows:[{tbl,row}], cursor, serverTime}` | snapshot کامل ۱۶ جدول برای bootstrap دستگاه جدید |
| `POST /api/backup` | — | فایل/لیست بکاپ | فقط Node؛ کپی SQLite با نگهداشت ۱۴ نسخه + auto روزانه؛ روی serverless → 501 با پیام فارسی |

- **شکل `row` در پاسخ‌ها با نام استورهای کلاینت (camelCase مثل `breadTypes`) است.**
- `sanitizeRow`: فقط فیلدهای مجاز هر جدول را نگه می‌دارد، نوع‌ها را اصلاح می‌کند (str/num/int/strNull) و در **فیلدهای تاریخ** (`date`, `carriedFrom`, `checkDueDate`, `paymentDate`, `startDate`) ارقام فارسی/عربی را به لاتین تبدیل می‌کند.
- `ensureSeed`: فقط اگر DB خالی باشد (گارد `seed-bt-01`) و تغییرات را در SyncLog ثبت می‌کند تا همه دستگاه‌ها بگیرند.

## ۷) موتور سینک کلاینت و لایه داده

**`src/lib/localdb.ts` (Dexie):**
- دیتابیس `waffly` نسخه ۱ با ۱۶ استور: ۱۴ استور داده + `outbox (++seq, ts)` + `meta (key)`
- ایندکس‌های هر استور در `version(1).stores(...)` تعریف شده‌اند (مثلاً sales: `id, updatedAt, date, customerId, settledStatus, paymentMethod`)
- `uid()`: `crypto.randomUUID()` با fallback
- `putRecord(tbl,row)` → `updatedAt=Date.now()` + put در Dexie + enqueue در outbox + `notifyChange()`
- `putMany` → bulkPut + bulkAdd در outbox (یک رویداد سینک برای گروه رکوردها مثل جعبه‌ها)
- `removeRecord` → تومب‌استون (`deleted:1`) — **هیچ‌جا hard-delete وجود ندارد**
- `putRemoteRows` → نوشتن silent داده سرور **با LWW** (ردیف با `updatedAt` بزرگ‌تر برنده است؛ ردیف قدیمی‌تر دور ریخته می‌شود) بدون enqueue
- کاربر فعال: `getActiveUser()/setActiveUser` روی `localStorage['waffly-user']` — فقط برای ثبت در `createdBy`

**`src/lib/sync-engine.ts`:**
- `export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''` — روی وب خالی (مسیر نسبی)؛ در بیلد APK = `https://waffly.pages.dev` (در زمان build تزریق می‌شود)
- `pushOutbox`: حلقه بسته‌های ۴۰۰تایی تا خالی شدن صف؛ بعد از هر batch موفق `clearOutboxUpTo(maxSeq)` — حتی skip شده‌ها پاک می‌شوند چون سرور نسخه جدیدتر را دارد
- `pullIncremental`: حلقه صفحات ۳۰۰تایی با cursor و گارد حداکثر ۲۰۰ دور
- `bootstrap`: **فقط وقتی دستگاه خالی است** — اگر `sales+productions+customers` لوکال > 0 باشد bootstrap نمی‌کند (حفظ داده کاربر) و فقط `markBootstrapped`
- `syncNow`: قفل با `running` + صف `syncQueued`؛ ترتیب: bootstrap → push → pull
- `startSyncEngine`: listeners برای `online/offline/waffly-data-changed/visibilitychange/focus` + `setInterval` هر ۲۰ ثانیه + **listeners کپاسیتور (`appStateChange` + `resume` با import پویا از @capacitor/app) — هر برگشت از پس‌زمینه اندروید فوراً syncNow** چون WebView تایمرها را throttle می‌کند و visibilitychange همیشه fire نمی‌شود؛ socket.io فقط با env صریح `NEXT_PUBLIC_SOCKET_URL` فعال می‌شود (در production/APK فقط polling)؛ تابع پاک‌سازی برمی‌گرداند
- `repairSync`: همه رکوردهای محلی را دوباره در outbox می‌ریزد (ابزار تعمیر دستی از تنظیمات)
- state سینک: `{online, syncing, pendingCount, lastSyncAt, error}` با `useSyncStore()`

## ۸) نماها و قابلیت‌ها (۷ نما — ناوبری state-based در `page.tsx` با `ViewKey`)

| نما | قابلیت‌ها |
|---|---|
| **dashboard** | ۵ کارت خلاصه + ۳ نمودار Recharts + هشدارها (موجودی بحرانی مواد، چک‌های نزدیک به سررسید `checkAlertDays`، بدحسابی‌ها) |
| **production** | ثبت تولید روزانه (نوع نان، تعداد کل، تعداد جعبه، تعداد در هر جعبه، ضایعات، انتقال از روز قبل با `carriedFrom`)، تولید خودکار جعبه‌ها با کد معنادار MMDD+S (شمارهٔ همان روز از nextBoxSerial بین همهٔ انواع +۱) + **بخش اختیاری اسانس در فرم (طعم از ESSENCE_TYPES + تعداد جعبه اسانس‌دار)**، **بخش بازشدنی «جعبه‌های این تولید» در کارت هر تولید با ویرایش/حذف تک‌تک جعبه‌ها** (دیالوگ ویرایش: نوع نان، سوییچ اسانس‌دار + طعم، یادداشت — کد چاپی ثابت می‌ماند)، مصرف مواد |
| **sales** | فروش **چندقلمی** (آیتم‌ها: نوع نان/تعداد/قیمت واحد/تحویلی/مرجوعی/هزینه مرجوع)، تسویه کامل و **جزئی** (`paidAmount`)، روش پرداخت نقد/کارت/کارت‌به‌کارت/**چک** (سررسید، شماره، بانک)، تاریخ وصول واقعی، مدیریت بدحسابی، مشتری‌ها با نوع همکاری |
| **purchases** | خرید مواد با قیمت و تامین‌کننده، موجودی انبار = خرید−مصرف با **حد بحرانی** (minStock) و میانگین قیمت، تسویه خریدها، تامین‌کننده‌ها، **مدیریت اقلام با فعال/غیرفعال** (غیرفعال از انتخاب‌گرهای خرید/مصرف حذف می‌شود ولی در لیست اقلام با نشان دیده می‌شود) |
| **machines** | دو نوع پروژه: تجهیزات نانوایی (BAKING) / دستگاه‌سازی تجاری (BUSINESS)؛ هزینه‌های مصرفی (CONSUMABLE) و سرمایه‌ای (CAPITAL)؛ سرمایه‌ای در سود دوره از مبنا جدا می‌شود |
| **accounting** | دوره حسابداری با **روز شروع دلخواه** (`monthStartDay`)، سود با **۳ مبنا**، تفکیک هزینه‌های `includeInProfit`، **بخش «سایر وجوه (خارج از حساب سود)» — ثبت/حذف IN/OUT با توضیح الزامی + خلاصه ورود/خروج/خالص که در هیچ فرمول سود وارد نمی‌شود**، **تب «حساب‌ها (بانک و صندوق)» از v2.7 (مدیریت حساب + موجودی + گردش)**، خروجی **اکسل/PDF/چاپ** (xlsx + jspdf + html2canvas-pro) |
| **settings** | نام کسب‌وکار، monthStartDay، badDebtDays، checkAlertDays، انتخاب کاربر فعال، بکاپ/دانلود دیتابیس (با API_BASE)، **تعمیر سینک** (repairSync)، نصب PWA (بنر + راهنمای iOS)، `storage.persist`، سرفصل هزینه‌ها (افزودن/تغییرنام/مشمول سود/حذف) |

**تأیید حذف (v2.7.0)**: هیچ دکمهٔ حذفی (🗑) مستقیم حذف نمی‌کند — همهٔ ~۱۶ نقطهٔ حذف (فروش، مشتری، بدحساب، تولید، جعبه، مصرف، نوع نان، خرید، کالا، تامین‌کننده، ماده، دستگاه، هزینهٔ دستگاه، سرفصل، سایر وجوه) دیالوگ «آیا مطمئن هستید؟» با دکمه‌های «حذف (قرمز) / انصراف» نشان می‌دهند — هوک مشترک `useConfirm` + `confirmRemove` در `bits.tsx` (هر کامپوننت خودش instance دارد و `{element}` را در JSX رندر می‌کند).

**فروش از جعبه با کد (v2.7.0)**: در هر قلم فروش (نان) یک انتخاب‌گر «کد جعبه» هست — کدهای معنادار ۵ رقمی با hint «نوع • تعداد عدد • مانده» — با انتخاب، نوع/تعداد/تحویل خودکار از جعبه پر می‌شود (قیمت دستی می‌ماند) و `boxId/boxCode` در JSON قلم ذخیره می‌شود؛ «مانده» = count − Σ(تحویل−برگشتی) همهٔ فروش‌های دیگر (memo `soldByBox`، فاکتور در حال ویرایش مستثنی)؛ فروش بیشتر از مانده هشدار قرمز می‌دهد؛ در لیست فروش‌ها کد جعبه چип می‌شود. انتخاب «بدون کد جعبه» = ثبت آزاد مثل قبل.

**حساب‌های بانکی/صندوق (v2.7.0)**: تب «حساب‌ها (بانک و صندوق)» در حسابداری — ساخت/ویرایش/حذف حساب (نام، BANK/CASH، موجودی اولیه، یادداشت)؛ موجودی هر حساب = موجودی اولیه + Σ paidAmount فروش‌هایی که «واریز به حساب» آن حساب‌اند + سایر وجوه ورود − Σ paidAmount خریدهای «پرداخت از حساب» − هزینه‌ها − سایر وجوه خروج (کاملاً مشتق — بدون جدول تراکنش؛ حذف فروش/خرید خودکار موجودی را اصلاح می‌کند)؛ «گردش‌ها»ی هر حساب = ادغام رکوردها با تاریخ و +/- رنگی؛ کارت «مجموع موجودی همه حساب‌ها». انتخاب‌گر حساب در فرم‌های فروش («واریز به حساب»)/خرید («پرداخت از حساب»)/سایر وجوه («حساب») — همه اختیاری.

**رفع باگ موقعیت منوها + باگ سینک دسته‌ای (v2.7.0)**: ① InlinePicker قبلاً position:fixed داخل DialogContent (والد transform دار) می‌داد → منو نسبت به دیالوگ موقعیت می‌گرفت و جابه‌جا/بریده می‌شد («لیست بالای صفحه باز می‌شود») + با هر اسکرول بسته می‌شد — الان منو با createPortal در body رندر می‌شود (دقیقاً ۴px زیر دکمه، فرار از overflow) و روی scroll جای‌گذاری مجدد می‌شود (دنبال دکمه می‌آید، بسته نمی‌شود). ② در `functions/api/_sync.ts` هر رکورد pull = ۱ SELECT و هر op push = SELECT+batch جدا بود → بیش از ~۲۵-۴۵ رکورد در یک درخواست، سقف ۵۰ subrequest کارگران ابری را می‌شکست (500) — حالا pull با یک SELECT گروهی `IN (...)` برای هر جدول و push با یک SELECT گروهی LWW + یک batch برای هر جدول کار می‌کند (~≤۳۵ subrequest در بدترین حالت).

**ویرایش همه‌جا (v2.6.0)**: هر رکورد ثبت‌شده دکمهٔ ویرایش (✏️ Pencil) دارد — تولید (تغییر تعداد جعبه: افزایش = جعبهٔ جدید با کد ادامه‌دار از `planProductionBoxes`، کاهش = حذف از آخر بر اساس کد؛ کدهای چاپی هرگز بازیافت/بازنویسی نمی‌شوند؛ تغییر نوع/تاریخ به جعبه‌های موجود cascade می‌شود و previewCodes فقط کدهای جدید را نشان می‌دهد)، فاکتور فروش (همهٔ اقلام JSON + تسویه + چک با بازمحاسبهٔ totalAmount)، خرید (همهٔ فیلدها؛ برای کالا اگر تعداد/قیمت دست‌نخورده باشد هزینهٔ اصلی حفظ می‌شود)، مصرف، مشتری، تامین‌کننده، کالا و ماده (نام/واحد/حد بحرانی)، نوع نان (نام)، دستگاه (نام/بخش/وضعیت/تاریخ/یادداشت)، هزینهٔ دستگاه، سرفصل هزینه (نام)، سایر وجوه. الگوی یکسان: state `editing` + پیش‌پرکردن همان فرم/دیالوگ + `putRecord` با همان id (createdBy حفظ، updatedAt جدید) → سینک LWW خودکار؛ همهٔ آمارها (موجودی، میانگین بها، سود دوره) زنده محاسبه می‌شوند و با ادیت خودشان اصلاح می‌شوند.

اجزای مشترک: `app-shell` (هدر سبز تیره `#13201A` با لوگو + سایدبار دسکتاپ + منوی کشویی موبایل + منوی کاربر فعال + `SyncBadge` + تاریخ شمسی امروز با کلاس `waffly-num`، هدر با `env(safe-area-inset-top)`)، `jalali-date` (پیکر شمسی با **نرمال‌سازی ارقام فارسی در onChange**)، **`inline-picker` (از v2.7: منو با createPortal در body + position:fixed با مختصات getBoundingClientRect — دقیقاً زیر دکمه، جای‌گذاری مجدد روی scroll؛ جایگزین اجباری `<Select>` داخل `<Dialog>` چون در WebView اندروید Radix Select داخل Dialog باز نمی‌شود)**، `bits` (قطعات کوچک UI)، `sw-register` (ثبت SW با گارد `window.Capacitor`).

## ۹) منطق کسب‌وکار (`calc.ts`، `boxcode.ts`، `jalali.ts`)

- **تاریخ‌ها همیشه رشته شمسی `YYYY/MM/DD` با ارقام لاتین** در DB ذخیره می‌شوند؛ مقایسه/بازه‌گیری رشته‌ای است و فقط با ارقام لاتین درست کار می‌کند
- **کد جعبه کوتاه معنادار (v2.5.2)**: ۵ رقم `MMDD S` — ماه شمسی (۲ رقم) + روز (۲ رقم) + شمارهٔ جعبهٔ همان روز (شروع از ۱؛ بین همهٔ انواع نان مشترک)؛ مثلاً 07263 = مهر ۲۶، جعبهٔ ۳ — `nextBoxSerial(کدها, تاریخ)` بزرگ‌ترین شمارهٔ همان روز +۱ (کدهای قدیمی ۱۰ رقمی نادیده/معتبر؛ بیش از ۹ جعبه در روز → کد ۶ رقمی، بیش از ۹۹ → ۷ رقمی — همچنان یکتا)؛ `planProductionBoxes(جعبه‌های زنده مرتب‌شده, تعداد جدید, تاریخ, همهٔ کدها)` برنامهٔ دلتای جعبه‌ها برای ویرایش تولید (v2.6) — کدهای جدید ادامه‌دار، حذف از آخر، بدون بازیافت کد
- `effectiveSettled`: باقی‌مانده ≤ ۰٫۵ تومان → PAID؛ پرداختی > ۰٫۵ → PARTIAL؛ وگرنه UNPAID
- `isBadDebt`: تسویه‌نشده که `daysSince(date) > badDebtDays`
- `effectivePaymentDate`: `paymentDate` یا در تسویه کامل تاریخ فروش — مبنای سود تعهدی-وصولی
- `materialStocks`: purchased−consumed، `avgPrice` از خریدها، `low = stock < minStock`
- دوره حسابداری: از `monthStartDay` (اگر امروز ≥ آن، دوره جاری؛ وگرنه دوره قبل)؛ سود ۳ مبنا: فروش − مواد/هزینه با تفکیک نقدی/تعهدی

## ۱۰) قوانین UI/UX

- **RTL کامل** و فارسی؛ فونت وزیرمتن لوکال (۴ وزن woff2 در `public/fonts/`)
- برند: سبز تیره — هدر `#13201A`، پس‌زمینه اسپلش/آیکون `#101613`، لوگو `public/icons/logo-64.png` و `public/logo.svg`
- **موبایل‌فرست** (کاربر اصلی روی گوشی است)؛ حالت دسکتاپ سایدبار دارد
- اعداد در نمایش فارسی با کلاس `waffly-num` (در globals.css)؛ ولی **داده ذخیره‌شده همیشه ارقام لاتین**
- ورودی تاریخ کاربر ممکن است ارقام فارسی باشد → نرمال‌سازی دو لایه (کلاینت onChange + سرور DATE_FIELDS)
- کامپوننت‌های shadcn/ui؛ toast با sonner؛ dialog/drawer برای فرم‌ها

## ۱۱) دیپلوی و گردش‌کار آپدیت

**وب (production):** Cloudflare Pages پروژه `waffly` → https://waffly.pages.dev
```bash
# بیلد استاتیک (src/app/api موقتاً مخفی می‌شود چون export نمی‌تواند API route داشته باشد)
CF_EXPORT=1 node scripts/build-pages.mjs
# دیپلوی (نیازمند env: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
npx wrangler pages deploy out --branch main
```
- secrets روی پروژه Pages: `TURSO_URL` + `TURSO_TOKEN` (با `wrangler pages secret put`)
- `next.config.ts`: با `CF_EXPORT=1` → `output:export` + images unoptimized؛ وگرنه `standalone`
- تست API سینک لوکال: `node scripts/test-cf-api.mjs` (۱۹ تست)

**APK اندروید (Capacitor):**
```bash
NEXT_PUBLIC_API_BASE=https://waffly.pages.dev CF_EXPORT=1 node scripts/build-pages.mjs
npx cap sync android          # خروجی out/ را داخل پروژه اندروید می‌ریزد
cd android && JAVA_HOME=<مسیر jdk21> ./gradlew assembleRelease
# خروجی: android/app/build/outputs/apk/release/app-release.apk
```
- appId: `com.abbas20gh.waffly` — **نسخه فعلی: versionCode 3 / versionName "2.0"** (در android/app/build.gradle — با هر آپدیت حتماً بالا برود)
- **آپدیت‌پذیری بدون حذف:** با همان applicationId + همان keystore، نصب APK جدید روی قبلی = آپدیت با حفظ داده؛ SHA-256 گواهی v1.0 و v2.0 یکسان است: `a31b9080…cda` (keystore: `android/keystore/waffly.keystore` + `keystore.properties` — قبل از انتشار Play چرخش شود)
- ثبت Service Worker داخل Capacitor غیرفعال است (گارد `window.Capacitor` در `sw-register.tsx` — حفظ شود)
- فایل APK فعلی: `download/Waffly-v2.0.apk` (v2.0، versionCode 3، امضاشده) + v1.0 نگه‌داری شده
- پلاگین `@capacitor/app` نصب است — listenerهای `appStateChange/resume` سینک فوری بعد از برگشت از پس‌زمینه (رفع باگ دیده‌نشدن داده وب روی گوشی)
- **نسخه‌گذاری SW:** `sw.js` placeholder `__WAFFLY_BUILD__` دارد که build-pages.mjs بعد از بیلد با شناسه یکتا پر می‌کند — هر دیپلوی کش PWA را باطل می‌کند

**دیتابیس Turso:**
- راه‌اندازی/انتقال: `node scripts/turso-setup.mjs [--data]` (ساخت ۱۷ جدول از اسکیما + INSERT OR REPLACE با گارد ضدتداخل)
- مهاجرت نسخه‌ای: `scripts/migrate-v2.mjs` (v2) — الگوی مهاجرت‌های بعدی هم همین: idempotent + ثبت SyncLog
- مقایسه تعداد ردیف‌ها با لوکال: `node scripts/compare-counts.mjs`

**dev لوکال:** `npm install` (postinstall = prisma generate) → `npx prisma db push` → `npm run dev` (پورت 3000) — با `DATABASE_URL=file:...` SQLite لوکال؛ seed خودکار در اولین درخواست ساخته می‌شود.

**git:** هر تغییر نهایی → commit و push به `origin/main` (github.com/Abbas20gh/waffly_app).

## ۱۲) قوانین حیاتی (RED LINES — نقض هرکدام = خرابی داده کاربر)

1. **id همیشه سمت کلاینت ساخته می‌شود** (`uid()`) — سرور هرگز id تولید نکند.
2. **`updatedAt` = میلی‌ثانیه کلاینت؛ برنده LWW ردیف جدیدتر است** — سرور `updatedAt` ردیف‌های معتبر را بازنویسی نکند.
3. **حذف فقط تومب‌استون** (`deleted:1`) — hard-delete ممنوع؛ تومب‌استون‌ها برای همیشه سینک می‌شوند.
4. **تاریخ = رشته شمسی با ارقام لاتین**؛ هر ورودی فارسی/عربی باید normalize شود (کلاینت onChange + سرور `DATE_FIELDS` در هر دو بک‌اند).
5. **هر تغییر اسکیما باید هم‌زمان در ۶ جا اعمال شود:** ① `prisma/schema.prisma` ② `src/lib/types.ts` ③ `src/lib/localdb.ts` (استور/ایندکس Dexie — با bump نسخه) ④ `src/lib/server/sync-tables.ts` (FIELDS) ⑤ `functions/api/_sync.ts` (FIELDS + PHYS) ⑥ جدول Turso (migration/SQL).
6. **منطق bootstrap هرگز نباید داده محلی دستگاه را پاک کند** — گارد «اگر داده محلی هست، full نگیر» حفظ شود.
7. **تنها مسیر نوشتن سرور = push از outbox است**؛ چیزی مستقیم به Turso ننویس مگر migration عمدی.
8. **پاریتی کامل دو بک‌اند** (`functions/api/_sync.ts` ↔ `src/lib/server/sync-tables.ts`) — هر تغییر منطق سینک در هر دو.
9. **آفلاین‌فرست بماند:** UI هرگز روی شبکه بلاک نشود؛ هر عملیات اول لوکال، بعد سینک.
10. **SW داخل Capacitor ثبت نشود** (گارد `window.Capacitor`).
11. **متن‌های UI فارسی و RTL**؛ تاریخ شمسی؛ نمایش اعداد فارسی ولی ذخیره لاتین.
12. **Turso منبع حقیقت است و داده واقعی دارد** — روی production با داده واقعی آزمایش نکن؛ تست فقط با ردیف‌های آزمایشی که بعد پاک می‌شوند.

## ۱۳) وضعیت فعلی و نکات شناخته‌شده (سپتامبر ۲۰۲۶ — نسخه v2.0)

- production سبز: صفحه اصلی 200، `/api` سلامت، full شامل ۱۰ ماده (سه ماده جدید + مایه خمیر غیرفعال)، جدول `OtherFund` فعال؛ تست E2E push→pull→تومب‌استون روی production پاس شد (نرمال‌سازی ارقام فارسی تاریخ سرور هم تست شد)
- **باگ سینک وب↔گوشی (v1) رفع شد:** ریشه = توقف JS در پس‌زمینه اندروید؛ راه‌حل = listenerهای کپاسیتور + focus + گارد socket
- **باگ Select در دیالوگ (v1) رفع شد:** ریشه = Portal تو در تو در WebView؛ راه‌حل = InlinePicker بدون Portal
- **مهاجرت v2 روی Turso اجرا شد:** ستون‌های active/hasEssence/essenceType/note + جدول OtherFund + غیرفعال‌شدن مایه خمیر + افزودن لسیتین/وانیل/آرد سبوس‌دار با ثبت SyncLog؛ بکاپ کامل قبل مهاجرت در `db/turso-backup-*.json` (لوکال)
- **باگ تاریخی رفع‌شده که باید بدانی:** پیکر تاریخ ارقام فارسی برمی‌گرداند → تاریخ‌های خراب در DB مقایسه رشته‌ای را می‌شکنند → راه‌حل: نرمال‌سازی دو لایه (بند ۱۲-۴) و ترمیم رکورد خراب با push دستی
- SyncLog در production فعال است (هر push یک ردیف می‌نویسد) — cursor دستگاه‌ها با آن پیش می‌رود
- سرویس socket.io در `mini-services/` فقط برای real-time محیط سندباکس است؛ روی Cloudflare بی‌اثر (polling 20s)
- توکن‌های حساس (CF/Turso) در این سند و در سورس **هست نیستند** — در Cloudflare Dashboard (secrets پروژه Pages) و `.env` لوکال کاربر هستند؛ به AI داده نشوند
- `.github/workflows/build-apk.yml` (CI ساخت APK) روی دیسک آماده است ولی تا وقتی توکن گیت‌هاب scope Actions/Workflow ندارد از push عمداً خارج مانده (در `.gitignore`)
- توصیه امنیتی معلق: چرخش توکن Cloudflare/Turso پس از تثبیت نهایی

## ۱۴) چک‌لیست هر تغییر (برای هوش مصنوعی)

- [ ] اسکیما را اگر لازم است در هر ۶ نقطه بند ۱۲-۵ آپدیت کردم (با bump نسخه Dexie)
- [ ] منطق سینک را در **هر دو** بک‌اند تغییر دادم (پاریتی)
- [ ] تست آفلاین: اینترنت قطع → ثبت رکورد → اینترنت وصل → سینک خودکار درست
- [ ] تست LWW: ویرایش هم‌زمان دو نسخه از یک رکورد → جدیدتر برنده، outbox پاک
- [ ] تست حذف: تومب‌استون به سرور رفت و در دستگاه دیگر هم حذف شد
- [ ] تست تاریخ: ورود تاریخ با ارقام فارسی → ذخیره با ارقام لاتین
- [ ] `CF_EXPORT=1 node scripts/build-pages.mjs` بدون خطا و out/ سالم (index/sw/manifest/icon)
- [ ] روی production دیپلوی + تست دود، سپس commit/push به گیت‌هاب
- [ ] اگر UI عوض شد: تست موبایل + RTL + (در صورت نیاز) بیلد مجدد APK با `NEXT_PUBLIC_API_BASE`

---
*پایان سند — این فایل را همراه با سورس کامل پروژه (یا لینک ریپو github.com/Abbas20gh/waffly_app) به هوش مصنوعی بده.*
