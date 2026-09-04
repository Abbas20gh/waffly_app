'use client'

// اجزای مشترک کوچک
import { ReactNode, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { faDigits, faMoney } from '@/lib/jalali'
import { removeRecord } from '@/lib/localdb'
import type { SyncTbl } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, icon, actions }: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-bold leading-8">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function FormRow({ label, hint, children }: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function StatCard({ title, value, sub, tone = 'default', icon }: {
  title: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
  icon?: ReactNode
}) {
  const toneClass = {
    default: 'text-foreground',
    positive: 'text-green-600',
    negative: 'text-red-600',
    warning: 'text-amber-600',
  }[tone]
  return (
    <Card className="waffly-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{title}</p>
          {icon && <span className="text-muted-foreground/60">{icon}</span>}
        </div>
        <p className={cn('text-lg md:text-xl font-bold mt-1.5 waffly-num', toneClass)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('waffly-num', className)}>{faMoney(value)}</span>
}

export function Num({ value, className }: { value: number | string; className?: string }) {
  return <span className={cn('waffly-num', className)}>{faDigits(value)}</span>
}

export function SettleBadge({ status, paid, total }: {
  status: 'PAID' | 'PARTIAL' | 'UNPAID'
  paid?: number
  total?: number
}) {
  const map = {
    PAID: { label: 'تسویه‌شده', cls: 'bg-green-50 text-green-700 border-green-200' },
    PARTIAL: { label: 'پرداخت جزئی', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    UNPAID: { label: 'پرداخت‌نشده', cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const m = map[status]
  const extra = status === 'PARTIAL' && paid != null && total ? ` (${faMoney(paid)} از ${faMoney(total)})` : ''
  return (
    <span className={cn('inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', m.cls)}>
      {m.label}{extra}
    </span>
  )
}

export function EmptyState({ icon, title, desc }: {
  icon?: ReactNode
  title: string
  desc?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>}
      <p className="font-semibold text-sm">{title}</p>
      {desc && <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-5">{desc}</p>}
    </div>
  )
}

export function TabsBar<T extends string>({ tabs, value, onChange }: {
  tabs: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 thin-scroll" role="tablist">
      {tabs.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-xl px-3.5 py-2 text-xs font-medium whitespace-nowrap min-h-9 transition-colors',
            value === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground border hover:bg-accent'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ===== تأیید حذف (v2.7) — هیچ رکوردی بدون پرسش «آیا مطمئن هستید؟» حذف نمی‌شود =====

interface ConfirmState {
  open: boolean
  title: string
  desc: string
  confirmLabel: string
  resolve: ((v: boolean) => void) | null
}

/** دیالوگ تأیید عمومی — عنصر برگشتی را جایی در JSX رندر کنید */
export function useConfirm() {
  const [st, setSt] = useState<ConfirmState>({ open: false, title: '', desc: '', confirmLabel: 'حذف', resolve: null })

  const confirm = (title: string, desc?: string, confirmLabel = 'حذف'): Promise<boolean> =>
    new Promise<boolean>(resolve => {
      setSt({ open: true, title, desc: desc || 'آیا از انجام این عملیات مطمئن هستید؟ این عملیات قابل بازگشت نیست.', confirmLabel, resolve })
    })

  const settle = (v: boolean) => {
    st.resolve?.(v)
    setSt(s => ({ ...s, open: false, resolve: null }))
  }

  const element = (
    <Dialog open={st.open} onOpenChange={v => { if (!v) settle(false) }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <span className="h-9 w-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4.5 w-4.5" />
            </span>
            {st.title}
          </DialogTitle>
          <DialogDescription className="pt-1 leading-6">{st.desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="destructive" className="flex-1" onClick={() => settle(true)}>{st.confirmLabel}</Button>
          <Button variant="outline" className="flex-1" onClick={() => settle(false)}>انصراف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, element }
}

/** حذف رکورد بعد از تأیید کاربر — با پیام «آیا مطمئن هستید؟» */
export async function confirmRemove(
  confirm: (title: string, desc?: string, confirmLabel?: string) => Promise<boolean>,
  tbl: SyncTbl,
  id: string,
  title: string,
  desc?: string,
) {
  const ok = await confirm(title, desc ?? 'آیا از حذف این مورد مطمئن هستید؟ این عملیات قابل بازگشت نیست.')
  if (ok) await removeRecord(tbl, id)
  return ok
}
