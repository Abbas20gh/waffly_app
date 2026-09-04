// تست واحد کد کوتاه جعبه — v2.5.1
// اجرا: npx tsx scripts/test-boxcode-v251.ts
import { boxCode, nextBoxSerial, BOX_CODE_LEN } from '../src/lib/boxcode'

let pass = 0, fail = 0
function ok(cond: boolean, name: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

console.log('— boxCode (فرمت) —')
ok(boxCode(1) === '00001', 'سری ۱ → 00001 (۵ رقم با صفر)')
ok(boxCode(42) === '00042', 'سری ۴۲ → 00042')
ok(boxCode(99999) === '99999', 'سری 99999 → 99999')
ok(boxCode(100000) === '100000', 'بعد از ۹۹۹۹۹ → ۶ رقم (هنوز یکتا)')
ok(boxCode(0) === '00001', 'سری ۰ → حداقل 1')
ok(boxCode(-5) === '00001', 'سری منفی → حداقل 1')
ok(boxCode(7.6) === '00008', 'اعشار گرد می‌شود')
ok(boxCode(1).length === BOX_CODE_LEN, 'طول پیش‌فرض ۵')

console.log('— nextBoxSerial (ادامهٔ ترتیبی) —')
ok(nextBoxSerial([]) === 1, 'خالی → 1 (اولین جعبه)')
ok(nextBoxSerial(['00001', '00002', '00003']) === 4, 'ادامهٔ کدهای موجود')
ok(nextBoxSerial(['00042']) === 43, '۴۲ → ۴۳')

console.log('— سازگاری با کدهای قدیمی ۱۰ رقمی —')
// کد قدیمی مثل 0605124001 نباید کد جدید را بلند کند
ok(nextBoxSerial(['0605124001', '0612054002']) === 1, 'فقط کد قدیمی → از 1 شروع می‌شود (نادیده گرفته می‌شود)')
ok(nextBoxSerial(['0605124001', '00007']) === 8, 'ترکیب قدیمی+کوتاه → ادامهٔ کوتاه')
ok(nextBoxSerial(['abc', '', '  ']) === 1, 'مقادیر نامعتبر نادیده گرفته می‌شوند')

console.log('— یکتایی در سناریوی واقعی —')
// شبیه‌سازی: ۳ بار تولید پشت هم (۳۰، ۵، ۲ جعبه) — هیچ تداخلی نباید باشد
const codes: string[] = []
let all = ['0605124001'] // یک کد قدیمی موجود
for (const n of [30, 5, 2]) {
  const start = nextBoxSerial(all)
  const fresh: string[] = []
  for (let i = 0; i < n; i++) fresh.push(boxCode(start + i))
  all = [...all, ...fresh]
  codes.push(...fresh)
}
ok(new Set(codes).size === codes.length, '۳۷ کد تولیدشده همگی یکتا')
ok(codes[0] === '00001' && codes[30] === '00031' && codes[35] === '00036', 'توالی صحیح بین دفعات تولید')
ok(codes.every(c => c.length === 5), 'همهٔ کدهای جدید ۵ رقمی‌اند')
ok(nextBoxSerial(all) === 38, 'سری بعدی = ۳۸')

console.log('— idempotency (اجرای دوباره) —')
const s1 = nextBoxSerial(all)
const again = boxCode(s1)
all.push(again)
ok(nextBoxSerial(all) === s1 + 1, 'بعد از افزودن کد جدید، سری بعدی +۱')

console.log(`\nنتیجه: ${pass} پاس / ${fail} خطا`)
if (fail > 0) process.exit(1)
console.log('همهٔ تست‌های boxcode v2.5.1 پاس شد ✓')
