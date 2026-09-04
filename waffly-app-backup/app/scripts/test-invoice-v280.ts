// تست واحد v2.8 — کتابخانهٔ فاکتور (مدل/تخفیف/متن/ترکیبی) — اجرا: npx tsx scripts/test-invoice-v280.ts
import {
  computeDiscount, buildSaleInvoice, buildCombinedInvoice, combinedInvoiceRecord,
  invoiceToText, invoiceCaption, saleSubtotal, type InvoiceCtx,
} from '../src/lib/invoice'
import type { Sale, SaleItem } from '../src/lib/types'

let pass = 0
let fail = 0
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.error(`✗ ${name}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`) }
}

const ctx: InvoiceCtx = {
  businessName: 'نان بستنی آرتا',
  phones: ['۰۹۱۰۴۳۶۱۲۳۳', '۰۹۳۹۱۵۳۱۶۶۴'],
  bank: { accountName: 'علی سبيلی', cardNumber: '6063-7312-5558-2299', sheba: 'IR730600000000300326236111', bankName: 'بانک ایران زمین' },
  nameOf: (id) => (id === 'bt1' ? 'نان بزرگ' : id === 'gd1' ? 'نان مشعلی' : 'قلم'),
}

const item = (over: Partial<SaleItem>): SaleItem => ({
  breadTypeId: 'bt1', qty: 10, unitPrice: 1000, delivered: 10, returned: 0, returnCost: 0, kind: 'BREAD', ...over,
})
const sale = (over: Partial<Sale>): Sale => ({
  id: 's1', updatedAt: 1, date: '1405/06/13', customerId: 'c1',
  items: JSON.stringify([item({})]), totalAmount: 10000, settledStatus: 'UNPAID', paidAmount: 0,
  paymentMethod: 'CASH', ...over,
})

// ===== computeDiscount =====
eq('تخفیف NONE = 0', computeDiscount(100000, 'NONE', 5000), 0)
eq('تخفیف مبلغ ثابت', computeDiscount(100000, 'AMOUNT', 5000), 5000)
eq('تخفیف مبلغ بیشتر از جمع → کپ می‌شود', computeDiscount(100000, 'AMOUNT', 500000), 100000)
eq('تخفیف درصد ۱۰٪', computeDiscount(100000, 'PERCENT', 10), 10000)
eq('تخفیف درصد > ۱۰۰ → کپ', computeDiscount(100000, 'PERCENT', 250), 100000)
eq('تخفیف بدون مقدار = 0', computeDiscount(100000, 'PERCENT', 0), 0)

// ===== saleSubtotal =====
const s2 = sale({ items: JSON.stringify([item({}), item({ breadTypeId: 'gd1', kind: 'GOOD', qty: 2, unitPrice: 80000, returnCost: 1500, returned: 3 })]) })
eq('جمع اقلام دو قلم', saleSubtotal(s2).itemsTotal, 10000 + 160000)
eq('جمع برگشتی', saleSubtotal(s2).returnTotal, 1500)

// ===== buildSaleInvoice =====
const s3 = sale({
  items: JSON.stringify([item({ qty: 50, unitPrice: 1000, returned: 3, returnCost: 1500 })]),
  totalAmount: 48500, discountType: 'AMOUNT', discountValue: 5000,
  paidAmount: 20000, settledStatus: 'PARTIAL', paymentMethod: 'CARD',
  invoiceNumber: 1001,
})
const m3 = buildSaleInvoice(s3, ctx)
eq('شماره فاکتور', m3.number, 1001)
eq('جمع اقلام ۵۰×۱۰۰۰', m3.itemsTotal, 50000)
eq('کسر برگشتی → subtotal', m3.sections[0].subtotal, 48500)
eq('تخفیف ۵۰۰۰', m3.discountTotal, 5000)
eq('جمع نهایی', m3.grandTotal, 43500)
eq('مانده', m3.dueTotal, 23500)
eq('ردیف مرجوعی', { q: m3.sections[0].items[0].returnedQty, c: m3.sections[0].items[0].returnedCost }, { q: 3, c: 1500 })

// بدون شماره = پیش‌نویس
eq('بدون invoiceNumber → null', buildSaleInvoice(sale({}), ctx).number, null)

// ===== buildCombinedInvoice =====
const sa = sale({ id: 'a', date: '1405/06/10', totalAmount: 10000, paidAmount: 4000 })
const sb = sale({ id: 'b', date: '1405/06/12', totalAmount: 30000, paidAmount: 0, items: JSON.stringify([item({ qty: 20, unitPrice: 1500 })]) })
const mc = buildCombinedInvoice([sb, sa], ctx)
eq('ترکیبی — تعداد بخش‌ها (مرتب بر اساس تاریخ)', mc.sections.length, 2)
eq('ترکیبی — اولین بخش قدیمی‌ترین', mc.sections[0].date, '1405/06/10')
eq('ترکیبی — جمع کل', mc.grandTotal, 40000)
eq('ترکیبی — جمع پرداختی', mc.paidTotal, 4000)
eq('ترکیبی — مانده', mc.dueTotal, 36000)
eq('ترکیبی — پیش‌فرض بدون شماره', mc.number, null)

// ===== combinedInvoiceRecord =====
const rec = combinedInvoiceRecord({ ...mc, number: 1002 }, [sa, sb], 'عباس')
eq('رکورد ترکیبی — شماره', rec.invoiceNumber, 1002)
eq('رکورد ترکیبی — saleIds', JSON.parse(rec.saleIds), ['a', 'b'])
eq('رکورد ترکیبی — مانده', rec.remaining, 36000)

// ===== متن فاکتور =====
const text = invoiceToText(m3)
const mustHave = [
  'نان بستنی آرتا', 'فاکتور ۱۰۰۱', 'نان بزرگ', 'مرجوعی: ۳', 'تخفیف: −۵٬۰۰۰',
  'جمع نهایی: ۴۳٬۵۰۰ تومان', 'پرداخت‌شده: ۲۰٬۰۰۰', 'مانده: ۲۳٬۵۰۰', 'کارت به کارت',
  '6063-7312-5558-2299', 'IR730600000000300326236111', '۰۹۱۰۴۳۶۱۲۳۳', 'با تشکر از خرید شما',
]
for (const t of mustHave) eq(`متن شامل «${t}»`, text.includes(t), true)

const textDraft = invoiceToText(buildSaleInvoice(sale({}), ctx))
eq('متن پیش‌نویس — برچسب', textDraft.includes('پیش‌نویس'), true)

const textCombined = invoiceToText(mc)
eq('متن ترکیبی — تعداد فروش‌ها', textCombined.includes('تعداد فروش‌ها: ۲'), true)

eq('کپشن — شامل مبلغ', invoiceCaption(m3).includes('۴۳٬۵۰۰'), true)

console.log(`\n===== ${pass} passed, ${fail} failed =====`)
if (fail > 0) process.exit(1)
