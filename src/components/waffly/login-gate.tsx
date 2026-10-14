'use client'

// صفحه ورود امن (v3.2.0) — هرکه آدرس سایت را دارد نمی‌تواند وارد شود.
// نام کاربری = فامیل | رمز = ۴ رقم آخر شماره موبایل خود شخص.
// اولین ورود (وقتی هیچ کاربری ثبت نیست) = مدیر سیستم؛ بقیه کاربرها را مدیر از تنظیمات اضافه می‌کند.
import { useState } from 'react'
import Image from 'next/image'
import { Lock, UserRound, ShieldCheck, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTable, loginAppUser, createFirstAdmin } from '@/lib/localdb'
import type { AppUser } from '@/lib/types'
import { faDigits } from '@/lib/jalali'

const toEn = (v: string) =>
  v.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

export function LoginGate() {
  const users = useTable<AppUser>('appUsers')
  const [ready, setReady] = useState(false)
  // تا liveQuery اول برنگردد صفحه‌ای نشان نده (جلوی فلش «مدیر بساز» برای کاربر واردشده)
  if (!ready && typeof users !== 'undefined') setReady(true)

  const [family, setFamily] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const firstMode = ready && users.filter(u => !u.deleted).length === 0
  if (!ready) return null

  const digits = toEn(pin).replace(/\D/g, '')

  const submitLogin = async () => {
    setErr('')
    if (!family.trim() || digits.length !== 4) { setErr('فامیل و رمز ۴ رقمی را وارد کنید'); return }
    setBusy(true)
    const r = await loginAppUser(family, digits)
    if (r === 'NO_USER') setErr('کاربری با این فامیل ثبت نشده — از مدیر بخواهید اکانت بسازد')
    else if (r === 'BAD_PIN') setErr('رمز اشتباه است — ۴ رقم آخر شماره موبایل خودتان')
    setBusy(false)
  }

  const submitFirst = async () => {
    setErr('')
    if (!family.trim()) { setErr('فامیل را وارد کنید'); return }
    if (digits.length !== 4) { setErr('رمز باید دقیقاً ۴ رقم باشد (۴ رقم آخر شماره موبایل)'); return }
    if (digits !== toEn(pin2).replace(/\D/g, '')) { setErr('تکرار رمز با رمز یکی نیست'); return }
    setBusy(true)
    try {
      await createFirstAdmin(family, digits, phone.trim() || undefined)
      // setSession داخل createFirstAdmin رویداد AUTH_EVENT را می‌فرستد و AppShell وارد می‌شود
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'ثبت نام انجام نشد')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <Image src="/icons/logo-64.png" alt="Waffly" width={64} height={64} className="mx-auto rounded-2xl" priority />
            <h1 className="text-xl font-bold">Waffly</h1>
            <p className="text-xs text-muted-foreground">مدیریت نان سنتی — نان بستنی آرتا</p>
          </div>

          <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {firstMode ? <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" /> : <Lock className="h-4.5 w-4.5 text-primary" />}
              {firstMode ? 'ورود اول — ساخت حساب مدیر' : 'ورود به برنامه'}
            </div>
            <p className="text-[11px] text-muted-foreground leading-5">
              {firstMode
                ? 'هنوز هیچ کاربری ثبت نشده. اولین نفری که وارد می‌شود «مدیر» می‌شود و از تنظیمات، کاربرهای دیگر را با فامیل و ۴ رقم آخر شماره موبایلشان اضافه می‌کند.'
                : 'برای ورود، فامیل و رمز (۴ رقم آخر شماره موبایل خودتان) را بزنید. اگر اکانت ندارید، مدیر باید از تنظیمات ← کاربران اکانت بسازد.'}
            </p>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> نام خانوادگی</span>
              <Input
                autoFocus
                value={family}
                onChange={e => setFamily(e.target.value)}
                placeholder="مثلاً: سبيلی"
                className="h-11"
                onKeyDown={e => { if (e.key === 'Enter') void (firstMode ? submitFirst() : submitLogin()) }}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> رمز ورود (۴ رقم آخر شماره موبایل)</span>
              <Input
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(toEn(e.target.value).replace(/\D/g, '').slice(0, 4))}
                placeholder="مثلاً ۱۲۳۴"
                className="h-11 waffly-num text-center tracking-[0.4em]"
                dir="ltr"
                onKeyDown={e => { if (e.key === 'Enter') void (firstMode ? submitFirst() : submitLogin()) }}
              />
            </label>

            {firstMode && (
              <>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">تکرار رمز</span>
                  <Input
                    inputMode="numeric"
                    value={pin2}
                    onChange={e => setPin2(toEn(e.target.value).replace(/\D/g, '').slice(0, 4))}
                    className="h-11 waffly-num text-center tracking-[0.4em]"
                    dir="ltr"
                    onKeyDown={e => { if (e.key === 'Enter') void submitFirst() }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">شماره موبایل شما (اختیاری — برای یادآوری رمز)</span>
                  <Input
                    inputMode="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="۰۹۱۲…"
                    className="h-11 waffly-num"
                    dir="ltr"
                  />
                </label>
              </>
            )}

            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

            <Button className="w-full h-11" disabled={busy || !ready} onClick={() => void (firstMode ? submitFirst() : submitLogin())}>
              <LogIn className="ml-1.5 h-4 w-4" />
              {busy ? 'لطفاً صبر کنید…' : firstMode ? 'ثبت نام مدیر و ورود' : 'ورود'}
            </Button>

            <p className="text-[10px] text-muted-foreground leading-5 text-center">
              {firstMode
                ? `دستگاه‌های دیگر بعد از سینک، فقط با حساب‌هایی که مدیر می‌سازد وارد می‌شوند.`
                : `ورود فقط برای کاربران ثبت‌شده است — ${faDigits(users.filter(u => !u.deleted).length)} کاربر فعال`}
            </p>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground pb-4">اگر رمزتان را فراموش کرده‌اید، مدیر می‌تواند حساب را دوباره بسازد.</p>
    </div>
  )
}
