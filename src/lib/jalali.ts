// تقویم جلالی — تبدیل، قالب‌بندی فارسی، دوره‌های حسابداری

export const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export const J_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

const div = (a: number, b: number) => ~~(a / b)
const mod = (a: number, b: number) => a - ~~(a / b) * b

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 1701, 1748, 1793, 1835, 1870, 1912, 1935, 1966, 2011, 2026, 2058, 2091, 2133, 2165, 2199, 2234, 2266, 2304, 2340, 2378, 2416, 2454, 2496, 2530, 2574, 2606, 2650, 2686, 2706, 2736, 2792, 2804, 2826, 2842, 2890, 2904, 2934, 2966, 3002]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]
  let jump = 0
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

export function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

export function d2j(jdn: number) {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31)
      const jd = mod(k, 31) + 1
      return { jy, jm, jd }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  const jm = 7 + div(k, 30)
  const jd = mod(k, 30) + 1
  return { jy, jm, jd }
}

export function isLeapJYear(jy: number) {
  return jalCal(jy).leap === 0
}

export function jMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJYear(jy) ? 30 : 29
}

export function gregorianToJalali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd))
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd))
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** تاریخ شمسی امروز به‌صورت رشته استاندارد 1404/06/07 */
export function todayJalali(): string {
  const now = new Date()
  const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  return `${jy}/${p2(jm)}/${p2(jd)}`
}

export function parseJalali(s: string): { jy: number; jm: number; jd: number } | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s.trim())
  if (!m) return null
  const jy = +m[1], jm = +m[2], jd = +m[3]
  if (jm < 1 || jm > 12 || jd < 1 || jd > jMonthLength(jy, jm)) return null
  return { jy, jm, jd }
}

/** روز مطلق برای مقایسه/اختلاف تاریخ */
export function jalaliAbsDays(s: string): number {
  const p = parseJalali(s)
  if (!p) return 0
  return j2d(p.jy, p.jm, p.jd)
}

export function addJalaliDays(s: string, days: number): string {
  const p = parseJalali(s)
  if (!p) return s
  const { jy, jm, jd } = d2j(j2d(p.jy, p.jm, p.jd) + days)
  return `${jy}/${p2(jm)}/${p2(jd)}`
}

/** نام روز هفته از تاریخ شمسی */
export function jWeekday(s: string): string {
  const p = parseJalali(s)
  if (!p) return ''
  // 1978/3/21 مصادف با 1/1/1 شمسی = شنبه
  const wd = mod(j2d(p.jy, p.jm, p.jd) - j2d(1, 1, 1), 7)
  return J_WEEKDAYS[wd]
}

/** شنبه، ۷ شهریور ۱۴۰۵ */
export function todayPretty(): string {
  const t = todayJalali()
  const p = parseJalali(t)!
  return `${jWeekday(t)}، ${faDigits(p.jd)} ${J_MONTHS[p.jm - 1]} ${faDigits(p.jy)}`
}

export function prettyJalali(s: string): string {
  const p = parseJalali(s)
  if (!p) return s
  return `${faDigits(p.jd)} ${J_MONTHS[p.jm - 1]} ${faDigits(p.jy)}`
}

// ===== اعداد فارسی =====
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
export function faDigits(v: string | number): string {
  return String(v).replace(/[0-9]/g, (d) => FA_DIGITS[+d])
}
export function faMoney(n: number): string {
  const rounded = Math.round(n || 0)
  const s = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return (rounded < 0 ? '−' : '') + faDigits(s)
}
/** خلاصه مبالغ بزرگ: ۱٫۲ میلیون */
export function faMoneyShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `${faDigits((n / 1e9).toFixed(1))} میلیارد`
  if (a >= 1e6) return `${faDigits((n / 1e6).toFixed(1))} میلیون`
  if (a >= 1e3) return `${faDigits(Math.round(n / 1e3))} هزار`
  return faMoney(n)
}

// ===== دوره‌های حسابداری =====
export interface Period {
  key: string // 1405-05
  jy: number
  jm: number
  start: string // inclusive
  end: string   // inclusive
  label: string // مرداد ۱۴۰۵
  rangeLabel: string // ۵ مرداد – ۴ شهریور ۱۴۰۵
}

/** دوره‌ی متعلق به یک تاریخ با توجه به روز شروع دوره */
export function periodOf(dateStr: string, startDay: number): Period {
  const p = parseJalali(dateStr) ?? { jy: 1404, jm: 1, jd: 1 }
  const sd = Math.min(Math.max(startDay, 1), 29)
  let jy = p.jy, jm = p.jm
  if (p.jd < sd) {
    jm -= 1
    if (jm === 0) { jm = 12; jy -= 1 }
  }
  return buildPeriod(jy, jm, sd)
}

function buildPeriod(jy: number, jm: number, sd: number): Period {
  const next = (jy: number, jm: number) => { const m = jm + 1; return m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m } }
  const prev = (jy: number, jm: number) => { const m = jm - 1; return m < 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: m } }
  const n = next(jy, jm)
  const endLen = jMonthLength(n.jy, n.jm)
  const endDay = Math.min(sd, endLen) - 1
  const end = endDay === 0
    ? `${n.jy}/${p2(n.jm)}/${p2(jMonthLength(n.jy, n.jm))}`
    : `${n.jy}/${p2(n.jm)}/${p2(endDay)}`
  const start = `${jy}/${p2(jm)}/${p2(Math.min(sd, jMonthLength(jy, jm)))}`
  const pm = prev(jy, jm)
  return {
    key: `${jy}-${p2(jm)}`,
    jy, jm,
    start, end,
    label: `${J_MONTHS[jm - 1]} ${faDigits(jy)}`,
    rangeLabel: `${faDigits(Math.min(sd, jMonthLength(jy, jm)))} ${J_MONTHS[jm - 1]} – ${faDigits(endDay === 0 ? jMonthLength(n.jy, n.jm) : endDay)} ${J_MONTHS[n.jm - 1]} ${faDigits(n.jy)}`,
  }
}

export function shiftPeriod(period: Period, delta: number, startDay: number): Period {
  const sd = Math.min(Math.max(startDay, 1), 29)
  let jy = period.jy, jm = period.jm + delta
  while (jm > 12) { jm -= 12; jy += 1 }
  while (jm < 1) { jm += 12; jy -= 1 }
  return buildPeriod(jy, jm, sd)
}

/** n دوره اخیر (قدیمی‌ترین اول) شامل دوره تاریخ داده‌شده */
export function lastPeriods(dateStr: string, n: number, startDay: number): Period[] {
  const cur = periodOf(dateStr, startDay)
  const out: Period[] = []
  for (let i = n - 1; i >= 0; i--) out.push(shiftPeriod(cur, -i, startDay))
  return out
}

export const inRange = (date: string, start: string, end: string) => date >= start && date <= end
