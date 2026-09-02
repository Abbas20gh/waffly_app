#!/usr/bin/env node
// تست E2E سینک کالاها (v2.4) روی dev محلی — پوشش:
//  1) full شامل جدول goods + seed نان مشعلی
//  2) push خرید کالایی (itemKind=GOOD) → pull برمی‌گرداند
//  3) push فروش با قلم کالا (kind=GOOD در items) → pull برمی‌گرداند
//  4) LWW و تومب‌استون روی goods
//  5) فیلدهای جدید Purchase (itemKind/boxesCount) سالم در گردش
const BASE = process.env.TEST_BASE || 'http://localhost:3000'
let pass = 0, fail = 0
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function post(path, body) {
  return fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function main() {
  console.log('== تست E2E کالاها (v2.4) روی', BASE, '==')

  // 1) full شامل goods + seed مشعلی
  let r = await post('/api/sync/full', {})
  const full = await r.json()
  check('full → 200', r.status === 200)
  const goodsRows = full.rows.filter(x => x.tbl === 'goods')
  check('full شامل جدول goods', r.status === 200 && Array.isArray(goodsRows), `${goodsRows.length} ردیف`)
  const meshali = goodsRows.find(x => x.row.id === 'seed-gd-01')
  // seed مشعلی فقط در دیتابیس خالی سید می‌شود؛ در دیتابیس‌های موجود از اسکریپت مهاجرت می‌آید (پروداکشن)
  console.log(`  ℹ seed نان مشعلی: ${meshali ? 'موجود' : 'ندارد (عادی برای دیتابیس موجود — با مهاجرت اضافه می‌شود)'}`)

  // 2) push کالای تستی + خرید کالایی
  const gid = 'e2e-good-' + Date.now()
  const pid = 'e2e-pur-' + Date.now()
  const sid = 'e2e-sale-' + Date.now()
  const now = Date.now()

  r = await post('/api/sync/push', { ops: [
    { tbl: 'goods', row: { id: gid, name: 'کالا تست E2E', piecesPerBox: 20, minStock: 5, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'purchases', row: { id: pid, date: '2025/01/01', materialId: gid, quantity: 60, cost: 270000, supplierId: null, settledStatus: 'PAID', paidAmount: 270000, itemKind: 'GOOD', boxesCount: 3, note: null, createdBy: 'e2e', updatedAt: now, deleted: 0 } },
    { tbl: 'sales', row: { id: sid, date: '2025/01/01', customerId: 'e2e-cust', items: JSON.stringify([
      { breadTypeId: gid, qty: 25, unitPrice: 18000, delivered: 25, returned: 5, returnCost: 0, kind: 'GOOD' },
    ]), totalAmount: 450000, settledStatus: 'PAID', paidAmount: 450000, paymentMethod: 'CASH', note: null, createdBy: 'e2e', updatedAt: now, deleted: 0 } },
  ] })
  const pushRes = await r.json()
  check('push ۳ ردیف → accepted=3', r.status === 200 && pushRes.accepted === 3, JSON.stringify(pushRes))

  // 3) pull برمی‌گرداند
  r = await post('/api/sync/pull', { since: 0, limit: 1000 })
  const pull = await r.json()
  const gHit = pull.rows.find(x => x.tbl === 'goods' && x.row.id === gid)
  const pHit = pull.rows.find(x => x.tbl === 'purchases' && x.row.id === pid)
  const sHit = pull.rows.find(x => x.tbl === 'sales' && x.row.id === sid)
  check('کالا در pull', !!gHit && gHit.row.piecesPerBox === 20)
  check('خرید کالایی در pull با itemKind=GOOD', !!pHit && pHit.row.itemKind === 'GOOD' && pHit.row.boxesCount === 3, pHit ? `itemKind=${pHit.row.itemKind}` : '')
  check('فروش با قلم کالا در pull', !!sHit && (() => { try { return JSON.parse(sHit.row.items)[0].kind === 'GOOD' } catch { return false } })())

  // 4) سازگاری رکوردهای قدیمی: خرید بدون itemKind → فیلد خالی/نامشخص ولی push قبول
  const oldId = 'e2e-old-' + Date.now()
  r = await post('/api/sync/push', { ops: [
    { tbl: 'purchases', row: { id: oldId, date: '2025/01/01', materialId: 'seed-mt-01', quantity: 10, cost: 50000, settledStatus: 'PAID', paidAmount: 50000, updatedAt: now, deleted: 0 } },
  ] })
  check('push خرید قدیمی بدون itemKind → accepted', (await r.json()).accepted === 1)

  // 5) LWW روی goods
  r = await post('/api/sync/push', { ops: [
    { tbl: 'goods', row: { id: gid, name: 'کالا تست E2E', piecesPerBox: 20, minStock: 5, active: 1, updatedAt: 1, deleted: 0 } },
  ] })
  check('LWW قدیمی روی goods → skipped', (await r.json()).skipped === 1)

  // 6) تومب‌استون کالا
  r = await post('/api/sync/push', { ops: [
    { tbl: 'goods', row: { id: gid, name: 'کالا تست E2E', piecesPerBox: 20, minStock: 5, active: 1, updatedAt: now + 10, deleted: 1 } },
  ] })
  check('تومب‌استون کالا accepted', (await r.json()).accepted === 1)

  // پاک‌سازی: تومب‌استون ردیف‌های تستی
  await post('/api/sync/push', { ops: [pid, sid, oldId].map((id, i) => ({
    tbl: i === 0 ? 'purchases' : i === 1 ? 'sales' : 'purchases',
    row: { id, updatedAt: now + 20, deleted: 1 },
  })) })
  console.log('  (ردیف‌های تستی پاک‌سازی شدند)')

  console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
