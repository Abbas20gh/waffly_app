'use client'

// داشبورد — کارت‌های میان‌بر، نمودارها، هشدارها
import { useMemo, useSyncExternalStore } from 'react'
import {
  Wheat, ShoppingCart, ShoppingBasket, Wrench, Calculator,
  AlertTriangle, CheckCircle2, TrendingUp, Users, ReceiptText, PiggyBank,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, LineChart, Line, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, EmptyState } from './bits'
import { useDataBundle } from '@/lib/hooks'
import { todayJalali, faDigits, faMoney, faMoneyShort, J_MONTHS, lastPeriods, periodOf } from '@/lib/jalali'
import { materialStocks, periodReport, buyerStats, isBadDebt, saleDue, active, daysSince, otherFundsTotals, type DataBundle } from '@/lib/calc'
import type { ViewKey } from './app-shell'
import { useSetting } from '@/lib/localdb'
import { cn } from '@/lib/utils'

const MODULES: { key: ViewKey; title: string; desc: string; icon: typeof Wheat }[] = [
  { key: 'production', title: 'تولید', desc: 'ثبت تولید روزانه، جعبه‌ها و مصرف مواد', icon: Wheat },
  { key: 'sales', title: 'فروش', desc: 'ثبت فروش، تسویه مشتریان و چک‌ها', icon: ShoppingCart },
  { key: 'purchases', title: 'خرید مواد', desc: 'تامین‌کنندگان، موجودی انبار', icon: ShoppingBasket },
  { key: 'machines', title: 'دستگاه‌سازی', desc: 'تجهیزات نانوایی و دستگاه‌سازی', icon: Wrench },
  { key: 'accounting', title: 'حسابداری کل', desc: 'گزارش دوره‌ای سود و زیان', icon: Calculator },
]

const emptySubscribe = () => () => {}

export function DashboardView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const d = useDataBundle()
  const setting = d.setting
  // تشخیص mount برای نمودارها (بدون effect)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const todayStr = todayJalali()
  const curPeriod = useMemo(() => periodOf(todayStr, setting.monthStartDay), [todayStr, setting.monthStartDay])
  const periods = useMemo(() => lastPeriods(todayStr, 6, setting.monthStartDay), [todayStr, setting.monthStartDay])
  const report = useMemo(() => periodReport(d, curPeriod), [d, curPeriod])
  const funds = useMemo(() => otherFundsTotals(d), [d])

  // نمودارها
  const salesChart = periods.map(p => {
    const r = periodReport(d, p)
    return { name: J_MONTHS[p.jm - 1], فروش: Math.round(r.salesAmount / 1e6 * 10) / 10, 'میلیون تومان': Math.round(r.salesAmount) }
  })
  const profitChart = periods.map(p => {
    const r = periodReport(d, p)
    return { name: J_MONTHS[p.jm - 1], 'سود ناخالص': Math.round(r.profitGross) }
  })
  const topBuyers = useMemo(() =>
    buyerStats(d).slice(0, 5).map(b => ({ name: b.customer.name, 'خرید': Math.round(b.amount) })),
    [d])

  // هشدارها
  const lowStock = materialStocks(d).filter(s => s.low)
  const badDebtors = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; days: number }>()
    for (const s of active(d.sales)) {
      if (!isBadDebt(s, setting.badDebtDays)) continue
      const c = d.customers.find(x => x.id === s.customerId)
      const key = s.customerId
      const prev = map.get(key)
      map.set(key, {
        name: c?.name || 'نامشخص',
        amount: (prev?.amount || 0) + saleDue(s),
        days: Math.max(prev?.days || 0, daysSince(s.date)),
      })
    }
    return [...map.values()].sort((a, b) => b.days - a.days)
  }, [d, setting.badDebtDays])

  const nearChecks = report.checks.filter(c => c.status !== 'FUTURE')

  return (
    <div className="space-y-5">
      {/* خوش‌آمد */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">سلام! خوش آمدید به {setting.businessName || 'Waffly'} 👋</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 waffly-num">
            امروز: {todayStr} — دوره جاری: {curPeriod.rangeLabel}
          </p>
        </div>
      </div>

      {/* کارت‌های میان‌بر ماژول‌ها */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {MODULES.map(m => (
          <button
            key={m.key}
            onClick={() => onNavigate(m.key)}
            className="group text-right rounded-2xl border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all min-h-28"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <m.icon className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm mt-2.5">{m.title}</p>
            <p className="text-[11px] text-muted-foreground leading-4 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* شاخص‌های دوره جاری */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title={`فروش ${curPeriod.label}`} value={faMoney(report.salesAmount)} sub={`${faDigits(report.salesQty)} نان فروخته‌شده`} icon={<ReceiptText className="h-4 w-4" />} />
        <StatCard title="وصول‌شده در دوره" value={faMoney(report.collected)} tone="positive" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="مانده مطالبات (کل)" value={faMoney(report.outstandingTotal)} tone={report.outstandingTotal > 0 ? 'warning' : 'default'} icon={<Users className="h-4 w-4" />} />
        <StatCard
          title={`سود ناخالص دوره`}
          value={faMoney(report.profitGross)}
          tone={report.profitGross >= 0 ? 'positive' : 'negative'}
          sub={`پس از کسر مواد: ${faMoneyShort(report.materialCost)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* سایر وجوه — خارج از حساب سود */}
      <button type="button" onClick={() => onNavigate('accounting')} className="block w-full text-right">
        <div className={cn('rounded-2xl border p-3.5 flex flex-wrap items-center gap-3',
          funds.net >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200')}>
          <div className="h-9 w-9 rounded-xl bg-white border shadow-sm flex items-center justify-center shrink-0">
            <PiggyBank className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">سایر وجوه (خارج از حساب سود)</p>
            <p className="text-[10px] text-muted-foreground waffly-num">ورود {faMoneyShort(funds.incoming)} • خروج {faMoneyShort(funds.outgoing)} — در سود محاسبه نمی‌شود</p>
          </div>
          <p className={cn('text-base font-black waffly-num', funds.net >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{faMoney(funds.net)} <span className="text-[10px] font-normal">تومان</span></p>
        </div>
      </button>

      {/* نمودارها */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="waffly-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">روند فروش ۶ دوره اخیر (میلیون تومان)</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {mounted && salesChart.some(x => x['میلیون تومان'] > 0) ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={salesChart} margin={{ top: 5, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <RTooltip formatter={(v: number | string) => [`${faDigits(typeof v === 'number' ? v.toLocaleString('en') : v)} تومان`, 'فروش']} />
                  <Bar dataKey="میلیون تومان" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="هنوز فروشی ثبت نشده" desc="از بخش فروش، اولین فروش را ثبت کنید تا نمودار نمایش داده شود." icon={<ShoppingCart className="h-5 w-5" />} />
            )}
          </CardContent>
        </Card>

        <Card className="waffly-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">روند سود ناخالص ۶ دوره اخیر</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {mounted && profitChart.some(x => x['سود ناخالص'] !== 0) ? (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={profitChart} margin={{ top: 5, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v: number) => faMoneyShort(v)} />
                  <RTooltip formatter={(v: number | string) => [`${faDigits(typeof v === 'number' ? Math.round(v).toLocaleString('en') : v)} تومان`, 'سود ناخالص']} />
                  <Line type="monotone" dataKey="سود ناخالص" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--chart-1)' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="داده کافی نیست" desc="برای محاسبه سود، ثبت تولید/مصرف مواد و فروش لازم است." icon={<TrendingUp className="h-5 w-5" />} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="waffly-card">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">خیرترین خریداران (مجموع خرید)</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {mounted && topBuyers.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(150, topBuyers.length * 44)}>
              <BarChart data={topBuyers} layout="vertical" margin={{ top: 0, left: 8, right: 16, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                <RTooltip formatter={(v: number | string) => [`${faDigits(typeof v === 'number' ? Math.round(v).toLocaleString('en') : v)} تومان`, 'خرید']} />
                <Bar dataKey="خرید" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {topBuyers.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? 'var(--chart-1)' : i === 1 ? 'var(--chart-2)' : 'var(--chart-3)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="هنوز خریداری ثبت نشده" icon={<Users className="h-5 w-5" />} />
          )}
        </CardContent>
      </Card>

      {/* هشدارها */}
      <Card className="waffly-card border-amber-200/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            هشدارهای فعال
            <span className="text-[11px] font-normal text-muted-foreground">
              ({faDigits(lowStock.length + badDebtors.length + nearChecks.length)} مورد)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 && badDebtors.length === 0 && nearChecks.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              همه‌چیز مرتب است — هشداری وجود ندارد.
            </p>
          ) : (
            <div className="space-y-4">
              {lowStock.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1.5">مواد اولیه رو به اتمام (زیر حد بحرانی)</p>
                  <div className="flex flex-wrap gap-2">
                    {lowStock.map(s => (
                      <span key={s.material.id} className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 text-[11px] waffly-num">
                        {s.material.name}: {faDigits(Math.round(s.stock * 100) / 100)} {s.material.unit} (حد: {faDigits(s.material.minStock)})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {badDebtors.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1.5">بدهکاران سرسخت (بیش از {faDigits(setting.badDebtDays)} روز)</p>
                  <div className="space-y-1.5">
                    {badDebtors.slice(0, 5).map(b => (
                      <div key={b.name} className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px]">
                        <span className="font-medium">{b.name}</span>
                        <span className="text-red-700 waffly-num">{faMoney(b.amount)} تومان • {faDigits(b.days)} روز</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {nearChecks.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1.5">چک‌های سررسید گذشته یا نزدیک</p>
                  <div className="space-y-1.5">
                    {nearChecks.slice(0, 5).map(({ sale, customer, status }, i) => (
                      <div key={sale.id + i} className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px]">
                        <span className="font-medium">{customer?.name || 'نامشخص'}</span>
                        <span className={cn('waffly-num', status === 'PAST_DUE' ? 'text-red-700' : 'text-amber-700')}>
                          {faMoney(sale.totalAmount)} تومان • سررسید {sale.checkDueDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
