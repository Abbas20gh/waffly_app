// بازیابی شکل دقیق رکوردهای ledgerEntries از سرور زنده (v3.3.0) — برای بازسازی سورس
const BASE = 'https://app.artanon.ir/api'
const res = await fetch(`${BASE}/sync/full`)
const data = await res.json()
const rows = data.rows || []
const byTbl = {}
for (const r of rows) byTbl[r.tbl] = (byTbl[r.tbl] || 0) + 1
console.log('== تعداد ردیف هر جدول ==')
for (const [t, c] of Object.entries(byTbl).sort()) console.log(t, c)
console.log('== ستون‌های ledgerEntries (از ردیف واقعی) ==')
const led = rows.filter((r) => r.tbl === 'ledgerEntries')
if (led.length > 0) {
  console.log('columns:', Object.keys(led[0].row).join(', '))
  console.log('== نمونه رکوردها (۵ تا) ==')
  for (const r of led.slice(0, 5)) console.log(JSON.stringify(r.row, null, 1))
  console.log('== مقادیر kind یکتا ==', [...new Set(led.map((r) => r.row.kind))].join(' | '))
} else {
  console.log('هیچ رکورد ledger در سرور نیست — فقط جدول خالی ساخته شده')
}
// appUsers برای اطمینان از ساختار ورود
const users = rows.filter((r) => r.tbl === 'appUsers')
console.log('== appUsers ==', users.length, users.length ? Object.keys(users[0].row).join(', ') : '')
