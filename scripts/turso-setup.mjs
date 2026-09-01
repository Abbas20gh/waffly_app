// راه‌اندازی Turso — ساخت جدول‌ها + انتقال داده‌های محلی (اختیاری)
// استفاده:
//   1) فقط ساخت جدول‌ها:      node scripts/turso-setup.mjs <libsql-url> <auth-token>
//   2) با انتقال داده محلی:   node scripts/turso-setup.mjs <libsql-url> <auth-token> --data
import { createClient } from '@libsql/client'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [url, token, ...flags] = process.argv.slice(2)
if (!url) {
  console.error('خطا: آدرس دیتابیس را بدهید (Turso: با libsql:// شروع می‌شود — برای تست محلی: file:...)')
  process.exit(1)
}
const withData = flags.includes('--data')

const turso = createClient({ url, authToken: token })

// ۱) تولید SQL از روی اسکیمای Prisma (بدون نیاز به اتصال)
console.log('⏳ تولید SQL از اسکیما...')
const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
)
console.log(`✓ SQL تولید شد (${sql.length} کاراکتر)`)

// ۲) اجرا روی Turso (CREATE TABLE IF NOT EXISTS مانند)
console.log('⏳ ساخت جدول‌ها روی Turso...')
await turso.executeMultiple(sql)
console.log('✓ جدول‌ها ساخته شدند')

// ۳) انتقال داده‌های محلی (اختیاری)
if (withData) {
  console.log('⏳ خواندن داده‌های محلی...')
  const local = new PrismaClient({ log: ['error'] })

  // نام جدول‌های فیزیکی SQLite/Prisma (بدون @@map نام جدول = نام مدل است)
  const TABLES = [
    'BreadType', 'Production', 'Box', 'Material', 'Consumption',
    'Customer', 'Sale', 'Supplier', 'Purchase', 'Machine',
    'MachineCost', 'ExpenseCategory', 'Expense', 'Setting',
  ]
  const MODELS = {
    BreadType: 'breadType', Production: 'production', Box: 'box',
    Material: 'material', Consumption: 'consumption', Customer: 'customer',
    Sale: 'sale', Supplier: 'supplier', Purchase: 'purchase',
    Machine: 'machine', MachineCost: 'machineCost',
    ExpenseCategory: 'expenseCategory', Expense: 'expense', Setting: 'setting',
  }

  let total = 0
  const existing = await turso.execute('SELECT COUNT(*) as c FROM SyncLog')
  const alreadyHas = Number(existing.rows[0]?.c ?? 0) > 0
  if (alreadyHas) {
    console.log('⚠️  Turso از قبل داده دارد — انتقال داده رد شد (برای جلوگیری از تداخل)')
  } else {
    for (const tbl of TABLES) {
      const model = MODELS[tbl]
      const delegate = local[model]
      const rows = await delegate.findMany()
      if (rows.length === 0) continue
      const cols = Object.keys(rows[0])
      const colList = cols.map(c => `"${c}"`).join(', ')
      for (const row of rows) {
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map(c => {
          const v = row[c]
          return typeof v === 'boolean' ? (v ? 1 : 0) : v
        })
        await turso.execute({
          sql: `INSERT OR REPLACE INTO "${tbl}" (${colList}) VALUES (${placeholders})`,
          args: values,
        })
      }
      total += rows.length
      console.log(`  ✓ ${tbl}: ${rows.length} ردیف`)
    }
    console.log(`✓ انتقال داده کامل شد — مجموع ${total} ردیف`)
  }
  await local.$disconnect()
}

console.log('🎉 Turso آماده است!')
console.log('   متغیرهای محیطی برای Vercel:')
console.log(`   DATABASE_URL = ${url}`)
console.log(`   DATABASE_URL_AUTH_TOKEN = ${token ? token.slice(0, 8) + '...' : '(توکن)'}`)
