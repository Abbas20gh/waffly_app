// ===== v3.1 — سیستم اعلان مرکزی وافلی =====
// هر عملیاتِ پذیرفته‌شده از /api/sync/push (از هر دستگاهی: APK اندروید یا نسخه وب)
// به یک اعلان فارسی با جزئیات کامل تبدیل می‌شود:
//  ۱) در جدول Notification روی دیتابیس ذخیره می‌شود → زنگ داخل اپ همه دستگاه‌ها
//  ۲) بلافاصله با ctx.waitUntil به تلگرام صاحب کسب‌وکار ارسال می‌شود (حتی اپ بسته)
// جدول Notification سینک نمی‌شود (فقط سروری) — کلاینت با endpoint می‌خواند.
import type { Client } from '@libsql/client'
import { PHYS, FIELDS, type SyncTbl } from './_sync'
import { faDigits } from '../../src/lib/jalali'
import { NOTIF_CATEGORIES, notifCategoryOf } from '../../src/lib/notif-categories'

export type NotifOp = 'CREATE' | 'UPDATE' | 'DELETE'
/** op می‌تواند NONE باشد (تغییر بی‌اثر — repair/تکراری) و در buildNotifications فیلتر می‌شود */
export interface NotifChange { tbl: SyncTbl; row: Record<string, unknown>; prev: Record<string, unknown> | null; op: NotifOp | 'NONE' }
export interface NotifRow { id: string; ts: number; tbl: string; rid: string; op: NotifOp; title: string; body: string; actor: string | null }

let notifTableReady = false

/** ساخت جدول اعلان‌ها — idempotent و یک‌بار در هر isolate */
export async function ensureNotifTable(db: Client): Promise<void> {
  if (notifTableReady) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "ts" REAL NOT NULL,
      "tbl" TEXT NOT NULL DEFAULT '',
      "rid" TEXT NOT NULL DEFAULT '',
      "op" TEXT NOT NULL DEFAULT 'UPDATE',
      "title" TEXT NOT NULL DEFAULT '',
      "body" TEXT NOT NULL DEFAULT '',
      "actor" TEXT
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS "Notification_ts_idx" ON "Notification" ("ts")`)
  notifTableReady = true
}

// ===== قواعد حذف نویز =====
/** بیشینهٔ تعداد اعلان ثبت‌شده در یک push (بازسازی/repair انبوه را سقف می‌زند) */
export const MAX_NOTIFS_PER_PUSH = 200
/** بالاتر از این تعداد، تلگرام فقط پیام خلاصه می‌دهد (ضداسپم) */
const TELEGRAM_MAX_LINES = 25

// ===== برچسب‌های فارسی =====
const TBL_LABEL: Record<SyncTbl, string> = {
  sales: 'فروش', purchases: 'خرید', productions: 'تولید', boxes: 'جعبه',
  consumptions: 'مصرف مواد', customers: 'مشتری', suppliers: 'فروشنده',
  materials: 'ماده اولیه', goods: 'کالا', machines: 'دستگاه', machineCosts: 'هزینه دستگاه',
  expenseCategories: 'سرفصل هزینه', expenses: 'هزینه', otherFunds: 'وجوه دیگر',
  settings: 'تنظیمات', accounts: 'حساب', breadTypes: 'نوع نان', combinedInvoices: 'فاکتور ترکیبی',
}
const OP_LABEL: Record<NotifOp, string> = { CREATE: 'ثبت', UPDATE: 'ویرایش', DELETE: 'حذف' }
const OP_ICON: Record<NotifOp, string> = { CREATE: '➕', UPDATE: '✏️', DELETE: '🗑' }
const PAY_LABEL: Record<string, string> = { CASH: 'نقدی', CARD: 'کارت‌خوان', TRANSFER: 'کارت به کارت', CHECK: 'چک' }
const SETTLE_LABEL: Record<string, string> = { PAID: 'تسویه‌شده', PARTIAL: 'تسویه جزئی', UNPAID: 'پرداخت‌نشده' }
const MACHINE_KIND: Record<string, string> = { BAKING: 'پخت', BUSINESS: 'بازرگانی' }
const MACHINE_STATUS: Record<string, string> = { IN_PROGRESS: 'در حال ساخت', DONE: 'تکمیل‌شده', PAUSED: 'متوقف' }
const COST_KIND: Record<string, string> = { CONSUMABLE: 'مصرفی', CAPITAL: 'سرمایه‌ای' }
const FUND_TYPE: Record<string, string> = { IN: 'ورود پول', OUT: 'خروج پول' }
const ACCOUNT_KIND: Record<string, string> = { BANK: 'حساب بانکی', CASH: 'صندوق نقدی' }

// ===== قالب‌بندی اعداد فارسی =====
const comma3 = (x: number): string => Math.round(Math.abs(x)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
const money = (x: unknown): string => `${faDigits(comma3(Number(x) || 0))} تومان`
const qty = (x: unknown): string => {
  const n = Number(x) || 0
  const s = Number.isInteger(n) ? faDigits(String(n)) : faDigits(String(Math.round(n * 100) / 100))
  return s
}
// ===== مقایسه فیلدها برای تشخیص ویرایش واقعی (حذف نویز repair) =====
function rowEquals(tbl: SyncTbl, a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = ['deleted', ...Object.keys(FIELDS[tbl])]
  for (const k of keys) {
    const va = a[k]
    const vb = b[k]
    if (String(va ?? '') === String(vb ?? '')) continue
    const na = Number(va)
    const nb = Number(vb)
    if (Number.isFinite(na) && Number.isFinite(nb) && na === nb) continue
    return false
  }
  return true
}

/** تشخیص نوع عملیات از روی وضعیت قبلی سرور */
export function classifyOp(tbl: SyncTbl, prev: Record<string, unknown> | null, row: Record<string, unknown>): NotifOp | 'NONE' {
  if (!prev) return 'CREATE'
  const pDeleted = Number(prev.deleted || 0)
  const nDeleted = Number(row.deleted || 0)
  if (pDeleted === 1 && nDeleted === 1) return 'NONE' // تومب‌استون تکراری
  if (pDeleted === 0 && nDeleted === 1) return 'DELETE'
  if (pDeleted === 1 && nDeleted === 0) return 'CREATE' // بازیابی
  return rowEquals(tbl, prev, row) ? 'NONE' : 'UPDATE' // محتوای یکسان (repair) → بدون اعلان
}

// ===== نام‌های مرجع (lookup) — یک SELECT برای هر جدول مرجع =====
const nameOf = (m: Map<string, string>, tbl: string, id: unknown): string => m.get(`${tbl}:${String(id || '')}`) || ''

export async function buildNotifications(db: Client, changes: NotifChange[]): Promise<NotifRow[]> {
  const usable = changes.filter((c): c is NotifChange & { op: NotifOp } => c.op !== 'NONE' && !String(c.row.id || '').startsWith('seed-'))
  if (usable.length === 0) return []
  const capped = usable.slice(0, MAX_NOTIFS_PER_PUSH)

  // ۱) شناسه‌های مرجع موردنیاز
  const lookups = new Map<string, Set<string>>()
  const need = (tbl: string, id: unknown) => {
    const s = String(id || '')
    if (!s || s === 'null') return
    let set = lookups.get(tbl)
    if (!set) { set = new Set(); lookups.set(tbl, set) }
    set.add(s)
  }
  for (const c of capped) {
    const r = c.row
    switch (c.tbl) {
      case 'sales': need('customers', r.customerId); need('accounts', r.accountId); break
      case 'purchases':
        need(String(r.itemKind) === 'GOOD' ? 'goods' : 'materials', r.materialId)
        need('suppliers', r.supplierId); need('accounts', r.accountId); break
      case 'productions': case 'boxes': need('breadTypes', r.breadTypeId); break
      case 'consumptions': need('materials', r.materialId); break
      case 'expenses': need('expenseCategories', r.categoryId); need('accounts', r.accountId); break
      case 'otherFunds': need('accounts', r.accountId); break
      case 'machineCosts': need('machines', r.machineId); break
      case 'combinedInvoices': need('customers', r.customerId); break
    }
  }

  // ۲) یک SELECT گروهی برای هر جدول مرجع
  const nameMap = new Map<string, string>()
  const unitMap = new Map<string, string>()
  for (const [lt, ids] of lookups) {
    const phys = PHYS[lt as SyncTbl]
    if (!phys) continue
    const arr = [...ids].slice(0, 500)
    try {
      const cols = lt === 'materials' ? 'id, name, unit' : 'id, name'
      const ph = arr.map(() => '?').join(',')
      const res = await db.execute({ sql: `SELECT ${cols} FROM "${phys}" WHERE id IN (${ph})`, args: arr })
      for (const r of res.rows) {
        nameMap.set(`${lt}:${String(r['id'])}`, String(r['name'] ?? ''))
        if (lt === 'materials') unitMap.set(String(r['id']), String(r['unit'] ?? ''))
      }
    } catch { /* مرجع در دسترس نبود — نام خالی می‌ماند */ }
  }

  // ۳) متن بدنهٔ هر جدول
  const bodyOf = (tbl: SyncTbl, r: Record<string, unknown>): string => {
    switch (tbl) {
      case 'sales': {
        const cust = nameOf(nameMap, 'customers', r.customerId) || 'مشتری'
        const pay = PAY_LABEL[String(r.paymentMethod)] || ''
        const settle = SETTLE_LABEL[String(r.settledStatus)] || ''
        const inv = r.invoiceNumber != null && Number(r.invoiceNumber) > 0 ? `فاکتور #${faDigits(String(r.invoiceNumber))}` : ''
        const acc = r.accountId ? `واریز به ${nameOf(nameMap, 'accounts', r.accountId)}` : ''
        return [cust, money(r.totalAmount), pay, settle, inv, acc].filter(Boolean).join(' — ')
      }
      case 'purchases': {
        const isGood = String(r.itemKind) === 'GOOD'
        const item = nameOf(nameMap, isGood ? 'goods' : 'materials', r.materialId) || (isGood ? 'کالا' : 'ماده اولیه')
        const unit = isGood ? 'جعبه' : unitMap.get(String(r.materialId)) || ''
        const sup = r.supplierId ? `فروشنده: ${nameOf(nameMap, 'suppliers', r.supplierId)}` : ''
        const settle = SETTLE_LABEL[String(r.settledStatus)] || ''
        return [item, `${qty(r.quantity)} ${unit}`.trim(), money(r.cost), sup, settle].filter(Boolean).join(' — ')
      }
      case 'productions': {
        const bt = nameOf(nameMap, 'breadTypes', r.breadTypeId)
        const waste = Number(r.waste || 0) > 0 ? `ضایعات: ${qty(r.waste)}` : ''
        return [bt, `${qty(r.totalProduced)} عدد`, `${qty(r.boxesCount)} جعبه`, waste].filter(Boolean).join(' — ')
      }
      case 'boxes': {
        const bt = nameOf(nameMap, 'breadTypes', r.breadTypeId)
        const ess = Number(r.hasEssence || 0) && r.essenceType ? `اسانس ${r.essenceType}` : ''
        return [`کد ${faDigits(String(r.code || ''))}`, `${qty(r.count)} عدد`, bt, ess].filter(Boolean).join(' — ')
      }
      case 'consumptions': {
        const mt = nameOf(nameMap, 'materials', r.materialId) || 'ماده اولیه'
        const unit = unitMap.get(String(r.materialId)) || ''
        return [mt, `${qty(r.quantity)} ${unit}`.trim()].filter(Boolean).join(' — ')
      }
      case 'expenses': {
        const cat = nameOf(nameMap, 'expenseCategories', r.categoryId) || 'هزینه'
        const acc = r.accountId ? `از ${nameOf(nameMap, 'accounts', r.accountId)}` : ''
        return [cat, money(r.amount), String(r.description || '') || null, acc].filter(Boolean).join(' — ')
      }
      case 'otherFunds': {
        const t = FUND_TYPE[String(r.type)] || 'انتقال وجه'
        const acc = r.accountId ? nameOf(nameMap, 'accounts', r.accountId) : ''
        return [t, money(r.amount), String(r.description || ''), acc].filter(Boolean).join(' — ')
      }
      case 'customers': return [String(r.name || 'مشتری'), r.phone ? `تلفن: ${faDigits(String(r.phone))}` : ''].filter(Boolean).join(' — ')
      case 'suppliers': return [String(r.name || 'فروشنده'), r.phone ? `تلفن: ${faDigits(String(r.phone))}` : ''].filter(Boolean).join(' — ')
      case 'materials': return [String(r.name || ''), `واحد: ${r.unit}`, `حد بحرانی: ${qty(r.minStock)}`].filter(Boolean).join(' — ')
      case 'goods': return [String(r.name || ''), `حد بحرانی: ${qty(r.minStock)} جعبه`].filter(Boolean).join(' — ')
      case 'machines': return [String(r.name || ''), MACHINE_KIND[String(r.kind)] || '', MACHINE_STATUS[String(r.status)] || ''].filter(Boolean).join(' — ')
      case 'machineCosts': {
        const m = nameOf(nameMap, 'machines', r.machineId)
        return [m, `${COST_KIND[String(r.kind)] || ''}: ${r.name}`, money(r.cost)].filter(Boolean).join(' — ')
      }
      case 'expenseCategories': return String(r.name || 'سرفصل')
      case 'breadTypes': return String(r.name || 'نوع نان')
      case 'accounts': return [String(r.name || ''), ACCOUNT_KIND[String(r.kind)] || '', `موجودی اولیه: ${money(r.initialBalance)}`].filter(Boolean).join(' — ')
      case 'settings': return `نام کسب‌وکار: ${r.businessName || '—'}`
      case 'combinedInvoices': {
        const cust = nameOf(nameMap, 'customers', r.customerId) || 'مشتری'
        const rem = Number(r.remaining || 0) > 0 ? `مانده: ${money(r.remaining)}` : 'تسویه کامل'
        return [`فاکتور #${faDigits(String(r.invoiceNumber || ''))}`, cust, money(r.totalAmount), rem].filter(Boolean).join(' — ')
      }
      default: return ''
    }
  }

  const baseTs = Date.now()
  return capped.map((c, i) => ({
    id: crypto.randomUUID(),
    ts: baseTs + i,
    tbl: c.tbl,
    rid: String(c.row.id || ''),
    op: c.op,
    title: `${OP_LABEL[c.op]} ${TBL_LABEL[c.tbl]}`,
    body: bodyOf(c.tbl, c.row),
    actor: (typeof c.row.createdBy === 'string' && c.row.createdBy) || (c.prev && typeof c.prev.createdBy === 'string' && c.prev.createdBy) || null,
  }))
}

/** درج اعلان‌ها + پاکسازی خودکار اعلان‌های قدیمی (بیش از ۳۰ روز) */
export async function insertNotifications(db: Client, notifs: NotifRow[]): Promise<void> {
  if (notifs.length === 0) return
  const stmts = notifs.map(n => ({
    sql: `INSERT OR REPLACE INTO "Notification" ("id","ts","tbl","rid","op","title","body","actor") VALUES (?,?,?,?,?,?,?,?)`,
    args: [n.id, n.ts, n.tbl, n.rid, n.op, n.title, n.body, n.actor],
  }))
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000
  stmts.push({ sql: `DELETE FROM "Notification" WHERE "ts" < ?`, args: [monthAgo] })
  await db.batch(stmts as unknown as Parameters<Client['batch']>[0], 'write')
}

/** خواندن اعلان‌ها برای کلاینت — جدیدترین اول */
export async function fetchNotifications(db: Client, since: number, limit: number): Promise<NotifRow[]> {
  const lim = Math.min(Math.max(limit || 100, 1), 200)
  const res = await db.execute({
    sql: `SELECT * FROM "Notification" WHERE "ts" > ? ORDER BY ts DESC, rowid DESC LIMIT ?`,
    args: [since, lim],
  })
  const out: NotifRow[] = []
  for (const r of res.rows) {
    out.push({
      id: String(r['id']),
      ts: Number(r['ts'] ?? 0),
      tbl: String(r['tbl'] ?? ''),
      rid: String(r['rid'] ?? ''),
      op: (String(r['op'] ?? 'UPDATE') as NotifOp),
      title: String(r['title'] ?? ''),
      body: String(r['body'] ?? ''),
      actor: r['actor'] == null ? null : String(r['actor']),
    })
  }
  return out
}

// ===== تلگرام — پیام فوری دسته‌بندی‌شده به صاحب کسب‌وکار (v3.1.2) =====
// هر دسته (تولید/فروش/خرید/...) پیام مستقل خودش را دارد با ایموجی و رنگ
// مفهومی مخصوص همان دسته. قالب HTML (هدرهای بولد) با escape کامل متن کاربر.

const TG_SEP = '━━━━━━━━━━━━━━'

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function tgStamp(): string {
  const d = new Date()
  return `🕐 ${faDigits(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`)}`
}

/** متن یک اعلان: آیکون عملیات + عنوان + بدنه + کاربر */
function tgLine(n: NotifRow): string {
  const by = n.actor ? `\n👤 ${escapeHtml(n.actor)}` : ''
  return `${OP_ICON[n.op] || '•'} ${escapeHtml(n.title)}\n${escapeHtml(n.body)}${by}`
}

/** پیام خلاصهٔ ضداسپم — وقتی تغییرات بیش از حد زیاد است */
function tgSummary(notifs: NotifRow[]): string {
  return `🔔 وافلی — ${faDigits(String(notifs.length))} تغییر جدید ثبت شد\n(بیش از حد برای نمایش جزئیات — در اپ ببینید)\n${tgStamp()}`
}

/** پیام یک دستهٔ مشخص — هدر بولد با ایموجی همان دسته */
function tgCategoryMessage(def: { emoji: string; label: string }, rows: NotifRow[]): string {
  return [
    `<b>🔔 وافلی | ${def.emoji} ${escapeHtml(def.label)} — ${faDigits(String(rows.length))} مورد جدید</b>`,
    TG_SEP,
    ...rows.map(tgLine),
    TG_SEP,
    tgStamp(),
  ].join('\n')
}

/**
 * پیام‌های تلگرام برای مجموعه اعلان‌ها — هر دسته پیام مستقل خودش:
 *  • یک دسته → یک پیام
 *  • ۲ تا ۴ دسته → یک پیام برای هر دسته (تولید جدا، فروش جدا، خرید جدا، ...)
 *  • بیش از ۴ دسته → یک پیام ترکیبی با سکشن هر دسته (ضداسپم)
 *  • بیش از ۲۵ اعلان → فقط پیام خلاصه
 */
export function telegramMessages(notifs: NotifRow[]): string[] {
  if (notifs.length === 0) return []
  if (notifs.length > TELEGRAM_MAX_LINES) return [tgSummary(notifs)]

  // گروه‌بندی به ترتیب رسمی دسته‌ها (فروش، خرید، تولید، ...)
  const groups: { def: (typeof NOTIF_CATEGORIES)[number]; rows: NotifRow[] }[] = []
  for (const def of NOTIF_CATEGORIES) {
    const rows = notifs.filter(n => notifCategoryOf(n.tbl) === def.key)
    if (rows.length > 0) groups.push({ def, rows })
  }
  // جدول ناشناخته (نباید اتفاق بیفتد) — داخل دستهٔ تنظیمات می‌افتد

  if (groups.length === 1) return [tgCategoryMessage(groups[0].def, groups[0].rows)]
  if (groups.length <= 4) return groups.map(g => tgCategoryMessage(g.def, g.rows))

  // ضداسپم: همهٔ دسته‌ها در یک پیام — هر دسته با هدر ایموجی خودش
  const sections = groups.map(g => `<b>${g.def.emoji} ${escapeHtml(g.def.label)}</b>\n${g.rows.map(tgLine).join('\n')}`)
  const combined = [
    `<b>🔔 وافلی — ${faDigits(String(notifs.length))} تغییر جدید</b>`,
    TG_SEP,
    sections.join(`\n${TG_SEP}\n`),
    TG_SEP,
    tgStamp(),
  ].join('\n')
  return [combined]
}

export async function sendTelegramNotifications(
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string; TELEGRAM_THREAD_ID?: string },
  notifs: NotifRow[],
): Promise<{ sent: boolean; reason?: string; messages?: number }> {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { sent: false, reason: 'telegram env missing' }
  const texts = telegramMessages(notifs)
  if (texts.length === 0) return { sent: false, reason: 'empty' }
  const threadId = env.TELEGRAM_THREAD_ID ? Number(env.TELEGRAM_THREAD_ID) : undefined
  let sentCount = 0
  for (let i = 0; i < texts.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 350)) // فاصلهٔ پیام‌ها — ضد ریت‌لیمیت
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texts[i],
        parse_mode: 'HTML',
        ...(threadId ? { message_thread_id: threadId } : {}),
      }),
    })
    if (!res.ok) {
      if (sentCount === 0) return { sent: false, reason: `telegram http ${res.status}` }
      return { sent: true, messages: sentCount } // بخشی ارسال شد
    }
    sentCount++
  }
  return { sent: true, messages: sentCount }
}
