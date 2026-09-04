// بکاپ کامل Turso به JSON — قبل از مهاجرت اسکیمای v2
// اجرا: TURSO_URL=... TURSO_TOKEN=... node scripts/backup-turso.mjs [output.json]
import { createClient } from '@libsql/client'
import fs from 'node:fs'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) {
  console.error('✗ TURSO_URL و TURSO_TOKEN لازم است')
  process.exit(1)
}

const out = process.argv[2] || `db/turso-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
const db = createClient({ url, authToken: token })

const PHYS = ['BreadType', 'Production', 'Box', 'Material', 'Consumption', 'Customer', 'Sale',
  'Supplier', 'Purchase', 'Machine', 'MachineCost', 'ExpenseCategory', 'Expense', 'Setting', 'SyncLog']

const dump = { __app: 'waffly', __at: new Date().toISOString(), tables: {} }
for (const t of PHYS) {
  const res = await db.execute(`SELECT * FROM "${t}"`)
  const rows = res.rows.map((r) => {
    const o = {}
    for (let i = 0; i < res.columns.length; i++) o[res.columns[i]] = r[i]
    return o
  })
  dump.tables[t] = rows
  console.log(`${t}: ${rows.length} ردیف`)
}

fs.writeFileSync(out, JSON.stringify(dump, null, 2))
console.log(`✓ بکاپ کامل ذخیره شد: ${out}`)
