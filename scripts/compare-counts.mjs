// مقایسه تعداد ردیف‌های دیتابیس محلی سندباکس با Turso
import { createClient } from '@libsql/client'

const MODELS = ['BreadType','Production','Box','Material','Consumption','Customer','Sale','Supplier','Purchase','Machine','MachineCost','ExpenseCategory','Expense','Setting','SyncLog']

const localUrl = process.env.LOCAL_DB_URL || 'file:/home/z/my-project/db/custom.db'
const tursoUrl = process.argv[2]
const tursoToken = process.argv[3]

const local = createClient({ url: localUrl })
const turso = createClient({ url: tursoUrl, authToken: tursoToken })

async function counts(db, label) {
  const out = {}
  for (const m of MODELS) {
    try {
      const r = await db.execute(`SELECT COUNT(*) as c FROM "${m}"`)
      out[m] = Number(r.rows[0][0])
    } catch {
      out[m] = 'ERR'
    }
  }
  console.log(`--- ${label} ---`)
  for (const [k, v] of Object.entries(out)) console.log(`${k}: ${v}`)
  return out
}

const l = await counts(local, 'LOCAL (sandbox sqlite)')
const t = await counts(turso, 'TURSO')

let diffs = []
for (const m of MODELS) if (l[m] !== t[m]) diffs.push(`${m}: local=${l[m]} turso=${t[m]}`)
console.log(diffs.length ? `\n⚠️ تفاوت‌ها:\n${diffs.join('\n')}` : '\n✓ همه جدول‌ها برابرند')
