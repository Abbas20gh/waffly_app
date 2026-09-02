// واحد کالاها از v2.5 همیشه «جعبه» است — نه «عدد».
// این ماژول منطق خالص تبدیل یک‌بارهٔ داده‌های قدیمی (v2.4 که به «عدد» ذخیره می‌کرد) را دارد:
//   * شرط تبدیل: good.piecesPerBox > 1 (یعنی رکوردهایش هنوز عددی‌اند)
//   * خرید GOOD: quantity = boxesCount (یا quantity ÷ piecesPerBox) — مبلغ کل (cost) ثابت می‌ماند
//   * قلم فروش GOOD: qty/delivered/returned ÷ piecesPerBox و unitPrice × piecesPerBox → ضرب‌در‌جمع پول ثابت می‌ماند
//   * حد بحرانی هم به جعبه مقیاس می‌شود (حداقل ۱)
// بعد از تبدیل piecesPerBox = 1 نوشته می‌شود → اجرای دوباره تابع، برنامهٔ خالی می‌دهد (idempotent و بدون فلگ)
import type { Good, Purchase, Sale } from './types'

const r4 = (x: number) => Math.round(x * 10000) / 10000

export interface GoodsBoxPlan {
  goods: { id: string; minStock: number }[]
  purchases: { id: string; quantity: number }[]
  sales: { id: string; items: string }[]
}

interface SaleItemLike {
  breadTypeId: string
  qty?: number
  unitPrice?: number
  delivered?: number
  returned?: number
  returnCost?: number
  kind?: string
}

/** مقیاس‌پذیری‌های لازم را پیدا می‌کند — خروجی برای هر سه بک‌اند (Dexie / Turso SQL / Prisma) */
export function planGoodsToBoxes(goodsIn: Good[], purchasesIn: Purchase[], salesIn: Sale[]): GoodsBoxPlan {
  const plan: GoodsBoxPlan = { goods: [], purchases: [], sales: [] }

  // goodId → piecesPerBox (فقط > 1 یعنی داده هنوز عددی است؛ 0 و 1 یعنی از قبل جعبه‌ای/بدون تبدیل)
  const scale = new Map<string, number>()
  for (const g of goodsIn) {
    if (g.deleted) continue
    const ppb = Number(g.piecesPerBox)
    if (Number.isFinite(ppb) && ppb > 1) scale.set(g.id, ppb)
  }
  if (scale.size === 0) return plan

  // ۱) خریدهای کالا → تعداد جعبه (مبلغ کل دست‌نخورده)
  for (const p of purchasesIn) {
    if (p.deleted || p.itemKind !== 'GOOD') continue
    const ppb = scale.get(p.materialId)
    if (!ppb) continue
    const bc = Number(p.boxesCount) || 0
    const boxes = bc > 0 ? bc : r4((Number(p.quantity) || 0) / ppb)
    if (Math.abs(boxes - (Number(p.quantity) || 0)) > 1e-9) {
      plan.purchases.push({ id: p.id, quantity: boxes })
    }
  }

  // ۲) قلم‌های فروش کالا → جعبه + قیمت هر جعبه (ضرب‌در‌جمع ثابت)
  for (const s of salesIn) {
    if (s.deleted) continue
    const next = scaleSaleItemsJson(s.items || '[]', scale)
    if (next !== null) plan.sales.push({ id: s.id, items: next })
  }

  // ۳) خود کالا — حد بحرانی به جعبه + piecesPerBox = 1 (نشانهٔ «از قبل جعبه‌ای» برای اجرای بعدی)
  for (const g of goodsIn) {
    const ppb = scale.get(g.id)
    if (!ppb) continue
    const min = Number(g.minStock) || 0
    plan.goods.push({ id: g.id, minStock: min > 0 ? Math.max(1, Math.round(min / ppb)) : 0 })
  }

  return plan
}

/** تبدیل قلم‌های JSON یک فروش با ضریب مشخص (کمک‌تابع مشترک بک‌اندها) */
export function scaleSaleItemsJson(raw: string, scale: Map<string, number>): string | null {
  let items: SaleItemLike[]
  try { items = JSON.parse(raw || '[]') as SaleItemLike[] } catch { return null }
  if (!Array.isArray(items)) return null
  let changed = false
  const next = items.map(it => {
    if (!it || it.kind !== 'GOOD') return it
    const ppb = scale.get(it.breadTypeId)
    if (!ppb) return it
    changed = true
    return {
      ...it,
      qty: r4((Number(it.qty) || 0) / ppb),
      delivered: r4((Number(it.delivered) || 0) / ppb),
      returned: r4((Number(it.returned) || 0) / ppb),
      unitPrice: Math.round((Number(it.unitPrice) || 0) * ppb),
    }
  })
  return changed ? JSON.stringify(next) : null
}
