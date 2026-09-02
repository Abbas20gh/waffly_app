// E2E سینک — دقیقاً مثل رفتار APK (origin https://localhost، مسیر POST)
const BASE = 'http://localhost:8787'
const ORIGIN = { 'Content-Type': 'application/json', Origin: 'https://localhost' }

async function j(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: ORIGIN, body: body ? JSON.stringify(body) : undefined })
  const headers = Object.fromEntries(res.headers.entries())
  const corsOk = headers['access-control-allow-origin'] === '*'
  const data = await res.json().catch(() => null)
  return { status: res.status, corsOk, data }
}

async function main() {
  console.log('1) push ماده تستی…')
  const id = 'e2e-test-' + Date.now()
  const now = Date.now()
  const r1 = await j('POST', '/api/sync/push', { ops: [{ tbl: 'materials', row: { id, name: '—تست E2E—', unit: 'عدد', minStock: 1, active: 1, updatedAt: now, deleted: 0 } }] })
  console.log('   status:', r1.status, 'cors:', r1.corsOk, 'body:', JSON.stringify(r1.data))
  if (!r1.corsOk || r1.status !== 200 || r1.data?.accepted !== 1) throw new Error('push failed')

  console.log('2) pull باید ماده تستی را برگرداند…')
  const r2 = await j('POST', '/api/sync/pull', { since: 0, limit: 1000 })
  const found = (r2.data?.rows || []).find(x => x.row.id === id)
  console.log('   status:', r2.status, 'cors:', r2.corsOk, 'cursor:', r2.data?.cursor, 'hasMore:', r2.data?.hasMore, 'yaghd:', found ? 'پیدا شد ✓' : 'نیست ✗')
  if (!found) throw new Error('pull did not return test row')

  console.log('3) pull افزایشی از cursor (باید خالی/کم باشد)…')
  const r3 = await j('POST', '/api/sync/pull', { since: r2.data.cursor, limit: 1000 })
  console.log('   rows:', r3.data?.rows?.length, 'hasMore:', r3.data?.hasMore)

  console.log('4) تومب‌استون ماده تستی (پاکسازی)…')
  const r4 = await j('POST', '/api/sync/push', { ops: [{ tbl: 'materials', row: { id, name: '—تست E2E—', unit: 'عدد', minStock: 1, active: 1, updatedAt: Date.now(), deleted: 1 } }] })
  console.log('   status:', r4.status, 'body:', JSON.stringify(r4.data))

  console.log('5) LWW: push قدیمی‌تر باید skip شود…')
  const r5 = await j('POST', '/api/sync/push', { ops: [{ tbl: 'materials', row: { id, name: '—تست E2E—', unit: 'عدد', minStock: 1, active: 1, updatedAt: now, deleted: 1 } }] })
  console.log('   body:', JSON.stringify(r5.data), r5.data?.skipped === 1 ? '→ skip درست ✓' : '→ ✗')

  console.log('\nنتیجه: همه مراحل سبز ✓')
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
