// ===== v3.4.0 — اتصال دفتر حساب به فاکتورها =====
// مشکل: وقتی واریز مشتری در دفتر حساب ثبت می‌شد، فاکتورهای باز او در بخش فروش
// همچنان «تسویه‌نشده» نشان داده می‌شدند و پول‌ها دو جا حساب می‌شدند.
// راه‌حل: دریافتی‌های دفتر (IN به مشتری) خودکار به قدیمی‌ترین فاکتورهای باز همان مشتری
// توزیع می‌شوند (FIFO) و پرداختی‌های دفتر به تامین‌کننده (OUT) به فاکتورهای خرید باز.
// توزیع «مشتق» است — هیچ فیلدی روی فاکتور ذخیره نمی‌شود، پس ویرایش/حذف تراکنش دفتر
// خودبه‌خود وضعیت فاکتورها را هم اصلاح می‌کند و قاعدهٔ «یک پرداخت فقط یک‌جا ثبت شود»
// (پرداخت لحظهٔ فاکتور XOR دفتر) حفظ می‌شود.
import type { Sale, Purchase, LedgerEntry, OpsExpense } from './types'

const EPS = 0.5 // تلورانس گرد کردن — زیر نیم تومان صفر حساب می‌شود

/** ماندهٔ باز یک سند تسویه‌پذیر (فاکتور/خرید) — فقط مثبت */
const openRemainder = (total: unknown, paid: unknown): number =>
  Math.max(0, ((Number(total) || 0) - (Number(paid) || 0)))

/**
 * توزیع FIFO دریافتی‌های دفتر بین فاکتورهای فروش باز هر مشتری.
 * خروجی: Map(saleId → مبلغی از این فاکتور که با واریزی‌های دفتر پوشش داده شده)
 */
export function ledgerAppliedToSales(sales: Sale[], ledger: LedgerEntry[]): Map<string, number> {
  const applied = new Map<string, number>()
  // دریافتی‌های هر مشتری به ترتیب تاریخ (قدیمی‌ترین اول)
  const receipts = [...ledger]
    .filter(e => !e.deleted && e.kind === 'IN' && e.customerId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
  if (receipts.length === 0) return applied
  // فاکتورهای باز هر مشتری به ترتیب تاریخ
  const openByCustomer = new Map<string, Sale[]>()
  for (const s of sales) {
    if (s.deleted || !s.customerId) continue
    if (openRemainder(s.totalAmount, s.paidAmount) <= EPS) continue
    const arr = openByCustomer.get(s.customerId) || []
    arr.push(s)
    openByCustomer.set(s.customerId, arr)
  }
  for (const arr of openByCustomer.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
  }
  for (const e of receipts) {
    let left = Number(e.amount) || 0
    const invoices = openByCustomer.get(e.customerId!) || []
    for (const s of invoices) {
      if (left <= EPS) break
      const due = openRemainder(s.totalAmount, s.paidAmount) - (applied.get(s.id) || 0)
      if (due <= EPS) continue
      const pay = Math.min(due, left)
      applied.set(s.id, (applied.get(s.id) || 0) + pay)
      left -= pay
    }
  }
  return applied
}

/**
 * توزیع FIFO پرداختی‌های دفتر به تامین‌کننده بین فاکتورهای خرید باز.
 * خروجی: Map(purchaseId → مبلغ پوشش‌داده‌شده)
 */
export function ledgerAppliedToPurchases(purchases: Purchase[], ledger: LedgerEntry[]): Map<string, number> {
  const applied = new Map<string, number>()
  const payments = [...ledger]
    .filter(e => !e.deleted && e.kind === 'OUT' && e.supplierId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
  if (payments.length === 0) return applied
  const openBySupplier = new Map<string, Purchase[]>()
  for (const p of purchases) {
    if (p.deleted || !p.supplierId) continue
    if (openRemainder(p.cost, p.paidAmount) <= EPS) continue
    const arr = openBySupplier.get(p.supplierId) || []
    arr.push(p)
    openBySupplier.set(p.supplierId, arr)
  }
  for (const arr of openBySupplier.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
  }
  for (const e of payments) {
    let left = Number(e.amount) || 0
    const invoices = openBySupplier.get(e.supplierId!) || []
    for (const p of invoices) {
      if (left <= EPS) break
      const due = openRemainder(p.cost, p.paidAmount) - (applied.get(p.id) || 0)
      if (due <= EPS) continue
      const pay = Math.min(due, left)
      applied.set(p.id, (applied.get(p.id) || 0) + pay)
      left -= pay
    }
  }
  return applied
}

export interface SettleWithApplied { totalAmount?: number; cost?: number; paidAmount?: number }

/** ماندهٔ مؤثر فاکتور فروش با احتساب واریزی‌های دفتر */
export function saleDueWithLedger(s: SettleWithApplied, applied: number): number {
  return Math.max(0, ((s.totalAmount ?? s.cost) || 0) - (s.paidAmount || 0) - applied)
}

/** وضعیت تسویهٔ مؤثر فاکتور فروش با احتساب واریزی‌های دفتر */
export function settledWithLedger(s: SettleWithApplied, applied: number): 'PAID' | 'PARTIAL' | 'UNPAID' {
  const due = saleDueWithLedger(s, applied)
  if (due <= EPS) return 'PAID'
  if (((s.paidAmount || 0) + applied) > EPS) return 'PARTIAL'
  return 'UNPAID'
}

/** ماندهٔ مؤثر فاکتور خرید با احتساب پرداختی‌های دفتر */
export function purchaseDueWithLedger(p: SettleWithApplied, applied: number): number {
  return Math.max(0, ((p.totalAmount ?? p.cost) || 0) - (p.paidAmount || 0) - applied)
}

/** ماندهٔ باز خرید/هزینهٔ عملیاتی */
export const opsDue = (o: OpsExpense): number =>
  Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.paidAmount) || 0))
