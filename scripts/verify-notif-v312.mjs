// تست زندهٔ v3.1.2 — نوتیف دسته‌بندی‌شده روی سرور پروداکشن
// یک فروش تستی می‌سازد (اعلان CREATE) → می‌خواند → حذف می‌کند (اعلان DELETE)
// تلگرام صاحب کسب‌وکار هم ۲ پیام با قالب جدید «💰 فروش» دریافت می‌کند.
const BASE = process.env.TEST_BASE || 'https://app.artanon.ir'

let pass = 0, fail = 0
const ok = (c, name, extra = '') => {
  if (c) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

const now = Date.now()
const testId = `notif-test-312-${now}`
const saleRow = {
  id: testId,
  updatedAt: now,
  deleted: 0,
  date: '1404/07/19',
  customerId: '',
  items: '[]',
  totalAmount: 312000,
  paidAmount: 312000,
  settledStatus: 'PAID',
  paymentMethod: 'CASH',
  createdBy: 'تست v3.1.2',
}

async function push(row) {
  const res = await fetch(`${BASE}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops: [{ tbl: 'sales', row }] }),
  })
  return res
}

async function readNotifs() {
  const res = await fetch(`${BASE}/api/sync/notifications?limit=10`)
  if (!res.ok) return []
  const data = await res.json()
  return data.notifications || []
}

console.log(`— تست نوتیف دسته‌بندی‌شده روی ${BASE} —`)

// ۰) سلامت endpoint
const health = await fetch(`${BASE}/api/sync/notifications?limit=1`)
ok(health.ok, `endpoint اعلان‌ها → HTTP ${health.status}`)

// ۱) push فروش تستی → اعلان CREATE دستهٔ فروش
const p1 = await push(saleRow)
const d1 = await p1.json().catch(() => ({}))
ok(p1.ok && d1.notifCount >= 1, `push فروش تستی → notifCount=${d1.notifCount}`)

// ۲) خواندن اعلان و بررسی هویت دسته
const list1 = await readNotifs()
const created = list1.find(n => n.rid === testId)
ok(!!created, 'اعلان CREATE در لیست سرور پیدا شد')
if (created) {
  ok(created.tbl === 'sales' && created.op === 'CREATE', `نوع: ${created.tbl}/${created.op}`)
  ok(created.title === 'ثبت فروش', `عنوان: «${created.title}»`)
  ok(created.body.includes('۳۱۲٬۰۰۰'), `بدنه شامل مبلغ فارسی: «${created.body}»`)
}

// ۳) حذف → اعلان DELETE
const p2 = await push({ ...saleRow, deleted: 1, updatedAt: now + 1 })
const d2 = await p2.json().catch(() => ({}))
ok(p2.ok && d2.notifCount >= 1, `push حذف → notifCount=${d2.notifCount}`)
const list2 = await readNotifs()
const deleted = list2.find(n => n.rid === testId && n.op === 'DELETE')
ok(!!deleted, 'اعلان DELETE ثبت شد')

console.log(`\nنتیجه: ${pass} پاس، ${fail} شکست`)
if (fail > 0) process.exit(1)
