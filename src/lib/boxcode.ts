// کد کوتاه جعبه (v2.5.1) — یک عدد ترتیبی ۵ رقمی؛ هیچ معنایی ندارد، فقط شناسهٔ جعبه است.
// مثال: 00001 … 99999 (بعد از آن ۶ رقمی می‌شود و همچنان یکتا می‌ماند)
// کدهای قدیمی ۱۰ رقمی (TTDDMMNNSS) دست‌نخورده و معتبرند — چون طولشان فرق دارد، تداخلی پیش نمی‌آید.

export const BOX_CODE_LEN = 5

/** کد از سری → عدد ۵ رقمی با صفر ابتدایی */
export function boxCode(serial: number): string {
  return String(Math.max(1, Math.round(serial))).padStart(BOX_CODE_LEN, '0')
}

/** بزرگ‌ترین سری استفاده‌شده میان کدهای کوتاه موجود → کد بعدی
 *  (کدهای قدیمی ۱۰ رقمی و مقادیر نامعتبر نادیده گرفته می‌شوند تا کد ناگهان بلند نشود) */
export function nextBoxSerial(existingCodes: string[]): number {
  let max = 0
  for (const c of existingCodes) {
    if (typeof c === 'string' && c.length <= BOX_CODE_LEN && /^\d{1,5}$/.test(c)) {
      const n = parseInt(c, 10)
      if (n > max) max = n
    }
  }
  return max + 1
}
