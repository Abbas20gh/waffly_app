#!/usr/bin/env node
// تست E2E سینک روی dev محلی (localhost:3000) — پوشش فیکس‌های v2.3:
//  1) POST pull/full روی API جدید → 200
//  2) GET pull/full (سازگاری سرور قدیمی) → 200
//  3) push → pull roundtrip با LWW
//  4) full بعد از push شامل ردیف جدید است
//  5) هدرهای CORS روی POST و OPTIONS (روت Next)
const BASE = process.env.TEST_BASE || 'http://localhost:3000'
let pass = 0, fail = 0
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function main() {
  console.log('== تست سینک روی', BASE, '==')

  // 1) POST pull
  let r = await fetch(`${BASE}/api/sync/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"since":0,"limit":300}' })
  check('POST pull → 200', r.status === 200, `status=${r.status}`)
  check('POST pull هدر ACAO دارد', (r.headers.get('access-control-allow-origin') || '') === '*')
  const pull0 = await r.json()
  check('شکل پاسخ pull', Array.isArray(pull0.rows) && typeof pull0.cursor === 'number')

  // 2) GET pull
  r = await fetch(`${BASE}/api/sync/pull?since=0&limit=300`)
  check('GET pull → 200 (سازگاری قدیمی)', r.status === 200, `status=${r.status}`)

  // 3) POST full
  r = await fetch(`${BASE}/api/sync/full`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  check('POST full → 200', r.status === 200, `status=${r.status}`)
  const full0 = await r.json()
  check('full شامل settings', full0.rows.some(x => x.tbl === 'settings'))

  // 4) GET full
  r = await fetch(`${BASE}/api/sync/full`)
  check('GET full → 200', r.status === 200, `status=${r.status}`)

  // 5) OPTIONS preflight
  r = await fetch(`${BASE}/api/sync/pull`, { method: 'OPTIONS' })
  check('OPTIONS → 204', r.status === 204, `status=${r.status}`)

  // 6) push ردیف تستی → pull می‌آید → تومب‌استون → pull تومب‌استون را می‌آورد
  const id = 'e2e-' + Date.now()
  r = await fetch(`${BASE}/api/sync/push`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops: [{ tbl: 'materials', row: { id, name: 'تست E2E', unit: 'عدد', minStock: 1, active: 1, updatedAt: Date.now(), deleted: 0 } }] }),
  })
  const pushRes = await r.json()
  check('push → accepted=1', r.status === 200 && pushRes.accepted === 1, JSON.stringify(pushRes))

  r = await fetch(`${BASE}/api/sync/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, limit: 300 }) })
  const pull1 = await r.json()
  const hit = pull1.rows.find(x => x.tbl === 'materials' && x.row.id === id)
  check('ردیف تستی در pull هست', !!hit)

  // 7) LWW: push قدیمی‌تر → skip
  r = await fetch(`${BASE}/api/sync/push`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops: [{ tbl: 'materials', row: { id, name: 'تست E2E قدیمی', unit: 'عدد', minStock: 1, active: 1, updatedAt: 1, deleted: 0 } }] }),
  })
  const lww = await r.json()
  check('LWW قدیمی → skipped=1', lww.skipped === 1, JSON.stringify(lww))

  // 8) تومب‌استون
  r = await fetch(`${BASE}/api/sync/push`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops: [{ tbl: 'materials', row: { id, name: 'تست E2E', unit: 'عدد', minStock: 1, active: 1, updatedAt: Date.now() + 5, deleted: 1 } }] }),
  })
  check('تومب‌استون accepted', (await r.json()).accepted === 1)
  r = await fetch(`${BASE}/api/sync/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, limit: 300 }) })
  const pull2 = await r.json()
  const hit2 = pull2.rows.find(x => x.tbl === 'materials' && x.row.id === id)
  check('تومب‌استون در pull با deleted=1', !!hit2 && hit2.row.deleted === 1)

  console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
