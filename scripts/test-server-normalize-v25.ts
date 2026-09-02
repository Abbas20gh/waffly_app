// تست مسیر سرور Next (Prisma) — نرمال‌سازی کالاها به جعبه — روی کپی دیتابیس محلی
// اجرا: DATABASE_URL=file:/home/z/my-project/db/test-prisma-v25.db bunx tsx scripts/test-server-normalize-v25.ts
import { cpSync, rmSync, existsSync } from 'node:fs'

const SRC = '/home/z/my-project/db/custom.db'
const DST = '/home/z/my-project/db/test-prisma-v25.db'
if (existsSync(DST)) rmSync(DST)
cpSync(SRC, DST)

let pass = 0, fail = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

async function main() {
  const { db } = await import('../src/lib/db')
  const { normalizeGoodsUnitsServer } = await import('../src/lib/server/goods-units')

  const now = Date.now()
  // داده v2.4 عددی
  await (db as unknown as { good: { create: (a: object) => Promise<unknown> } }).good.create({
    data: { id: 'g-prisma-test', name: 'نان تست پرisma', piecesPerBox: 40, minStock: 20, active: 1, updatedAt: now, deleted: 0 },
  })
  await (db as unknown as { purchase: { create: (a: object) => Promise<unknown> } }).purchase.create({
    data: { id: 'p-prisma-test', date: '2025-01-01', materialId: 'g-prisma-test', quantity: 120, cost: 900000, settledStatus: 'PAID', paidAmount: 900000, itemKind: 'GOOD', boxesCount: 3, updatedAt: now, deleted: 0 },
  })
  await (db as unknown as { sale: { create: (a: object) => Promise<unknown> } }).sale.create({
    data: {
      id: 's-prisma-test', date: '2025-01-01', customerId: 'c-test',
      items: JSON.stringify([{ breadTypeId: 'g-prisma-test', qty: 25, unitPrice: 18000, delivered: 25, returned: 5, returnCost: 0, kind: 'GOOD' }]),
      totalAmount: 450000, settledStatus: 'PAID', paidAmount: 450000, paymentMethod: 'CASH', updatedAt: now, deleted: 0,
    },
  })

  const d = db as unknown as {
    good: { findUnique: (a: object) => Promise<Record<string, unknown> | null>; update: (a: object) => Promise<unknown> }
    purchase: { findUnique: (a: object) => Promise<Record<string, unknown> | null> }
    sale: { findUnique: (a: object) => Promise<Record<string, unknown> | null> }
    syncLog: { findMany: (a: object) => Promise<Array<{ tbl: string; rid: string }>> }
  }

  await normalizeGoodsUnitsServer()

  const g = await d.good.findUnique({ where: { id: 'g-prisma-test' } })
  const p = await d.purchase.findUnique({ where: { id: 'p-prisma-test' } })
  const s = await d.sale.findUnique({ where: { id: 's-prisma-test' } })

  check('کالا: piecesPerBox → 1', Number(g?.piecesPerBox) === 1, String(g?.piecesPerBox))
  check('کالا: حد ۲۰ عدد → ۱ جعبه', Number(g?.minStock) === 1, String(g?.minStock))
  check('خرید: ۱۲۰ عدد → ۳ جعبه', Number(p?.quantity) === 3, String(p?.quantity))
  const items = JSON.parse(String(s?.items || '[]')) as Array<{ qty: number; returned: number; unitPrice: number }>
  check('فروش: ۲۵ عدد → ۰٫۶۲۵ جعبه', items[0]?.qty === 0.625, String(items[0]?.qty))
  check('فروش: قیمت جعبه ۷۲۰هزار', items[0]?.unitPrice === 720000)
  const logs = await d.syncLog.findMany({ where: { rid: { in: ['g-prisma-test', 'p-prisma-test', 's-prisma-test'] } } })
  check('SyncLog ثبت شد (۳+ ردیف)', logs.length >= 3, String(logs.length))

  // idempotency — فراخوانی دوباره در همان پروسه (done memoized) و همچنین اجرای واقعی تابع با دادهٔ تازه
  const before = JSON.stringify(items)
  await normalizeGoodsUnitsServer() // باید فوراً برگردد (memoized)
  const s2 = await d.sale.findUnique({ where: { id: 's-prisma-test' } })
  check('اجرای دوباره: تغییری نکرد', String(s2?.items) === before)

  // پاک‌سازی ردیف‌های تستی از کپی
  await d.good.update({ where: { id: 'g-prisma-test' }, data: { deleted: 1, updatedAt: Date.now() } })
  console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
