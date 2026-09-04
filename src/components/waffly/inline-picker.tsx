'use client'

// پیکر آفلاین‌پسند — جایگزین مطمئن <Select> داخل <Dialog> در WebView اندروید
// v2.7 — ریشهٔ باگ «لیست بالای صفحه باز می‌شود»:
//   DialogContent هم transform (translate-50%) دارد و هم overflow-y-auto؛ عنصر position:fixed
//   داخل یک والد transform دار، نسبت به همان والد موقعیت‌دهی می‌شود (containing block) نه viewport
//   → منو جابه‌جا/بریده می‌شد. راه‌حل: رندر منو با Portal در document.body (بدون transform)
//   + جای‌گذاری مجدد هنگام scroll (منو دنبال دکمه می‌رود و دیگر با هر اسکرول بسته نمی‌شود).
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PickerOption {
  value: string
  label: string
  hint?: string // متن کمکی کوچک (مثل واحد ماده)
}

export function InlinePicker({
  value, options, onChange, placeholder, disabled, className, buttonClassName,
}: {
  value: string
  options: PickerOption[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const openUp = below < 300 && r.top > 320 // اگر جا نیست، منو رو به بالا باز شود (ارتفاع منو تا ~۲۷۰px)
    setRect({
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      left: r.left,
      width: r.width,
    })
  }

  // اسکرول = جای‌گذاری مجدد (نه بستن) — منو دقیقاً زیر/بالای دکمه می‌ماند
  useLayoutEffect(() => {
    if (!open) return
    place()
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = () => place()
    const onResize = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (open) { setOpen(false); return }
          place()
          setOpen(true)
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground',
          buttonClassName,
        )}
      >
        <span className="truncate">{selected ? selected.label : (placeholder ?? 'انتخاب کنید')}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {/* open فقط از کلیک (سمت کلاینت) true می‌شود → document همیشه موجود است */}
      {open && rect && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            width: Math.max(rect.width, 180),
            zIndex: 9999,
          }}
          className="max-h-[17rem] overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-lg"
          dir="rtl"
        >
          {options.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">موردی ثبت نشده است</div>
          )}
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2.5 text-right text-sm',
                'hover:bg-accent active:bg-accent',
                o.value === value && 'bg-accent/60',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>}
              </span>
              {o.value === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
