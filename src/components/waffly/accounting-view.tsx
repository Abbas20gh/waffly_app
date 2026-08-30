'use client'

// حسابداری کل — گزارش دوره‌ای با روز شروع قابل‌تنظیم + خروجی اکسل/PDF
import { useMemo, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  Calculator, ChevronRight, ChevronLeft, FileSpreadsheet, FileText, Printer,
  TrendingUp, TrendingDown, Wallet, Scale,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, StatCard, EmptyState, Money, Num } from './bits'
import { useDataBundle } from '@/lib/hooks'
import { periodOf, shiftPeriod, faDigits, faMoney, prettyJalali, todayJalali } from '@/lib/jalali'
import { periodReport, type ProfitMode } from '@/lib/calc'
import { exportRowsToExcel, exportElementToPdf } from '@/lib/export'
import { cn } from '@/lib/utils'

export function AccountingView() {
  const d = useDataBundle()
  const [offset, setOffset] = useState(0)
  const reportRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<ProfitMode>('net')

  const basePeriod = periodOf(todayJalali(), d.setting.monthStartDay)
  const period = useMemo(() => shiftPeriod(basePeriod, offset, d.setting.monthStartDay), [basePeriod, offset, d.setting.monthStartDay])
  const rep = useMemo(() => periodReport(d, period), [d, period])

  const modeInfo = {
    gross: { label: 'ناخالص', desc: 'فروش − هزینه مواد', value: rep.profitGross },
    beforeOverhead: { label: 'پیش از سربار', desc: 'فروش − هزینه مواد (بدون سایر هزینه‌ها)', value: rep.profitGross },
    net: { label: 'خالص نهایی', desc: 'فروش − مواد − هزینه‌های مشمول سود', value: rep.profitNet },
  } as const

  const exportExcel = () => {
    try {
      exportRowsToExcel(`waffly-report-${period.key}.xlsx`, `گزارش ${period.label}`,
        ['شرح', 'مقدار/مبلغ', 'توضیح'],
        [
          ['دوره گزارش', period.rangeLabel, ''],
          ['فروش کل (تومان)', rep.salesAmount, `${faDigits(rep.salesQty)} نان`],
          ['وصول‌شده در دوره', rep.collected, ''],
          ['مانده مطالبات (کل)', rep.outstandingTotal, ''],
          ['هزینه مواد دوره', rep.materialCost, 'مصرف × میانگین قیمت خرید'],
          ['سود ناخالص', rep.profitGross, 'فروش − مواد'],
          ['هزینه‌های مشمول سود', rep.expensesTotalIncluded, rep.expensesIncluded.map(e => `${e.name}: ${e.amount}`).join('، ') || '—'],
          ['سود خالص نهایی', rep.profitNet, 'فروش − مواد − هزینه‌های مشمول'],
          ['خرید مواد دوره', rep.purchasesTotal, `پرداخت‌نشده: ${rep.purchasesDue}`],
          [],
          ['— جزئیات خریداران —', '', ''],
          ...rep.buyers.map((b, i) => [
            `${faDigits(i + 1)}. ${b.customer.name}`,
            b.amount,
            `بدهی: ${b.due}${b.avgSettleDays != null ? ` • تسویه: ${Math.round(b.avgSettleDays)} روز` : ''}`,
          ]),
          [],
          ['— تولید دوره —', '', ''],
          ...rep.productionTotals.filter(p => p.produced > 0).map(p => [
            p.breadType.name, p.produced, `${p.boxes} جعبه • ضایعات: ${p.waste}`,
          ]),
        ])
      toast({ title: 'اکسل ذخیره شد' })
    } catch { toast({ title: 'خطا در ساخت اکسل', variant: 'destructive' }) }
  }

  const exportPdf = async () => {
    if (!reportRef.current) return
    toast({ title: 'در حال ساخت PDF…' })
    try {
      await exportElementToPdf(reportRef.current, `waffly-report-${period.key}.pdf`)
      toast({ title: 'PDF ذخیره شد' })
    } catch { toast({ title: 'خطا در ساخت PDF', variant: 'destructive' }) }
  }

  return (
    <div>
      <PageHeader
        title="حسابداری کل"
        subtitle={`گزارش دوره «${period.rangeLabel}» — روز شروع دوره در تنظیمات قابل تغییر است`}
        icon={<Calculator className="h-5 w-5" />}
        actions={
          <div className="flex gap-1.5 no-print">
            <Button variant="outline" size="icon" className="h-10 w-10" aria-label="دوره قبل" onClick={() => setOffset(o => o - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-10 text-xs waffly-num" onClick={() => setOffset(0)}>
              {period.label}
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10" aria-label="دوره بعد" disabled={offset >= 0} onClick={() => setOffset(o => o + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* دکمه‌های خروجی */}
      <div className="flex flex-wrap gap-2 mb-4 no-print">
        <Button variant="outline" className="h-10" onClick={exportExcel}><FileSpreadsheet className="ml-1 h-4 w-4" /> اکسل</Button>
        <Button variant="outline" className="h-10" onClick={() => void exportPdf()}><FileText className="ml-1 h-4 w-4" /> PDF</Button>
        <Button variant="outline" className="h-10" onClick={() => window.print()}><Printer className="ml-1 h-4 w-4" /> چاپ</Button>
      </div>

      {/* ===== گزارش قابل چاپ ===== */}
      <div ref={reportRef} className="space-y-4">
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-bold">{d.setting.businessName || 'Waffly'} — گزارش حسابداری دوره</p>
          <p className="text-xs text-muted-foreground waffly-num mt-1">{period.rangeLabel}</p>
        </div>

        {/* KPIها */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="فروش کل دوره" value={faMoney(rep.salesAmount)} sub={`${faDigits(rep.salesQty)} نان`} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="وصول‌شده دوره" value={faMoney(rep.collected)} tone="positive" />
          <StatCard title="هزینه مواد دوره" value={faMoney(rep.materialCost)} tone="warning" sub="مصرف × میانگین قیمت خرید" />
          <StatCard
            title={`سود ${modeInfo[mode].label}`}
            value={faMoney(modeInfo[mode].value)}
            tone={modeInfo[mode].value >= 0 ? 'positive' : 'negative'}
            sub={modeInfo[mode].desc}
            icon={modeInfo[mode].value >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
        </div>

        {/* انتخاب مبنا */}
        <Card className="waffly-card no-print">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">مبنای سود:</span>
            {(['gross', 'beforeOverhead', 'net'] as ProfitMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium border min-h-9',
                  mode === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground')}
              >
                {{ gross: 'ناخالص', beforeOverhead: 'پیش از سربار', net: 'خالص نهایی' }[m]}
              </button>
            ))}
            <span className="text-[11px] text-muted-foreground mr-auto">{modeInfo[mode].desc}</span>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* خریداران */}
          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">خریداران دوره (رتبه بر اساس مبلغ خرید)</CardTitle>
            </CardHeader>
            <CardContent>
              {rep.buyers.length === 0 ? (
                <EmptyState title="خریدی در این دوره ثبت نشده" />
              ) : (
                <div className="space-y-1.5">
                  {rep.buyers.map((b, i) => (
                    <div key={b.customer.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                      <span className={cn('h-6 w-6 rounded-full text-[11px] flex items-center justify-center font-bold shrink-0 waffly-num',
                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground')}>
                        {faDigits(i + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{b.customer.name}</p>
                        <p className="text-[11px] text-muted-foreground waffly-num">
                          <Num value={b.qty} /> نان • {faDigits(b.salesCount)} فاکتور
                          {b.avgSettleDays != null && ` • تسویه ~${faDigits(Math.round(b.avgSettleDays))} روزه`}
                        </p>
                      </div>
                      {b.due > 0.5 && <span className="text-[11px] text-red-600 font-bold waffly-num">بدهی: {faMoney(b.due)}</span>}
                      <Money value={b.amount} className="text-sm font-bold" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* هزینه‌ها */}
          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">هزینه‌های دوره</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rep.expensesTotalAll === 0 ? (
                <EmptyState title="هزینه‌ای ثبت نشده" desc="هزینه‌ها (دستمزد، حمل‌ونقل و…) را از بخش تنظیمات سرفصل‌بندی کنید." />
              ) : (
                <>
                  {rep.expensesIncluded.map(e => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{e.name}</span>
                      <Money value={e.amount} className="font-bold" />
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <span>جمع هزینه‌های مشمول سود</span>
                    <Money value={rep.expensesTotalIncluded} className="font-bold" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> جمع کل هزینه‌ها (شامل غیرمشمول مانند برداشت شخصی)</span>
                    <Money value={rep.expensesTotalAll} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* تولید دوره */}
          <Card className="waffly-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">تولید دوره</CardTitle></CardHeader>
            <CardContent>
              {rep.productionTotals.every(p => p.produced === 0) ? (
                <EmptyState title="تولیدی در این دوره ثبت نشده" />
              ) : (
                <div className="space-y-1.5">
                  {rep.productionTotals.filter(p => p.produced > 0).map(p => (
                    <div key={p.breadType.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-medium">{p.breadType.name}</span>
                      <span className="text-[11px] text-muted-foreground waffly-num">
                        {faDigits(p.produced)} نان • {faDigits(p.boxes)} جعبه • ضایعات: {faDigits(p.waste)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* چک‌ها و بدهی‌ها */}
          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">چک‌ها و بدهی‌های جاری</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rep.checks.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5">چک‌های پرداخت‌نشده</p>
                  <div className="space-y-1">
                    {rep.checks.slice(0, 6).map(({ sale, customer, status }, i) => (
                      <div key={sale.id + i} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px]">
                        <span className="font-medium">{customer?.name || 'نامشخص'}</span>
                        <span className={cn('waffly-num', status === 'PAST_DUE' ? 'text-red-600' : status === 'NEAR' ? 'text-amber-600' : 'text-muted-foreground')}>
                          سررسید {sale.checkDueDate ? prettyJalali(sale.checkDueDate) : '—'} • {faMoney(sale.totalAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {rep.badDebts.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1.5">بدحسابان (بیش از {faDigits(d.setting.badDebtDays)} روز)</p>
                  <div className="space-y-1">
                    {rep.badDebts.slice(0, 6).map(({ sale, customer, days }, i) => (
                      <div key={sale.id + i} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-[11px]">
                        <span className="font-medium">{customer?.name || 'نامشخص'}</span>
                        <span className="text-red-700 waffly-num">{faDigits(days)} روز • {faMoney(sale.totalAmount - sale.paidAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {rep.checks.length === 0 && rep.badDebts.length === 0 && (
                <p className="text-xs text-muted-foreground">چک باز یا بدحسابی وجود ندارد ✓</p>
              )}
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                <span>خرید مواد دوره (پرداخت‌نشده: {faMoney(rep.purchasesDue)})</span>
                <Money value={rep.purchasesTotal} className="font-bold" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                <span>مانده کل مطالبات از مشتریان</span>
                <Money value={rep.outstandingTotal} className="font-bold" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
