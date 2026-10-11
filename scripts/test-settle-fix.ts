// تست سریع منطق تسویه (باگ #۱) — effectiveSettled برای فروش و خرید
import { effectiveSettled, saleDue } from '../src/lib/calc'

interface Case { name: string; got: string; want: string }

const cases: Case[] = []
const check = (name: string, got: unknown, want: unknown) =>
  cases.push({ name, got: String(got), want: String(want) })

// ---- فروش (totalAmount دارد) ----
const sale = (totalAmount: number, paidAmount: number) => ({ totalAmount, paidAmount })
check('sale PAID', effectiveSettled(sale(200_000, 200_000)), 'PAID')
check('sale PARTIAL', effectiveSettled(sale(200_000, 50_000)), 'PARTIAL')
check('sale UNPAID', effectiveSettled(sale(200_000, 0)), 'UNPAID')
check('sale due', saleDue(sale(200_000, 50_000)), 150_000)

// ---- خرید (cost دارد — باگ: قبلاً همیشه PAID برمی‌گشت) ----
const pur = (cost: number, paidAmount: number) => ({ cost, paidAmount })
check('purchase UNPAID (باگ کاربر)', effectiveSettled(pur(1_500_000, 0)), 'UNPAID')
check('purchase PARTIAL', effectiveSettled(pur(1_500_000, 400_000)), 'PARTIAL')
check('purchase PAID', effectiveSettled(pur(1_500_000, 1_500_000)), 'PAID')
check('purchase due', saleDue(pur(1_500_000, 400_000)), 1_100_000)
check('purchase paid>cost cap display', saleDue(pur(1_000, 1_500)), 0)

let fail = 0
for (const c of cases) {
  const ok = c.got === c.want
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${c.name}: got=${c.got} want=${c.want}`)
}
console.log(fail === 0 ? 'ALL PASS' : `FAILURES: ${fail}`)
process.exit(fail === 0 ? 0 : 1)
