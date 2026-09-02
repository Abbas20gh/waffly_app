// تست مسیر واقعی Functions (پروداکشن CF) — نرمال‌سازی کالاها به جعبه روی SQLite محلی
// اجرا: bun scripts/test-cf-normalize-v25.mjs
// ensureSchema/normalizeGoodsBoxes همان کدی است که در Cloudflare Pages Functions اجرا می‌شود
import { createClient } from '@libsql/client'
import { rmSync, existsSync } from 'node:fs'
import { ensureSchema, normalizeGoodsBoxes } from '../functions/api/_sync.ts'

const DB_PATH = '/home/z/my-project/db/test-cf-v25.db'
if (existsSync(DB_PATH)) rmSync(DB_PATH)

let pass = 0, fail = 0
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

const db = createClient({ url: `file:${DB_PATH}` })

// schema حداقلی مثل دیتابیس v2.4 موجود (بعد از ensureSchema قبلی)
await db.execute(`CREATE TABLE IF NOT EXISTS "SyncLog" ("seq" INTEGER PRIMARY KEY AUTOINCREMENT, "tbl" TEXT NOT NULL, "rid" TEXT NOT NULL, "ts" REAL NOT NULL)`)
await db.execute(`CREATE TABLE IF NOT EXISTS "Good" ("id" TEXT PRIMARY KEY NOT NULL, "name" TEXT NOT NULL DEFAULT '', "piecesPerBox" REAL NOT NULL DEFAULT 0, "minStock" REAL NOT NULL DEFAULT 0, "active" INTEGER NOT NULL DEFAULT 1, "updatedAt" REAL NOT NULL DEFAULT 0, "deleted" INTEGER NOT NULL DEFAULT 0)`)
await db.execute(`CREATE TABLE IF NOT EXISTS "Purchase" ("id" TEXT PRIMARY KEY NOT NULL, "date" TEXT NOT NULL, "materialId" TEXT NOT NULL, "quantity" REAL NOT NULL DEFAULT 0, "cost" REAL NOT NULL DEFAULT 0, "supplierId" TEXT, "settledStatus" TEXT NOT NULL DEFAULT 'UNPAID', "paidAmount" REAL NOT NULL DEFAULT 0, "itemKind" TEXT NOT NULL DEFAULT 'MATERIAL', "boxesCount" REAL NOT NULL DEFAULT 0, "note" TEXT, "createdBy" TEXT, "updatedAt" REAL NOT NULL DEFAULT 0, "deleted" INTEGER NOT NULL DEFAULT 0)`)
await db.execute(`CREATE TABLE IF NOT EXISTS "Sale" ("id" TEXT PRIMARY KEY NOT NULL, "date" TEXT NOT NULL, "customerId" TEXT NOT NULL, "items" TEXT NOT NULL, "totalAmount" REAL NOT NULL DEFAULT 0, "settledStatus" TEXT NOT NULL DEFAULT 'UNPAID', "paidAmount" REAL NOT NULL DEFAULT 0, "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', "checkDueDate" TEXT, "checkNumber" TEXT, "checkBank" TEXT, "paymentDate" TEXT, "note" TEXT, "createdBy" TEXT, "updatedAt" REAL NOT NULL DEFAULT 0, "deleted" INTEGER NOT NULL DEFAULT 0)`)

const now = Date.now()
// داده v2.4 عددی — قبل از اولین ensureSchema درج می‌شود
await db.execute({ sql: `INSERT INTO "Good" (id,name,piecesPerBox,minStock,active,updatedAt,deleted) VALUES ('g-test','نان تست',40,20,1,?,0)`, args: [now] })
await db.execute({ sql: `INSERT INTO "Purchase" (id,date,materialId,quantity,cost,settledStatus,paidAmount,itemKind,boxesCount,updatedAt,deleted) VALUES ('p-test','2025-01-01','g-test',120,900000,'PAID',900000,'GOOD',3,?,0)`, args: [now] })
await db.execute({ sql: `INSERT INTO "Sale" (id,date,customerId,items,totalAmount,settledStatus,paidAmount,paymentMethod,updatedAt,deleted) VALUES ('s-test','2025-01-01','c-test',?,450000,'PAID',450000,'CASH',?,0)`, args: [
  JSON.stringify([{ breadTypeId: 'g-test', qty: 25, unitPrice: 18000, delivered: 25, returned: 5, returnCost: 0, kind: 'GOOD' }]), now,
] })

console.log('== اولین ensureSchema (شبیه اولین درخواست بعد از دیپلوی) ==')
await ensureSchema(db)

const g = await db.execute({ sql: `SELECT * FROM "Good" WHERE id = 'g-test'`, args: [] })
const p = await db.execute({ sql: `SELECT * FROM "Purchase" WHERE id = 'p-test'`, args: [] })
const s = await db.execute({ sql: `SELECT * FROM "Sale" WHERE id = 's-test'`, args: [] })

check('کالا: piecesPerBox → 1', Number(g.rows[0]['piecesPerBox']) === 1, String(g.rows[0]['piecesPerBox']))
check('کالا: حد بحرانی ۲۰ عدد → ۱ جعبه', Number(g.rows[0]['minStock']) === 1, String(g.rows[0]['minStock']))
check('خرید: ۱۲۰ عدد → ۳ جعبه (boxesCount مرجع)', Number(p.rows[0]['quantity']) === 3, String(p.rows[0]['quantity']))
check('خرید: مبلغ کل ثابت ۹۰۰هزار', Number(p.rows[0]['cost']) === 900000)
const items = JSON.parse(String(s.rows[0]['items']))
check('فروش: ۲۵ عدد → ۰٫۶۲۵ جعبه', items[0].qty === 0.625, String(items[0].qty))
check('فروش: برگشتی ۵ عدد → ۰٫۱۲۵', items[0].returned === 0.125)
check('فروش: قیمت هر جعبه ۷۲۰هزار (۱۸هزار×۴۰)', items[0].unitPrice === 720000, String(items[0].unitPrice))
check('فروش: ضرب‌در ثابت (۰٫۶۲۵×۷۲۰هزار = ۴۵۰هزار)', Math.round(items[0].qty * items[0].unitPrice) === 450000)
check('updatedAt ردیف‌ها به‌روز شد (برای LWW کلاینت‌ها)', Number(p.rows[0]['updatedAt']) > now - 60000 && Number(s.rows[0]['updatedAt']) > now - 60000)

const logs = await db.execute({ sql: `SELECT tbl, rid FROM SyncLog WHERE rid IN ('g-test','p-test','s-test')`, args: [] })
check('SyncLog برای هر ۳ ردیف ثبت شد (تا دستگاه‌ها pull کنند)', logs.rows.length >= 3, String(logs.rows.length))

console.log('== idempotency — اجرای دوباره ==')
await normalizeGoodsBoxes(db)
const g2 = await db.execute({ sql: `SELECT piecesPerBox, minStock FROM "Good" WHERE id = 'g-test'`, args: [] })
const p2 = await db.execute({ sql: `SELECT quantity FROM "Purchase" WHERE id = 'p-test'`, args: [] })
const s2 = await db.execute({ sql: `SELECT items FROM "Sale" WHERE id = 's-test'`, args: [] })
check('کالا تغییری نکرد', Number(g2.rows[0]['piecesPerBox']) === 1 && Number(g2.rows[0]['minStock']) === 1)
check('خرید تغییری نکرد', Number(p2.rows[0]['quantity']) === 3)
check('فروش تغییری نکرد', JSON.stringify(JSON.parse(String(s2.rows[0]['items']))) === JSON.stringify(items))

console.log('== seed مشعلی در ensureSchema ==')
const seed = await db.execute({ sql: `SELECT piecesPerBox FROM "Good" WHERE id = 'seed-gd-01'`, args: [] })
check('seed مشعلی با piecesPerBox=1', seed.rows.length === 1 && Number(seed.rows[0]['piecesPerBox']) === 1)

rmSync(DB_PATH)
console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
process.exit(fail ? 1 : 0)
