// تست واحد کد معنادار جعبه (ماه + روز + شمارهٔ همان روز) — v2.5.2
// اجرا: npx tsx scripts/test-boxcode-v252.ts
import { boxCode, nextBoxSerial, boxDayPrefix } from '../src/lib/boxcode'

let pass = 0, fail = 0
function ok(cond: boolean, name: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const D1 = '1404/07/26' // مهر ۲۶
const D2 = '1404/01/05' // فروردین ۵
const D3 = '1404/11/30' // بهمن ۳۰

console.log('— فرمت کد (ماه + روز + شماره) —')
ok(boxDayPrefix(D1) === '0726', 'پیشوند مهر ۲۶ → 0726')
ok(boxCode(D1, 3) === '07263', 'مهر ۲۶ جعبهٔ ۳ → 07263 (۵ رقم معنادار)')
ok(boxCode(D2, 1) === '01051', 'فروردین ۵ جعبهٔ ۱ → 01051 (صفرهای ابتدایی حفظ می‌شود)')
ok(boxCode(D3, 9) === '11309', 'بهمن ۳۰ جعبهٔ ۹ → 11309')
ok(boxCode(D1, 10) === '072610', 'جعبهٔ ۱۰ همان روز → ۶ رقم (فوق‌جریان خودکار)')
ok(boxCode(D1, 100) === '0726100', 'جعبهٔ ۱۰۰ → ۷ رقم — همچنان یکتا')
ok(boxCode(D1, 0) === '07261', 'شمارهٔ ۰ → حداقل ۱')
ok(boxCode(D1, 4.7) === '07265', 'اعشار گرد می‌شود')

console.log('— nextBoxSerial (ادامهٔ شمارهٔ همان روز) —')
ok(nextBoxSerial([], D1) === 1, 'روز خالی → جعبهٔ ۱')
ok(nextBoxSerial(['07263', '07261'], D1) === 4, 'بزرگ‌ترین شمارهٔ همان روز +۱')
ok(nextBoxSerial(['01051', '01053'], D2) === 4, 'برای روز دیگر مستقل است')
ok(nextBoxSerial(['07261', '01051'], D1) === 2, 'کد روز دیگر روی این روز اثر ندارد')

console.log('— نادیده‌گرفتن کدهای قدیمی/نامعتبر —')
ok(nextBoxSerial(['0605124001', '2612054002'], D1) === 1, 'کد قدیمی ۱۰ رقمی نادیده → از ۱')
ok(nextBoxSerial(['0605124001', '07262'], D1) === 3, 'ترکیب قدیمی + کوتاه همان روز')
ok(nextBoxSerial(['abc', '', '0726x'], D1) === 1, 'مقادیر نامعتبر نادیده')

console.log('— یکتایی در سناریوی واقعی (دو نوبت تولید در یک روز + روز بعد) —')
const all: string[] = []
// صبح: ۶ جعبه از یک نوع
let start = nextBoxSerial(all, D1)
const morning: string[] = []
for (let i = 0; i < 6; i++) morning.push(boxCode(D1, start + i))
all.push(...morning)
// عصر: ۴ جعبه از نوع دیگر — همان روز، شماره‌ها ادامه پیدا می‌کنند (باگ تکرار نسخهٔ قدیمی رفع)
start = nextBoxSerial(all, D1)
const evening: string[] = []
for (let i = 0; i < 4; i++) evening.push(boxCode(D1, start + i))
all.push(...evening)
ok(everyUnique([...morning, ...evening]), '۱۰ کد همان روز همگی یکتا (حتی بین دو نوبت و دو نوع)')
ok(evening[0] === '07267' && evening[3] === '072610', 'نوبت عصر ادامهٔ نوبت صبح: 07267…072610')
ok(everyUnique(all.map(c => c === '072610' ? c : c)), 'بعد از جعبهٔ ۹، کد ۶ رقمی و همچنان یکتا')
// روز بعد: شماره‌ها از ۱ شروع می‌شوند
start = nextBoxSerial(all, D2)
ok(start === 1 && boxCode(D2, start) === '01051', 'روز بعد دوباره از جعبهٔ ۱')

console.log('— اجرای دوباره (idempotent بودن ترتیب) —')
all.push(boxCode(D1, nextBoxSerial(all, D1)))
ok(nextBoxSerial(all, D1) === 12, 'بعد از افزودن جعبهٔ جدید، شمارهٔ بعدی +۱')

function everyUnique(arr: string[]): boolean { return new Set(arr).size === arr.length }

console.log(`\nنتیجه: ${pass} پاس / ${fail} خطا`)
if (fail > 0) process.exit(1)
console.log('همهٔ تست‌های boxcode v2.5.2 پاس شد ✓')
