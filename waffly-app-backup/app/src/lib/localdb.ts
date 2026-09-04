'use client'

// لایه داده آفلاین — Dexie/IndexedDB + صف outbox + هوک‌های زنده
import Dexie, { type Table } from 'dexie'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { TABLES, type SyncTbl, type BaseRow, type Setting, type Good, type Purchase, type Sale } from './types'
import { planGoodsToBoxes } from './goods-units'

export { TABLES }
export type { SyncTbl }

export const DEFAULT_BANK = {
  bankAccountName: 'علی سبيلی',
  bankCardNumber: '6063-7312-5558-2299',
  bankSheba: 'IR730600000000300326236111',
  bankName: 'بانک ایران زمین',
  shopPhones: '۰۹۱۰۴۳۶۱۲۳۳ ,۰۹۳۹۱۵۳۱۶۶۴',
}

export const DEFAULT_SETTING: Setting = {
  id: 'main',
  businessName: 'Waffly',
  monthStartDay: 1,
  badDebtDays: 30,
  checkAlertDays: 7,
  ...DEFAULT_BANK,
  updatedAt: 0,
  deleted: 0,
}

interface OutboxItem { seq?: number; tbl: SyncTbl; row: BaseRow; ts: number }

class WafflyDB extends Dexie {
  breadTypes!: Table<BaseRow, string>
  productions!: Table<BaseRow, string>
  boxes!: Table<BaseRow, string>
  materials!: Table<BaseRow, string>
  goods!: Table<BaseRow, string>
  consumptions!: Table<BaseRow, string>
  customers!: Table<BaseRow, string>
  sales!: Table<BaseRow, string>
  suppliers!: Table<BaseRow, string>
  purchases!: Table<BaseRow, string>
  machines!: Table<BaseRow, string>
  machineCosts!: Table<BaseRow, string>
  expenseCategories!: Table<BaseRow, string>
  expenses!: Table<BaseRow, string>
  otherFunds!: Table<BaseRow, string>
  settings!: Table<BaseRow, string>
  accounts!: Table<BaseRow, string>
  combinedInvoices!: Table<BaseRow, string>
  outbox!: Table<OutboxItem, number>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('waffly')
    this.version(1).stores({
      breadTypes: 'id, updatedAt, code',
      productions: 'id, updatedAt, date, breadTypeId',
      boxes: 'id, updatedAt, code, date, breadTypeId, productionId',
      materials: 'id, updatedAt, name',
      consumptions: 'id, updatedAt, date, materialId',
      customers: 'id, updatedAt, name',
      sales: 'id, updatedAt, date, customerId, settledStatus, paymentMethod',
      suppliers: 'id, updatedAt, name',
      purchases: 'id, updatedAt, date, materialId, supplierId, settledStatus',
      machines: 'id, updatedAt, kind',
      machineCosts: 'id, updatedAt, machineId, date, kind',
      expenseCategories: 'id, updatedAt',
      expenses: 'id, updatedAt, date, categoryId',
      settings: 'id',
      outbox: '++seq, ts',
      meta: 'key',
    })
    // v2: جدول سایر وجوه (خارج از حساب سود) + اسانس/یادداشت جعبه‌ها (فیلدهای غیرایندکسی — بدون ایندکس جدید)
    this.version(2).stores({
      otherFunds: 'id, updatedAt, date',
    })
    // v3: کالاهای بازرگانی (خرید و فروش بدون تولید — مثل نان مشعلی)
    this.version(3).stores({
      goods: 'id, updatedAt, name',
    })
    // v4: حساب‌های بانکی/صندوق نقدی (v2.7) — فیلدهای accountId روی رکوردهای دیگر غیرایندکسی‌اند
    this.version(4).stores({
      accounts: 'id, updatedAt, name',
    })
    // v5: فاکتورهای ترکیبی (v2.8) — فیلدهای discount/invoiceNumber فروش غیرایندکسی‌اند
    this.version(5).stores({
      combinedInvoices: 'id, updatedAt, date, customerId',
    })
  }
}

export const dexie = new WafflyDB()

export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* ignore */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ===== نرمال‌سازی واحدهای کالا به «جعبه» (v2.5) =====
// داده‌های v2.4 برای کالاها به «عدد» ذخیره می‌شدند؛ این تابع یک‌بار آن‌ها را به جعبه تبدیل می‌کند
// (idempotent — بعد از تبدیل piecesPerBox = 1 می‌شود و دوباره اجرا کاری نمی‌کند) و ردیف‌ها را برای سینک صف می‌کند.
export async function normalizeGoodsUnits(): Promise<number> {
  const [goods, purchases, sales] = await Promise.all([
    dexie.goods.toArray() as Promise<Good[]>,
    dexie.purchases.toArray() as Promise<Purchase[]>,
    dexie.sales.toArray() as Promise<Sale[]>,
  ])
  const plan = planGoodsToBoxes(goods, purchases, sales)
  const total = plan.goods.length + plan.purchases.length + plan.sales.length
  if (total === 0) return 0
  const now = Date.now()
  await dexie.transaction('rw', dexie.goods, dexie.purchases, dexie.sales, dexie.outbox, async () => {
    for (const g of plan.goods) {
      const row = await dexie.goods.get(g.id)
      if (!row) continue
      const next = { ...row, piecesPerBox: 1, minStock: g.minStock, updatedAt: now }
      await dexie.goods.put(next)
      await dexie.outbox.add({ tbl: 'goods', row: next, ts: now })
    }
    for (const p of plan.purchases) {
      const row = await dexie.purchases.get(p.id)
      if (!row) continue
      const next = { ...row, quantity: p.quantity, updatedAt: now }
      await dexie.purchases.put(next)
      await dexie.outbox.add({ tbl: 'purchases', row: next, ts: now })
    }
    for (const s of plan.sales) {
      const row = await dexie.sales.get(s.id)
      if (!row) continue
      const next = { ...row, items: s.items, updatedAt: now }
      await dexie.sales.put(next)
      await dexie.outbox.add({ tbl: 'sales', row: next, ts: now })
    }
  })
  notifyChange()
  return total
}

// ===== کاربر فعال =====
export function getActiveUser(): string {
  try { return localStorage.getItem('waffly-user') || '' } catch { return '' }
}
export function setActiveUser(name: string) {
  try { localStorage.setItem('waffly-user', name) } catch { /* ignore */ }
}

// ===== رویداد تغییر داده (برای زمان‌بندی سینک) =====
export function notifyChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('waffly-data-changed'))
}

async function enqueue(tbl: SyncTbl, row: BaseRow) {
  await dexie.outbox.add({ tbl, row, ts: Date.now() })
}

/** ثبت/به‌روزرسانی یک رکورد + صف سینک */
export async function putRecord<T extends BaseRow>(tbl: SyncTbl, row: T, opts?: { sync?: boolean }): Promise<T> {
  const r = { ...row, updatedAt: row.updatedAt && opts?.sync === false ? row.updatedAt : Date.now(), deleted: row.deleted ? 1 : 0 }
  await dexie.table(tbl).put(r)
  if (opts?.sync !== false) await enqueue(tbl, r as BaseRow)
  notifyChange()
  return r as T
}

/** ثبت گروهی (مثلاً جعبه‌ها) — یک رویداد سینک */
export async function putMany<T extends BaseRow>(tbl: SyncTbl, rows: T[], opts?: { sync?: boolean }): Promise<T[]> {
  if (rows.length === 0) return []
  const now = Date.now()
  const rs = rows.map(r => ({ ...r, updatedAt: r.updatedAt || now, deleted: r.deleted ? 1 : 0 }))
  await dexie.table(tbl).bulkPut(rs)
  if (opts?.sync !== false) {
    await dexie.outbox.bulkAdd(rs.map(r => ({ tbl, row: r as BaseRow, ts: now })))
    notifyChange()
  }
  return rs as T[]
}

/** حذف منطقی (تومب‌استون) */
export async function removeRecord(tbl: SyncTbl, id: string) {
  const row = await dexie.table(tbl).get(id) as BaseRow | undefined
  if (!row) return
  await putRecord(tbl, { ...(row as object), id, deleted: 1 } as BaseRow)
}

/** نوشتن داده دریافتی از سرور — بدون صف (silent) با LWW */
export async function putRemoteRows(rows: { tbl: SyncTbl; row: BaseRow }[]) {
  const byTbl = new Map<SyncTbl, BaseRow[]>()
  for (const { tbl, row } of rows) {
    if (!TABLES.includes(tbl)) continue
    const arr = byTbl.get(tbl) || []
    arr.push({ ...row, deleted: row.deleted ? 1 : 0 })
    byTbl.set(tbl, arr)
  }
  await dexie.transaction('rw', ...TABLES.map(t => dexie.table(t)), async () => {
    for (const [tbl, arr] of byTbl) {
      const table = dexie.table(tbl)
      for (const r of arr) {
        const local = await table.get(r.id) as BaseRow | undefined
        if (!local || (r.updatedAt ?? 0) >= (local.updatedAt ?? 0)) await table.put(r)
      }
    }
  })
}

/**
 * جایگزینی کامل محلی با اسنپ‌شات سرور (حالت «سرور مرجع»).
 * برخلاف putRemoteRows (ادغام LWW)، ردیف‌های محلیِ خارج از سرور (مثل seed قدیمی گوشی)
 * هم حذف می‌شوند → گوشی دقیقاً هم‌سطح سرور می‌شود و اقلام تکراری/موازی از بین می‌رود.
 * فقط بعد از pushOutbox صدا زده شود تا هیچ داده محلیِ جدید از دست نرود.
 */
export async function replaceAllFromServer(rows: { tbl: SyncTbl; row: BaseRow }[]) {
  const byTbl = new Map<SyncTbl, BaseRow[]>()
  for (const { tbl, row } of rows) {
    if (!TABLES.includes(tbl)) continue
    const arr = byTbl.get(tbl) || []
    arr.push({ ...row, deleted: row.deleted ? 1 : 0 })
    byTbl.set(tbl, arr)
  }
  await dexie.transaction('rw', ...TABLES.map(t => dexie.table(t)), async () => {
    for (const tbl of TABLES) await dexie.table(tbl).clear()
    for (const [tbl, arr] of byTbl) {
      if (arr.length) await dexie.table(tbl).bulkPut(arr)
    }
  })
}

// ===== هوک‌های زنده =====
export function useDexie<T>(fn: () => T | Promise<T>, deps: unknown[] = []): T | undefined {
  const [state, setState] = useState<T | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const sub = liveQuery(fn).subscribe({
      next: (v) => { if (alive) setState(v as T) },
      error: (e) => console.error('liveQuery error', e),
    })
    return () => { alive = false; sub.unsubscribe() }
  }, deps)
  return state
}

export function useTable<T extends BaseRow>(tbl: SyncTbl): T[] {
  return (useDexie(() => dexie.table(tbl).toArray(), [tbl]) || []) as T[]
}

export function useSetting(): Setting {
  const raw = useDexie(() => dexie.settings.get('main'), [])
  return { ...DEFAULT_SETTING, ...(raw || {}) }
}

// ===== outbox / متادیتا =====
export async function outboxCount(): Promise<number> {
  return dexie.outbox.count()
}
export async function getOutboxBatch(limit = 500): Promise<OutboxItem[]> {
  return dexie.outbox.orderBy('seq').limit(limit).toArray()
}
export async function clearOutboxUpTo(seq: number) {
  await dexie.outbox.where('seq').belowOrEqual(seq).delete()
}
export function getCursor(): number {
  try { return Number(localStorage.getItem('waffly-cursor') || 0) } catch { return 0 }
}
export function setCursor(v: number) {
  try { localStorage.setItem('waffly-cursor', String(v)) } catch { /* ignore */ }
}
export function isBootstrapped(): boolean {
  try { return localStorage.getItem('waffly-bootstrapped') === '1' } catch { return false }
}
export function markBootstrapped() {
  try { localStorage.setItem('waffly-bootstrapped', '1') } catch { /* ignore */ }
}

/** تعمیر سینک — همه رکوردهای محلی دوباره در صف قرار می‌گیرند */
export async function repairSync(): Promise<number> {
  let count = 0
  const now = Date.now()
  for (const tbl of TABLES) {
    if (tbl === 'settings') continue
    const rows = (await dexie.table(tbl).toArray()) as BaseRow[]
    if (rows.length === 0) continue
    await dexie.outbox.bulkAdd(rows.map(r => ({ tbl, row: r, ts: now })))
    count += rows.length
  }
  const st = await dexie.settings.get('main')
  if (st) { await dexie.outbox.add({ tbl: 'settings', row: st, ts: now }); count++ }
  notifyChange()
  return count
}

// ===== پشتیبان JSON =====
export async function exportAllToJson(): Promise<string> {
  const data: Record<string, unknown> = { __app: 'waffly', __version: 1, __at: Date.now() }
  for (const tbl of TABLES) {
    data[tbl] = await dexie.table(tbl).toArray()
  }
  return JSON.stringify(data, null, 2)
}

export async function importAllFromJson(file: File): Promise<number> {
  const text = await file.text()
  const data = JSON.parse(text) as Record<string, unknown[]>
  let count = 0
  await dexie.transaction('rw', ...TABLES.map(t => dexie.table(t)), async () => {
    for (const tbl of TABLES) {
      const rows = data[tbl]
      if (!Array.isArray(rows)) continue
      await dexie.table(tbl).clear()
      if (rows.length) await dexie.table(tbl).bulkPut(rows)
      count += rows.length
    }
  })
  // همه در صف قرار بگیرند تا سرور هم هم‌سطح شود
  const now = Date.now()
  for (const tbl of TABLES) {
    const rows = (await dexie.table(tbl).toArray()) as BaseRow[]
    if (rows.length) await dexie.outbox.bulkAdd(rows.map(r => ({ tbl, row: r, ts: now })))
  }
  notifyChange()
  return count
}
