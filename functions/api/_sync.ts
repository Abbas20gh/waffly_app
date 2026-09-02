// منطق سینک برای Cloudflare Pages Functions — نسخه SQL خام از src/lib/server/sync-tables.ts
// ⚠️ هر تغییری در اسکیمای سینک باید در هر دو فایل اعمال شود
import type { Client } from '@libsql/client'

export const TABLES = [
  'breadTypes', 'productions', 'boxes', 'materials', 'goods', 'consumptions',
  'customers', 'sales', 'suppliers', 'purchases',
  'machines', 'machineCosts', 'expenseCategories', 'expenses', 'otherFunds', 'settings',
] as const
export type SyncTbl = (typeof TABLES)[number]

// نام فیزیکی جدول در دیتابیس (بدون @@map → نام مدل)
export const PHYS: Record<SyncTbl, string> = {
  breadTypes: 'BreadType', productions: 'Production', boxes: 'Box',
  materials: 'Material', goods: 'Good', consumptions: 'Consumption', customers: 'Customer',
  sales: 'Sale', suppliers: 'Supplier', purchases: 'Purchase',
  machines: 'Machine', machineCosts: 'MachineCost',
  expenseCategories: 'ExpenseCategory', expenses: 'Expense', otherFunds: 'OtherFund', settings: 'Setting',
}

type FieldType = 'str' | 'num' | 'int' | 'strNull'

export const FIELDS: Record<SyncTbl, Record<string, FieldType>> = {
  breadTypes: { name: 'str', code: 'str', active: 'int' },
  productions: { date: 'str', breadTypeId: 'str', totalProduced: 'num', boxesCount: 'num', perBoxCount: 'num', waste: 'num', carriedFrom: 'strNull', note: 'strNull', createdBy: 'strNull' },
  boxes: { code: 'str', productionId: 'str', breadTypeId: 'str', count: 'num', date: 'str', hasEssence: 'int', essenceType: 'strNull', note: 'strNull' },
  materials: { name: 'str', unit: 'str', minStock: 'num', active: 'int' },
  goods: { name: 'str', piecesPerBox: 'num', minStock: 'num', active: 'int' },
  consumptions: { date: 'str', materialId: 'str', quantity: 'num', note: 'strNull', createdBy: 'strNull' },
  customers: { name: 'str', phone: 'strNull', address: 'strNull', cooperationType: 'strNull' },
  sales: { date: 'str', customerId: 'str', items: 'str', totalAmount: 'num', settledStatus: 'str', paidAmount: 'num', paymentMethod: 'str', checkDueDate: 'strNull', checkNumber: 'strNull', checkBank: 'strNull', paymentDate: 'strNull', note: 'strNull', createdBy: 'strNull' },
  suppliers: { name: 'str', phone: 'strNull', address: 'strNull' },
  purchases: { date: 'str', materialId: 'str', quantity: 'num', cost: 'num', supplierId: 'strNull', settledStatus: 'str', paidAmount: 'num', itemKind: 'str', boxesCount: 'num', note: 'strNull', createdBy: 'strNull' },
  machines: { name: 'str', kind: 'str', startDate: 'str', status: 'str', note: 'strNull' },
  machineCosts: { machineId: 'str', kind: 'str', name: 'str', quantity: 'num', date: 'str', cost: 'num', note: 'strNull' },
  expenseCategories: { name: 'str', includeInProfit: 'int' },
  expenses: { date: 'str', categoryId: 'str', amount: 'num', description: 'strNull', createdBy: 'strNull' },
  otherFunds: { date: 'str', type: 'str', amount: 'num', description: 'str' },
  settings: { businessName: 'str', monthStartDay: 'int', badDebtDays: 'int', checkAlertDays: 'int' },
}

const s = (v: unknown, dflt = ''): string => (typeof v === 'string' ? v : v == null ? dflt : String(v))
const n = (v: unknown, dflt = 0): number => {
  const x = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(x) ? x : dflt
}

// ===== مهاجرت خودکار اسکیما (v2.4 — کالاهای بازرگانی) =====
// idempotent و در سطح isolate مموایز — اولین درخواست بعد از دیپلوی مهاجرت را انجام می‌دهد
let schemaReady = false
export async function ensureSchema(db: Client): Promise<void> {
  if (schemaReady) return
  // ۱) جدول کالاها
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Good" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "piecesPerBox" REAL NOT NULL DEFAULT 0,
      "minStock" REAL NOT NULL DEFAULT 0,
      "active" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" REAL NOT NULL DEFAULT 0,
      "deleted" INTEGER NOT NULL DEFAULT 0
    )
  `)
  // ۲) ستون‌های جدید خرید (itemKind / boxesCount)
  const cols = await db.execute({ sql: `PRAGMA table_info("Purchase")`, args: [] })
  const names = new Set(cols.rows.map((r) => String(r['name'])))
  if (!names.has('itemKind')) {
    await db.execute(`ALTER TABLE "Purchase" ADD COLUMN "itemKind" TEXT NOT NULL DEFAULT 'MATERIAL'`)
  }
  if (!names.has('boxesCount')) {
    await db.execute(`ALTER TABLE "Purchase" ADD COLUMN "boxesCount" REAL NOT NULL DEFAULT 0`)
  }
  // ۳) seed مشعلی برای دیتابیس‌های موجود (دیتابیس خالی در ensureSeed گرفته می‌شود)
  const g = await db.execute({ sql: `SELECT id FROM "Good" WHERE id = ?`, args: ['seed-gd-01'] })
  if (g.rows.length === 0) {
    const now = Date.now()
    await db.execute({
      sql: `INSERT INTO "Good" ("id","name","piecesPerBox","minStock","active","updatedAt","deleted") VALUES (?, ?, 0, 0, 1, ?, 0)`,
      args: ['seed-gd-01', 'نان مشعلی', now],
    })
    await db.execute({ sql: 'INSERT INTO SyncLog (tbl, rid, ts) VALUES (?, ?, ?)', args: ['goods', 'seed-gd-01', now] })
  }
  schemaReady = true
}
const i = (v: unknown, dflt = 0): number => Math.round(n(v, dflt))
const sn = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

// فیلدهای تاریخ — همیشه با ارقام لاتین ذخیره شوند (مقایسه رشته‌ای درست کار کند)
const DATE_FIELDS = new Set(['date', 'carriedFrom', 'checkDueDate', 'paymentDate', 'startDate'])
const toEnDigits = (v: string): string =>
  v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** فقط فیلدهای مجاز هر جدول را نگه می‌دارد و نوع‌ها را اصلاح می‌کند */
export function sanitizeRow(tbl: SyncTbl, row: Record<string, unknown>): Record<string, unknown> | null {
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

/** ترتیب ستون‌ها برای INSERT — id، updatedAt، deleted + فیلدهای اختصاصی */
export function colsOf(tbl: SyncTbl): string[] {
  return ['id', 'updatedAt', 'deleted', ...Object.keys(FIELDS[tbl])]
}

/** تبدیل ردیف libsql به آبجکت ساده (برای JSON) */
export function rowToObj(r: { columns: string[] }, row: ArrayLike<unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (let c = 0; c < r.columns.length; c++) o[r.columns[c]] = row[c]
  return o
}

/** seed اولیه — فقط اگر دیتابیس خالی باشد */
export async function ensureSeed(db: Client): Promise<boolean> {
  const existing = await db.execute({ sql: `SELECT id FROM BreadType WHERE id = ?`, args: ['seed-bt-01'] })
  if (existing.rows.length > 0) return false
  const now = Date.now()

  const seeds: { tbl: SyncTbl; id: string; data: Record<string, unknown> }[] = [
    { tbl: 'settings', id: 'main', data: { businessName: 'Waffly', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-01', data: { name: 'نان بزرگ', code: '01', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-02', data: { name: 'نان متوسط', code: '02', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-03', data: { name: 'نان بینابینی', code: '03', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-04', data: { name: 'نان خرد (ریزه)', code: '04', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'breadTypes', id: 'seed-bt-05', data: { name: 'نان کاسه‌ای', code: '05', active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-01', data: { name: 'آرد', unit: 'کیلوگرم', minStock: 25, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-02', data: { name: 'شکر', unit: 'کیلوگرم', minStock: 10, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-03', data: { name: 'مایه خمیر', unit: 'کیلوگرم', minStock: 3, active: 0, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-04', data: { name: 'نمک', unit: 'کیلوگرم', minStock: 2, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-05', data: { name: 'روغن مایع', unit: 'لیتر', minStock: 8, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-06', data: { name: 'کارتن بسته‌بندی', unit: 'عدد', minStock: 100, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-07', data: { name: 'لسیتین', unit: 'گرم', minStock: 500, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-08', data: { name: 'وانیل', unit: 'گرم', minStock: 200, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'materials', id: 'seed-mt-09', data: { name: 'آرد سبوس‌دار', unit: 'کیلوگرم', minStock: 25, active: 1, updatedAt: now, deleted: 0 } },
    // کالای بازرگانی — نان مشعلی (تعداد در جعبه را کاربر تکمیل می‌کند)
    { tbl: 'goods', id: 'seed-gd-01', data: { name: 'نان مشعلی', piecesPerBox: 0, minStock: 0, active: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-01', data: { name: 'دستمزد کارگران', includeInProfit: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-02', data: { name: 'برداشت صاحب کار', includeInProfit: 0, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-03', data: { name: 'حمل‌ونقل', includeInProfit: 1, updatedAt: now, deleted: 0 } },
    { tbl: 'expenseCategories', id: 'seed-ec-04', data: { name: 'سایر', includeInProfit: 1, updatedAt: now, deleted: 0 } },
  ]

  for (const seed of seeds) {
    const row = sanitizeRow(seed.tbl, { id: seed.id, ...seed.data })
    if (!row) continue
    const cols = colsOf(seed.tbl)
    await db.batch([
      {
        sql: `INSERT OR REPLACE INTO "${PHYS[seed.tbl]}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        args: cols.map((c) => row[c]),
      },
      { sql: 'INSERT INTO SyncLog (tbl, rid, ts) VALUES (?, ?, ?)', args: [seed.tbl, seed.id, row.updatedAt as number] },
    ], 'write')
  }
  return true
}

/** ثبت تغییرات کلاینت‌ها با حل تعارض Last-Write-Wins — پرت از sync/push/route.ts */
export async function pushOps(db: Client, ops: unknown): Promise<{ accepted: number; skipped: number }> {
  let accepted = 0
  let skipped = 0
  const list = Array.isArray(ops) ? ops : []
  for (const op of list.slice(0, 2000)) {
    const tbl = String((op as { tbl?: unknown })?.tbl || '') as SyncTbl
    if (!TABLES.includes(tbl)) continue
    const row = sanitizeRow(tbl, ((op as { row?: unknown })?.row || {}) as Record<string, unknown>)
    if (!row) continue
    const phys = PHYS[tbl]
    const ex = await db.execute({ sql: `SELECT updatedAt FROM "${phys}" WHERE id = ?`, args: [row.id as string] })
    const exUpd = ex.rows.length > 0 ? Number(ex.rows[0]['updatedAt'] ?? 0) : null
    if (exUpd !== null && exUpd >= (row.updatedAt as number)) {
      skipped++
      continue
    }
    const cols = colsOf(tbl)
    await db.batch([
      {
        sql: `INSERT OR REPLACE INTO "${phys}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        args: cols.map((c) => row[c]),
      },
      { sql: 'INSERT INTO SyncLog (tbl, rid, ts) VALUES (?, ?, ?)', args: [tbl, row.id, row.updatedAt as number] },
    ], 'write')
    accepted++
  }
  return { accepted, skipped }
}

/** دریافت تغییرات افزایشی بر اساس cursor — پرت از sync/pull/route.ts */
export async function pullRows(db: Client, since: number, limit: number) {
  const logs = await db.execute({
    sql: 'SELECT seq, tbl, rid FROM SyncLog WHERE seq > ? ORDER BY seq ASC LIMIT ?',
    args: [since, limit],
  })

  // آخرین تغییر هر رکورد
  const latest = new Map<string, { tbl: SyncTbl; rid: string; seq: number }>()
  for (const l of logs.rows) {
    latest.set(`${String(l.tbl)}:${String(l.rid)}`, { tbl: String(l.tbl) as SyncTbl, rid: String(l.rid), seq: Number(l.seq) })
  }

  const rows: { tbl: SyncTbl; row: Record<string, unknown> }[] = []
  for (const { tbl, rid } of latest.values()) {
    const r = await db.execute({ sql: `SELECT * FROM "${PHYS[tbl]}" WHERE id = ?`, args: [rid] })
    if (r.rows.length > 0) rows.push({ tbl, row: rowToObj(r, r.rows[0]) })
  }

  const cursor = logs.rows.length > 0 ? Number(logs.rows[logs.rows.length - 1].seq) : since
  return { rows, cursor, hasMore: logs.rows.length === limit }
}

/** اسنپ‌شات کامل برای دستگاه جدید (bootstrap) — پرت از sync/full/route.ts */
export async function fullSnapshot(db: Client) {
  await ensureSeed(db)
  const rows: { tbl: SyncTbl; row: Record<string, unknown> }[] = []
  for (const tbl of TABLES) {
    const all = await db.execute(`SELECT * FROM "${PHYS[tbl]}"`)
    for (const row of all.rows) rows.push({ tbl, row: rowToObj(all, row) })
  }
  const last = await db.execute('SELECT MAX(seq) AS m FROM SyncLog')
  const cursor = last.rows.length > 0 && last.rows[0]['m'] != null ? Number(last.rows[0]['m']) : 0
  return { rows, cursor }
}
