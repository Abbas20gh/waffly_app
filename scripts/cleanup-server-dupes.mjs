#!/usr/bin/env node
// پاک‌سازی داده‌های آشفته سرور پروداکشن (waffly.pages.dev)
// روش: push تومب‌استون (deleted=1) با updatedAt جدید → LWW سرور می‌پذیرد → همه دستگاه‌ها با pull همگرا می‌شوند
// ردیف‌ها:
//  1) deploy-test-mt  «تست دیپلوی» — ردیف تستی قدیمی که دوباره فعال شده
//  2) 8785d91a-…      «آرد نول» تکراری ۱ (از ۳ نسخه، جدیدترین 755b9034 می‌ماند)
//  3) 58781f73-…      «آرد نول» تکراری ۲
//  4) seed-bt-01      «نان بزرگ» تکراری (کاربر «نان بزرگ» جدید 8e22f3d9 ساخته و تولیدها به همان ارجاع دارند)
// هیچ purchase/consumption/production به این ردیف‌ها ارجاع ندارد (تأییدشده با تحلیل full snapshot)

const BASE = process.env.WAFFLY_BASE || 'https://waffly.pages.dev'

const tombstones = [
  { tbl: 'materials', row: { id: 'deploy-test-mt', name: 'تست دیپلوی', unit: 'کیلوگرم', minStock: 0, active: 1, deleted: 1 } },
  { tbl: 'materials', row: { id: '8785d91a-80e3-4790-8108-f571461743c6', name: 'آرد نول', unit: 'کیلوگرم', minStock: 0, active: 1, deleted: 1 } },
  { tbl: 'materials', row: { id: '58781f73-553e-4862-9077-7f7efc9e9690', name: 'آرد نول', unit: 'کیلوگرم', minStock: 0, active: 1, deleted: 1 } },
  { tbl: 'breadTypes', row: { id: 'seed-bt-01', name: 'نان بزرگ', code: '01', active: 1, deleted: 1 } },
]

const now = Date.now()
const ops = tombstones.map((t, i) => ({ tbl: t.tbl, row: { ...t.row, updatedAt: now + i + 1 } }))

async function main() {
  console.log('== قبل از پاک‌سازی ==')
  await report()

  const res = await fetch(`${BASE}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops }),
  })
  console.log('push status:', res.status)
  const data = await res.json()
  console.log('push result:', JSON.stringify(data))
  if (!res.ok || data.accepted !== ops.length) {
    console.error('!! پاک‌سازی ناقص بود — توقف')
    process.exit(1)
  }

  console.log('== بعد از پاک‌سازی ==')
  await report()
}

async function report() {
  const r = await fetch(`${BASE}/api/sync/full`)
  const d = await r.json()
  const byTbl = {}
  for (const { tbl, row } of d.rows) (byTbl[tbl] = byTbl[tbl] || []).push(row)
  const activeMats = (byTbl.materials || []).filter(m => !m.deleted && m.active)
  const activeBts = (byTbl.breadTypes || []).filter(b => !b.deleted && b.active)
  console.log('مواد فعال:', activeMats.map(m => m.name).join('، '), `(${activeMats.length})`)
  console.log('نان‌های فعال:', activeBts.map(b => b.name).join('، '), `(${activeBts.length})`)
  const nools = (byTbl.materials || []).filter(m => m.name === 'آرد نول')
  console.log('آرد نول (همه حالت‌ها):', nools.map(n => `${n.id.slice(0, 8)} deleted=${n.deleted}`).join(' | '))
}

main().catch(e => { console.error(e); process.exit(1) })
