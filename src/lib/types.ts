// تایپ‌های مشترک Waffly — رکوردهای سینک‌پذیر
export const TABLES = [
  'breadTypes', 'productions', 'boxes', 'materials', 'goods', 'consumptions',
  'customers', 'sales', 'suppliers', 'purchases',
  'machines', 'machineCosts', 'expenseCategories', 'expenses', 'otherFunds', 'settings',
] as const

export type SyncTbl = (typeof TABLES)[number]

export interface BaseRow {
  id: string
  updatedAt: number
  deleted?: number // 0/1 تومب‌استون
}

export interface BreadType extends BaseRow { name: string; code: string; active?: number }
export interface Production extends BaseRow {
  date: string; breadTypeId: string
  totalProduced: number; boxesCount: number; perBoxCount: number; waste: number
  carriedFrom?: string | null; note?: string | null; createdBy?: string | null
}
export interface Box extends BaseRow {
  code: string; productionId: string; breadTypeId: string; count: number; date: string
  hasEssence?: number; essenceType?: string | null; note?: string | null
}
export interface Material extends BaseRow { name: string; unit: string; minStock: number; active?: number }

/** کالای بازرگانی — خرید و فروش بدون تولید (مثل نان مشعلی) */
export interface Good extends BaseRow {
  name: string
  piecesPerBox: number // تعداد در هر جعبه — ۰ یعنی هنوز تعیین نشده
  minStock: number // حد بحرانی هشدار (به عدد)
  active?: number
}
export interface Consumption extends BaseRow {
  date: string; materialId: string; quantity: number; note?: string | null; createdBy?: string | null
}
export interface Customer extends BaseRow {
  name: string; phone?: string | null; address?: string | null; cooperationType?: string | null
}
/**
 * قلم فاکتور فروش
 * kind=BREAD: breadTypeId = شناسه نان (پیش‌فرض — سازگار با رکوردهای قدیمی)
 * kind=GOOD: breadTypeId = شناسه کالا و همه مقادیر (qty/delivered/returned) همیشه به «عدد» ذخیره می‌شوند؛
 *   ورود جعبه‌ای فقط راحتی UI است و قبل از ذخیره به عدد تبدیل می‌شود.
 */
export interface SaleItem {
  breadTypeId: string; qty: number; unitPrice: number
  delivered: number; returned: number; returnCost: number
  kind?: 'BREAD' | 'GOOD'
}
export interface Sale extends BaseRow {
  date: string; customerId: string; items: string // JSON SaleItem[]
  totalAmount: number; settledStatus: 'PAID' | 'PARTIAL' | 'UNPAID'
  paidAmount: number; paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK'
  checkDueDate?: string | null; checkNumber?: string | null; checkBank?: string | null
  paymentDate?: string | null; note?: string | null; createdBy?: string | null
}
export interface Supplier extends BaseRow { name: string; phone?: string | null; address?: string | null }
/**
 * خرید — itemKind=MATERIAL (پیش‌فرض): materialId = ماده اولیه
 * itemKind=GOOD: materialId = شناسه کالا، quantity = تعداد عدد (بعد از تبدیل جعبه)، boxesCount برای نمایش
 */
export interface Purchase extends BaseRow {
  date: string; materialId: string; quantity: number; cost: number; supplierId?: string | null
  settledStatus: 'PAID' | 'PARTIAL' | 'UNPAID'; paidAmount: number
  itemKind?: 'MATERIAL' | 'GOOD'
  boxesCount?: number // فقط کالای جعبه‌ای — برای نمایش
  note?: string | null; createdBy?: string | null
}
export interface Machine extends BaseRow {
  name: string; kind: 'BAKING' | 'BUSINESS'; startDate: string
  status: 'IN_PROGRESS' | 'DONE' | 'PAUSED'; note?: string | null
}
export interface MachineCost extends BaseRow {
  machineId: string; kind: 'CONSUMABLE' | 'CAPITAL'
  name: string; quantity: number; date: string; cost: number
  note?: string | null
}
export interface ExpenseCategory extends BaseRow { name: string; includeInProfit?: number }
export interface Expense extends BaseRow {
  date: string; categoryId: string; amount: number; description?: string | null; createdBy?: string | null
}
export interface OtherFund extends BaseRow {
  date: string
  type: 'IN' | 'OUT' // ورود/خروج — خارج از حساب سود
  amount: number
  description: string // اجباری — منشأ/مقصد پول
}

export interface Setting extends BaseRow {
  businessName: string; monthStartDay: number; badDebtDays: number; checkAlertDays: number
}

// طعم‌های اسانس — لیست قابل‌گسترش (فعلاً پرتقالی؛ بعداً اضافه می‌شود)
export const ESSENCE_TYPES: string[] = ['پرتقالی']

export type SyncOp = { tbl: SyncTbl; row: Record<string, unknown> }
