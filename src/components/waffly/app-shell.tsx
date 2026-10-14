'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Wheat, ShoppingCart, ShoppingBasket, Wrench,
  Calculator, Settings, Menu, UserRound, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SyncBadge } from './sync-badge'
import { NotificationsBell } from './notifications-bell'
import { todayPretty } from '@/lib/jalali'
import { getSession, setSession, AUTH_EVENT, type AuthSession } from '@/lib/localdb'
import { UserGateDialog } from '@/lib/user-gate'
import { LoginGate } from './login-gate'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export type ViewKey = 'dashboard' | 'production' | 'sales' | 'purchases' | 'machines' | 'accounting' | 'settings'

export const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'production', label: 'تولید', icon: Wheat },
  { key: 'sales', label: 'فروش', icon: ShoppingCart },
  { key: 'purchases', label: 'خرید مواد', icon: ShoppingBasket },
  { key: 'machines', label: 'دستگاه‌سازی', icon: Wrench },
  { key: 'accounting', label: 'حسابداری', icon: Calculator },
  { key: 'settings', label: 'تنظیمات', icon: Settings },
]

export function AppShell({ view, onNavigate, children }: {
  view: ViewKey
  onNavigate: (v: ViewKey) => void
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [auth, setAuth] = useState<AuthSession | null>(null)
  const [mounted, setMounted] = useState(false)

  // v3.2.0 — قفل ورود: بدون نشست معتبر، فقط صفحهٔ ورود نمایش داده می‌شود
  useEffect(() => {
    setAuth(getSession())
    setMounted(true)
    const sync = () => setAuth(getSession())
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('waffly-user-changed', sync)
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('waffly-user-changed', sync)
    }
  }, [])

  const nav = (v: ViewKey) => {
    onNavigate(v)
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  if (!mounted) return <div className="min-h-screen bg-background" dir="rtl" />
  if (!auth) return <LoginGate />
  const userName = auth.family

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* ===== هدر ===== */}
      <header className="sticky top-0 z-40 border-b bg-[#13201A] text-white shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex h-14 items-center gap-2 px-3 md:px-5">
          {/* دکمه منو موبایل */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <button onClick={() => nav('dashboard')} className="flex items-center gap-2.5">
            <Image src="/icons/logo-64.png" alt="لوگوی Waffly" width={34} height={34} className="rounded-lg" priority />
            <div className="text-right leading-tight">
              <div className="font-bold text-base">Waffly</div>
              <div className="text-[10px] text-white/60 hidden sm:block">مدیریت نان سنتی</div>
            </div>
          </button>

          <div className="hidden lg:block text-xs text-white/60 mr-4 waffly-num">{todayPretty()}</div>

          <div className="flex-1" />

          {/* کاربر واردشده + خروج */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-white hover:bg-white/10 h-9 px-2.5">
                <UserRound className="h-4.5 w-4.5" />
                <span className="text-xs hidden sm:inline">{userName}{auth.isAdmin ? ' (مدیر)' : ''}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>کاربر: {userName}{auth.isAdmin ? ' — مدیر' : ''}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <p className="px-3 py-2 text-[11px] text-muted-foreground leading-5">
                نام شما روی رکوردهای ثبت‌شده (فروش، خرید، تولید) درج می‌شود.
                {auth.isAdmin && ' مدیریت کاربران در تنظیمات ← کاربران است.'}
              </p>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => setSession(null)}
              >
                <LogOut className="h-4 w-4 ml-1" /> خروج از حساب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="[&_button]:bg-white/10 [&_button]:border-white/20 [&_button]:text-white [&_button:hover]:bg-white/20">
            <NotificationsBell />
          </div>

          <div className="[&_button]:bg-white/10 [&_button]:border-white/20 [&_button]:text-white [&_button:hover]:bg-white/20">
            <SyncBadge />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ===== سایدبار دسکتاپ ===== */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-l bg-card">
          <nav className="flex-1 p-3 space-y-1" aria-label="ناوبری اصلی">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => nav(item.key)}
                aria-current={view === item.key ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors min-h-11',
                  view === item.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 text-[11px] text-muted-foreground border-t">
            <p className="font-semibold text-foreground/70">Waffly v3.2.0</p>
            <p className="mt-1 leading-5">آفلاین‌محور • سینک خودکار<br />تقویم شمسی • ورود با حساب کاربری</p>
          </div>
        </aside>

        {/* ===== منوی کشویی موبایل ===== */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <nav className="absolute top-0 right-0 h-full w-64 bg-card shadow-2xl p-3 space-y-1 overflow-y-auto" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
              <div className="flex items-center gap-2 px-2 pb-3 pt-1">
                <Image src="/icons/logo-64.png" alt="لوگوی Waffly" width={30} height={30} />
                <span className="font-bold">Waffly</span>
              </div>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => nav(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium min-h-11',
                    view === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* ===== محتوا ===== */}
        <main className="flex-1 min-w-0 p-3 md:p-6 pb-24 md:pb-8 max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* ===== گیت نام کاربر (سراسری — همیشه زنده) ===== */}
      <UserGateDialog />

      {/* ===== ناوبری پایین موبایل ===== */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 select-none" aria-label="ناوبری پایین">
        <div className="flex justify-around px-1 py-1.5" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
          {NAV_ITEMS.slice(0, 6).map(item => (
            <button
              key={item.key}
              onClick={() => nav(item.key)}
              aria-label={item.label}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 min-w-12',
                view === item.key ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
