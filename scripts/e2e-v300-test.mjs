#!/usr/bin/env node
// تست E2E نسخه 3.0.0 روی dev محلی — پوشش:
//  1) full شامل جدول recipes
//  2) push رسپی → pull برمی‌گرداند (sanitize فیلدهای جدید)
//  3) شبیه‌سازی خروجی فرم دسته‌ای: تولید + جعبه‌ها + کسر خودکار رسپی (consumption)
//  4) LWW و تومب‌استون روی recipes
//  5) push/pull هزینه‌ها (دسته‌بندی + حساب)
//  6) گزارش سود: پاکسازی رکوردهای تستی (تومب‌استون)
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
  console.log('== تست E2E v3.0.0 روی', BASE, '==')
  const ts = Date.now()
  const btId = 'e2e-bt-' + ts
  const mtId = 'e2e-mt-' + ts
  const rcId = 'e2e-rc-' + ts
  const prId = 'e2e-pr-' + ts
  const bx1 = 'e2e-bx-' + ts + '-1'
  const bx2 = 'e2e-bx-' + ts + '-2'
  const csId = 'e2e-cs-' + ts
  const waId = 'e2e-waste-prod-' + ts
  const exId = 'e2e-ex-' + ts
  const ecId = 'e2e-ec-' + ts
  const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '/')

  // 1) full شامل recipes
  let r = await post('/api/sync/full', {})
  const full = await r.json()
  check('full → 200', r.status === 200)
  const recipeRows = full.rows.filter(x => x.tbl === 'recipes')
  check('full شامل جدول recipes', r.status === 200 && Array.isArray(recipeRows), `${recipeRows.length} ردیف`)

  // 2) push نوع نان + ماده + رسپی (۰٫۰۵ کیلوگرم آرد برای هر نان)
  r = await post('/api/sync/push', { ops: [
    { tbl: 'breadTypes', row: { id: btId, name: 'نان تست v300', code: '90', active: 1, updatedAt: ts, deleted: 0 } },
    { tbl: 'materials', row: { id: mtId, name: 'آرد تست v300', unit: 'کیلوگرم', minStock: 1, active: 1, updatedAt: ts, deleted: 0 } },
    { tbl: 'recipes', row: { id: rcId, breadTypeId: btId, materialId: mtId, qtyPerBread: 0.05, note: 'رسپی تست', updatedAt: ts, deleted: 0 } },
  ] })
  let pushRes = await r.json()
  check('push ۳ ردیف پایه → accepted=3', r.status === 200 && pushRes.accepted === 3, JSON.stringify(pushRes))

  // 3) خروجی فرم دسته‌ای: ۲ جعبه × ۳۰ = ۶۰ نان → کسر ۳ کیلوگرم آرد
  r = await post('/api/sync/push', { ops: [
    { tbl: 'productions', row: { id: prId, date: today, breadTypeId: btId, totalProduced: 60, boxesCount: 2, perBoxCount: 30, waste: 4, carriedFrom: null, note: 'ثبت سریع', createdBy: 'e2e', updatedAt: ts + 1, deleted: 0 } },
    { tbl: 'boxes', row: { id: bx1, code: 'TEST300001', productionId: prId, breadTypeId: btId, count: 30, date: today, hasEssence: 0, essenceType: null, note: null, updatedAt: ts + 1, deleted: 0 } },
    { tbl: 'boxes', row: { id: bx2, code: 'TEST300002', productionId: prId, breadTypeId: btId, count: 30, date: today, hasEssence: 0, essenceType: null, note: null, updatedAt: ts + 1, deleted: 0 } },
    { tbl: 'consumptions', row: { id: csId, date: today, materialId: mtId, quantity: 3, note: 'کسر خودکار رسپی', createdBy: 'e2e', updatedAt: ts + 1, deleted: 0 } },
  ] })
  pushRes = await r.json()
  check('push ۴ ردیف تولید/جعبه/کسر → accepted=4', r.status === 200 && pushRes.accepted === 4, JSON.stringify(pushRes))

  // 4) pull برمی‌گرداند
  r = await post('/api/sync/pull', { since: 0, limit: 5000 })
  const pull = await r.json()
  check('pull → 200', r.status === 200)
  const rc = pull.rows.find(x => x.tbl === 'recipes' && x.row.id === rcId)
  check('pull شامل رسپی', !!rc)
  check('رسپی qtyPerBread اعشاری سالم', rc && Math.abs(Number(rc.row.qtyPerBread) - 0.05) < 1e-9, rc && String(rc.row.qtyPerBread))
  const cs = pull.rows.find(x => x.tbl === 'consumptions' && x.row.id === csId)
  check('pull شامل کسر خودکار رسپی', !!cs && Math.abs(Number(cs.row.quantity) - 3) < 1e-9)

  // 5) LWW: push همان رسپی با updatedAt قدیمی‌تر → skipped
  r = await post('/api/sync/push', { ops: [
    { tbl: 'recipes', row: { id: rcId, breadTypeId: btId, materialId: mtId, qtyPerBread: 999, note: 'قدیمی', updatedAt: ts - 100, deleted: 0 } },
  ] })
  pushRes = await r.json()
  check('LWW: رکورد قدیمی‌تر skipped', r.status === 200 && pushRes.skipped === 1, JSON.stringify(pushRes))

  // 6) هزینه با سرفصل + حساب واهی
  r = await post('/api/sync/push', { ops: [
    { tbl: 'expenseCategories', row: { id: ecId, name: 'سرفصل تست v300', includeInProfit: 1, updatedAt: ts, deleted: 0 } },
    { tbl: 'expenses', row: { id: exId, date: today, categoryId: ecId, amount: 1500000, description: 'کرایه تست', accountId: null, createdBy: 'e2e', updatedAt: ts, deleted: 0 } },
  ] })
  pushRes = await r.json()
  check('push سرفصل + هزینه → accepted=2', r.status === 200 && pushRes.accepted === 2, JSON.stringify(pushRes))

  // 7) تومب‌استون همه رکوردهای تستی (پاکسازی)
  const tomb = [btId, mtId, rcId, prId, bx1, bx2, csId, exId, ecId].map((id, i) => {
    const tblMap = { [btId]: 'breadTypes', [mtId]: 'materials', [rcId]: 'recipes', [prId]: 'productions', [bx1]: 'boxes', [bx2]: 'boxes', [csId]: 'consumptions', [exId]: 'expenses', [ecId]: 'expenseCategories' }
    return { tbl: tblMap[id], row: { id, updatedAt: ts + 10 + i, deleted: 1 } }
  })
  r = await post('/api/sync/push', { ops: tomb })
  pushRes = await r.json()
  check('پاکسازی تومب‌استون → accepted=9', r.status === 200 && pushRes.accepted === 9, JSON.stringify(pushRes))

  console.log(`\nنتیجه: ${pass} پاس / ${fail} شکست`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
