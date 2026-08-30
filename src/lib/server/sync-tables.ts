// سمت سرور — نگاشت جدول‌های سینک، پاک‌سازی فیلدها، seed اولیه
import { db } from '@/lib/db'
import { TABLES, type SyncTbl } from '@/lib/types'

type FieldType = 'str' | 'num' | 'int' | 'strNull'

export const MODELS: Record<SyncTbl, string> = {
  breadTypes: 'breadType',
  productions: 'production',
  boxes: 'box',
  materials: 'material',
  consumptions: 'consumption',
  customers: 'customer',
  sales: 'sale',
  suppliers: 'supplier',
  purchases: 'purchase',
  machines: 'machine',
  machineCosts: 'machineCost',
  expenseCategories: 'expenseCategory',
  expenses: 'expense',
  settings: 'setting',
}

export const FIELDS: Record<SyncTbl, Record<string, FieldType>> = {
  breadTypes: { name: 'str', code: 'str', active: 'int' },
  productions: { date: 'str', breadTypeId: 'str', totalProduced: 'num', boxesCount: 'num', perBoxCount: 'num', waste: 'num', carriedFrom: 'strNull', note: 'strNull', createdBy: 'strNull' },
  boxes: { code: 'str', productionId: 'str', breadTypeId: 'str', count: 'num', date: 'str' },
  materials: { name: 'str', unit: 'str', minStock: 'num' },
  consumptions: { date: 'str', materialId: 'str', quantity: 'num', note: 'strNull', createdBy: 'strNull' },
  customers: { name: 'str', phone: 'strNull', address: 'strNull', cooperationType: 'strNull' },
  sales: { date: 'str', customerId: 'str', items: 'str', totalAmount: 'num', settledStatus: 'str', paidAmount: 'num', paymentMethod: 'str', checkDueDate: 'strNull', checkNumber: 'strNull', checkBank: 'strNull', paymentDate: 'strNull', note: 'strNull', createdBy: 'strNull' },
  suppliers: { name: 'str', phone: 'strNull', address: 'strNull' },
  purchases: { date: 'str', materialId: 'str', quantity: 'num', cost: 'num', supplierId: 'strNull', settledStatus: 'str', paidAmount: 'num', note: 'strNull', createdBy: 'strNull' },
  machines: { name: 'str', kind: 'str', startDate: 'str', status: 'str', note: 'strNull' },
  machineCosts: { machineId: 'str', kind: 'str', name: 'str', quantity: 'num', date: 'str', cost: 'num' },
  expenseCategories: { name: 'str', includeInProfit: 'int' },
  expenses: { date: 'str', categoryId: 'str', amount: 'num', description: 'strNull', createdBy: 'strNull' },
  settings: { businessName: 'str', monthStartDay: 'int', badDebtDays: 'int', checkAlertDays: 'int' },
}

const s = (v: unknown, dflt = '') => (typeof v === 'string' ? v : v == null ? dflt : String(v))
const n = (v: unknown, dflt = 0) => {
  const x = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(x) ? x : dflt
}
const i = (v: unknown, dflt = 0) => Math.round(n(v, dflt))
const sn = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

// فیلدهای تاریخ — همیشه با ارقام لاتین ذخیره شوند (مقایسه رشته‌ای درست کار کند)
const DATE_FIELDS = new Set(['date', 'carriedFrom', 'checkDueDate', 'paymentDate', 'startDate'])
const toEnDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** فقط فیلدهای مجاز هر جدول را نگه می‌دارد و نوع‌ها را اصلاح می‌کند */
export function sanitizeRow(tbl: SyncTbl, row: Record<string, unknown>) {
  const spec = FIELDS[tbl]
  if (!spec) return null
  const id = s(row.id)
  if (!id) return null
  const out: Record<string, unknown> = {
    id,
    updatedAt: n(row.updatedAt, Date.now()),
    deleted: i(row.deleted) ? 1 : 0,
  }
  for (const [k, t] of Object.entries(spec)) {
    const v = row[k]
    if (t === 'str') out[k] = DATE_FIELDS.has(k) ? toEnDigits(s(v)) : s(v)
    else if (t === 'num') out[k] = n(v)
    else if (t === 'int') out[k] = i(v)
    else out[k] = DATE_FIELDS.has(k) ? (sn(v) === null ? null : toEnDigits(sn(v)!)) : sn(v)
  }
  return out
}

let seeded = false

/** seed اولیه — فقط اگر دیتابیس خالی باشد؛ با ثبت SyncLog تا همه دستگاه‌ها بگیرند */
export async function ensureSeed() {
  if (seeded) return false
  // تشخیص با نمای؛ اگر قبلاً ناقص مانده باشد (مثلاً خطای گذرا) ادامه کامل می‌گیرد
  const existing = await db.breadType.findUnique({ where: { id: 'seed-bt-01' } })
  if (existing) { seeded = true; return false }
  const now = Date.now()

  const seeds: { tbl: SyncTbl; id: string; data: Record<string, unknown> }[] = [
    { tbl: 'settings', id: 'main', data: { businessName: 'Waffly', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: now, deleted: 0 } },
    // انواع نان
    { tbl: 'breadTypes', id: 'seed-bt-01', data: { name: 'نان بزرگ', code: '01', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-02', data: { name: 'نان متوسط', code: '02', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-03', data: { name: 'نان بینابینی', code: '03', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-04', data: { name: 'نان خرد (ریزه)', code: '04', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-05', data: { name: 'نان کاسه‌ای', code: '05', active: 1, updatedAt: now, deleted: 0 } },
    // مواد اولیه رایج
    { tbl: 'materials', id: 'seed-mt-01', data: { name: 'آرد', unit: 'کیلوگرم', minStock: 25, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-02', data: { name: 'شکر', unit: 'کیلوگرم', minStock: 10, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-03', data: { name: 'مایه خمیر', unit: 'کیلوگرم', minStock: 3, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-04', data: { name: 'نمک', unit: 'کیلوگرم', minStock: 2, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-05', data: { name: 'روغن مایع', unit: 'لیتر', minStock: 8, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-06', data: { name: 'کارتن بسته‌بندی', unit: 'عدد', minStock: 100, updatedAt: now, deleted: 0 } },
    // سرفصل هزینه‌ها
    { tbl: 'expenseCategories', id: 'seed-ec-01', data: { name: 'دستمزد کارگران', includeInProfit: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-02', data: { name: 'برداشت صاحب کار', includeInProfit: 0, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-03', data: { name: 'حمل‌ونقل', includeInProfit: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-04', data: { name: 'سایر', includeInProfit: 1, updatedAt: now, deleted: 0 } },
  ]

  for (const seed of seeds) {
    const model = MODELS[seed.tbl]
    const delegate = (db as unknown as Record<string, { upsert: (a: object) => Promise<unknown> }>)[model]
    await delegate.upsert({
      where: { id: seed.id },
      create: { id: seed.id, ...seed.data },
      update: {},
    })
    await db.syncLog.create({ data: { tbl: seed.tbl, rid: seed.id, ts: (seed.data.updatedAt as number) || now } })
  }
  seeded = true
  return true
}
