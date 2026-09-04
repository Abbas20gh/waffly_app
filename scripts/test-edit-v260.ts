// تست واحد ویرایش تولید — برنامه‌ریز دلتای جعبه‌ها (v2.6)
// اجرا: npx tsx scripts/test-edit-v260.ts
import { planProductionBoxes } from '../src/lib/boxcode'

let pass = 0, fail = 0
function ok(cond: boolean, name: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const mk = (codes: string[]) => codes.map((code, i) => ({ id: `b${i}`, code }))

console.log('— افزودن جعبه —')
{
  const live = mk(['07261', '07262', '07263'])
  const all = [...live.map(b => b.code), '06111'] // یک کد از روز دیگر
  const { addCodes, removeIds } = planProductionBoxes(live, 5, '1405/07/26', all)
  ok(addCodes.length === 2, '۳ → ۵ جعبه = ۲ کد جدید')
  ok(addCodes[0] === '07264' && addCodes[1] === '07265', 'ادامهٔ سری همان روز: 07264، 07265')
  ok(removeIds.length === 0, 'هیچ جعبه‌ای حذف نمی‌شود')
}

console.log('— کم‌کردن جعبه (حذف از آخر) —')
{
  const live = mk(['07261', '07262', '07263', '07264', '07265'])
  const { addCodes, removeIds } = planProductionBoxes(live, 3, '1405/07/26', live.map(b => b.code))
  ok(addCodes.length === 0, 'کد جدیدی ساخته نمی‌شود')
  ok(removeIds.length === 2, '۵ → ۳ = حذف ۲ جعبه')
  ok(removeIds.includes('b3') && removeIds.includes('b4') && !removeIds.includes('b0'), 'حذف از آخر (بزرگ‌ترین کد): b3 و b4')
}

console.log('— بدون تغییر —')
{
  const live = mk(['07261', '07262'])
  const { addCodes, removeIds } = planProductionBoxes(live, 2, '1405/07/26', live.map(b => b.code))
  ok(addCodes.length === 0 && removeIds.length === 0, 'تعداد یکسان → بدون تغییر')
}

console.log('— تولید خالی → ساخت از ۱ —')
{
  const { addCodes, removeIds } = planProductionBoxes([], 3, '1405/07/27', ['07265'])
  ok(addCodes.join(',') === '07271,07272,07273', 'روز جدید از سری ۱ شروع می‌شود')
  ok(removeIds.length === 0, 'چیزی حذف نمی‌شود')
}

console.log('— تغییر تاریخ تولید → کدهای جدید از تاریخ جدید + عدم بازیافت کد حذف‌شده —')
{
  // جعبه‌های روز ۰۷۲۶ موجودند؛ جعبه ۰۷۲۶۳ حذف شده ولی در allCodes هست → بازیافت نمی‌شود
  const live = mk(['07261', '07262'])
  const all = ['07261', '07262', '07263', '07264'] // ۶۳ و ۶۴ قبلاً حذف/موجود بوده‌اند
  const { addCodes } = planProductionBoxes(live, 4, '1405/07/26', all)
  ok(addCodes.join(',') === '07265,07266', 'از ۷۲۶۵ ادامه می‌یابد (کدهای حذف‌شده بازیافت نمی‌شوند)')
}

console.log('— تعداد منفی/نامعتبر —')
{
  const live = mk(['07261'])
  const r = planProductionBoxes(live, -3, '1405/07/26', live.map(b => b.code))
  ok(r.removeIds.length === 1 && r.addCodes.length === 0, 'تعداد منفی → همه حذف می‌شوند (حداقل صفر)')
  const r2 = planProductionBoxes(live, NaN, '1405/07/26', live.map(b => b.code))
  ok(r2.removeIds.length === 1 && r2.addCodes.length === 0, 'NaN → مثل صفر')
}

console.log(`\nنتیجه: ${pass} پاس / ${fail} خطا`)
if (fail > 0) process.exit(1)
console.log('همهٔ تست‌های planProductionBoxes v2.6 پاس شد ✓')
