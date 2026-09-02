// تست واحد نرمال‌سازی واحدهای کالا به «جعبه» (v2.5) — scripts/test-goods-box-v25.ts
// اجرا: bunx tsx scripts/test-goods-box-v25.ts
import { planGoodsToBoxes, scaleSaleItemsJson } from '../src/lib/goods-units'
import type { Good, Purchase, Sale } from '../src/lib/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${extra}`) }
}
const now = Date.now()

// ===== داده v2.4 (عددی) =====
const meshali: Good = { id: 'g-meshali', name: 'نان مشعلی', piecesPerBox: 40, minStock: 20, active: 1, updatedAt: now, deleted: 0 }
const fantazi: Good = { id: 'g-fantazi', name: 'نان فانتزی', piecesPerBox: 30, minStock: 0, active: 1, updatedAt: now, deleted: 0 }
const oldGood: Good = { id: 'g-old', name: 'کالا بدون تنظیم', piecesPerBox: 0, minStock: 5, active: 1, updatedAt: now, deleted: 0 }
const boxGood: Good = { id: 'g-box', name: 'کالا از قبل جعبه‌ای', piecesPerBox: 1, minStock: 2, active: 1, updatedAt: now, deleted: 0 }
const delGood: Good = { id: 'g-del', name: 'کالا حذف‌شده', piecesPerBox: 10, minStock: 1, active: 1, updatedAt: now, deleted: 1 }
const goods = [meshali, fantazi, oldGood, boxGood, delGood]

const purchases: Purchase[] = [
  // مشعلی: ۲ جعبه ۹۰۰هزار (ذخیره‌شده ۸۰ عدد)
  { id: 'p1', date: '1404-06-01', materialId: 'g-meshali', quantity: 80, cost: 900000, supplierId: null, settledStatus: 'PAID', paidAmount: 900000, itemKind: 'GOOD', boxesCount: 2, updatedAt: now, deleted: 0 },
  // مشعلی: خرید عددی ۴۰ عدد (بدون boxesCount) ۵۲۰هزار
  { id: 'p2', date: '1404-06-02', materialId: 'g-meshali', quantity: 40, cost: 520000, supplierId: null, settledStatus: 'PAID', paidAmount: 520000, itemKind: 'GOOD', boxesCount: 0, updatedAt: now, deleted: 0 },
  // فانتزی: ۳ جعبه ۶۰۰هزار
  { id: 'p3', date: '1404-06-03', materialId: 'g-fantazi', quantity: 90, cost: 600000, supplierId: null, settledStatus: 'PAID', paidAmount: 600000, itemKind: 'GOOD', boxesCount: 3, updatedAt: now, deleted: 0 },
  // ماده اولیه — نباید دست بخورد
  { id: 'p4', date: '1404-06-04', materialId: 'm-flour', quantity: 30, cost: 900000, supplierId: null, settledStatus: 'PAID', paidAmount: 900000, updatedAt: now, deleted: 0 },
  // کالای حذف‌شده — نباید دست بخورد
  { id: 'p5', date: '1404-06-05', materialId: 'g-del', quantity: 50, cost: 100000, supplierId: null, settledStatus: 'PAID', paidAmount: 100000, itemKind: 'GOOD', boxesCount: 5, updatedAt: now, deleted: 1 },
]

const sales: Sale[] = [
  {
    id: 's1', date: '1404-06-05', customerId: 'c1',
    // نان ۱۰۰ عدد + مشعلی ۳۰ عدد @۱۸هزار (برگشتی ۲ عدد) — جمع کالا ۵۴۰هزار − برگشت ۳۶هزار
    items: JSON.stringify([
      { breadTypeId: 'seed-bt-01', qty: 100, unitPrice: 5000, delivered: 100, returned: 0, returnCost: 0, kind: 'BREAD' },
      { breadTypeId: 'g-meshali', qty: 30, unitPrice: 18000, delivered: 30, returned: 2, returnCost: 0, kind: 'GOOD' },
    ]),
    totalAmount: 500000 + 540000, settledStatus: 'PAID', paidAmount: 1040000, paymentMethod: 'CASH', updatedAt: now, deleted: 0,
  },
  {
    id: 's2', date: '1404-06-06', customerId: 'c1',
    // فانتزی ۱۵ عدد @۲۲هزار = ۳۳۰هزار (نیم جعبه — کسری)
    items: JSON.stringify([
      { breadTypeId: 'g-fantazi', qty: 15, unitPrice: 22000, delivered: 15, returned: 0, returnCost: 0, kind: 'GOOD' },
    ]),
    totalAmount: 330000, settledStatus: 'PAID', paidAmount: 330000, paymentMethod: 'CASH', updatedAt: now, deleted: 0,
  },
]

console.log('— برنامه تبدیل —')
const plan = planGoodsToBoxes(goods, purchases, sales)

check('خرید p1: ۸۰ عدد → ۲ جعبه', plan.purchases.find(p => p.id === 'p1')?.quantity === 2)
check('خرید p2: ۴۰ عدد بدون boxesCount → ۱ جعبه', plan.purchases.find(p => p.id === 'p2')?.quantity === 1)
check('خرید p3: ۹۰ عدد → ۳ جعبه', plan.purchases.find(p => p.id === 'p3')?.quantity === 3)
check('خرید ماده اولیه p4 دست‌نخورده', !plan.purchases.find(p => p.id === 'p4'))
check('خرید کالای حذف‌شده p5 دست‌نخورده', !plan.purchases.find(p => p.id === 'p5'))

const s1next = JSON.parse(plan.sales.find(s => s.id === 's1')?.items || '[]') as Array<Record<string, number | string>>
const s1good = s1next.find(it => it.kind === 'GOOD') as Record<string, number> | undefined
check('فروش s1: مشعلی ۳۰ عدد → ۰٫۷۵ جعبه', s1good?.qty === 0.75, `got ${s1good?.qty}`)
check('فروش s1: delivered هم ۰٫۷۵', s1good?.delivered === 0.75)
check('فروش s1: برگشتی ۲ عدد → ۰٫۰۵ جعبه', s1good?.returned === 0.05, `got ${s1good?.returned}`)
check('فروش s1: قیمت هر عدد ۱۸هزار → هر جعبه ۷۲۰هزار', s1good?.unitPrice === 720000, `got ${s1good?.unitPrice}`)
check('فروش s1: نان دست‌نخورده', (s1next.find(it => it.kind === 'BREAD') as Record<string, number> | undefined)?.qty === 100)
check('فروش s1: ضرب‌در‌جمع کالا ثابت (۰٫۷۵×۷۲۰هزار = ۵۴۰هزار)', Math.round((s1good?.qty || 0) * (s1good?.unitPrice || 0)) === 540000)

const s2next = JSON.parse(plan.sales.find(s => s.id === 's2')?.items || '[]') as Array<Record<string, number>>
check('فروش s2: فانتزی ۱۵ عدد → ۰٫۵ جعبه', s2next[0]?.qty === 0.5, `got ${s2next[0]?.qty}`)
check('فروش s2: قیمت جعبه ۶۶۰هزار (۲۲×۳۰)', s2next[0]?.unitPrice === 660000, `got ${s2next[0]?.unitPrice}`)

check('کالا مشعلی: حد ۲۰ عدد → ۱ جعبه', plan.goods.find(g => g.id === 'g-meshali')?.minStock === 1)
check('کالا فانتزی: حد ۰ → ۰ می‌ماند', plan.goods.find(g => g.id === 'g-fantazi')?.minStock === 0)
check('کالاهای بدون تبدیل (ppb=0/1) در برنامه نیستند', !plan.goods.find(g => g.id === 'g-old') && !plan.goods.find(g => g.id === 'g-box'))
check('کالای حذف‌شده در برنامه نیست', !plan.goods.find(g => g.id === 'g-del'))

console.log('— idempotency —')
// شبیه‌سازی وضعیت بعد از تبدیل: piecesPerBox = 1 و مقادیر جعبه‌ای
const goods2: Good[] = [
  { ...meshali, piecesPerBox: 1, minStock: 1 },
  { ...fantazi, piecesPerBox: 1, minStock: 0 },
  oldGood, boxGood,
]
const purchases2: Purchase[] = [
  { ...purchases[0], quantity: 2, boxesCount: 2 },
  { ...purchases[1], quantity: 1, boxesCount: 1 },
  { ...purchases[2], quantity: 3, boxesCount: 3 },
  purchases[3],
]
const sales2: Sale[] = [
  { ...sales[0], items: plan.sales.find(s => s.id === 's1')!.items },
  { ...sales[1], items: plan.sales.find(s => s.id === 's2')!.items },
]
const plan2 = planGoodsToBoxes(goods2, purchases2, sales2)
check('اجرای دوم: هیچ تغییری نمی‌دهد',
  plan2.goods.length === 0 && plan2.purchases.length === 0 && plan2.sales.length === 0,
  JSON.stringify(plan2))

console.log('— scaleSaleItemsJson (کمک‌تابع) —')
const scale = new Map([['g1', 12]])
check('نال برای فروش بدون قلم مرتبط', scaleSaleItemsJson('[{"breadTypeId":"x","kind":"BREAD"}]', scale) === null)
const sc = scaleSaleItemsJson('[{"breadTypeId":"g1","qty":24,"unitPrice":10000,"delivered":24,"returned":0,"returnCost":0,"kind":"GOOD"}]', scale)
const scParsed = JSON.parse(sc || '[]') as Array<Record<string, number>>
check('تبدیل ۲۴ عدد @۱۰هزار → ۲ جعبه @۱۲۰هزار', scParsed[0]?.qty === 2 && scParsed[0]?.unitPrice === 120000)
check('JSON خراب → نال', scaleSaleItemsJson('{bad', scale) === null)

console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
if (fail > 0) process.exit(1)
