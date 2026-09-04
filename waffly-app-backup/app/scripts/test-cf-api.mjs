// تست محلی منطق Pages Functions — همان کدی که روی Cloudflare اجرا می‌شود
import { createClient } from '@libsql/client'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { fullSnapshot, pushOps, pullRows, ensureSeed, sanitizeRow } from '../functions/api/_sync'

const DB = '/tmp/cf-test.db'
for (const f of [DB, DB + '-journal', DB + '-wal', DB + '-shm']) fs.existsSync(f) && fs.rmSync(f)

// ساخت اسکیما از Prisma (همان که روی Turso اجرا شده)
const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', { encoding: 'utf8' })
const db = createClient({ url: `file:${DB}` })
await db.executeMultiple(sql)
console.log('✓ اسکیما ساخته شد')

let failed = 0
const ok = (cond, name) => {
  console.log((cond ? '✓' : '✗ FAILED') + ' ' + name)
  if (!cond) failed++
}

// ۱) full روی دیتابیس خالی → seed خودکار
const full1 = await fullSnapshot(db)
ok(full1.rows.length === 20, `full خالی → seed ۲۰ ردیف (گرفت ${full1.rows.length})`)
ok(full1.cursor > 0, `cursor > 0 (=${full1.cursor})`)

// ۲) seed دوباره → تکراری نباشد
const seeded2 = await ensureSeed(db)
ok(seeded2 === false, 'seed دوباره → false')

// ۳) push رکورد جدید با تاریخ فارسی → نرمال‌سازی
const t1 = 1788100000000
const r1 = await pushOps(db, [
  { tbl: 'productions', row: { id: 'p-01', date: '۱۴۰۴/۰۶/۰۹', breadTypeId: 'seed-bt-01', totalProduced: 500, boxesCount: 25, perBoxCount: 20, waste: 2, note: 'تست', updatedAt: t1, deleted: 0 } },
])
ok(r1.accepted === 1 && r1.skipped === 0, `push جدید → accepted:1 (گرفت ${JSON.stringify(r1)})`)

// ۴) همان رکورد با همان updatedAt → skip (LWW)
const r2 = await pushOps(db, [
  { tbl: 'productions', row: { id: 'p-01', date: '1404/06/09', breadTypeId: 'seed-bt-01', totalProduced: 999, updatedAt: t1, deleted: 0 } },
])
ok(r2.skipped === 1 && r2.accepted === 0, 'push با updatedAt برابر → skipped')

// ۵) push قدیمی‌تر → skip
const r3 = await pushOps(db, [
  { tbl: 'productions', row: { id: 'p-01', totalProduced: 111, updatedAt: t1 - 5000, deleted: 0 } },
])
ok(r3.skipped === 1, 'push قدیمی‌تر → skipped')

// ۶) push جدیدتر → accept و مقدار عوض شود
const r4 = await pushOps(db, [
  { tbl: 'productions', row: { id: 'p-01', date: '1404/06/10', breadTypeId: 'seed-bt-01', totalProduced: 600, boxesCount: 30, perBoxCount: 20, waste: 1, updatedAt: t1 + 5000, deleted: 0 } },
])
ok(r4.accepted === 1, 'push جدیدتر → accepted')
const got = await db.execute(`SELECT * FROM Production WHERE id='p-01'`)
ok(Number(got.rows[0]['totalProduced']) === 600, 'مقدار به‌روز شد (600)')
ok(String(got.rows[0]['date']) === '1404/06/10', `تاریخ لاتین ذخیره شد (=${got.rows[0]['date']})`)
ok(got.rows[0]['note'] === null || got.rows[0]['note'] === undefined, 'فیلد حذف‌شده → NULL')

// ۷) فیلدهای غیرمجاز حذف شوند (sanitize)
const san = sanitizeRow('breadTypes', { id: 'x', name: 'نان', code: '09', active: 1, hacker: 'drop table', updatedAt: 1, deleted: 0 })
ok(san && !('hacker' in san), 'sanitize فیلد غیرمجاز را حذف کرد')

// ۸) pull افزایشی
const full2 = await fullSnapshot(db)
const pul = await pullRows(db, full2.cursor, 300)
ok(pul.rows.length === 0, `pull با cursor آخر → خالی (گرفت ${pul.rows.length})`)
const pul2 = await pullRows(db, 0, 300)
ok(pul2.rows.length >= 17, `pull از صفر → همه رکوردها (گرفت ${pul2.rows.length})`)
ok(pul2.cursor >= full2.cursor, 'cursor درست پیش رفت')

// ۹) soft delete با deleted=1 (تومب‌استون) — timestamp باید از seed (الان) جدیدتر باشد
const tDel = Date.now() + 20000
const r5 = await pushOps(db, [
  { tbl: 'materials', row: { id: 'seed-mt-01', name: 'آرد', unit: 'کیلوگرم', minStock: 25, updatedAt: tDel, deleted: 1 } },
])
ok(r5.accepted === 1, 'تومب‌استون → accepted')
const mat = await db.execute(`SELECT deleted FROM Material WHERE id='seed-mt-01'`)
ok(Number(mat.rows[0]['deleted']) === 1, 'deleted=1 ذخیره شد')

// ۱۰) شکل JSON ردیف‌ها مثل Prisma باشد (کلیدها)
const sample = pul2.rows.find((r) => r.tbl === 'settings')
ok(sample && 'businessName' in sample.row && 'monthStartDay' in sample.row, 'شکل ردیف settings درست')
const sale = pul2.rows.find((r) => r.tbl === 'sales')
ok(sale === undefined, 'جدول خالی sales در full نیامده')

console.log(failed === 0 ? '\n🎉 همه تست‌ها پاس شد' : `\n💥 ${failed} تست شکست خورد`)
process.exit(failed === 0 ? 0 : 1)
