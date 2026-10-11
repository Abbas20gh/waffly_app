'use client'

// ===== v3.1 — استور اعلان‌های وافلی (سمت کلاینت) =====
// اعلان‌ها روی سرور ساخته می‌شوند (functions/api/_notify.ts) و همه دستگاه‌ها
// (وب و APK) با endpoint /api/sync/notifications می‌خوانند.
// وضعیت «خوانده‌شده» per-device در localStorage — اعلان سیستم اندروید با
// @capacitor/local-notifications برای آیتم‌های تازه نمایش داده می‌شود.
import { useSyncExternalStore } from 'react'
import { notifCategoryOf, notifCategoryDef } from './notif-categories'

// همان الگوی sync-engine — در پلتفرم نیتیو (APK) همیشه سرور اصلی
// (pages.dev در ایران فیلتر است)؛ در وب: همان دامنهٔ فعلی
const API_BASE = (() => {
  try {
    const cap = (typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor) || undefined
    if (cap?.isNativePlatform?.()) return 'https://app.artanon.ir'
  } catch { /* وب/SSR — بی‌اثر */ }
  return process.env.NEXT_PUBLIC_API_BASE || ''
})()

export interface WNotif {
  id: string
  ts: number
  tbl: string
  rid: string
  op: 'CREATE' | 'UPDATE' | 'DELETE'
  title: string
  body: string
  actor?: string | null
}

const READ_KEY = 'waffly-notif-read'
const CACHE_KEY = 'waffly-notif-cache'
const SHOWN_KEY = 'waffly-notif-lastshown'

function loadCache(): WNotif[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as WNotif[]
    return Array.isArray(arr) ? arr.slice(0, 100) : []
  } catch { return [] }
}

function saveCache(list: WNotif[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, 100))) } catch { /* ignore */ }
}

function getReadTs(): number {
  try { return Number(localStorage.getItem(READ_KEY) || 0) } catch { return 0 }
}

interface NotifSnap { items: WNotif[]; unread: number }

let items: WNotif[] = typeof window === 'undefined' ? [] : loadCache()
let snap: NotifSnap = { items, unread: 0 }
let loading = false

const listeners = new Set<() => void>()

function recompute() {
  const r = getReadTs()
  const unread = items.filter(n => n.ts > r).length
  snap = { items, unread }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
function getSnap(): NotifSnap { return snap }

export function useNotifs(): NotifSnap {
  return useSyncExternalStore(subscribe, getSnap, getSnap)
}

/** آخرین ts خوانده‌شده را به جدیدترین اعلان می‌برد (همه خوانده شد) */
export function markAllRead() {
  const max = items.reduce((m, n) => Math.max(m, n.ts), Date.now())
  try { localStorage.setItem(READ_KEY, String(max)) } catch { /* ignore */ }
  recompute()
}

// ===== نوتیف سیستم اندروید (APK) =====
function hashId(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 2000000000
}

async function maybeLocalNotify(list: WNotif[]) {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!cap?.isNativePlatform?.()) return // فقط اپ نصبی اندروید
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    let granted = perm.display === 'granted'
    if (!granted) {
      const req = await LocalNotifications.requestPermissions()
      granted = req.display === 'granted'
    }
    if (!granted) return
    const last = Number(localStorage.getItem(SHOWN_KEY) || 0)
    const fresh = list.filter(n => n.ts > last).slice(0, 5)
    const maxTs = list.reduce((m, n) => Math.max(m, n.ts), last)
    try { localStorage.setItem(SHOWN_KEY, String(maxTs)) } catch { /* ignore */ }
    if (fresh.length === 0) return
    await LocalNotifications.schedule({
      notifications: fresh.map((n, i) => ({
        id: hashId(n.id),
        // v3.1.2 — ایموجی دسته در عنوان: 💰 فروش / 🛒 خرید / 🏭 تولید / ...
        title: `${notifCategoryDef(notifCategoryOf(n.tbl)).emoji} Waffly — ${n.title}`,
        body: n.body + (n.actor ? ` (${n.actor})` : ''),
        schedule: { at: new Date(Date.now() + 300 + i * 500) },
      })),
    })
  } catch { /* پلاگین/وب — بی‌اثر */ }
}

/** دریافت اعلان‌ها از سرور — بعد از هر سینک، هر ۶۰ ثانیه و موقع باز کردن زنگ */
export async function refreshNotifications(): Promise<void> {
  if (loading) return
  if (typeof window === 'undefined') return
  if (!navigator.onLine) return
  loading = true
  try {
    const res = await fetch(`${API_BASE}/api/sync/notifications?limit=100`)
    if (!res.ok) return
    const data = await res.json() as { notifications?: WNotif[] }
    if (Array.isArray(data.notifications)) {
      items = data.notifications
      saveCache(items)
      recompute()
      void maybeLocalNotify(items)
    }
  } catch { /* آفلاین/خطا — کش محلی می‌ماند */ }
  finally { loading = false }
}
