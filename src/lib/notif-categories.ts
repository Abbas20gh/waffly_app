// ===== v3.1.2 — دسته‌بندی اعلان‌های وافلی =====
// هر نوع فعالیت (تولید/فروش/خرید/...) دستهٔ مستقل خودش را دارد:
// رنگ و آیکون مخصوص به خودش — هم در زنگ داخل اپ، هم در تلگرام، هم در
// نوتیف سیستم اندروید. این ماژول عمداً بدون هیچ وابستگی به React یا
// lucide است تا هم کلاینت (src) و هم Functions سروری (functions/api)
// بتوانند از آن import کنند (الگوی همان jalali.ts).

export type NotifCategory =
  | 'sales'       // فروش
  | 'purchase'    // خرید
  | 'production'  // تولید
  | 'inventory'   // موجودی
  | 'expense'     // هزینه
  | 'finance'     // مالی (حساب‌ها و وجوه)
  | 'machine'     // دستگاه‌ها
  | 'settings'    // تنظیمات

export interface NotifCategoryDef {
  key: NotifCategory
  /** برچسب فارسی دسته */
  label: string
  /** ایموجی آیکون — تلگرام و نوتیف سیستم اندروید */
  emoji: string
  /** جدول‌های sync متعلق به این دسته */
  tables: string[]
}

/** ترتیب دسته‌ها = ترتیب نمایش در چیپ‌ها و گروه‌بندی تلگرام */
export const NOTIF_CATEGORIES: NotifCategoryDef[] = [
  { key: 'sales',      label: 'فروش',    emoji: '💰', tables: ['sales', 'combinedInvoices', 'customers'] },
  { key: 'purchase',   label: 'خرید',    emoji: '🛒', tables: ['purchases', 'suppliers'] },
  { key: 'production', label: 'تولید',   emoji: '🏭', tables: ['productions', 'boxes', 'consumptions', 'breadTypes'] },
  { key: 'inventory',  label: 'موجودی',  emoji: '📦', tables: ['materials', 'goods'] },
  { key: 'expense',    label: 'هزینه',   emoji: '💸', tables: ['expenses', 'expenseCategories'] },
  { key: 'finance',    label: 'مالی',    emoji: '🏦', tables: ['accounts', 'otherFunds'] },
  { key: 'machine',    label: 'دستگاه',  emoji: '🔧', tables: ['machines', 'machineCosts'] },
  { key: 'settings',   label: 'تنظیمات', emoji: '⚙️', tables: ['settings'] },
]

const TBL2CAT: Record<string, NotifCategory> = {}
for (const c of NOTIF_CATEGORIES) {
  for (const t of c.tables) TBL2CAT[t] = c.key
}

/** دستهٔ یک جدول sync — جدول ناشناخته → تنظیمات (خنثی‌ترین دسته) */
export function notifCategoryOf(tbl: string): NotifCategory {
  return TBL2CAT[tbl] || 'settings'
}

/** تعریف کامل دسته از روی کلید */
export function notifCategoryDef(key: NotifCategory): NotifCategoryDef {
  return NOTIF_CATEGORIES.find(c => c.key === key) || NOTIF_CATEGORIES[NOTIF_CATEGORIES.length - 1]
}
