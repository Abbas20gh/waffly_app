'use client'

// گزارش‌ساز (v3.0) — گزارش هر بخش با بازه تاریخ شمسی + خروجی اکسل و PDF
import { useMemo, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { ClipboardList, FileSpreadsheet, FileText, Printer, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, EmptyState } from './bits'
import { JalaliDateInput } from './jalali-date'
import { useDataBundle } from '@/lib/hooks'
import { todayJalali, faDigits, faMoney, prettyJalali, addJalaliDays } from '@/lib/jalali'
import { active, periodReport, buyerStats, saleDue, effectiveSettled, parseItems } from '@/lib/calc'
import { exportRowsToExcel, exportElementToPdf } from '@/lib/export'

type ReportKey = 'production' | 'sales' | 'purchases' | 'expenses' | 'profit' | 'boxes' | 'customers'

const REPORTS: { key: ReportKey; label: string; desc: string }[] = [
  { key: 'production', label: 'تولید و ضایعات', desc: 'تولید هر نوع نان، جعبه‌ها و ضایعات در بازه' },
  { key: 'sales', label: 'فروش‌ها', desc: 'فاکتورهای فروش با وضعیت تسویه' },
  { key: 'purchases', label: 'خریدها', desc: 'خرید مواد و کالا با مانده پرداخت' },
  { key: 'expenses', label: 'هزینه‌ها', desc: 'هزینه‌های جاری تفکیک‌شده بر اساس سرفصل' },
  { key: 'profit', label: 'سود و زیان', desc: 'خلاصه دوره: فروش، بهای مواد، هزینه‌ها و سود' },
  { key: 'boxes', label: 'کدهای جعبه', desc: 'لیست جعبه‌های تولیدشده با کد یکتا' },
  { key: 'customers', label: 'مشتریان', desc: 'گردش خرید و مانده هر مشتری' },
]

const PRESETS: { label: string; days: number | null }[] = [
  { label: '۷ روز اخیر', days: 6 },
  { label: '۳۰ روز اخیر', days: 29 },
  { label: '۹۰ روز اخیر', days: 89 },
  { label: 'همه زمان‌ها', days: null },
]

export function ReportsView() {
  const [reportKey, setReportKey] = useState<ReportKey>('production')
  const [from, setFrom] = useState(addJalaliDays(todayJalali(), -29))
  const [to, setTo] = useState(todayJalali())

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        subtitle="انتخاب بازه تاریخ شمسی و دریافت گزارش آماده اکسل و PDF — مثل نرم‌افزارهای حسابداری"
        icon={<ClipboardList className="h-5 w-5" />}
      />

      <Card className="waffly-card mb-4">
        <CardContent className="pt-4 space-y-3">
          {/* انتخاب نوع گزارش */}
          <div className="flex flex-wrap gap-2">
            {REPORTS.map(r => (
              <button
                key={r.key}
                onClick={() => setReportKey(r.key)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${reportKey === r.key ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card hover:bg-accent'}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* بازه تاریخ */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40"><JalaliDateInput value={from} onChange={setFrom} /></div>
            <span className="text-xs text-muted-foreground pb-3">تا</span>
            <div className="w-40"><JalaliDateInput value={to} onChange={setTo} /></div>
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {PRESETS.map(p => (
                <Button key={p.label} variant="outline" size="sm" className="h-9 text-[11px]"
                  onClick={() => {
                    if (p.days === null) { setFrom('1300/01/01'); setTo(todayJalali()) }
                    else { setFrom(addJalaliDays(todayJalali(), -p.days)); setTo(todayJalali()) }
                  }}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <ReportBody key={`${reportKey}-${from}-${to}`} reportKey={reportKey} from={from} to={to} />
    </div>
  )
}

function ReportBody({ reportKey, from, to }: { reportKey: ReportKey; from: string; to: string }) {
  const d = useDataBundle()
  const printRef = useRef<HTMLDivElement>(null)
  const period = useMemo(() => ({ key: `${from}-${to}`, jy: 0, jm: 0, start: from, end: to, label: `${from} تا ${to}`, rangeLabel: `${prettyJalali(from)} تا ${prettyJalali(to)}` }), [from, to])
  const meta = REPORTS.find(r => r.key === reportKey)!

  const build = (): { title: string; header: string[]; rows: (string | number)[][]; footer?: string } => {
    const inP = (date: string) => date >= from && date <= to
    switch (reportKey) {
      case 'production': {
        const prods = active(d.productions).filter(p => inP(p.date))
        const rows = active(d.breadTypes)
          .map(bt => {
            const rs = prods.filter(p => p.breadTypeId === bt.id)
            const boxes = rs.reduce((a, p) => a + (p.boxesCount || 0), 0)
            const produced = rs.reduce((a, p) => a + (p.totalProduced || 0), 0)
            const waste = rs.reduce((a, p) => a + (p.waste || 0), 0)
            const rate = produced > 0 ? Math.round((waste / produced) * 1000) / 10 : 0
            return [bt.name, boxes, produced, waste, `${faDigits(rate)}٪`]
          })
          .filter(r => Number(r[1]) > 0 || Number(r[3]) > 0)
        const totalBoxes = prods.reduce((a, p) => a + (p.boxesCount || 0), 0)
        const totalProd = prods.reduce((a, p) => a + (p.totalProduced || 0), 0)
        const totalWaste = prods.reduce((a, p) => a + (p.waste || 0), 0)
        return {
          title: 'تولید و ضایعات',
          header: ['نوع نان', 'جعبه', 'تولید (نان)', 'ضایعات', 'نرخ ضایعات'],
          rows,
          footer: `جمع: ${faDigits(totalBoxes)} جعبه • ${faDigits(totalProd)} نان • ضایعات ${faDigits(totalWaste)}`,
        }
      }
      case 'sales': {
        const rows = active(d.sales).filter(s => inP(s.date)).sort((a, b) => a.date.localeCompare(b.date)).map(s => {
          const c = d.customers.find(x => x.id === s.customerId)
          const items = parseItems(s)
          const itemsDesc = items.map(it => `${it.kind === 'GOOD' ? d.goods.find(g => g.id === it.breadTypeId)?.name || 'کالا' : d.breadTypes.find(b => b.id === it.breadTypeId)?.name || '?'}×${it.delivered || it.qty}`).join(' + ')
          return [prettyJalali(s.date), c?.name || 'نامشخص', itemsDesc, s.invoiceNumber ? faDigits(s.invoiceNumber) : '—', s.totalAmount || 0, s.paidAmount || 0, saleDue(s), effectiveSettled(s) === 'PAID' ? 'تسویه' : effectiveSettled(s) === 'PARTIAL' ? 'جزئی' : 'پرداخت‌نشده']
        })
        const totalAmount = active(d.sales).filter(s => inP(s.date)).reduce((a, s) => a + (s.totalAmount || 0), 0)
        return {
          title: 'فروش‌ها',
          header: ['تاریخ', 'مشتری', 'اقلام', 'فاکتور', 'مبلغ', 'پرداختی', 'مانده', 'وضعیت'],
          rows,
          footer: `جمع فروش دوره: ${faDigits(totalAmount)} تومان`,
        }
      }
      case 'purchases': {
        const rows = active(d.purchases).filter(p => inP(p.date)).sort((a, b) => a.date.localeCompare(b.date)).map(p => {
          const nm = p.itemKind === 'GOOD' ? d.goods.find(g => g.id === p.materialId)?.name || 'کالا' : d.materials.find(m => m.id === p.materialId)?.name || 'نامشخص'
          const sup = d.suppliers.find(s => s.id === p.supplierId)?.name || ''
          return [prettyJalali(p.date), nm, p.quantity, `${faDigits(p.cost)}`, sup, p.paidAmount || 0, Math.max(0, (p.cost || 0) - (p.paidAmount || 0))]
        })
        const total = active(d.purchases).filter(p => inP(p.date)).reduce((a, p) => a + (p.cost || 0), 0)
        return {
          title: 'خریدها',
          header: ['تاریخ', 'قلم', 'مقدار', 'بها (تومان)', 'تامین‌کننده', 'پرداختی', 'مانده'],
          rows,
          footer: `جمع خرید دوره: ${faDigits(total)} تومان`,
        }
      }
      case 'expenses': {
        const rows = active(d.expenses).filter(e => inP(e.date)).sort((a, b) => a.date.localeCompare(b.date)).map(e => {
          const cat = d.expenseCategories.find(c => c.id === e.categoryId)
          return [prettyJalali(e.date), cat?.name || 'نامشخص', e.description || '', e.amount || 0, (cat?.includeInProfit ?? 1) === 1 ? 'مشمول' : 'غیرمشمول']
        })
        const total = active(d.expenses).filter(e => inP(e.date)).reduce((a, e) => a + (e.amount || 0), 0)
        return {
          title: 'هزینه‌ها',
          header: ['تاریخ', 'سرفصل', 'شرح', 'مبلغ (تومان)', 'سود'],
          rows,
          footer: `جمع هزینه دوره: ${faDigits(total)} تومان`,
        }
      }
      case 'profit': {
        const rep = periodReport(d, period)
        const rows: (string | number)[][] = [
          ['فروش نان و کالا', rep.salesAmount],
          ['بهای مواد مصرفی', -rep.materialCost],
          ['بهای کالای فروش‌رفته', -rep.goodsCost],
          ['سود ناخالص', rep.profitGross],
          ...rep.expensesIncluded.map(e => [`هزینه: ${e.name}`, -e.amount] as (string | number)[]),
          ['سود خالص نهایی', rep.profitNet],
          ['وصول‌شده در دوره', rep.collected],
          ['مانده مطالبات کل', rep.outstandingTotal],
        ]
        return {
          title: 'سود و زیان دوره',
          header: ['شرح', 'مبلغ (تومان)'],
          rows,
          footer: rep.profitNet >= 0 ? `سود خالص دوره: ${faDigits(rep.profitNet)} تومان` : `زیان دوره: ${faDigits(Math.abs(rep.profitNet))} تومان`,
        }
      }
      case 'boxes': {
        const rows = active(d.boxes).filter(b => inP(b.date)).sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code)).map(b => {
          const bt = d.breadTypes.find(x => x.id === b.breadTypeId)?.name || '?'
          const st = d.sales.some(s => parseItems(s).some(it => it.boxId === b.id)) ? 'فروخته‌شده' : 'در انبار'
          return [b.code, prettyJalali(b.date), bt, b.count, b.hasEssence ? `اسانس${b.essenceType ? ` ${b.essenceType}` : ''}` : '—', st]
        })
        return {
          title: 'کدهای جعبه',
          header: ['کد جعبه', 'تاریخ', 'نوع نان', 'تعداد', 'اسانس', 'وضعیت'],
          rows,
          footer: `جمع: ${faDigits(rows.length)} جعبه در این بازه`,
        }
      }
      case 'customers': {
        const buyers = buyerStats(d)
        const rows = buyers.map(b => [b.customer.name, b.customer.phone || '—', b.salesCount, b.qty, b.amount, b.due, b.avgSettleDays != null ? `${faDigits(Math.round(b.avgSettleDays))} روز` : '—'])
        return {
          title: 'مشتریان',
          header: ['مشتری', 'تلفن', 'فاکتورها', 'تعداد نان', 'مجموع خرید', 'مانده', 'میانگین تسویه'],
          rows,
          footer: `تعداد مشتریان فعال: ${faDigits(rows.length)}`,
        }
      }
    }
  }

  const data = build()
  const isEmpty = data.rows.length === 0

  const exportExcel = () => {
    exportRowsToExcel(
      `Waffly-${meta.label}-${from.replace(/\//g, '-')}_${to.replace(/\//g, '-')}.xlsx`,
      meta.label,
      data.header,
      data.rows,
    )
    toast({ title: 'اکسل گزارش دانلود شد' })
  }

  const exportPdf = async () => {
    if (!printRef.current) return
    try {
      toast({ title: 'در حال ساخت PDF…' })
      await exportElementToPdf(printRef.current, `Waffly-${meta.label}-${from.replace(/\//g, '-')}_${to.replace(/\//g, '-')}.pdf`)
      toast({ title: 'PDF گزارش دانلود شد' })
    } catch {
      toast({ title: 'ساخت PDF ناموفق بود', description: 'از دکمه چاپ مرورگر استفاده کنید.', variant: 'destructive' })
    }
  }

  return (
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Search className="h-4 w-4" /> {meta.label} — {prettyJalali(from)} تا {prettyJalali(to)}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={exportExcel} disabled={isEmpty}>
              <FileSpreadsheet className="ml-1 h-3.5 w-3.5" /> اکسل
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => void exportPdf()} disabled={isEmpty}>
              <FileText className="ml-1 h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => window.print()} disabled={isEmpty}>
              <Printer className="ml-1 h-3.5 w-3.5" /> چاپ
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            title="داده‌ای در این بازه نیست"
            desc={`برای گزارش «${meta.label}» در بازه انتخابی رکوردی یافت نشد — بازه دیگری را امتحان کنید.`}
            icon={<ClipboardList className="h-5 w-5" />}
          />
        ) : (
          <>
            <div ref={printRef} className="rounded-xl border overflow-x-auto">
              {/* سربرگ چاپ */}
              <div className="hidden print:block px-4 pt-4 pb-1 text-center border-b">
                <p className="font-bold text-sm">{d.setting.businessName || 'Waffly'} — گزارش {meta.label}</p>
                <p className="text-[10px] text-muted-foreground waffly-num">{prettyJalali(from)} تا {prettyJalali(to)} — تهیه‌شده در {prettyJalali(todayJalali())}</p>
              </div>
              <table className="w-full text-xs rtl:text-right">
                <thead>
                  <tr className="bg-muted/60">
                    {data.header.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-right font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((r, ri) => (
                    <tr key={ri} className="hover:bg-muted/30">
                      {r.map((c, ci) => {
                        const isMoney = typeof c === 'number' && (data.header[ci]?.includes('مبلغ') || data.header[ci]?.includes('بها') || data.header[ci]?.includes('مجموع') || data.header[ci]?.includes('مانده') || data.header[ci]?.includes('پرداختی') || data.header[ci]?.includes('خرید') || (typeof r[0] === 'string' && ['فروش نان و کالا', 'بهای مواد مصرفی', 'بهای کالای فروش‌رفته', 'سود ناخالص', 'سود خالص نهایی', 'وصول‌شده در دوره', 'مانده مطالبات کل'].includes(String(r[0]))))
                        return (
                          <td key={ci} className={`px-3 py-1.5 waffly-num whitespace-nowrap ${isMoney ? (typeof c === 'number' && c < 0 ? 'text-rose-600' : 'font-medium') : ''}`}>
                            {isMoney && typeof c === 'number' ? faMoney(c) : typeof c === 'number' ? faDigits(c) : c}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.footer && (
                <p className="px-3 py-2 text-[11px] font-bold bg-muted/40 border-t waffly-num">{data.footer}</p>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {faDigits(data.rows.length)} ردیف — خروجی اکسل/PDF همان جدول است؛ برای گزارش «سود و زیان» اعداد منفی به رنگ سرخ نشان‌دهنده کسر از فروش است.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
