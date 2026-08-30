// محاسبات کسب‌وکار — موجودی، بدحسابی، سود دوره، خریداران
import type { Consumption, Customer, Expense, ExpenseCategory, Material, Production, Purchase, Sale, Setting, BreadType, MachineCost, Machine } from './types'
import { inRange, jalaliAbsDays, todayJalali, type Period } from './jalali'

export interface DataBundle {
  breadTypes: BreadType[]
  productions: Production[]
  materials: Material[]
  consumptions: Consumption[]
  customers: Customer[]
  sales: Sale[]
  suppliers: { id: string; name: string }[]
  purchases: Purchase[]
  machines: Machine[]
  machineCosts: MachineCost[]
  expenseCategories: ExpenseCategory[]
  expenses: Expense[]
  setting: Setting
}

export const active = <T extends { deleted?: number }>(rows: T[]) => rows.filter(r => !r.deleted)

export const parseItems = (sale: Sale) => {
  try { return JSON.parse(sale.items || '[]') as Sale['items'] extends string ? import('./types').SaleItem[] : never[] } catch { return [] }
}

// ===== فروش =====
export const saleDue = (s: Sale) => Math.max(0, (s.totalAmount || 0) - (s.paidAmount || 0))

export function effectiveSettled(s: Sale): 'PAID' | 'PARTIAL' | 'UNPAID' {
  const due = saleDue(s)
  if (due <= 0.5) return 'PAID'
  if ((s.paidAmount || 0) > 0.5) return 'PARTIAL'
  return 'UNPAID'
}

export function isBadDebt(s: Sale, badDebtDays: number) {
  return effectiveSettled(s) !== 'PAID' && daysSince(s.date) > badDebtDays
}

export function daysSince(dateStr: string): number {
  const t = jalaliAbsDays(today())
  return t - jalaliAbsDays(dateStr)
}

export const today = () => todayJalali()

/** تاریخ وصول مؤثر: paymentDate یا در صورت تسویه کامل، تاریخ فروش */
export function effectivePaymentDate(s: Sale): string | null {
  if (s.paymentDate) return s.paymentDate
  if (effectiveSettled(s) === 'PAID') return s.date
  return null
}

// ===== مواد و موجودی =====
export interface MaterialStock {
  material: Material
  purchased: number
  consumed: number
  stock: number
  avgPrice: number // میانگین قیمت هر واحد بر اساس خریدها
  low: boolean
}

export function materialStocks(d: DataBundle): MaterialStock[] {
  const today2 = today()
  return active(d.materials).map(m => {
    const purchases = active(d.purchases).filter(p => p.materialId === m.id)
    const consumptions = active(d.consumptions).filter(c => c.materialId === m.id)
    const purchased = purchases.reduce((a, p) => a + (p.quantity || 0), 0)
    const consumed = consumptions.reduce((a, c) => a + (c.quantity || 0), 0)
    const totalCost = purchases.reduce((a, p) => a + (p.cost || 0), 0)
    const avgPrice = purchased > 0 ? totalCost / purchased : 0
    const stock = purchased - consumed
    return { material: m, purchased, consumed, stock, avgPrice, low: stock <= (m.minStock || 0) }
  })
}

/** هزینه مواد یک دوره = مصرف دوره × میانگین قیمت خرید */
export function periodMaterialCost(d: DataBundle, period: Period): number {
  const stocks = materialStocks(d)
  let cost = 0
  for (const c of active(d.consumptions)) {
    if (!inRange(c.date, period.start, period.end)) continue
    const st = stocks.find(s => s.material.id === c.materialId)
    cost += (c.quantity || 0) * (st?.avgPrice || 0)
  }
  return cost
}

// ===== خریداران =====
export interface BuyerStat {
  customer: Customer
  qty: number
  amount: number
  due: number
  salesCount: number
  avgSettleDays: number | null // میانگین سرعت تسویه
}

export function buyerStats(d: DataBundle, period?: Period): BuyerStat[] {
  const sales = active(d.sales).filter(s => !period || inRange(s.date, period.start, period.end))
  const map = new Map<string, BuyerStat>()
  for (const s of sales) {
    const c = d.customers.find(x => x.id === s.customerId)
    if (!c) continue
    let st = map.get(c.id)
    if (!st) {
      st = { customer: c, qty: 0, amount: 0, due: 0, salesCount: 0, avgSettleDays: null }
      map.set(c.id, st)
    }
    const items = parseItems(s)
    st.qty += items.reduce((a, it) => a + (it.delivered || it.qty || 0), 0)
    st.amount += s.totalAmount || 0
    st.due += saleDue(s)
    st.salesCount += 1
    const pd = s.paymentDate
    if (pd) {
      const days = Math.max(0, jalaliAbsDays(pd) - jalaliAbsDays(s.date))
      st.avgSettleDays = st.avgSettleDays == null ? days : (st.avgSettleDays + days) / 2
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

// ===== گزارش دوره =====
export type ProfitMode = 'gross' | 'beforeOverhead' | 'net'

export interface PeriodReport {
  salesAmount: number
  salesQty: number
  collected: number
  outstandingTotal: number // مانده کل مطالبات (همه زمان‌ها)
  materialCost: number
  expensesIncluded: { id: string; name: string; amount: number }[]
  expensesTotalIncluded: number
  expensesTotalAll: number
  profitGross: number       // فروش − مواد
  profitBeforeOverhead: number // همان gross (برای شفافیت)
  profitNet: number         // فروش − مواد − هزینه‌های مشمول
  buyers: BuyerStat[]
  badDebts: { sale: Sale; customer: Customer | undefined; days: number }[]
  checks: { sale: Sale; customer: Customer | undefined; status: 'PAST_DUE' | 'NEAR' | 'FUTURE' }[]
  purchasesTotal: number
  purchasesDue: number
  productionTotals: { breadType: BreadType; produced: number; boxes: number; waste: number }[]
}

export function periodReport(d: DataBundle, period: Period): PeriodReport {
  const { start, end } = period
  const sales = active(d.sales).filter(s => inRange(s.date, start, end))
  const salesAmount = sales.reduce((a, s) => a + (s.totalAmount || 0), 0)
  const salesQty = sales.reduce((a, s) => a + parseItems(s).reduce((b, it) => b + (it.delivered || it.qty || 0), 0), 0)
  const collected = sales.reduce((a, s) => {
    const pd = effectivePaymentDate(s)
    return pd && inRange(pd, start, end) ? a + (s.paidAmount || 0) : a
  }, 0)
  const outstandingTotal = active(d.sales).reduce((a, s) => a + saleDue(s), 0)

  const materialCost = periodMaterialCost(d, period)

  const expenses = active(d.expenses).filter(e => inRange(e.date, start, end))
  const byCat = new Map<string, number>()
  let expensesTotalAll = 0
  for (const e of expenses) {
    expensesTotalAll += e.amount || 0
    byCat.set(e.categoryId, (byCat.get(e.categoryId) || 0) + (e.amount || 0))
  }
  const expensesIncluded = [...byCat.entries()].map(([catId, amount]) => {
    const cat = d.expenseCategories.find(c => c.id === catId)
    return { id: catId, name: cat?.name || 'نامشخص', amount, included: (cat?.includeInProfit ?? 1) === 1 }
  }).filter(x => x.included) as { id: string; name: string; amount: number }[]
  const expensesTotalIncluded = expensesIncluded.reduce((a, x) => a + x.amount, 0)

  const profitGross = salesAmount - materialCost
  const profitNet = profitGross - expensesTotalIncluded

  const buyers = buyerStats(d, period)

  const badDebts = active(d.sales)
    .filter(s => isBadDebt(s, d.setting.badDebtDays))
    .map(s => ({ sale: s, customer: d.customers.find(c => c.id === s.customerId), days: daysSince(s.date) }))
    .sort((a, b) => b.days - a.days)

  const todayStr = today()
  const alertDays = d.setting.checkAlertDays || 7
  const checks = active(d.sales)
    .filter(s => s.paymentMethod === 'CHECK' && effectiveSettled(s) !== 'PAID')
    .map(s => {
      const due = s.checkDueDate || s.date
      const diff = jalaliAbsDays(due) - jalaliAbsDays(todayStr)
      const status: 'PAST_DUE' | 'NEAR' | 'FUTURE' = diff < 0 ? 'PAST_DUE' : diff <= alertDays ? 'NEAR' : 'FUTURE'
      return { sale: s, customer: d.customers.find(c => c.id === s.customerId), status }
    })
    .sort((a, b) => (a.sale.checkDueDate || '').localeCompare(b.sale.checkDueDate || ''))

  const purchases = active(d.purchases).filter(p => inRange(p.date, start, end))
  const purchasesTotal = purchases.reduce((a, p) => a + (p.cost || 0), 0)
  const purchasesDue = purchases.reduce((a, p) => a + Math.max(0, (p.cost || 0) - (p.paidAmount || 0)), 0)

  const productions = active(d.productions).filter(p => inRange(p.date, start, end))
  const productionTotals = active(d.breadTypes).map(bt => {
    const rows = productions.filter(p => p.breadTypeId === bt.id)
    return {
      breadType: bt,
      produced: rows.reduce((a, p) => a + (p.totalProduced || 0), 0),
      boxes: rows.reduce((a, p) => a + (p.boxesCount || 0), 0),
      waste: rows.reduce((a, p) => a + (p.waste || 0), 0),
    }
  })

  return {
    salesAmount, salesQty, collected, outstandingTotal,
    materialCost, expensesIncluded, expensesTotalIncluded, expensesTotalAll,
    profitGross, profitBeforeOverhead: profitGross, profitNet,
    buyers, badDebts, checks,
    purchasesTotal, purchasesDue, productionTotals,
  }
}

// ===== دستگاه‌سازی =====
export function machineTotals(d: DataBundle, machineId: string) {
  const costs = active(d.machineCosts).filter(c => c.machineId === machineId)
  const consumable = costs.filter(c => c.kind === 'CONSUMABLE').reduce((a, c) => a + (c.cost || 0), 0)
  const capital = costs.filter(c => c.kind === 'CAPITAL').reduce((a, c) => a + (c.cost || 0), 0)
  return { consumable, capital, total: consumable + capital, costs }
}
