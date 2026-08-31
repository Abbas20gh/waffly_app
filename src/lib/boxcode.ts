// کد یکتای جعبه — ۱۰ رقم: TT DD MM NN SS
// TT: کد نوع نان (۲ رقم) | DD: روز شمسی | MM: ماه شمسی | NN: تعداد نان در هر جعبه | SS: شماره سری جعبه
import { todayJalali, parseJalali } from './jalali'

export function boxCode(breadTypeCode: string, date: string, perBox: number, serial: number): string {
  const p = parseJalali(date) ?? parseJalali(todayJalali())!
  const tt = String(Math.abs(parseInt(breadTypeCode || '0', 10)) % 100).padStart(2, '0')
  const dd = p2(p.jd)
  const mm = p2(p.jm)
  const nn = String(Math.max(0, Math.min(99, Math.round(perBox || 0)))).padStart(2, '0')
  const ss = String(serial).padStart(2, '0') // بیش از ۹۹، طول کد بزرگ‌تر می‌شود تا یکتا بماند
  return `${tt}${dd}${mm}${nn}${ss}`
}

export interface ParsedBoxCode {
  typeCode: string; day: number; month: number; perBox: number; serial: number; valid: boolean
}

export function parseBoxCode(code: string): ParsedBoxCode | null {
  const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2,})$/.exec(code.trim())
  if (!m) return null
  return {
    typeCode: m[1], day: +m[2], month: +m[3], perBox: +m[4], serial: +m[5], valid: true,
  }
}

const p2 = (n: number) => String(n).padStart(2, '0')
