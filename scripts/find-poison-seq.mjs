#!/usr/bin/env node
// یافتن ردیف سمّی SyncLog که pull را 500 می‌کند — باینری‌سرچ روی since
const BASE = process.env.TEST_BASE || 'https://app.artanon.ir'
const LIMIT = Number(process.env.PULL_LIMIT || 300)

async function pullFails(since, limit = LIMIT) {
  try {
    const r = await fetch(`${BASE}/api/sync/pull?since=${since}&limit=${limit}`, { signal: AbortSignal.timeout(25000) })
    if (r.status === 200) { await r.json().catch(() => ({})); return false }
    return true
  } catch { return true } // timeout/network هم به‌عنوان شکست حساب می‌شود — تکرار می‌کنیم بیرون
}

async function pullRows(since, limit = LIMIT) {
  const r = await fetch(`${BASE}/api/sync/pull?since=${since}&limit=${limit}`, { signal: AbortSignal.timeout(25000) })
  const j = await r.json().catch(() => null)
  return j
}

async function failsStable(since, limit = LIMIT) {
  // هر شرط را ۲ بار چک می‌کنیم تا خطای شبکه لحظه‌ای قاطی نشود
  const a = await pullFails(since, limit)
  const b = a ? await pullFails(since, limit) : false
  return a && b
}

async function main() {
  // ۱) مرز بالایی: اولین S که موفق است (پیمایش پله‌ای ۳۰۰)
  let upper = null
  for (let S = 0; S <= 3_000_000; S += LIMIT) {
    const f = await failsStable(S)
    if (!f) { upper = S; console.log(`first OK at since=${S}`); break }
    console.log(`fail at since=${S}`)
  }
  if (upper === null) { console.log('تا ۳ میلیون هم شکست — حد بالا بیشتر لازم است'); process.exit(1) }

  // ۲) در پنجره (upper-LIMIT, upper] بزرگ‌ترین S شکست‌خورده = B → سمّ = B+1
  let lo = upper - LIMIT + 1, hi = upper // lo..hi-1 نامعلوم، hi قطعاً OK
  // f(lo) ممکن است true یا false باشد (بسته به محل سمّی)؛ بزرگ‌ترین S با f(S)=true را پیدا کن
  let B = null
  let a = upper - LIMIT, b = upper - 1
  if (await failsStable(a)) { B = a }
  else {
    while (b - a > 1) {
      const mid = Math.floor((a + b) / 2)
      if (await failsStable(mid)) a = mid; else b = mid
    }
    B = a
  }
  if (B === null) { console.log('در پنجره شکستی نیست؟ upper را کم کن'); process.exit(1) }
  const P = B + 1
  console.log(`poison seq = ${P} (pull since=${B} fails, since=${B + 1} OK)`)

  // ۳) تأیید نهایی با limit=1
  console.log(`since=${P - 1} limit=1 → ${await failsStable(P - 1, 1) ? 'FAIL ✓' : 'OK ✗'}`)

  // ۴) همسایه‌ها برای تاریخ‌گذاری
  const prev = await pullRows(P - 2, 1).catch(() => null)
  if (prev?.rows?.[0]) console.log('row P-1:', JSON.stringify(prev.rows[0].row).slice(0, 300))
  const next = await pullRows(P, 1).catch(() => null)
  if (next?.rows?.[0]) console.log('row P+1:', JSON.stringify(next.rows[0].row).slice(0, 300))
}
main()
