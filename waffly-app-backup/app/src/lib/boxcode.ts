// کد کوتاه معنادار جعبه (v2.5.2) — ۵ رقم: MM DD S
// دو رقم اول: ماه شمسی | دو رقم بعد: روز ماه | رقم آخر: شمارهٔ جعبهٔ همان روز
// مثال: 07263 ← ماه ۰۷ (مهر)، روز ۲۶، جعبهٔ سوم همان روز
// اگر یک روز بیش از ۹ جعبه تولید شود، شماره ۲ رقمی و کد ۶ رقمی می‌شود (بیش از ۹۹ → ۷ رقمی) — همچنان یکتا.
// کدهای قدیمی ۱۰ رقمی (TTDDMMNNSS) دست‌نخورده و معتبرند — با طول متفاوت تداخلی ایجاد نمی‌کنند.
import { parseJalali, todayJalali } from './jalali'

/** پیشوند ۴ رقمی تاریخ: ماه + روز */
export function boxDayPrefix(date: string): string {
  const p = parseJalali(date) ?? parseJalali(todayJalali())!
  return `${String(p.jm).padStart(2, '0')}${String(p.jd).padStart(2, '0')}`
}

/** کد جعبه = ماه + روز + شمارهٔ جعبهٔ همان روز */
export function boxCode(date: string, serial: number): string {
  return `${boxDayPrefix(date)}${Math.max(1, Math.round(serial))}`
}

/** بزرگ‌ترین شمارهٔ استفاده‌شدهٔ همان روز میان کدهای موجود → شمارهٔ بعدی
 *  (شماره در سطح «روز» است و بین همهٔ انواع نان مشترک می‌شود؛ کدهای قدیمی نادیده گرفته می‌شوند) */
export function nextBoxSerial(existingCodes: string[], date: string): number {
  const prefix = boxDayPrefix(date)
  let max = 0
  for (const c of existingCodes) {
    if (typeof c === 'string' && c.length >= 5 && c.length <= 7 && /^\d{4}\d{1,3}$/.test(c) && c.startsWith(prefix)) {
      const s = parseInt(c.slice(4), 10)
      if (s > max) max = s
    }
  }
  return max + 1
}

/**
 * برنامهٔ تغییر تعداد جعبه‌های یک تولید موجود (ویرایش تولید — v2.6)
 * - liveBoxes: جعبه‌های زندهٔ همین تولید (مرتب‌شده بر اساس کد)
 * - newCount: تعداد جدید جعبه‌ها
 * - date: تاریخ (احتمالاً جدید) تولید — کدهای جدید از همین تاریخ می‌گیرند
 * - allCodes: همهٔ کدهای موجود (شامل حذف‌شده‌ها — کد چاپی بازیافت نمی‌شود)
 * خروجی: کدهای جعبه‌های جدید + شناسهٔ جعبه‌هایی که باید حذف شوند (از آخر؛ بزرگ‌ترین کد)
 */
export function planProductionBoxes(
  liveBoxes: { id: string; code: string }[],
  newCount: number,
  date: string,
  allCodes: string[],
): { addCodes: string[]; removeIds: string[] } {
  const count = Math.max(0, Math.round(newCount) || 0)
  const add = Math.max(0, count - liveBoxes.length)
  const remove = Math.max(0, liveBoxes.length - count)
  const start = nextBoxSerial(allCodes, date)
  const addCodes: string[] = []
  for (let i = 0; i < add; i++) addCodes.push(boxCode(date, start + i))
  const removeIds = remove > 0 ? liveBoxes.slice(liveBoxes.length - remove).map(b => b.id) : []
  return { addCodes, removeIds }
}
