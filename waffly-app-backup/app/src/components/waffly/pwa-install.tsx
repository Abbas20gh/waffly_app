'use client'

// نصب PWA — بنر هوشمند + راهنمای گام‌به‌گام iOS (Safari → Add to Home Screen)
// و اندروید/دسکتاپ (beforeinstallprompt)
import { useEffect, useState, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Share, PlusSquare, Check, X, Smartphone, Download, WifiOff, RefreshCw,
  MonitorSmartphone, Info, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type Platform = 'ios' | 'android' | 'desktop'

export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
    || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)) // iPadOS 13+ به‌عنوان Mac
  if (isIOS) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// ---------- محتوای راهنما (در بنر و تنظیمات استفاده می‌شود) ----------
export function PwaGuideContent() {
  const steps = [
    {
      icon: Globe,
      title: '۱. اپ را در Safari باز کنید',
      desc: 'آدرس سرور Waffly را در مرورگر Safari آیفون/آیپد خود باز کنید. (نصب PWA روی iOS فقط از Safari انجام می‌شود، نه Chrome)',
    },
    {
      icon: Share,
      title: '۲. روی دکمه اشتراک‌گذاری بزنید',
      desc: 'در نوار پایین Safari دکمه «Share» (مربع با فلش رو به بالا) را لمس کنید.',
    },
    {
      icon: PlusSquare,
      title: '۳. گزینه Add to Home Screen را انتخاب کنید',
      desc: 'در لیست بازشده، پایین را بگردید و «Add to Home Screen» را بزنید.',
    },
    {
      icon: Check,
      title: '۴. دکمه Add را بزنید',
      desc: 'نام «Waffly» نمایش داده می‌شود؛ دکمه Add را لمس کنید تا آیکون اپ روی صفحه اصلی نصب شود.',
    },
  ]
  return (
    <div className="space-y-4">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3 items-start rounded-xl border bg-card p-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <s.icon className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-6">{s.title}</p>
            <p className="text-xs text-muted-foreground leading-5 mt-0.5">{s.desc}</p>
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
          <Info className="h-4 w-4" /> مزایای نسخه نصب‌شده (PWA)
        </p>
        <ul className="text-xs text-muted-foreground space-y-1.5 leading-5">
          <li className="flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5 shrink-0" /> کارکرد کامل آفلاین — بدون اینترنت هم ثبت تولید و فروش ممکن است</li>
          <li className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 shrink-0" /> سینک خودکار داده‌ها بین هر ۳ گوشی به‌محض اتصال</li>
          <li className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 shrink-0" /> تمام‌صفحه مثل اپ واقعی، بدون نوار آدرس مرورگر</li>
          <li className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5 shrink-0" /> بدون App Store — به‌روزرسانی خودکار با بازکردن اپ</li>
        </ul>
      </div>
    </div>
  )
}

// ---------- بنر شناور ----------
export function PwaInstall() {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [standalone, setStandalone] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  const dismiss = useCallback(() => {
    setBannerVisible(false)
    try {
      localStorage.setItem('waffly-pwa-banner', String(Date.now()))
    } catch { /* ignore */ }
  }, [])

  // آیا بنر اخیراً (۷ روز گذشته) بسته شده؟
  const recentlyDismissed = () => {
    try {
      const t = Number(localStorage.getItem('waffly-pwa-banner') || 0)
      return Date.now() - t < 7 * 24 * 3600 * 1000
    } catch { return false }
  }

  useEffect(() => {
    // درخواست پایداری دیتابیس آفلاین (مهم برای iOS که ممکن است حافظه را پاک کند)
    try { navigator.storage?.persist?.() } catch { /* ignore */ }

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (!recentlyDismissed()) setBannerVisible(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setBannerVisible(false)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)

    // iOS: beforeinstallprompt ندارد — با تأخیر بنر بومی را نشان بده
    const t = setTimeout(() => {
      setPlatform(getPlatform())
      setStandalone(isStandalone())
      if (getPlatform() === 'ios' && !isStandalone() && !recentlyDismissed()) {
        setBannerVisible(true)
      }
    }, 2500)

    const onDisplayChange = (e: MediaQueryListEvent) => {
      setStandalone(e.matches || isStandalone())
    }
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener('change', onDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener('change', onDisplayChange)
      clearTimeout(t)
    }
  }, [])

  const nativeInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setBannerVisible(false)
  }

  if (standalone || installed) return null

  return (
    <>
      {/* بنر پایین شناور — فقط وقتی در مرورگر (نه standalone) باز شده */}
      {bannerVisible && (
        <div
          role="status"
          aria-label="راهنمای نصب اپلیکیشن"
          className={cn(
            'fixed z-50 left-3 right-3 bottom-3 md:left-auto md:right-6 md:bottom-6 md:w-96',
            'rounded-2xl border bg-card/95 backdrop-blur shadow-2xl p-4',
            'animate-in slide-in-from-bottom-4 fade-in duration-500'
          )}
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={dismiss}
            aria-label="بستن"
            className="absolute top-2 left-2 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Waffly را روی گوشی نصب کنید</p>
              <p className="text-[11px] text-muted-foreground leading-4 mt-0.5">
                تمام‌صفحه، آفلاین و با سینک خودکار — مثل اپ واقعی
              </p>
            </div>
          </div>

          {platform === 'ios' && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-5">
              <Share className="h-4 w-4 shrink-0 text-primary" />
              <span>
                در Safari: دکمه <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>
              </span>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {platform === 'ios' || !deferredPrompt ? (
              <Button size="sm" className="flex-1 h-9" onClick={() => { setGuideOpen(true); dismiss() }}>
                <Share className="h-4 w-4" /> راهنمای کامل نصب
              </Button>
            ) : (
              <Button size="sm" className="flex-1 h-9" onClick={nativeInstall}>
                <Download className="h-4 w-4" /> نصب مستقیم
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-9" onClick={dismiss}>
              بعداً
            </Button>
          </div>
        </div>
      )}

      {/* دیالوگ راهنمای کامل */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              نصب Waffly روی گوشی
              <Badge variant="secondary" className="mr-auto">PWA</Badge>
            </DialogTitle>
            <DialogDescription>
              روی iPhone و iPad از طریق Safari نصب کنید؛ روی اندروید از Chrome.
            </DialogDescription>
          </DialogHeader>
          <PwaGuideContent />
        </DialogContent>
      </Dialog>
    </>
  )
}
