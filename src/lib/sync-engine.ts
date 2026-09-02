'use client'

// موتور سینک — push صف outbox، pull افزایشی، bootstrap، real-time با socket.io
import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  dexie, getOutboxBatch, clearOutboxUpTo, getCursor, setCursor,
  isBootstrapped, markBootstrapped, putRemoteRows, outboxCount, TABLES, type SyncTbl,
} from './localdb'

interface SyncState {
  online: boolean
  syncing: boolean
  pendingCount: number
  lastSyncAt: number
  error: string | null
}

let state: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pendingCount: 0,
  lastSyncAt: 0,
  error: null,
}

const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function getState() { return state }

export function useSyncStore(): SyncState {
  return useSyncExternalStore(subscribe, getState, getState)
}

let running = false
let syncQueued = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let cycleTimer: ReturnType<typeof setInterval> | null = null
let socket: Socket | null = null

// بسته‌بندی اندروید (Capacitor): آدرس سرور سینک در زمان build تزریق می‌شود؛ روی وب نسبی می‌ماند
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

async function pushOutbox(): Promise<void> {
  for (;;) {
    const ops = await getOutboxBatch(400)
    if (ops.length === 0) return
    const res = await fetch(`${API_BASE}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops: ops.map(o => ({ tbl: o.tbl, row: o.row })) }),
    })
    if (!res.ok) throw new Error(`push ${res.status}`)
    const data = await res.json() as { accepted: number }
    if (!data || typeof data.accepted !== 'number') throw new Error('push bad response')
    // حذف موارد ارسال‌شده (حتی skip شده‌ها — سرور جدیدتر را دارد)
    const maxSeq = ops[ops.length - 1].seq ?? 0
    await clearOutboxUpTo(maxSeq)
    if (data.accepted === 0 && ops.length < 400) return
  }
}

async function pullIncremental(): Promise<void> {
  let guard = 0
  for (;;) {
    if (guard++ > 200) break
    const since = getCursor()
    // POST — در APK از مسیر نیتیو CapacitorHttp می‌رود (بدون CORS/پروکسی WebView)
    const res = await fetch(`${API_BASE}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since, limit: 300 }),
    })
    if (!res.ok) throw new Error(`pull ${res.status}`)
    const data = await res.json() as { rows: { tbl: SyncTbl; row: Record<string, unknown> }[]; cursor: number; hasMore: boolean }
    if (data.rows?.length) await putRemoteRows(data.rows as never)
    setCursor(data.cursor ?? since)
    if (!data.hasMore) break
  }
}

async function bootstrap(force = false): Promise<void> {
  if (!force && isBootstrapped()) return
  if (!force) {
    // اگر دستگاه از قبل داده محلی دارد، bootstrap نکن (داده کاربر از بین نرود)
    const anyData = await dexie.sales.count() + await dexie.productions.count() + await dexie.customers.count()
    if (anyData > 0) { markBootstrapped(); return }
  }
  const res = await fetch(`${API_BASE}/api/sync/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(`full ${res.status}`)
  const data = await res.json() as { rows: { tbl: SyncTbl; row: Record<string, unknown> }[]; cursor: number }
  await putRemoteRows(data.rows as never)
  setCursor(data.cursor ?? 0)
  markBootstrapped()
}

export async function syncNow(): Promise<void> {
  if (typeof window === 'undefined') return
  if (running) { syncQueued = true; return }
  if (!navigator.onLine) return
  running = true
  setState({ syncing: true, error: null })
  try {
    await bootstrap()
    await pushOutbox()
    await pullIncremental()
    setState({ lastSyncAt: Date.now(), pendingCount: await outboxCount() })
  } catch (e) {
    setState({ error: e instanceof Error ? e.message : 'sync error' })
  } finally {
    running = false
    setState({ syncing: false })
    if (syncQueued) { syncQueued = false; void syncNow() }
  }
}

/** سینک با تاخیر (بعد از نوشتن محلی) */
export function scheduleSync() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void syncNow(), 1500)
}

export function forceSyncNow() { void syncNow() }

/** تعمیر: همه رکوردهای محلی دوباره به صف می‌روند */
export async function repairSync() {
  const { repairSync: repair } = await import('./localdb')
  const n = await repair()
  scheduleSync()
  return n
}

/**
 * دریافت کامل از سرور (تعمیر قطعی همگرایی):
 * ۱) همه تغییرات محلی push می‌شوند (هیچ چیز از دست نمی‌رود)
 * ۲) اسنپ‌شات کامل سرور با LWW روی داده‌های محلی می‌نشیند
 * ۳) کِرسر به انتهای سرور ست می‌شود
 * رکوردهای محلیِ جدیدتر از سرور حفظ می‌شوند (LWW) — بقیه با سرور هم‌سطح می‌شوند.
 */
export async function forceFullResync(): Promise<void> {
  if (typeof window === 'undefined') return
  if (running) { syncQueued = true; return }
  if (!navigator.onLine) throw new Error('offline')
  running = true
  setState({ syncing: true, error: null })
  try {
    await pushOutbox()
    await bootstrap(true)
    await pullIncremental()
    setState({ lastSyncAt: Date.now(), pendingCount: await outboxCount() })
  } finally {
    running = false
    setState({ syncing: false })
    if (syncQueued) { syncQueued = false; void syncNow() }
  }
}

export function startSyncEngine(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => { setState({ online: true }); void syncNow() }
  const onOffline = () => setState({ online: false })
  const onDataChanged = () => scheduleSync()
  const onVisible = () => { if (document.visibilityState === 'visible') void syncNow() }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('waffly-data-changed', onDataChanged)
  document.addEventListener('visibilitychange', onVisible)

  cycleTimer = setInterval(() => void syncNow(), 20000)

  // فوکوس پنجره (PWA دسکتاپ) — برگشت به تب اپ سینک بگیرد
  const onFocus = () => { void syncNow() }
  window.addEventListener('focus', onFocus)

  // اتصال real-time فقط با env صریح (سندباکس) — روی production/APK فقط polling
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
  if (socketUrl) {
    try {
      socket = io(socketUrl, {
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling'],
      })
      socket.on('connect', () => { void syncNow() })
      socket.on('data-changed', () => { void syncNow() })
    } catch { /* socket اختیاری است */ }
  }

  // اپ اندروید (Capacitor): هر برگشت از پس‌زمینه فوراً سینک بگیر.
  // WebView اندروید JS پس‌زمینه را throttle/pause می‌کند و visibilitychange همیشه fire نمی‌شود.
  void (async () => {
    try {
      const isNative = typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
      if (!isNative) return
      const { App } = await import('@capacitor/app')
      await App.addListener('appStateChange', (s: { isActive: boolean }) => {
        if (s.isActive) {
          setState({ online: navigator.onLine })
          void syncNow()
        }
      })
      await App.addListener('resume', () => { void syncNow() })
    } catch { /* پلاگین در وب نصب‌مانده نیست — بی‌اثر */ }
  })()

  // شمارش صف اولیه + سینک اول
  void outboxCount().then(n => setState({ pendingCount: n }))
  void syncNow()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('waffly-data-changed', onDataChanged)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
    if (cycleTimer) clearInterval(cycleTimer)
    if (debounceTimer) clearTimeout(debounceTimer)
    socket?.disconnect()
    socket = null
  }
}
