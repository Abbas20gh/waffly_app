// v2.8 — مدل مشترک فاکتور + ساخت متن پیامکی
// این فایل خالص است (بدون DOM) — هم طراحی HTML/PNG و هم PDF و هم متن از همین مدل می‌خوانند
import type { Sale, SaleItem, Customer, DiscountType, CombinedInvoice } from './types'
import { faDigits, faMoney, prettyJalali, todayJalali } from './jalali'
import { DEFAULT_BANK } from './localdb'

// ===== کانتکست (از settings/جداول پر می‌شود) =====
export interface InvoiceCtx {
  businessName: string
  phones: string[]
  bank: {
    accountName: string
    cardNumber: string
    sheba: string
    bankName: string
  }
  /** نام نوع نان/کالا از شناسه */
  nameOf: (id: string, kind?: 'BREAD' | 'GOOD') => string
}

export interface InvoiceItemRow {
  name: string
  unit: 'عدد' | 'جعبه'
  isGood: boolean
  qty: number
  unitPrice: number
  total: number
  returnedQty?: number
  returnedCost?: number
}

export interface InvoiceSection {
  /** برای فاکتور ترکیبی: عنوان بخش («فروش ۱۴۰۵/۰۶/۱۳»)؛ برای تک‌فروشی خالی */
  title?: string
  date: string
  items: InvoiceItemRow[]
  itemsTotal: number // جمع اقلام
  returnTotal: number // جمع برگشتی‌ها
  subtotal: number // اقلام − برگشتی
  discount: number
  total: number // نهایی این بخش (بعد از تخفیف)
  paid: number
  due: number
}

export interface InvoiceModel {
  kind: 'single' | 'combined'
  /** null = پیش‌نویس (شماره نگرفته — آفلاین) */
  number: number | null
  issueDate: string
  customerName: string
  customerPhone?: string | null
  sections: InvoiceSection[]
  itemsTotal: number
  returnTotal: number
  discountTotal: number
  grandTotal: number
  paidTotal: number
  dueTotal: number
  paymentMethod?: Sale['paymentMethod']
  settledStatus?: Sale['settledStatus']
  checkDueDate?: string | null
  ctx: InvoiceCtx
}

// ===== محاسبه تخفیف =====
export function computeDiscount(subtotal: number, type: DiscountType | undefined, value: number | undefined): number {
  if (!type || type === 'NONE' || !value || value <= 0 || subtotal <= 0) return 0
  if (type === 'AMOUNT') return Math.min(Math.round(value), subtotal)
  return Math.min(Math.round((subtotal * Math.min(value, 100)) / 100), subtotal)
}

export const saleSubtotal = (sale: Sale) => {
  const items = parseSafe(sale.items)
  const itemsTotal = items.reduce((a, it) => a + (it.qty || 0) * (it.unitPrice || 0), 0)
  const returnTotal = items.reduce((a, it) => a + (it.returnCost || 0), 0)
  return { items, itemsTotal, returnTotal, subtotal: Math.max(0, itemsTotal - returnTotal) }
}

function parseSafe(items: string): SaleItem[] {
  try {
    const arr = JSON.parse(items || '[]') as SaleItem[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// ===== فاکتور تک‌فروش =====
export function buildSaleInvoice(sale: Sale, ctx: InvoiceCtx, customer?: Customer | null): InvoiceModel {
  const { items, itemsTotal, returnTotal, subtotal } = saleSubtotal(sale)
  const discount = computeDiscount(subtotal, sale.discountType, sale.discountValue)
  const total = Math.max(0, subtotal - discount)
  const paid = sale.paidAmount || 0
  const rows: InvoiceItemRow[] = items.map(it => {
    const isGood = it.kind === 'GOOD'
    return {
      name: ctx.nameOf(it.breadTypeId, it.kind),
      unit: isGood ? 'جعبه' : 'عدد',
      isGood,
      qty: it.qty || 0,
      unitPrice: it.unitPrice || 0,
      total: (it.qty || 0) * (it.unitPrice || 0),
      returnedQty: it.returned || 0,
      returnedCost: it.returnCost || 0,
    }
  })
  const section: InvoiceSection = {
    date: sale.date,
    items: rows,
    itemsTotal,
    returnTotal,
    subtotal,
    discount,
    total,
    paid,
    due: Math.max(0, total - paid),
  }
  return {
    kind: 'single',
    number: sale.invoiceNumber ?? null,
    issueDate: todayJalali(),
    customerName: customer?.name || 'نامشخص',
    customerPhone: customer?.phone || null,
    sections: [section],
    itemsTotal,
    returnTotal,
    discountTotal: discount,
    grandTotal: total,
    paidTotal: paid,
    dueTotal: Math.max(0, total - paid),
    paymentMethod: sale.paymentMethod,
    settledStatus: sale.settledStatus,
    checkDueDate: sale.checkDueDate,
    ctx,
  }
}

// ===== فاکتور ترکیبی (صورت‌حساب چند فروش یک مشتری) =====
export function buildCombinedInvoice(sales: Sale[], ctx: InvoiceCtx, customer?: Customer | null, number: number | null = null): InvoiceModel {
  const sorted = [...sales].sort((a, b) => (a.date + a.updatedAt).localeCompare(b.date + b.updatedAt))
  const sections: InvoiceSection[] = sorted.map(s => {
    const { items, itemsTotal, returnTotal, subtotal } = saleSubtotal(s)
    const discount = computeDiscount(subtotal, s.discountType, s.discountValue)
    const total = Math.max(0, subtotal - discount)
    const paid = s.paidAmount || 0
    return {
      title: `فروش ${prettyJalali(s.date)}`,
      date: s.date,
      items: items.map(it => {
        const isGood = it.kind === 'GOOD'
        return {
          name: ctx.nameOf(it.breadTypeId, it.kind),
          unit: isGood ? 'جعبه' : 'عدد',
          isGood,
          qty: it.qty || 0,
          unitPrice: it.unitPrice || 0,
          total: (it.qty || 0) * (it.unitPrice || 0),
          returnedQty: it.returned || 0,
          returnedCost: it.returnCost || 0,
        }
      }),
      itemsTotal,
      returnTotal,
      subtotal,
      discount,
      total,
      paid,
      due: Math.max(0, total - paid),
    }
  })
  const itemsTotal = sections.reduce((a, s) => a + s.itemsTotal, 0)
  const returnTotal = sections.reduce((a, s) => a + s.returnTotal, 0)
  const discountTotal = sections.reduce((a, s) => a + s.discount, 0)
  const grandTotal = sections.reduce((a, s) => a + s.total, 0)
  const paidTotal = sections.reduce((a, s) => a + s.paid, 0)
  return {
    kind: 'combined',
    number,
    issueDate: todayJalali(),
    customerName: customer?.name || 'نامشخص',
    customerPhone: customer?.phone || null,
    sections,
    itemsTotal,
    returnTotal,
    discountTotal,
    grandTotal,
    paidTotal,
    dueTotal: Math.max(0, grandTotal - paidTotal),
    ctx,
  }
}

/** ساخت رکورد سینک‌پذیر فاکتور ترکیبی برای ذخیره در combinedInvoices */
export function combinedInvoiceRecord(m: InvoiceModel, sales: Sale[], createdBy?: string | null): CombinedInvoice {
  return {
    id: `ci-${m.number}-${Date.now().toString(36)}`,
    invoiceNumber: m.number ?? 0,
    customerId: sales[0]?.customerId || '',
    saleIds: JSON.stringify(sales.map(s => s.id)),
    date: m.issueDate,
    totalAmount: m.grandTotal,
    paidAmount: m.paidTotal,
    remaining: m.dueTotal,
    note: null,
    createdBy: createdBy || null,
    updatedAt: 0,
    deleted: 0,
  }
}

// ===== برچسب‌های وضعیت =====
export const SETTLE_LABEL: Record<string, string> = {
  PAID: 'پرداخت‌شده',
  PARTIAL: 'پرداخت جزئی',
  UNPAID: 'پرداخت‌نشده',
}
export const METHOD_LABEL: Record<string, string> = {
  CASH: 'نقدی',
  CARD: 'کارت به کارت',
  TRANSFER: 'کارت به کارت',
  CHECK: 'چک',
}

// ===== متن فاکتور (پیامک/کپی/تلگرام متنی) =====
export function invoiceTitleLine(m: InvoiceModel): string {
  const title = m.ctx.businessName
  const num = m.number ? `فاکتور ${faDigits(m.number)}` : 'فاکتور (پیش‌نویس)'
  return `${title} | ${num} | ${prettyJalali(m.issueDate)}`
}

export function invoiceToText(m: InvoiceModel): string {
  const L: string[] = []
  L.push(`🧾 ${invoiceTitleLine(m)}`)
  L.push(`مشتری: ${m.customerName}`)
  L.push('--------------------------')
  for (const s of m.sections) {
    if (s.title) L.push(`«${s.title}»`)
    for (const it of s.items) {
      const qty = `${faDigits(it.qty)}${it.isGood ? ' جعبه' : ''}`
      L.push(`• ${it.name} ${qty} × ${faMoney(it.unitPrice)} = ${faMoney(it.total)}`)
      if ((it.returnedQty || 0) > 0) {
        L.push(`   ↳ مرجوعی: ${faDigits(it.returnedQty || 0)} ${it.unit} (−${faMoney(it.returnedCost || 0)})`)
      }
    }
    if (s.discount > 0) L.push(`   تخفیف: −${faMoney(s.discount)}`)
    if (s.title) L.push(`   جمع این فروش: ${faMoney(s.total)} تومان`)
  }
  L.push('--------------------------')
  if (m.kind === 'combined') {
    L.push(`تعداد فروش‌ها: ${faDigits(m.sections.length)}`)
    if (m.discountTotal > 0) L.push(`جمع تخفیف‌ها: −${faMoney(m.discountTotal)}`)
  }
  L.push(`جمع نهایی: ${faMoney(m.grandTotal)} تومان`)
  if (m.paidTotal > 0.5) L.push(`پرداخت‌شده: ${faMoney(m.paidTotal)} تومان`)
  if (m.dueTotal > 0.5) L.push(`مانده: ${faMoney(m.dueTotal)} تومان`)
  if (m.kind === 'single' && m.paymentMethod) {
    L.push(`روش پرداخت: ${METHOD_LABEL[m.paymentMethod] || m.paymentMethod}`)
    if (m.paymentMethod === 'CHECK' && m.checkDueDate) L.push(`سررسید چک: ${prettyJalali(m.checkDueDate)}`)
  }
  const st = m.kind === 'single' && m.settledStatus ? SETTLE_LABEL[m.settledStatus] : null
  if (st) L.push(`وضعیت: ${st}`)
  L.push('--------------------------')
  L.push(`💳 کارت ${m.ctx.bank.cardNumber}`)
  L.push(`به نام ${m.ctx.bank.accountName} — ${m.ctx.bank.bankName}`)
  L.push(`شبا: ${m.ctx.bank.sheba}`)
  L.push(`📞 ${m.ctx.phones.join(' | ')}`)
  L.push('با تشکر از خرید شما')
  return L.join('\n')
}

/** کپشن کوتاه تلگرام برای فایل PDF/PNG */
export function invoiceCaption(m: InvoiceModel): string {
  const num = m.number ? `فاکتور ${faDigits(m.number)}` : 'فاکتور پیش‌نویس'
  const parts = [`${m.ctx.businessName} — ${num}`, m.customerName, `${faMoney(m.grandTotal)} تومان`]
  if (m.dueTotal > 0.5) parts.push(`مانده: ${faMoney(m.dueTotal)}`)
  return parts.join(' | ')
}

/** نام فایل خروجی */
export function invoiceFilename(m: InvoiceModel, ext: 'pdf' | 'png'): string {
  const base = m.number ? `invoice-${m.number}` : `invoice-draft-${Date.now()}`
  return `${base}.${ext}`
}

/** خلاصه یک‌خطی برای دکمه‌ها/توست */
export function invoiceSummary(m: InvoiceModel): string {
  return `${m.customerName} — ${faMoney(m.grandTotal)} تومان`
}
