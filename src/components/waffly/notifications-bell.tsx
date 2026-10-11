'use client'

// ===== v3.1 — زنگ اعلان‌ها در هدر =====
// لیست فعالیت‌های همه دستگاه‌ها (وب + APK) از سرور — با شمارنده نخوانده
import { useEffect } from 'react'
import { Bell, Plus, Pencil, Trash2, CheckCheck, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotifs, markAllRead, refreshNotifications, type WNotif } from '@/lib/notify'
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

function NotifIcon({ op }: { op: WNotif['op'] }) {
  const cls = 'h-3.5 w-3.5'
  if (op === 'CREATE') return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700"><Plus className={cls} /></span>
  if (op === 'DELETE') return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 className={cls} /></span>
  return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Pencil className={cls} /></span>
}

export function NotificationsBell() {
  const { items, unread } = useNotifs()

  // پولینگ مستقل: هر ۶۰ ثانیه + بازگشت به تب/اپ (سینک‌موهم هم بعد از هر سینک صدا می‌زند)
  useEffect(() => {
    void refreshNotifications()
    const t = setInterval(() => void refreshNotifications(), 60000)
    const onVis = () => { if (document.visibilityState === 'visible') void refreshNotifications() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const openBell = (open: boolean) => {
    if (open) {
      void refreshNotifications()
      // پس از باز شدن، همه خوانده‌شده می‌شوند (شمارنده صفر)
      setTimeout(() => markAllRead(), 900)
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
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-40" />
              <p className="text-xs">هنوز فعالیتی ثبت نشده است</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map(n => (
                <li key={n.id} className="flex gap-2.5 px-3 py-2.5 hover:bg-accent/50">
                  <div className="pt-0.5"><NotifIcon op={n.op} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold">{n.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground waffly-num">{notifTime(n.ts)}</span>
                    </div>
                    <p className={cn('mt-0.5 text-[11px] leading-5 text-muted-foreground break-words waffly-num')}>{n.body}</p>
                    {n.actor && <p className="mt-0.5 text-[10px] text-muted-foreground/70">توسط: {n.actor}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t px-3.5 py-2 text-[10px] text-muted-foreground">
          فعالیت‌های همه دستگاه‌ها (وب و اپ) — تغییرات مهم هم‌زمان به تلگرام هم می‌رود
        </div>
      </PopoverContent>
    </Popover>
  )
}
