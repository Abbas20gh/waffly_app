// سمت سرور Next (سندباکس/پاریتی) — نرمال‌سازی واحدهای کالا به «جعبه» (v2.5)
// دادهٔ v2.4 برای کالاها به «عدد» ذخیره می‌شد؛ این تابع یک‌بار آن‌ها را به جعبه تبدیل می‌کند.
// idempotent — بعد از تبدیل piecesPerBox = 1 می‌شود و اجرای دوباره کاری نمی‌کند.
// پرت SQL/Functions همین منطق در functions/api/_sync.ts ← normalizeGoodsBoxes است.
import { db } from '@/lib/db'
import { planGoodsToBoxes } from '@/lib/goods-units'
import type { Good, Purchase, Sale } from '@/lib/types'

let done = false

export async function normalizeGoodsUnitsServer(): Promise<void> {
  if (done) return
  const d = db as unknown as {
    good: {
      findMany: (a: object) => Promise<Good[]>
      update: (a: object) => Promise<unknown>
    }
    purchase: { findMany: (a: object) => Promise<Purchase[]>; update: (a: object) => Promise<unknown> }
    sale: { findMany: (a: object) => Promise<Sale[]>; update: (a: object) => Promise<unknown> }
    syncLog: { create: (a: object) => Promise<unknown> }
  }

  const goods = await d.good.findMany({ where: { deleted: 0, piecesPerBox: { gt: 1 } } })
  if (goods.length === 0) { done = true; return }

  const [purchases, sales] = await Promise.all([
    d.purchase.findMany({ where: { deleted: 0, itemKind: 'GOOD' } }),
    d.sale.findMany({ where: { deleted: 0 } }),
  ])

  const plan = planGoodsToBoxes(goods, purchases, sales)
  const now = Date.now()

  for (const p of plan.purchases) {
    await d.purchase.update({ where: { id: p.id }, data: { quantity: p.quantity, updatedAt: now } })
    await d.syncLog.create({ data: { tbl: 'purchases', rid: p.id, ts: now } })
  }
  for (const s of plan.sales) {
    await d.sale.update({ where: { id: s.id }, data: { items: s.items, updatedAt: now } })
    await d.syncLog.create({ data: { tbl: 'sales', rid: s.id, ts: now } })
  }
  for (const g of plan.goods) {
    await d.good.update({ where: { id: g.id }, data: { piecesPerBox: 1, minStock: g.minStock, updatedAt: now } })
    await d.syncLog.create({ data: { tbl: 'goods', rid: g.id, ts: now } })
  }
  done = true
}
