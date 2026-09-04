// مهاجرت اسکیمای v2 روی Turso — idempotent (چندبار اجرا امن است)
// ۱) ستون‌های جدید: Material.active, Box.hasEssence/essenceType/note, MachineCost.note
// ۲) جدول جدید: OtherFund
// ۳) داده: غیرفعال‌کردن مایه خمیر + افزودن لسیتین/وانیل/آرد سبوس‌دار — با ثبت SyncLog تا دستگاه‌ها بگیرند
// اجرا: TURSO_URL=... TURSO_TOKEN=... node scripts/migrate-v2.mjs
import { createClient } from '@libsql/client'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) { console.error('✗ TURSO_URL و TURSO_TOKEN لازم است'); process.exit(1) }

const db = createClient({ url, authToken: token })

async function tableCols(phys) {
  const res = await db.execute({ sql: `PRAGMA table_info("${phys}")`, args: [] })
  return new Set(res.rows.map((r) => String(r['name'])))
}

async function ensureColumn(phys, col, ddl) {
  const cols = await tableCols(phys)
  if (cols.has(col)) { console.log(`• ${phys}.${col} از قبل هست`); return }
  await db.execute(`ALTER TABLE "${phys}" ADD COLUMN ${ddl}`)
  console.log(`✓ ${phys}.${col} اضافه شد`)
}

// ۱) ستون‌ها
await ensureColumn('Material', 'active', `"active" INTEGER NOT NULL DEFAULT 1`)
await ensureColumn('Box', 'hasEssence', `"hasEssence" INTEGER NOT NULL DEFAULT 0`)
await ensureColumn('Box', 'essenceType', `"essenceType" TEXT`)
await ensureColumn('Box', 'note', `"note" TEXT`)
await ensureColumn('MachineCost', 'note', `"note" TEXT`)

// ۲) جدول OtherFund
const ofExists = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='OtherFund'`)
if (ofExists.rows.length === 0) {
  await db.executeMultiple(`
    CREATE TABLE "OtherFund" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "date" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'IN',
      "amount" REAL NOT NULL DEFAULT 0,
      "description" TEXT NOT NULL DEFAULT '',
      "updatedAt" REAL NOT NULL,
      "deleted" INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX "OtherFund_date_idx" ON "OtherFund" ("date");
  `)
  console.log('✓ جدول OtherFund ساخته شد')
} else {
  console.log('• جدول OtherFund از قبل هست')
}

// ۳) داده‌های seed جدید — فقط اگر از قبل نیستند (INSERT OR IGNORE بر اساس id)
const now = Date.now()
const newMaterials = [
  { id: 'seed-mt-07', name: 'لسیتین', unit: 'گرم', minStock: 500 },
  { id: 'seed-mt-08', name: 'وانیل', unit: 'گرم', minStock: 200 },
  { id: 'seed-mt-09', name: 'آرد سبوس‌دار', unit: 'کیلوگرم', minStock: 25 },
]

let syncNote = 0
const logSync = async (tbl, rid, ts) => {
  await db.execute({ sql: 'INSERT INTO SyncLog (tbl, rid, ts) VALUES (?, ?, ?)', args: [tbl, rid, ts] })
  syncNote++
}

// ۳-الف) مایه خمیر غیرفعال شود (فقط اگر هنوز فعال است)
const yeast = await db.execute({ sql: `SELECT id, active, updatedAt FROM "Material" WHERE id = 'seed-mt-03'`, args: [] })
if (yeast.rows.length > 0 && Number(yeast.rows[0]['active'] ?? 1) !== 0) {
  await db.execute({
    sql: `UPDATE "Material" SET active = 0, updatedAt = ? WHERE id = 'seed-mt-03'`,
    args: [now],
  })
  await logSync('materials', 'seed-mt-03', now)
  console.log('✓ «مایه خمیر» غیرفعال شد (حذف نشد)')
} else {
  console.log('• مایه خمیر: تغییر لازم نبود')
}

// ۳-ب) مواد جدید
for (const m of newMaterials) {
  const ex = await db.execute({ sql: `SELECT id FROM "Material" WHERE id = ?`, args: [m.id] })
  if (ex.rows.length > 0) { console.log(`• ${m.name} از قبل هست`); continue }
  await db.execute({
    sql: `INSERT INTO "Material" (id, name, unit, minStock, active, updatedAt, deleted) VALUES (?, ?, ?, ?, 1, ?, 0)`,
    args: [m.id, m.name, m.unit, m.minStock, now],
  })
  await logSync('materials', m.id, now)
  console.log(`✓ ماده جدید اضافه شد: ${m.name} (${m.unit})`)
}

console.log(`— ${syncNote} ردیف SyncLog ثبت شد تا همه دستگاه‌ها با pull بعدی بگیرند`)
console.log('🎉 مهاجرت v2 روی Turso کامل شد')
