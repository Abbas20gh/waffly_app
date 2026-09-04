'use client'

// حسابداری کل — گزارش دوره‌ای با روز شروع قابل‌تنظیم + خروجی اکسل/PDF
import { useMemo, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  Calculator, ChevronRight, ChevronLeft, FileSpreadsheet, FileText, Printer,
  TrendingUp, TrendingDown, Wallet, Scale, Plus, Trash2, PiggyBank, Pencil, Landmark, ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, StatCard, EmptyState, Money, Num, FormRow, TabsBar, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useDataBundle } from '@/lib/hooks'
import { periodOf, shiftPeriod, faDigits, faMoney, prettyJalali, todayJalali } from '@/lib/jalali'
import { periodReport, otherFundsTotals, active, effectivePaymentDate, type ProfitMode } from '@/lib/calc'
import { putRecord, removeRecord, uid, getActiveUser, useTable } from '@/lib/localdb'
import type { OtherFund, Account, Sale, Purchase, Expense, Customer, Material, Good } from '@/lib/types'
import { exportRowsToExcel, exportElementToPdf } from '@/lib/export'
import { cn } from '@/lib/utils'

export function AccountingView() {
  const d = useDataBundle()
  const [sec, setSec] = useState<'report' | 'accounts'>('report')
  const accounts = useTable<Account>('accounts')
  const { confirm, element: confirmDialog } = useConfirm()
  const [offset, setOffset] = useState(0)
  const reportRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<ProfitMode>('net')
  const [fundOpen, setFundOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<OtherFund | null>(null)
  const [fundForm, setFundForm] = useState({ date: todayJalali(), type: 'IN' as OtherFund['type'], amount: '', description: '', accountId: '' })

  const openNewFund = () => {
    setEditingFund(null)
    setFundForm({ date: todayJalali(), type: 'IN', amount: '', description: '', accountId: '' })
    setFundOpen(true)
  }
  const openEditFund = (f: OtherFund) => {
    setEditingFund(f)
    setFundForm({ date: f.date, type: f.type, amount: f.amount ? String(f.amount) : '', description: f.description || '', accountId: f.accountId || '' })
    setFundOpen(true)
  }

  const basePeriod = periodOf(todayJalali(), d.setting.monthStartDay)
  const period = useMemo(() => shiftPeriod(basePeriod, offset, d.setting.monthStartDay), [basePeriod, offset, d.setting.monthStartDay])
  const rep = useMemo(() => periodReport(d, period), [d, period])
  const funds = useMemo(() => otherFundsTotals(d, period), [d, period])
  const fundsList = useMemo(() => d.otherFunds.filter(f => !f.deleted && f.date >= period.start && f.date <= period.end).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)), [d.otherFunds, period])

  const saveFund = async () => {
    const amount = parseFloat(fundForm.amount || '0')
    if (amount <= 0) { toast({ title: 'مبلغ را وارد کنید', variant: 'destructive' }); return }
    if (!fundForm.description.trim()) { toast({ title: 'توضیح منشأ پول الزامی است', variant: 'destructive' }); return }
    await putRecord<OtherFund>('otherFunds', {
      ...(editingFund || {}),
      id: editingFund ? editingFund.id : uid(),
      updatedAt: editingFund ? editingFund.updatedAt : 0,
      date: fundForm.date,
      type: fundForm.type,
      amount,
      description: fundForm.description.trim(),
      accountId: fundForm.accountId || null,
      deleted: 0,
    })
    setFundForm(f => ({ ...f, amount: '', description: '' }))
    setFundOpen(false)
    setEditingFund(null)
    toast({
      title: editingFund ? 'سایر وجه ویرایش شد' : 'سایر وجه ثبت شد',
      description: 'خارج از حساب سود ثبت شد و در سودآوری محاسبه نمی‌شود.',
    })
  }

  const modeInfo = {
    gross: { label: 'ناخالص', desc: 'فروش − مواد − بهای کالا', value: rep.profitGross },
    beforeOverhead: { label: 'پیش از سربار', desc: 'فروش − مواد − بهای کالا (بدون سایر هزینه‌ها)', value: rep.profitGross },
    net: { label: 'خالص نهایی', desc: 'فروش − مواد − بهای کالا − هزینه‌های مشمول سود', value: rep.profitNet },
  } as const

  const exportExcel = () => {
    try {
      exportRowsToExcel(`waffly-report-${period.key}.xlsx`, `گزارش ${period.label}`,
        ['شرح', 'مقدار/مبلغ', 'توضیح'],
        [
          ['دوره گزارش', period.rangeLabel, ''],
          ['فروش کل (تومان)', rep.salesAmount, `${faDigits(rep.salesQty)} نان${rep.goodsQty ? ` + ${faDigits(Math.round(rep.goodsQty * 100) / 100)} جعبه کالا` : ''}`],
          ['وصول‌شده در دوره', rep.collected, ''],
          ['مانده مطالبات (کل)', rep.outstandingTotal, ''],
          ['هزینه مواد دوره', rep.materialCost, 'مصرف × میانگین قیمت خرید'],
          ['بهای کالای فروش‌رفته', rep.goodsCost, 'تعداد فروش‌رفته × میانگین قیمت خرید'],
          ['سود ناخالص', rep.profitGross, 'فروش − مواد − بهای کالا'],
          ['هزینه‌های مشمول سود', rep.expensesTotalIncluded, rep.expensesIncluded.map(e => `${e.name}: ${e.amount}`).join('، ') || '—'],
          ['سود خالص نهایی', rep.profitNet, 'فروش − مواد − بهای کالا − هزینه‌های مشمول'],
          ['سایر وجوه ورودی دوره (خارج از سود)', funds.incoming, ''],
          ['سایر وجوه خروجی دوره (خارج از سود)', funds.outgoing, ''],
          ['سایر وجوه (خالص)', funds.net, 'خارج از محاسبه سود'],
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

      <TabsBar<'report' | 'accounts'>
        value={sec}
        onChange={setSec}
        tabs={[
          { key: 'report', label: 'گزارش دوره' },
          { key: 'accounts', label: 'حساب‌ها (بانک و صندوق)' },
        ]}
      />

      {sec === 'accounts' ? (
        <AccountsTab />
      ) : (
      <>

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
          <StatCard title="فروش کل دوره" value={faMoney(rep.salesAmount)} sub={`${faDigits(rep.salesQty)} نان${rep.goodsQty ? ` + ${faDigits(Math.round(rep.goodsQty * 100) / 100)} جعبه کالا` : ''}`} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="وصول‌شده دوره" value={faMoney(rep.collected)} tone="positive" />
          <StatCard title="هزینه مواد دوره" value={faMoney(rep.materialCost)} tone="warning" sub="مصرف × میانگین قیمت خرید" />
          <StatCard
            title={`سود ${modeInfo[mode].label}`}
            value={faMoney(modeInfo[mode].value)}
            tone={modeInfo[mode].value >= 0 ? 'positive' : 'negative'}
            sub={modeInfo[mode].desc}
            icon={modeInfo[mode].value >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
          {rep.goodsCost > 0 && (
            <StatCard title="بهای کالای فروش‌رفته" value={faMoney(rep.goodsCost)} tone="warning" sub="فروش کالا × میانگین قیمت خرید (مثل نان مشعلی)" />
          )}
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

        {/* سایر وجوه — خارج از حساب سود */}
        <Card className="waffly-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> سایر وجوه (خارج از حساب سود)</span>
              <Button size="sm" variant="outline" className="h-8 text-[11px] no-print" onClick={openNewFund}>
                <Plus className="ml-1 h-3.5 w-3.5" /> ثبت سایر وجه
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-5">
              مثل فروش جنس قدیم یا موجودی اولیه — فقط ثبت و نمایش داده می‌شود و در هیچ‌کدام از فرمول‌های سود دیده نمی‌شود.
            </p>
            {fundsList.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-center">در این دوره موردی ثبت نشده است.</p>
            ) : (
              <div className="space-y-1.5">
                {fundsList.map(f => (
                  <div key={f.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                      f.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {f.type === 'IN' ? 'ورود' : 'خروج'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.description}</p>
                      <p className="text-[10px] text-muted-foreground waffly-num">{prettyJalali(f.date)}</p>
                    </div>
                    <Money value={f.amount} className={cn('text-sm font-bold', f.type === 'IN' ? 'text-green-700' : 'text-red-700')} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground no-print" aria-label="ویرایش"
                      onClick={() => openEditFund(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600 no-print" aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'otherFunds', f.id, 'حذف سایر وجه', `آیا از حذف «${f.description}» (${faMoney(f.amount)} تومان) مطمئن هستید؟`)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex-1 min-w-28 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">جمع ورود</p>
                <p className="text-sm font-bold text-green-700 waffly-num">{faMoney(funds.incoming)}</p>
              </div>
              <div className="flex-1 min-w-28 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">جمع خروج</p>
                <p className="text-sm font-bold text-red-700 waffly-num">{faMoney(funds.outgoing)}</p>
              </div>
              <div className="flex-1 min-w-28 rounded-lg bg-muted/60 border px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">خالص (خارج از سود)</p>
                <p className="text-sm font-bold waffly-num">{faMoney(funds.net)}</p>
              </div>
            </div>
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

      {/* دیالوگ ثبت سایر وجه */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFund ? 'ویرایش سایر وجه' : 'ثبت سایر وجه (خارج از حساب سود)'}</DialogTitle>
            <DialogDescription>این مبلغ فقط ثبت و نمایش داده می‌شود؛ در سود و زیان تولید محاسبه نمی‌شود.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="نوع">
                <InlinePicker
                  value={fundForm.type}
                  options={[
                    { value: 'IN', label: 'ورود پول' },
                    { value: 'OUT', label: 'خروج پول' },
                  ]}
                  onChange={v => setFundForm(f => ({ ...f, type: v as OtherFund['type'] }))}
                />
              </FormRow>
              <FormRow label="مبلغ (تومان)">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={fundForm.amount} onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} />
              </FormRow>
            </div>
            <FormRow label="تاریخ">
              <JalaliDateInput value={fundForm.date} onChange={v => setFundForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="حساب" hint={fundForm.type === 'IN' ? 'پول به این حساب اضافه می‌شود' : 'پول از این حساب کم می‌شود'}>
              <InlinePicker
                value={fundForm.accountId}
                options={[{ value: '', label: 'بدون حساب' }, ...accounts.filter(a => !a.deleted).map(a => ({ value: a.id, label: a.name, hint: a.kind === 'BANK' ? 'حساب بانکی' : 'صندوق نقدی' }))]}
                onChange={v => setFundForm(f => ({ ...f, accountId: v }))}
                placeholder="انتخاب حساب (اختیاری)"
              />
            </FormRow>
            <FormRow label="توضیح منشأ/مقصد (الزامی)" hint="مثلاً: فروش جنس قدیم انبار، موجودی اولیه صندوق">
              <Input value={fundForm.description} onChange={e => setFundForm(f => ({ ...f, description: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFundOpen(false); setEditingFund(null) }}>انصراف</Button>
            <Button onClick={saveFund}>{editingFund ? 'ذخیره تغییرات' : 'ثبت'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
      {confirmDialog}
    </div>
  )
}

// ================= حساب‌ها (بانک و صندوق) — v2.7 =================
// موجودی هر حساب = موجودی اولیه + واریزی فروش‌ها + سایر وجوه ورود − پرداخت خریدها − هزینه‌ها − سایر وجوه خروج
interface LedgerRow { key: string; date: string; dir: 'IN' | 'OUT'; amount: number; desc: string; src: string }

function AccountsTab() {
  const accounts = useTable<Account>('accounts')
  const sales = useTable<Sale>('sales')
  const purchases = useTable<Purchase>('purchases')
  const expenses = useTable<Expense>('expenses')
  const otherFunds = useTable<OtherFund>('otherFunds')
  const customers = useTable<Customer>('customers')
  const materials = useTable<Material>('materials')
  const goods = useTable<Good>('goods')
  const { confirm, element: confirmDialog } = useConfirm()

  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({ name: '', kind: 'BANK' as Account['kind'], initialBalance: '', note: '' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const openNew = () => { setEditing(null); setForm({ name: '', kind: 'BANK', initialBalance: '', note: '' }); setDlgOpen(true) }
  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ name: a.name, kind: a.kind, initialBalance: a.initialBalance ? String(a.initialBalance) : '', note: a.note || '' })
    setDlgOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام حساب را وارد کنید', variant: 'destructive' }); return }
    await putRecord<Account>('accounts', {
      ...(editing || {}),
      id: editing ? editing.id : uid(),
      updatedAt: editing ? editing.updatedAt : 0,
      name: form.name.trim(),
      kind: form.kind,
      initialBalance: parseFloat(form.initialBalance || '0') || 0,
      note: form.note || null,
      active: 1,
      deleted: 0,
    })
    toast({ title: editing ? 'حساب ویرایش شد' : 'حساب اضافه شد', description: form.name.trim() })
    setDlgOpen(false)
    setEditing(null)
  }

  const itemName = (p: Purchase) =>
    p.itemKind === 'GOOD'
      ? (goods.find(g => g.id === p.materialId)?.name || 'کالا')
      : (materials.find(m => m.id === p.materialId)?.name || 'ماده')

  /** دفتر گردش حساب — از رکوردهای سینک‌شده مشتق می‌شود (بدون جدول موازی) */
  const ledgerOf = (accId: string): LedgerRow[] => {
    const rows: LedgerRow[] = []
    for (const s of active(sales)) {
      if (s.accountId !== accId || (s.paidAmount || 0) <= 0) continue
      rows.push({
        key: `s-${s.id}`, date: effectivePaymentDate(s) || s.date, dir: 'IN', amount: s.paidAmount,
        desc: `فروش — ${customers.find(c => c.id === s.customerId)?.name || 'نامشخص'}`,
        src: 'فروش',
      })
    }
    for (const p of active(purchases)) {
      if (p.accountId !== accId || (p.paidAmount || 0) <= 0) continue
      rows.push({
        key: `p-${p.id}`, date: p.date, dir: 'OUT', amount: p.paidAmount,
        desc: `خرید — ${itemName(p)}`, src: 'خرید',
      })
    }
    for (const e of active(expenses)) {
      if (e.accountId !== accId || (e.amount || 0) <= 0) continue
      rows.push({ key: `e-${e.id}`, date: e.date, dir: 'OUT', amount: e.amount, desc: e.description || 'هزینه', src: 'هزینه' })
    }
    for (const f of active(otherFunds)) {
      if (f.accountId !== accId || (f.amount || 0) <= 0) continue
      rows.push({ key: `f-${f.id}`, date: f.date, dir: f.type === 'IN' ? 'IN' : 'OUT', amount: f.amount, desc: f.description, src: 'سایر وجه' })
    }
    return rows.sort((a, b) => (b.date + b.key).localeCompare(a.date + a.key))
  }

  const statsOf = (accId: string, initial: number) => {
    const rows = ledgerOf(accId)
    const inc = rows.filter(r => r.dir === 'IN').reduce((a, r) => a + r.amount, 0)
    const out = rows.filter(r => r.dir === 'OUT').reduce((a, r) => a + r.amount, 0)
    return { rows, inc, out, balance: initial + inc - out }
  }

  const list = active(accounts).sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  const totalBalance = list.reduce((a, acc) => a + statsOf(acc.id, acc.initialBalance || 0).balance, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground leading-5 max-w-xl">
          حساب‌های بانکی و صندوق نقدی‌تان را وارد کنید؛ در فرم فروش «واریز به حساب» و در فرم خرید «پرداخت از حساب» را انتخاب کنید
          تا گردش پول و موجودی همین‌جا خودکار محاسبه شود.
        </p>
        <Button onClick={openNew} className="h-11 shrink-0"><Plus className="ml-1 h-4 w-4" /> حساب جدید</Button>
      </div>

      {list.length > 0 && (
        <Card className="waffly-card">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">مجموع موجودی همه حساب‌ها</p>
              <p className={cn('text-xl font-bold waffly-num mt-0.5', totalBalance < 0 ? 'text-red-600' : 'text-green-700')}>{faMoney(totalBalance)} <span className="text-[11px] font-normal text-muted-foreground">تومان</span></p>
            </div>
            <Wallet className="h-8 w-8 text-muted-foreground/40" />
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <Card className="waffly-card">
          <CardContent>
            <EmptyState
              title="حسابی ثبت نشده"
              desc="مثلاً «بانک ملت» یا «صندوق نقدی» بسازید و موجودی اولیه‌اش را وارد کنید."
              icon={<Landmark className="h-5 w-5" />}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {list.map(acc => {
            const st = statsOf(acc.id, acc.initialBalance || 0)
            const isOpen = expanded === acc.id
            return (
              <Card key={acc.id} className="waffly-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                      acc.kind === 'BANK' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200')}>
                      {acc.kind === 'BANK' ? <Landmark className="h-4.5 w-4.5" /> : <Wallet className="h-4.5 w-4.5" />}
                    </span>
                    <span className="font-bold">{acc.name}</span>
                    <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{acc.kind === 'BANK' ? 'حساب بانکی' : 'صندوق نقدی'}</span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="ویرایش حساب" onClick={() => openEdit(acc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" aria-label="حذف حساب"
                      onClick={() => void confirmRemove(confirm, 'accounts', acc.id, 'حذف حساب', `آیا از حذف حساب «${acc.name}» مطمئن هستید؟ فروش‌ها و خریدهای قبلی حفظ می‌شوند ولی دیگر به این حساب وصل نیستند.`)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground">موجودی فعلی</p>
                      <p className={cn('text-xl font-bold waffly-num', st.balance < 0 ? 'text-red-600' : 'text-green-700')}>
                        {faMoney(st.balance)} <span className="text-[11px] font-normal text-muted-foreground">تومان</span>
                      </p>
                    </div>
                    <div className="text-left text-[11px] waffly-num space-y-0.5">
                      <p className="text-green-700">ورود: +{faMoney(st.inc)}</p>
                      <p className="text-red-700">خروج: −{faMoney(st.out)}</p>
                      {acc.initialBalance > 0 && <p className="text-muted-foreground">موجودی اولیه: {faMoney(acc.initialBalance)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-2">
                    <p className="text-[10px] text-muted-foreground">{faDigits(st.rows.length)} گردش ثبت‌شده</p>
                    <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setExpanded(isOpen ? null : acc.id)}>
                      گردش‌ها <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 max-h-64 overflow-y-auto thin-scroll border-t pt-2">
                      {st.rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">گردشی ثبت نشده — در فرم فروش/خرید این حساب را انتخاب کنید.</p>
                      ) : st.rows.map(r => (
                        <div key={r.key} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                            r.dir === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                            {r.dir === 'IN' ? 'واریز' : 'برداشت'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{r.desc}</p>
                            <p className="text-[10px] text-muted-foreground waffly-num">{prettyJalali(r.date)} • {r.src}</p>
                          </div>
                          <span className={cn('font-bold waffly-num shrink-0', r.dir === 'IN' ? 'text-green-700' : 'text-red-700')}>
                            {r.dir === 'IN' ? '+' : '−'}{faMoney(r.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* دیالوگ ساخت/ویرایش حساب */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `ویرایش حساب: ${editing.name}` : 'حساب جدید'}</DialogTitle>
            <DialogDescription>حساب بانکی یا صندوق نقدی — گردش پول و موجودی خودکار محاسبه می‌شود.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نام حساب" hint="مثلاً: بانک ملت، کارت به کارت، صندوق نقدی">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
            </FormRow>
            <FormRow label="نوع حساب">
              <InlinePicker
                value={form.kind}
                options={[{ value: 'BANK', label: 'حساب بانکی' }, { value: 'CASH', label: 'صندوق نقدی' }]}
                onChange={v => setForm(f => ({ ...f, kind: v as Account['kind'] }))}
              />
            </FormRow>
            <FormRow label="موجودی اولیه (تومان)" hint="مبلغی که همین حالا در این حساب دارید">
              <Input inputMode="decimal" className="waffly-num-input h-11" value={form.initialBalance} onChange={e => setForm(f => ({ ...f, initialBalance: e.target.value }))} />
            </FormRow>
            <FormRow label="یادداشت (اختیاری)">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>انصراف</Button>
            <Button onClick={save}>{editing ? 'ذخیره تغییرات' : 'افزودن حساب'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}
