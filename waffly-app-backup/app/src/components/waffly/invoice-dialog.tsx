'use client'

// v2.8 — دیالوگ «صدور فاکتور»: انتخاب فرمت (متنی / تصویری PNG / PDF) + کپی/دانلود/پیامک/تلگرام
// شمارهٔ سریال موقع باز شدن دیالوگ (لحظهٔ صدور) از سرور گرفته می‌شود؛ آفلاین = پیش‌نویس بدون شماره
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Download, MessageSquare, Send, Share2, FileDown, ImageIcon, FileText, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { API_BASE } from '@/lib/sync-engine'
import {
  type InvoiceModel, invoiceToText, invoiceCaption, invoiceFilename, invoiceSummary,
} from '@/lib/invoice'
import { InvoiceVisual } from './invoice-visual'
import { cn } from '@/lib/utils'

type Fmt = 'text' | 'image' | 'pdf'

const FMTS: { key: Fmt; label: string; icon: React.ReactNode }[] = [
  { key: 'text', label: 'متنی', icon: <FileText className="h-4 w-4" /> },
  { key: 'image', label: 'تصویری PNG', icon: <ImageIcon className="h-4 w-4" /> },
  { key: 'pdf', label: 'PDF', icon: <FileDown className="h-4 w-4" /> },
]

export function InvoiceDialog({ open, onOpenChange, model: initialModel, invoiceKey, getNumber }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  model: InvoiceModel | null
  /** کلید پایدار فاکتور جاری (شناسهٔ فروش یا 'combined-…') — فقط با تغییر آن مدل ریست می‌شود */
  invoiceKey: string
  /** گرفتن شمارهٔ سریال از سرور + ثبت روی رکورد — null/throw یعنی آفلاین (پیش‌نویس) */
  getNumber: (m: InvoiceModel) => Promise<number | null>
}) {
  const [model, setModel] = useState<InvoiceModel | null>(initialModel)
  const [fmt, setFmt] = useState<Fmt>('text')
  const [numbering, setNumbering] = useState(false)
  const [tgState, setTgState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [tgError, setTgError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)

  // sync مدل — فقط وقتی دیالوگ باز می‌شود یا فاکتور عوض می‌شود (initialModel هر رندر جدید است؛
  // اگر به dep بود، شمارهٔ صادرشده هر رندر پاک می‌شد و شمارهٔ تکراری گرفته می‌شد)
  useEffect(() => {
    if (open) {
      setModel(initialModel)
      setTgState('idle')
      setTgError(null)
      setFmt('text')
    }
  }, [open, invoiceKey])

  // لحظهٔ صدور — اگر شماره ندارد، از سرور بگیر و ثبت کن (آفلاین → پیش‌نویس)
  useEffect(() => {
    if (!open || numbering) return
    if (!model || model.number != null) return
    let alive = true
    setNumbering(true)
    getNumber(model)
      .then(n => { if (alive && n) setModel(prev => (prev ? { ...prev, number: n } : prev)) })
      .catch(() => { /* آفلاین — پیش‌نویس می‌ماند */ })
      .finally(() => { if (alive) setNumbering(false) })
    return () => { alive = false }
  }, [open, invoiceKey, model?.number == null])

  // مقیاس پیش‌نمایش متناسب با عرض دیالوگ (طرح ۷۹۴px است)
  useEffect(() => {
    const el = previewRef.current
    if (!el || !open) return
    const update = () => setScale(Math.min(1, Math.max(0.35, el.clientWidth / 794)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, fmt])

  const text = model ? invoiceToText(model) : ''

  const copyText = useCallback(async () => {
    if (!model) return
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'متن فاکتور کپی شد' })
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      toast({ title: 'متن فاکتور کپی شد' })
    }
  }, [model, text])

  const toPngBlob = useCallback(async (): Promise<Blob> => {
    if (!model) throw new Error('فاکتور خالی است')
    const { renderInvoicePng } = await import('./invoice-pdf')
    return await renderInvoicePng(model)
  }, [model])

  const toPdfBlob = useCallback(async (): Promise<Blob> => {
    if (!model) throw new Error('فاکتور خالی است')
    const { renderInvoicePdf } = await import('./invoice-pdf')
    return await renderInvoicePdf(model)
  }, [model])

  const download = useCallback(async (kind: 'image' | 'pdf') => {
    if (!model) return
    setBusy(kind)
    try {
      const blob = kind === 'image' ? await toPngBlob() : await toPdfBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = invoiceFilename(model, kind === 'image' ? 'png' : 'pdf')
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: 'دانلود شد', description: invoiceFilename(model, kind === 'image' ? 'png' : 'pdf') })
    } catch (e) {
      toast({ title: 'خطا در ساخت فایل', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }, [model, toPngBlob, toPdfBlob])

  // پیامک — همیشه فرمت متنی (SMS فایل حمل نمی‌کند)
  const sendSms = useCallback(async () => {
    if (!model) return
    const isNative = typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
    try {
      if (isNative) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: model.ctx.businessName, text, dialogTitle: 'ارسال فاکتور' })
        return
      }
      if (model.customerPhone) {
        window.location.href = `sms:${model.customerPhone}?body=${encodeURIComponent(text)}`
        return
      }
      await navigator.clipboard.writeText(text)
      toast({ title: 'شمارهٔ مشتری ثبت نشده — متن کپی شد', description: 'در پیام‌رسان بچسبانید' })
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {})
      toast({ title: 'متن کپی شد', description: 'در پیام‌رسان بچسبانید' })
    }
  }, [model, text])

  // اشتراک‌گذاری عمومی (اپ پیام‌رسان گوشی با متن آماده باز می‌شود)
  const shareText = useCallback(async () => {
    if (!model) return
    const isNative = typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
    if (isNative) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: model.ctx.businessName, text, dialogTitle: 'اشتراک‌گذاری فاکتور' })
        return
      } catch { /* لغو توسط کاربر */ }
    }
    await copyText()
  }, [model, text, copyText])

  // ارسال به تلگرام — طبق فرمت انتخابی (نیاز به اینترنت)
  const sendTelegram = useCallback(async () => {
    if (!model) return
    setTgState('sending')
    setTgError(null)
    try {
      let body: Record<string, unknown>
      if (fmt === 'text') {
        body = { format: 'text', text }
      } else {
        const blob = fmt === 'image' ? await toPngBlob() : await toPdfBlob()
        const b64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
          fr.onerror = () => reject(new Error('تبدیل فایل به base64 شکست خورد'))
          fr.readAsDataURL(blob)
        })
        body = { format: fmt, base64: b64, filename: invoiceFilename(model, fmt === 'image' ? 'png' : 'pdf'), caption: invoiceCaption(model) }
      }
      const res = await fetch(`${API_BASE}/api/invoice/send-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({ ok: false, error: `سرور ${res.status}` })) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'ارسال به تلگرام شکست خورد')
      setTgState('ok')
      toast({ title: 'به تلگرام ارسال شد ✓' })
    } catch (e) {
      setTgState('error')
      setTgError(e instanceof Error ? e.message : 'خطای نامشخص')
      toast({ title: 'ارسال به تلگرام شکست خورد', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }, [model, fmt, text, toPngBlob, toPdfBlob])

  if (!model) return null
  const isVisual = fmt !== 'text'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>صدور فاکتور {model.number ? `شماره ${model.number.toLocaleString('fa-IR')}` : '(پیش‌نویس)'}</DialogTitle>
          <DialogDescription>{invoiceSummary(model)}{model.number ? '' : ' — آفلاین: شمارهٔ نهایی بعد از اتصال به اینترنت ثبت می‌شود'}</DialogDescription>
        </DialogHeader>

        {/* انتخاب فرمت */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">فرمت:</span>
          <div className="flex rounded-lg border p-0.5 gap-0.5 bg-muted/40">
            {FMTS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFmt(f.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  fmt === f.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          {numbering && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال دریافت شمارهٔ سریال…
            </span>
          )}
          {!numbering && !model.number && (
            <span className="text-[11px] text-red-600">پیش‌نویس بدون شماره — برای شماره‌گذاری اینترنت لازم است</span>
          )}
        </div>

        {/* پیش‌نمایش */}
        <div ref={previewRef} className="rounded-xl border overflow-auto bg-muted/30" style={{ maxHeight: '46dvh' }}>
          {fmt === 'text' ? (
            <pre dir="rtl" className="p-3 text-[12.5px] leading-6 whitespace-pre-wrap font-sans">{text}</pre>
          ) : (
            <div style={{ height: 1000 * scale }} className="relative">
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top right', position: 'absolute', top: 0, right: 0 }}>
                <InvoiceVisual model={model} draftHint />
              </div>
            </div>
          )}
        </div>

        {/* رندر مخفی حذف شد — capture با نود موقت بیرون از صفحه در invoice-pdf.tsx انجام می‌شود */}

        {/* عملیات */}
        <div className="flex flex-wrap gap-2">
          {fmt === 'text' && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => void copyText()}>
              <Copy className="h-4 w-4" /> کپی متن
            </Button>
          )}
          {isVisual && (
            <Button variant="outline" size="sm" className="h-9" disabled={busy !== null} onClick={() => void download(fmt)}>
              {busy === fmt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              دانلود {fmt === 'image' ? 'PNG' : 'PDF'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={() => void sendSms()}>
            <MessageSquare className="h-4 w-4" /> ارسال پیامکی
            <span className="text-[9px] text-muted-foreground">(همیشه متنی)</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => void shareText()}>
            <Share2 className="h-4 w-4" /> اشتراک‌گذاری
          </Button>
          <Button
            size="sm"
            className="h-9 mr-auto"
            disabled={tgState === 'sending'}
            onClick={() => void sendTelegram()}
          >
            {tgState === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ارسال به تلگرام
          </Button>
        </div>
        {tgState === 'error' && tgError && (
          <p className="text-[11px] text-red-600 -mt-1">خطای تلگرام: {tgError} — این عملیات به اینترنت نیاز دارد.</p>
        )}
        {fmt !== 'text' && (
          <p className="text-[10.5px] text-muted-foreground -mt-1">
            پیش‌نمایش تلگرام: در تلگرام عکس (PNG) بهتر نمایش داده می‌شود و PDF به‌صورت سند می‌رود.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
