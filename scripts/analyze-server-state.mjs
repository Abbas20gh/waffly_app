// تحلیل کامل وضعیت سرور — مقایسه با انتظار (seed + مهاجرت v2)
const BASE = 'https://waffly.pages.dev'

async function main() {
  const res = await fetch(`${BASE}/api/sync/full`)
  if (!res.ok) { console.error('full failed', res.status); process.exit(1) }
  const data = await res.json()
  const byTbl = {}
  for (const { tbl, row } of data.rows) {
    (byTbl[tbl] ||= []).push(row)
  }
  console.log('cursor:', data.cursor)
  console.log('=== جدول‌ها ===')
  for (const [tbl, rows] of Object.entries(byTbl)) {
    const live = rows.filter(r => !r.deleted)
    console.log(`${tbl}: total=${rows.length} live=${live.length}`)
  }

  console.log('\n=== مواد (Material) — کامل ===')
  const mats = (byTbl.materials || []).sort((a, b) => a.updatedAt - b.updatedAt)
  for (const m of mats) {
    console.log(`  ${m.id.slice(0, 8)} | active=${m.active} del=${m.deleted} | ${m.name} | unit=${m.unit} | upd=${new Date(m.updatedAt).toISOString()}`)
  }

  console.log('\n=== انواع نان (BreadType) ===')
  for (const b of (byTbl.breadTypes || [])) {
    console.log(`  ${b.id.slice(0, 8)} | active=${b.active} del=${b.deleted} | ${b.name} | code=${b.code} | upd=${new Date(b.updatedAt).toISOString()}`)
  }

  console.log('\n=== دسته‌های هزینه (ExpenseCategory) ===')
  for (const c of (byTbl.expenseCategories || [])) {
    console.log(`  ${c.id.slice(0, 8)} | inc=${c.includeInProfit} del=${c.deleted} | ${c.name} | upd=${new Date(c.updatedAt).toISOString()}`)
  }

  console.log('\n=== سایر جداول کلیدی (۵ ردیف آخر هر کدام) ===')
  for (const tbl of ['productions', 'boxes', 'sales', 'purchases', 'consumptions', 'expenses', 'otherFunds', 'customers', 'suppliers', 'machines', 'machineCosts', 'settings']) {
    const rows = (byTbl[tbl] || []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
    console.log(`${tbl}:`)
    for (const r of rows) console.log(`  upd=${new Date(r.updatedAt).toISOString()} del=${r.deleted} id=${r.id.slice(0, 8)}`)
  }

  console.log('\n=== توزیع زمانی updatedAt (برای تشخیص pushهای تازه گوشی) ===')
  const buckets = {}
  for (const { tbl, row } of data.rows) {
    const d = new Date(row.updatedAt)
    const key = `${d.toISOString().slice(0, 10)} ${String(d.getUTCHours()).padStart(2, '0')}h`
    buckets[key] ||= 0
    buckets[key]++
  }
  for (const [k, v] of Object.entries(buckets).sort()) console.log(`  ${k} UTC → ${v} rows`)
}
main().catch(e => { console.error(e); process.exit(1) })
