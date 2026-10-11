'use client'

// ===== v3.1.2 — زنگ اعلان‌ها در هدر (دسته‌بندی رنگی) =====
// لیست فعالیت‌های همه دستگاه‌ها (وب + APK) از سرور — با شمارنده نخوانده
// v3.1.2: هر دسته (فروش/خرید/تولید/...) رنگ و آیکون مخصوص خودش را دارد؛
// چیپ‌های فیلتر بالای لیست هر دسته را جدا می‌کنند.
import { useEffect, useMemo, useState } from 'react'
import {
  Bell, CheckCheck, BellOff,
  Banknote, ShoppingCart, Factory, Package, Receipt, Landmark, Wrench, Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotifs, markAllRead, refreshNotifications, type WNotif } from '@/lib/notify'
import { NOTIF_CATEGORIES, notifCategoryOf, notifCategoryDef, type NotifCategory } from '@/lib/notif-categories'
import { faDigits, gregorianToJalali } from '@/lib/jalali'
import { cn } from '@/lib/utils'

const p2 = (n: number) => String(n).padStart(2, '0')

function notifTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 90 * 1000) return 'همین حالا'
  if (diff < 60 * 60 * 1000) return `${faDigits(Math.floor(diff / 60000))} دقیقه پیش`
  if (diff < 24 * 60 * 60 * 1000) return `${faDigits(Math.floor(diff / 3600000))} ساعت پیش`
  const d = new Date(ts)
  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return `${faDigits(`${jy}/${p2(jm)}/${p2(jd)}`)} — ${faDigits(`${p2(d.getHours())}:${p2(d.getMinutes())}`)}`
}

// ===== هویت بصری هر دسته — رنگ و آیکون اختصاصی (کلاس‌های ثابت برای Tailwind) =====
const CAT_UI: Record<NotifCategory, { icon: LucideIcon; badge: string; border: string; chip: string; dot: string }> = {
  sales:      { icon: Banknote,     badge: 'bg-emerald-100 text-emerald-700', border: 'border-s-emerald-500', chip: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  purchase:   { icon: ShoppingCart, badge: 'bg-orange-100 text-orange-700',   border: 'border-s-orange-500',  chip: 'bg-orange-100 text-orange-800 border-orange-300',  dot: 'bg-orange-500' },
  production: { icon: Factory,      badge: 'bg-violet-100 text-violet-700',   border: 'border-s-violet-500',  chip: 'bg-violet-100 text-violet-800 border-violet-300',  dot: 'bg-violet-500' },
  inventory:  { icon: Package,      badge: 'bg-amber-100 text-amber-700',     border: 'border-s-amber-500',   chip: 'bg-amber-100 text-amber-800 border-amber-300',     dot: 'bg-amber-500' },
  expense:    { icon: Receipt,      badge: 'bg-rose-100 text-rose-700',       border: 'border-s-rose-500',    chip: 'bg-rose-100 text-rose-800 border-rose-300',        dot: 'bg-rose-500' },
  finance:    { icon: Landmark,     badge: 'bg-sky-100 text-sky-700',         border: 'border-s-sky-500',     chip: 'bg-sky-100 text-sky-800 border-sky-300',           dot: 'bg-sky-500' },
  machine:    { icon: Wrench,       badge: 'bg-indigo-100 text-indigo-700',   border: 'border-s-indigo-500',  chip: 'bg-indigo-100 text-indigo-800 border-indigo-300',  dot: 'bg-indigo-500' },
  settings:   { icon: SettingsIcon, badge: 'bg-slate-100 text-slate-600',     border: 'border-s-slate-400',   chip: 'bg-slate-100 text-slate-700 border-slate-300',     dot: 'bg-slate-400' },
}

function CategoryBadge({ tbl }: { tbl: string }) {
  const cat = notifCategoryOf(tbl)
  const def = notifCategoryDef(cat)
  const ui = CAT_UI[cat]
  const Icon = ui.icon
  return (
    <span
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', ui.badge)}
      title={`${def.label}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  )
}

export function NotificationsBell() {
  const { items, unread } = useNotifs()
  const [filter, setFilter] = useState<'all' | NotifCategory>('all')

  // پولینگ مستقل: هر ۶۰ ثانیه + بازگشت به تب/اپ (سینک‌موهم هم بعد از هر سینک صدا می‌زند)
  useEffect(() => {
    void refreshNotifications()
    const t = setInterval(() => void refreshNotifications(), 60000)
    const onVis = () => { if (document.visibilityState === 'visible') void refreshNotifications() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // دسته‌های موجود در اعلان‌های فعلی — برای چیپ‌های فیلتر
  const presentCats = useMemo(() => {
    const set = new Set<NotifCategory>()
    for (const n of items) set.add(notifCategoryOf(n.tbl))
    return NOTIF_CATEGORIES.filter(c => set.has(c.key))
  }, [items])

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter(n => notifCategoryOf(n.tbl) === filter)),
    [items, filter],
  )
  const countOf = (key: NotifCategory) => items.filter(n => notifCategoryOf(n.tbl) === key).length

  const openBell = (open: boolean) => {
    if (open) {
      void refreshNotifications()
      // پس از باز شدن، همه خوانده‌شده می‌شوند (شمارنده صفر)
      setTimeout(() => markAllRead(), 900)
    } else {
      setFilter('all') // دفعه بعد از نو
    }
  }

  return (
    <Popover onOpenChange={openBell}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative text-white hover:bg-white/10"
          aria-label={`اعلان‌ها${unread > 0 ? ` — ${faDigits(unread)} نخوانده` : ''}`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -top-1 -left-1 h-4 min-w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1 waffly-num">
              {faDigits(unread > 99 ? '99+' : unread)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[340px] sm:w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b px-3.5 py-2.5 bg-muted/40">
          <div className="flex items-center gap-2 text-sm font-bold">اعلان‌های وافلی</div>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px] text-muted-foreground" onClick={() => markAllRead()}>
            <CheckCheck className="h-3.5 w-3.5" /> خواندم
          </Button>
        </div>

        {/* ===== چیپ‌های دسته — هر دسته با رنگ و آیکون خودش ===== */}
        {items.length > 0 && presentCats.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b bg-muted/20 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                filter === 'all'
                  ? 'bg-foreground text-primary-foreground border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent',
              )}
            >
              همه ({faDigits(items.length)})
            </button>
            {presentCats.map(c => {
              const ui = CAT_UI[c.key]
              const Icon = ui.icon
              const active = filter === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(active ? 'all' : c.key)}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    active ? ui.chip : 'bg-background text-muted-foreground border-border hover:bg-accent',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {c.label}
                  <span className="waffly-num opacity-70">({faDigits(countOf(c.key))})</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-40" />
              <p className="text-xs">هنوز فعالیتی ثبت نشده است</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-muted-foreground">
              <BellOff className="h-6 w-6 opacity-30" />
              <p className="text-xs">فعالیتی در این دسته نیست</p>
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map(n => {
                const cat = notifCategoryOf(n.tbl)
                const def = notifCategoryDef(cat)
                return (
                  <li key={n.id} className={cn('flex gap-2.5 border-s-[3px] px-3 py-2.5 hover:bg-accent/50', CAT_UI[cat].border)}>
                    <div className="pt-0.5"><CategoryBadge tbl={n.tbl} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1 text-xs font-bold">
                          <span aria-hidden>{def.emoji}</span>
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground waffly-num">{notifTime(n.ts)}</span>
                      </div>
                      <p className={cn('mt-0.5 text-[11px] leading-5 text-muted-foreground break-words waffly-num')}>{n.body}</p>
                      {n.actor && <p className="mt-0.5 text-[10px] text-muted-foreground/70">توسط: {n.actor}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t px-3.5 py-2 text-[10px] text-muted-foreground">
          فعالیت‌های همه دستگاه‌ها (وب و اپ) — هر دسته رنگ و آیکون خودش را دارد؛ تغییرات مهم به‌صورت جداگانه به تلگرام هم می‌رود
        </div>
      </PopoverContent>
    </Popover>
  )
}
