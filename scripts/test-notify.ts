// تست واحد ماژول اعلان سرور (functions/api/_notify.ts) — با دیتابیس جعلی
import { classifyOp, buildNotifications, insertNotifications, fetchNotifications, telegramMessage, type NotifChange, type NotifRow } from '../functions/api/_notify'
import type { Client } from '@libsql/client'

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

// ===== دیتابیس جعلی — فقط execute/batch شبیه‌سازی می‌شود =====
const tables: Record<string, Record<string, unknown>[]> = {
  Customer: [{ id: 'cust-1', name: 'کافه نادر', updatedAt: 1, deleted: 0 }],
  Material: [{ id: 'mat-1', name: 'آرد', unit: 'کیلوگرم', updatedAt: 1, deleted: 0 }],
  Good: [{ id: 'gd-1', name: 'نان مشعلی', updatedAt: 1, deleted: 0 }],
  Supplier: [{ id: 'sup-1', name: 'آردسازی مرکزی', updatedAt: 1, deleted: 0 }],
  ExpenseCategory: [{ id: 'ec-1', name: 'دستمزد کارگران', updatedAt: 1, deleted: 0 }],
  Account: [{ id: 'acc-1', name: 'صندوق نقدی', updatedAt: 1, deleted: 0 }],
  BreadType: [{ id: 'bt-1', name: 'نان بزرگ', updatedAt: 1, deleted: 0 }],
  Machine: [{ id: 'mch-1', name: 'دستگاه پخت ۱', updatedAt: 1, deleted: 0 }],
}
const notifStore: Record<string, unknown>[] = []

const fakeDb = {
  async execute(opts: { sql: string; args?: unknown[] }) {
    const sql = String(opts.sql)
    // SELECT id, name[, unit] FROM "X" WHERE id IN (...)
    const m = /SELECT .+ FROM "(\w+)"/.exec(sql)
    if (m && tables[m[1]]) {
      const ids = (opts.args || []).map(String)
      const rows = (tables[m[1]] || []).filter(r => ids.includes(String(r.id)))
      const cols = rows.length > 0 ? Object.keys(rows[0]) : ['id', 'name']
      return { rows, columns: cols }
    }
    if (/FROM "Notification"/.test(sql)) {
      const since = Number((opts.args || [])[0] ?? 0)
      const lim = Number((opts.args || [])[1] ?? 100)
      // شبیه‌سازی ORDER BY ts DESC — همان رفتار SQL واقعی
      const rows = notifStore.filter(r => Number(r.ts) > since)
        .sort((a, b) => Number(b.ts) - Number(a.ts))
        .slice(0, lim)
      const cols = rows.length > 0 ? Object.keys(rows[0]) : ['id', 'ts']
      return { rows, columns: cols }
    }
    return { rows: [], columns: [] }
  },
  async batch(stmts: { sql: string; args?: unknown[] }[]) {
    for (const st of stmts) {
      if (/INSERT (OR REPLACE )?INTO "Notification"/.test(st.sql)) {
        const [id, ts, tbl, rid, op, title, body, actor] = st.args as unknown[]
        notifStore.push({ id, ts, tbl, rid, op, title, body, actor })
      }
      if (/DELETE FROM "Notification"/.test(st.sql)) {
        const cutoff = Number((st.args || [])[0] ?? 0)
        for (let i = notifStore.length - 1; i >= 0; i--) {
          if (Number(notifStore[i].ts) < cutoff) notifStore.splice(i, 1)
        }
      }
    }
  },
} as unknown as Client

async function main() {
  console.log('— classifyOp —')
  const sale = { id: 's1', updatedAt: 100, deleted: 0, date: '1404/07/19', customerId: 'cust-1', items: '[]', totalAmount: 2500000, settledStatus: 'PAID', paidAmount: 2500000, paymentMethod: 'CASH' }
  ok(classifyOp('sales', null, sale) === 'CREATE', 'رکورد جدید = CREATE')
  ok(classifyOp('sales', { ...sale }, { ...sale, updatedAt: 101 }) === 'NONE', 'محتوای یکسان (repair) = NONE — بدون نویز')
  ok(classifyOp('sales', { ...sale }, { ...sale, totalAmount: 3000000, updatedAt: 102 }) === 'UPDATE', 'تغییر مبلغ = UPDATE')
  ok(classifyOp('sales', { ...sale }, { ...sale, deleted: 1, updatedAt: 103 }) === 'DELETE', 'تومب‌استون = DELETE')
  ok(classifyOp('sales', { ...sale, deleted: 1 }, { ...sale, deleted: 1, updatedAt: 104 }) === 'NONE', 'تومب‌استون تکراری = NONE')
  ok(classifyOp('sales', { ...sale, deleted: 1 }, { ...sale, updatedAt: 105 }) === 'CREATE', 'بازیابی = CREATE')

  console.log('— buildNotifications (فارسی با جزئیات) —')
  const changes: NotifChange[] = [
    { tbl: 'sales', row: { ...sale, updatedAt: 110, invoiceNumber: 1001 }, prev: null, op: 'CREATE' },
    { tbl: 'purchases', row: { id: 'p1', updatedAt: 111, deleted: 0, date: '1404/07/19', materialId: 'mat-1', quantity: 50, cost: 1200000, supplierId: 'sup-1', settledStatus: 'UNPAID', paidAmount: 0, itemKind: 'MATERIAL' }, prev: null, op: 'CREATE' },
    { tbl: 'purchases', row: { id: 'p2', updatedAt: 112, deleted: 0, date: '1404/07/19', materialId: 'gd-1', quantity: 3, cost: 900000, settledStatus: 'PAID', paidAmount: 900000, itemKind: 'GOOD' }, prev: null, op: 'CREATE' },
    { tbl: 'expenses', row: { id: 'e1', updatedAt: 113, deleted: 0, date: '1404/07/19', categoryId: 'ec-1', amount: 500000, description: 'دستمزد هفتگی' }, prev: null, op: 'CREATE' },
    { tbl: 'productions', row: { id: 'pr1', updatedAt: 114, deleted: 0, date: '1404/07/19', breadTypeId: 'bt-1', totalProduced: 180, boxesCount: 1, perBoxCount: 180, waste: 5 }, prev: null, op: 'CREATE' },
    { tbl: 'expenseCategories', row: { id: 'x1', updatedAt: 115, deleted: 1, name: 'تست اعلان' }, prev: { id: 'x1', updatedAt: 110, deleted: 0, name: 'تست اعلان' }, op: 'DELETE' },
    { tbl: 'sales', row: { id: 'seed-bt-01', updatedAt: 116, deleted: 0, name: 'نان بزرگ', code: '01', active: 1 }, prev: null, op: 'CREATE' }, // seed → رد شود
  ]
  const notifs = await buildNotifications(fakeDb, changes)
  ok(notifs.length === 6, `۶ اعلان (seed حذف شد) — got ${notifs.length}`)
  const saleN = notifs.find(n => n.rid === 's1')!
  ok(saleN.title === 'ثبت فروش', 'عنوان فروش: ثبت فروش')
  ok(saleN.body.includes('کافه نادر') && saleN.body.includes('۲٬۵۰۰٬۰۰۰') && saleN.body.includes('نقدی') && saleN.body.includes('فاکتور #۱۰۰۱'), 'بدنه فروش کامل: نام/مبلغ/پرداخت/فاکتور', saleN.body)
  const purN = notifs.find(n => n.rid === 'p1')!
  ok(purN.body.includes('آرد') && purN.body.includes('۵۰ کیلوگرم') && purN.body.includes('آردسازی مرکزی') && purN.body.includes('پرداخت‌نشده'), 'بدنه خرید مواد کامل', purN.body)
  const goodN = notifs.find(n => n.rid === 'p2')!
  ok(goodN.body.includes('نان مشعلی') && goodN.body.includes('۳ جعبه'), 'خرید کالا با واحد جعبه', goodN.body)
  const expN = notifs.find(n => n.rid === 'e1')!
  ok(expN.body.includes('دستمزد کارگران') && expN.body.includes('۵۰۰٬۰۰۰') && expN.body.includes('دستمزد هفتگی'), 'بدنه هزینه کامل', expN.body)
  const prdN = notifs.find(n => n.rid === 'pr1')!
  ok(prdN.body.includes('نان بزرگ') && prdN.body.includes('۱۸۰ عدد') && prdN.body.includes('ضایعات: ۵'), 'بدنه تولید کامل', prdN.body)
  const delN = notifs.find(n => n.rid === 'x1')!
  ok(delN.title === 'حذف سرفصل هزینه', 'عنوان حذف', delN.title)

  console.log('— درج و خواندن —')
  await insertNotifications(fakeDb, notifs)
  ok(notifStore.length === 6, `۶ ردیف ذخیره شد — got ${notifStore.length}`)
  const back = await fetchNotifications(fakeDb, 0, 100)
  ok(back.length === 6, 'خواندن معکوس')
  ok(back[0].ts >= back[1].ts, 'ترتیب جدید→قدیم')

  console.log('— پیام تلگرام —')
  const msg = telegramMessage(notifs)
  ok(!!msg && msg.includes('🔔 وافلی — ۶ تغییر جدید'), 'سرخط تلگرام')
  ok(!!msg && msg.includes('➕ ثبت فروش') && msg.includes('🗑 حذف سرفصل هزینه'), 'آیکون‌های عملیات در تلگرام')
  const many: NotifRow[] = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, ts: i, tbl: 'sales', rid: `r${i}`, op: 'UPDATE', title: 'ویرایش فروش', body: 'x', actor: null }))
  const msg2 = telegramMessage(many)
  ok(!!msg2 && msg2.includes('بیش از حد'), 'ضداسپم: بالای ۲۵ مورد → خلاصه')

  console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
