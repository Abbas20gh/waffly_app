// تست واحد محاسبات کالای بازرگانی (نان مشعلی) — v2.4
import {
  goodsStocks, periodGoodsCost, periodReport, buyerStats,
  type DataBundle,
} from '../src/lib/calc'
import { todayJalali, periodOf } from '../src/lib/jalali'
import type { Good, Purchase, Sale, SaleItem } from '../src/lib/types'

const today = todayJalali()
const now = Date.now()
const G = 'good-meshali'
const C = 'cust-1'
const B = 'seed-bt-01'

const good: Good = { id: G, name: 'نان مشعلی', piecesPerBox: 40, minStock: 10, active: 1, updatedAt: now, deleted: 0 }
const p1: Purchase = { id: 'p1', date: today, materialId: G, quantity: 80, cost: 900000, supplierId: null, settledStatus: 'PAID', paidAmount: 900000, itemKind: 'GOOD', boxesCount: 2, updatedAt: now, deleted: 0 }
const p2: Purchase = { id: 'p2', date: today, materialId: G, quantity: 40, cost: 520000, supplierId: null, settledStatus: 'PAID', paidAmount: 520000, itemKind: 'GOOD', boxesCount: 1, updatedAt: now, deleted: 0 }
const breadItem: SaleItem = { breadTypeId: B, qty: 100, unitPrice: 5000, delivered: 100, returned: 0, returnCost: 0, kind: 'BREAD' }
const goodItem: SaleItem = { breadTypeId: G, qty: 30, unitPrice: 18000, delivered: 30, returned: 2, returnCost: 10000, kind: 'GOOD' }
const sale: Sale = {
  id: 's1', date: today, customerId: C, items: JSON.stringify([breadItem, goodItem]),
  totalAmount: 100 * 5000 + 30 * 18000 - 10000, settledStatus: 'PAID', paidAmount: 100 * 5000 + 30 * 18000 - 10000,
  paymentMethod: 'CASH', updatedAt: now, deleted: 0,
}

const d: DataBundle = {
  breadTypes: [{ id: B, name: 'نان بزرگ', code: '01', active: 1, updatedAt: now, deleted: 0 }],
  productions: [], materials: [], goods: [good], consumptions: [],
  customers: [{ id: C, name: 'مشتری تست', updatedAt: now, deleted: 0 }],
  sales: [sale], suppliers: [], purchases: [p1, p2],
  machines: [], machineCosts: [], expenseCategories: [], expenses: [], otherFunds: [],
  setting: { id: 'main', businessName: 'W', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: 0, deleted: 0 },
}

let failed = 0
function check(name: string, actual: unknown, expected: unknown, tol = 0.51) {
  const ok = typeof expected === 'number'
    ? Math.abs((actual as number) - expected) <= tol
    : JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '✅' : '❌'} ${name} → ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
  if (!ok) failed++
}

// ۱) میانگین موزون: (900000 + 520000) / (80 + 40) = 11833.33
const gs = goodsStocks(d)
check('تعداد کالاهای فعال در انبار', gs.length, 1)
check('خرید کل (عدد)', gs[0].purchased, 120)
check('فروش خالص (۳۰ تحویل − ۲ برگشتی)', gs[0].sold, 28)
check('موجودی', gs[0].stock, 92)
check('میانگین بهای هر عدد', gs[0].avgPrice, 1420000 / 120, 0.01)

// ۲) بهای کالای فروش‌رفته دوره = ۲۸ × میانگین
const period = periodOf(today, 1)
check('periodGoodsCost', periodGoodsCost(d, period), 28 * (1420000 / 120), 1)

// ۳) گزارش دوره: فروش کل شامل نان + کالا؛ سود = فروش − مواد(۰) − بهای کالا
const rep = periodReport(d, period)
check('فروش کل', rep.salesAmount, 500000 + 540000 - 10000)
check('تعداد نان (کالا نباید بشمارد)', rep.salesQty, 100)
check('تعداد عدد کالا', rep.goodsQty, 30)
check('فروش کالا', rep.goodsSalesAmount, 540000)
check('سود ناخالص', rep.profitGross, 1030000 - 28 * (1420000 / 120), 1)

// ۴) خریداران: تعداد فقط نان
const bs = buyerStats(d, period)
check('qty خریدار فقط نان', bs[0].qty, 100)

// ۵) خرید اشتباهی ماده نباید به انبار کالا بخورد
const d2 = { ...d, purchases: [...d.purchases, { ...p1, id: 'p3', materialId: 'other-good', itemKind: 'GOOD' as const }] }
check('خرید کالای نامرتبط اثر ندارد', goodsStocks(d2)[0].purchased, 120)

// ۶) حد بحرانی: موجودی ۹۲ > ۱۰ → بدون هشدار؛ با حد ۱۰۰ → هشدار
check('بدون هشدار (حد ۱۰)', gs[0].low, false)
const gHigh = { ...good, minStock: 100 }
const d3 = { ...d, goods: [gHigh] }
check('هشدار (حد ۱۰۰)', goodsStocks(d3)[0].low, true)

console.log(failed === 0 ? '\n🎉 همه تست‌های محاسبات کالا سبز' : `\n💥 ${failed} تست شکست خورد`)
process.exit(failed === 0 ? 0 : 1)
