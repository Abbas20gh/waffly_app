'use client'

// گیتِ نام کاربر (v3.1.4) — قبل از ثبت فروش/خرید/تولید/مصرف، وجود نام کاربر بررسی می‌شود.
// اگر نام ثبت نباشد، دیالوگ «نام شما چیست؟» باز می‌شود و اکشنِ در انتظار بعد از ثبت نام اجرا می‌شود.
//
// نکات مقاوم‌سازی (فیکس باگ «فاکتور دوم ثبت نمی‌شود» در نسخهٔ وب):
// ۱) requireUserName کاملاً بی‌حالت (stateless) است و getActiveUser هر بار تازه از localStorage
//    (یا پشتیبان حافظه) خوانده می‌شود — هیچ کش/نشست کهنی در کار نیست.
// ۲) اگر کاربر دیالوگ را بدون ثبت نام ببندد، به‌جای شکستِ بی‌صدا یک توست خطای واضح نشان داده
//    می‌شود تا معلوم باشد چرا ثبت انجام نشد.
// ۳) اگر چند بار پشت‌سرهم درخواست ثبت بیاید، آخرین اکشن نگه داشته می‌شود و فقط یک دیالوگ باز است.
// ۴) خطاهای IndexedDB در مسیر ذخیره (putRecord) در ویوها catch و با توست نمایش داده می‌شوند —
//    دیگر هیچ شکستی بی‌صدا نیست.

import { useEffect, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { getActiveUser, setActiveUser } from './localdb'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export const USER_GATE_EVENT = 'waffly-user-gate'

/**
 * اگر نام کاربر ثبت شده باشد اکشن را بلافاصله اجرا می‌کند (true برمی‌گرداند)؛
 * وگرنه رویداد گیت را منتشر می‌کند تا دیالوگ نام باز شود و اکشن پس از ثبت نام ادامه یابد.
 */
export function requireUserName(action: () => void): boolean {
  if (getActiveUser().trim()) { action(); return true }
  if (typeof window === 'undefined') { action(); return true }
  window.dispatchEvent(new CustomEvent(USER_GATE_EVENT, { detail: action }))
  return false
}

/** دیالوگ سراسری نام کاربر — یک بار در AppShell رندر می‌شود (همیشه زنده است). */
export function UserGateDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const pending = useRef<(() => void) | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      pending.current = (e as CustomEvent).detail && typeof (e as CustomEvent).detail === 'function'
        ? (e as CustomEvent).detail as () => void
        : null
      setName(getActiveUser())
      setOpen(true)
    }
    window.addEventListener(USER_GATE_EVENT, handler)
    return () => window.removeEventListener(USER_GATE_EVENT, handler)
  }, [])

  const confirm = () => {
    const n = name.trim()
    if (!n) return
    setActiveUser(n)
    setOpen(false)
    const act = pending.current
    pending.current = null
    act?.()
  }

  const dismiss = () => {
    const had = !!pending.current
    pending.current = null
    setOpen(false)
    if (had) {
      toast({
        title: 'ثبت انجام نشد',
        description: 'برای ثبت، اول نام‌تان را در کادر وارد و «ثبت نام و ادامه» را بزنید.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent dir="rtl" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 leading-7">
            <UserRound className="h-5 w-5 text-primary shrink-0" />
            نام شما چیست؟
          </DialogTitle>
          <DialogDescription>
            برای ثبت، اول نام‌تان را وارد کنید. این نام روی رکوردهای فروش، خرید و تولید و در
            اعلان‌های اپ نمایش داده می‌شود تا معلوم باشد هر مورد را چه کسی ثبت کرده است.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً: عباس، اپراتور ۱ ..."
          onKeyDown={(e) => { if (e.key === 'Enter') confirm() }}
          maxLength={40}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={dismiss}>بی‌خیال</Button>
          <Button onClick={confirm} disabled={!name.trim()}>ثبت نام و ادامه</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
