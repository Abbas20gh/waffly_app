// تست ensureSchema روی دیتابیس «موجودی» بدون جدول Good (شبیه‌سازی پروداکشن Turso)
import { createClient } from '@libsql/client'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { ensureSchema, fullSnapshot } from '../functions/api/_sync'

const DB = 'db/.test-schema-v24.db'
if (fs.existsSync(DB)) fs.unlinkSync(DB)
const db = createClient({ url: `file:${DB}` })

let failed = 0
const ok = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++ }

async function main() {
// دیتابیس قدیمی: Purchase بدون itemKind/boxesCount، بدون Good، با seed قبلی
await db.executeMultiple(`
  CREATE TABLE "Purchase" ("id" TEXT PRIMARY KEY NOT NULL, "date" TEXT NOT NULL, "materialId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0, "cost" REAL NOT NULL DEFAULT 0, "updatedAt" REAL NOT NULL DEFAULT 0, "deleted" INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE "BreadType" ("id" TEXT PRIMARY KEY NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1, "updatedAt" REAL NOT NULL DEFAULT 0, "deleted" INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE "SyncLog" ("seq" INTEGER PRIMARY KEY AUTOINCREMENT, "tbl" TEXT NOT NULL, "rid" TEXT NOT NULL, "ts" REAL NOT NULL);
  INSERT INTO "BreadType" VALUES ('seed-bt-01', 'نان بزرگ', '01', 1, 1, 0);
`)
let failed = 0
const ok = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++ }

// مهاجرت
await ensureSchema(db)
const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='Good'`)
ok('جدول Good ساخته شد', tables.rows.length === 1)
const cols = await db.execute(`PRAGMA table_info("Purchase")`)
const names = cols.rows.map(r => String(r['name']))
ok('Purchase.itemKind اضافه شد', names.includes('itemKind'))
ok('Purchase.boxesCount اضافه شد', names.includes('boxesCount'))
const seed = await db.execute(`SELECT name, active FROM "Good" WHERE id='seed-gd-01'`)
ok('seed مشعلی درج شد', seed.rows.length === 1 && String(seed.rows[0].name).includes('مشعلی'))
const slog = await db.execute(`SELECT COUNT(*) c FROM SyncLog WHERE tbl='goods'`)
ok('SyncLog برای goods ثبت شد', Number(slog.rows[0].c) >= 1)

// idempotent — دوباره اجرا، خطا و تکرار ندارد
await ensureSchema(db)
const seed2 = await db.execute(`SELECT COUNT(*) c FROM "Good"`)
ok('اجرای دوم idempotent (بدون تکرار seed)', Number(seed2.rows[0].c) === 1)

// (fullSnapshot روی دیتابیس کامل در e2e-v24 تست شده — این دیتابیس ساختگی فقط ۳ جدول دارد)

let failedEnd = failed
fs.unlinkSync(DB)
console.log(failedEnd === 0 ? '\n🎉 مهاجرت خودکار سالم است' : `\n💥 ${failedEnd} شکست`)
process.exit(failedEnd ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
