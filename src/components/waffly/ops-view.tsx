'use client'

// ===== خرید و هزینهٔ عملیاتی (v3.4.0) =====
// خریدهای روزمرهٔ کارگاه که مواد اولیه نیستند (صبحانه، میوه، لیوان و…)،
// دستگاه/دارایی، و حقوق و دستمزد — همه با کرایهٔ حملِ اختیاری در همان فرم.
// ماندهٔ پرداخت‌نشدهٔ هر ردیف خودکار در دفتر حساب به‌عنوان بدهی به همان
// فروشنده/گیرنده نمایش داده می‌شود تا حساب‌ها همخوان بمانند.
// پولِ پرداخت‌شده (paidAmount از حساب انتخاب‌شده) در گردش حساب‌های بخش حسابداری لحاظ می‌شود.
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  ShoppingBag, Plus, Pencil, Trash2, Coffee, Wrench, Wallet, Car,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, EmptyState, TabsBar, FormRow, StatCard, SettleBadge, Money, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, useSetting, putRecord, uid, getActiveUser } from '@/lib/localdb'
import { requireUserName } from '@/lib/user-gate'
import type { OpsExpense, Account } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali, periodOf } from '@/lib/jalali'
import { active } from '@/lib/calc'
import { opsDue } from '@/lib/settlement'
import { cn } from '@/lib/utils'

type Tab = 'daily' | 'asset' | 'staff'
type Kind = OpsExpense['kind']

const TAB_KINDS: Record<Tab, Kind[]> = {
  daily: ['DAILY'],
  asset: ['ASSET'],
  staff: ['SALARY', 'WAGE'],
}

const KIND_META: Record<Kind, { label: string; icon: typeof Coffee }> = {
  DAILY: { label: 'خرید روزمره', icon: Coffee },
  ASSET: { label: 'دستگاه/دارایی', icon: Wrench },
  SALARY: { label: 'حقوق', icon: Wallet },
  WAGE: { label: 'دستمزد', icon: Car },
}

const toNum = (v: string): number => {
  const x = parseFloat(v)
  return Number.isFinite(x) ? x : 0
}

export function OpsView() {
  const [tab, setTab] = useState<Tab>('daily')
  return (
    <div>
      <PageHeader
        title="خرید و هزینه"
        subtitle="خریدهای روزمرهٔ کارگاه، کرایه، دستگاه و حقوق و دستمزد — خارج از مواد اولیه"
        icon={<ShoppingBag className="h-5 w-5" />}
      />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'daily', label: 'روزمره و کرایه' },
          { key: 'asset', label: 'دستگاه و دارایی' },
          { key: 'staff', label: 'حقوق و دستمزد' },
        ]}
      />
      <OpsList tab={tab} />
    </div>
  )
}

function OpsList({ tab }: { tab: Tab }) {
  const ops = useTable<OpsExpense>('opsExpenses')
  const accounts = useTable<Account>('accounts')
  const setting = useSetting()
  const { confirm, element: confirmDialog } = useConfirm()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OpsExpense | null>(null)
  const [saving, setSaving] = useState(false)
  const kinds = TAB_KINDS[tab]
  const isStaff = tab === 'staff'
  const isAsset = tab === 'asset'

  const [form, setForm] = useState({
    date: todayJalali(),
    kind: (isStaff ? 'SALARY' : isAsset ? 'ASSET' : 'DAILY') as Kind,
    title: '',
    person: '',
    qty: '',
    unitPrice: '',
    rentAmount: '',
    totalAmount: '',
    settledStatus: 'PAID' as OpsExpense['settledStatus'],
    paidAmount: '',
    method: 'CASH' as OpsExpense['method'],
    accountId: '',
    note: '',
  })

  const openNew = () => {
    setEditing(null)
    setForm(f => ({
      date: todayJalali(),
      kind: (isStaff ? 'SALARY' : isAsset ? 'ASSET' : 'DAILY') as Kind,
      title: '', person: '', qty: '', unitPrice: '', rentAmount: '',
      totalAmount: '', settledStatus: 'PAID', paidAmount: '', method: 'CASH', accountId: '', note: '',
    }))
    setOpen(true)
  }
  const openEdit = (o: OpsExpense) => {
    setEditing(o)
    setForm({
      date: o.date,
      kind: o.kind,
      title: o.title || '',
      person: o.person || '',
      qty: o.qty != null && o.qty > 0 ? String(o.qty) : '',
      unitPrice: o.unitPrice != null && o.unitPrice > 0 ? String(o.unitPrice) : '',
      rentAmount: o.rentAmount != null && o.rentAmount > 0 ? String(o.rentAmount) : '',
      totalAmount: o.totalAmount ? String(o.totalAmount) : '',
      settledStatus: o.settledStatus,
      paidAmount: o.settledStatus === 'PARTIAL' ? String(o.paidAmount || '') : '',
      method: o.method || 'CASH',
      accountId: o.accountId || '',
      note: o.note || '',
    })
    setOpen(true)
  }

  const computedBase = toNum(form.qty || '') * toNum(form.unitPrice || '') + toNum(form.rentAmount || '')
  const computedTotal = computedBase > 0 ? computedBase : toNum(form.totalAmount || '')

  // تغییر تعداد/قیمت/کرایه → جمع کل خودکار پر می‌شود (بعداً قابل دستکاری)
  const autoTotal = (patch: Partial<typeof form>) => {
    const qty = patch.qty ?? form.qty ?? ''
    const unit = patch.unitPrice ?? form.unitPrice ?? ''
    const rent = patch.rentAmount ?? form.rentAmount ?? ''
    const base = toNum(qty) * toNum(unit) + toNum(rent)
    return base > 0 ? { totalAmount: String(base) } : {}
  }

  const save = async () => {
    if (!form.title.trim()) { toast({ title: isStaff ? 'عنوان را وارد کنید (مثلاً: حقوق آبان — علی)' : 'چه خریدید؟ عنوان را وارد کنید', variant: 'destructive' }); return }
    const total = computedTotal
    if (total <= 0) { toast({ title: 'مبلغ را وارد کنید', variant: 'destructive' }); return }
    const paid = form.settledStatus === 'PAID' ? total : form.settledStatus === 'UNPAID' ? 0 : toNum(form.paidAmount || '')
    const status: OpsExpense['settledStatus'] = form.settledStatus === 'PAID' || paid >= total - 0.5
      ? 'PAID'
      : paid > 0.5 ? 'PARTIAL' : 'UNPAID'
    if (saving) return
    setSaving(true)
    try {
      await putRecord<OpsExpense>('opsExpenses', {
        ...(editing || {}),
        id: editing ? editing.id : uid(),
        updatedAt: editing ? editing.updatedAt : 0,
        date: form.date,
        kind: form.kind,
        title: form.title.trim(),
        person: form.person.trim() || null,
        qty: toNum(form.qty || '') > 0 ? toNum(form.qty || '') : null,
        unitPrice: toNum(form.unitPrice || '') > 0 ? toNum(form.unitPrice || '') : null,
        rentAmount: toNum(form.rentAmount || '') > 0 ? toNum(form.rentAmount || '') : null,
        totalAmount: total,
        settledStatus: status,
        paidAmount: Math.min(paid, total),
        method: status === 'UNPAID' ? null : (form.method || 'CASH'),
        accountId: form.accountId || null,
        note: form.note.trim() || null,
        createdBy: editing?.createdBy ?? (getActiveUser() || null),
        deleted: 0,
      })
      toast({
        title: editing ? 'ویرایش شد' : 'ثبت شد',
        description: status !== 'PAID'
          ? `${faMoney(total - paid)} تومان مانده — به‌عنوان بدهی در دفتر حساب (نام: ${form.person.trim() || form.title.trim()}) ثبت می‌شود.`
          : `${faMoney(total)} تومان`,
      })
      setOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const rows = useMemo(() =>
    active(ops)
      .filter(o => kinds.includes(o.kind))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0)),
  [ops, kinds])

  // آمار دورهٔ جاری (طبق روز شروع دورهٔ حسابداری)
  const period = useMemo(() => periodOf(todayJalali(), setting.monthStartDay), [setting.monthStartDay])
  const stats = useMemo(() => {
    const thisPeriod = rows.filter(o => o.date >= period.start && o.date <= period.end)
    return {
      periodTotal: thisPeriod.reduce((a, o) => a + (o.totalAmount || 0), 0),
      periodPaid: thisPeriod.reduce((a, o) => a + (o.paidAmount || 0), 0),
      total: rows.reduce((a, o) => a + (o.totalAmount || 0), 0),
      due: rows.reduce((a, o) => a + opsDue(o), 0),
      rentThisPeriod: thisPeriod.reduce((a, o) => a + (o.rentAmount || 0), 0),
      count: rows.length,
    }
  }, [rows, period])

  const accName = (id: string | null | undefined) => accounts.find(a => a.id === id && !a.deleted)?.name

  const titleHint = isStaff
    ? 'مثلاً: «حقوق آبان — علی»، «دستمزد روزانه رضا»'
    : isAsset
      ? 'مثلاً: «موتور برشی»، «ترازوی دیجیتال»'
      : 'مثلاً: «صبحانه»، «میوه»، «لیوان یکبارمصرف»'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground leading-5 max-w-xl">
          {isStaff
            ? 'حقوق ماهانه و دستمزد روزانه کارگران را اینجا ثبت کنید؛ پرداخت‌نشده‌ها در دفتر حساب زیر نام گیرنده بدهی می‌شوند.'
            : isAsset
              ? 'دستگاه و دارایی‌هایی که می‌خرید (کلاً یا اقساطی) — کرایهٔ حمل را هم در همان فرم ثبت کنید.'
              : 'خریدهای روزمرهٔ کارگاه مثل صبحانه، میوه و لیوان — اگر خرید کرایهٔ حمل داشت، در همین فرم ثبت می‌شود تا حساب‌ها همخوان بماند.'}
        </p>
        <Button onClick={openNew} className="h-11 shrink-0">
          <Plus className="ml-1 h-4 w-4" /> {isStaff ? 'ثبت حقوق/دستمزد' : isAsset ? 'ثبت دستگاه/دارایی' : 'ثبت خرید'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title={`جمع ${period.label}`} value={faMoney(stats.periodTotal)} sub={`${faDigits(rows.filter(o => o.date >= period.start && o.date <= period.end).length)} مورد`} />
        <StatCard title="جمع پرداخت‌شدهٔ دوره" value={faMoney(stats.periodPaid)} tone="positive" />
        {isAsset ? (
          <StatCard title="جمع کل دارایی‌ها" value={faMoney(stats.total)} sub="سرمایه‌ای — در سود دوره محاسبه نمی‌شود" tone="warning" />
        ) : (
          <StatCard title="مانده پرداخت‌نشده" value={faMoney(stats.due)} tone={stats.due > 0.5 ? 'negative' : 'default'} sub="در دفتر حساب هم بدهی دیده می‌شود" />
        )}
        {tab === 'daily' && (
          <StatCard title="کرایهٔ حمل دوره" value={faMoney(stats.rentThisPeriod)} sub="جمع کرایه‌های همین دوره" icon={<Car className="h-4 w-4" />} />
        )}
        {tab === 'staff' && (
          <StatCard title="جمع کل (همهٔ زمان‌ها)" value={faMoney(stats.total)} sub={`${faDigits(stats.count)} پرداخت حقوق/دستمزد`} />
        )}
        {tab === 'asset' && (
          <StatCard title="تعداد اقلام" value={faDigits(stats.count)} sub="دستگاه/دارایی ثبت‌شده" />
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="waffly-card">
          <CardContent>
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title={isStaff ? 'حقوق/دستمزدی ثبت نشده' : isAsset ? 'دستگاه/دارایی ثبت نشده' : 'خریدی ثبت نشده'}
              desc="با دکمه بالا اولین مورد را ثبت کنید؛ ماندهٔ پرداخت‌نشده خودکار در دفتر حساب می‌آید."
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="waffly-card">
          <CardContent className="p-3 space-y-2">
            {rows.map(o => {
              const due = opsDue(o)
              const meta = KIND_META[o.kind]
              const Icon = meta.icon
              return (
                <div key={o.id} className="rounded-xl border p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-bold">{o.title}</p>
                    {o.person && <span className="text-[11px] text-muted-foreground">برای/از: {o.person}</span>}
                    <span className="text-[11px] text-muted-foreground waffly-num">{prettyJalali(o.date)}</span>
                    <div className="flex-1" />
                    <SettleBadge status={o.settledStatus} paid={o.paidAmount} total={o.totalAmount} />
                    <Money value={o.totalAmount} className="font-bold text-sm" />
                    <span className="text-[10px] text-muted-foreground">تومان</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش" onClick={() => openEdit(o)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'opsExpenses', o.id, `حذف ${meta.label}`, `آیا از حذف «${o.title}» به مبلغ ${faMoney(o.totalAmount)} تومان مطمئن هستید؟`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground waffly-num flex flex-wrap items-center gap-x-2">
                    {o.qty != null && o.unitPrice != null && <span>{faDigits(o.qty)} × {faMoney(o.unitPrice)}</span>}
                    {o.rentAmount != null && o.rentAmount > 0 && <span className="text-amber-700">کرایه: {faMoney(o.rentAmount)}</span>}
                    {o.method && o.settledStatus !== 'UNPAID' && <span>{o.method === 'CASH' ? 'نقدی' : o.method === 'POS' ? 'کارتخوان' : 'کارت به کارت'}</span>}
                    {accName(o.accountId) && <span>از حساب: {accName(o.accountId)}</span>}
                    {due > 0.5 && <span className="text-red-600 font-bold">مانده: {faMoney(due)}</span>}
                    {o.createdBy && <span>{o.createdBy}</span>}
                    {o.note && <span>{o.note}</span>}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* دیالوگ ثبت/ویرایش */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'ویرایش' : isStaff ? 'ثبت حقوق/دستمزد' : isAsset ? 'ثبت دستگاه/دارایی' : 'ثبت خرید روزمره'}
            </DialogTitle>
            <DialogDescription>
              {isStaff
                ? 'پرداخت حقوق یا دستمزد به کارگر — اگر نسیه بماند، در دفتر حساب بدهی ثبت می‌شود.'
                : 'خرید غیر از مواد اولیه؛ اگر کرایهٔ حمل داشت در فیلد کرایه ثبت کنید (به جمع کل اضافه می‌شود).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            {isStaff ? (
              <FormRow label="نوع">
                <InlinePicker
                  value={form.kind}
                  options={[{ value: 'SALARY', label: 'حقوق (ماهانه)' }, { value: 'WAGE', label: 'دستمزد (روزانه/موردی)' }]}
                  onChange={v => setForm(f => ({ ...f, kind: v as Kind }))}
                />
              </FormRow>
            ) : (
              <FormRow label="نوع" hint={isAsset ? undefined : 'اگر جنسی دستگاه/دارایی است اینجا انتخاب کنید'}>
                <InlinePicker
                  value={form.kind}
                  options={[{ value: 'DAILY', label: 'خرید روزمره' }, { value: 'ASSET', label: 'دستگاه/دارایی' }]}
                  onChange={v => setForm(f => ({ ...f, kind: v as Kind }))}
                />
              </FormRow>
            )}
            <FormRow label={isStaff ? 'عنوان (به کی، برای چه ماهی؟)' : 'چه خریدید؟'} hint={titleHint}>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="h-11"
              />
            </FormRow>
            <FormRow label={isStaff ? 'نام گیرنده (اختیاری)' : 'فروشنده / از کجا خریدید (اختیاری)'}
              hint="این نام در دفتر حساب برای بدهی/گردش استفاده می‌شود — مثلاً «سوپر مارکت صادقی»">
              <Input
                value={form.person}
                onChange={e => setForm(f => ({ ...f, person: e.target.value }))}
                className="h-11"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              {!isStaff && (
                <>
                  <FormRow label="تعداد (اختیاری)">
                    <Input
                      inputMode="decimal" className="waffly-num-input h-11"
                      value={form.qty}
                      onChange={e => setForm(f => ({ ...f, qty: e.target.value, ...autoTotal({ qty: e.target.value }) }))}
                    />
                  </FormRow>
                  <FormRow label="قیمت هر واحد (تومان)">
                    <Input
                      inputMode="decimal" className="waffly-num-input h-11"
                      value={form.unitPrice}
                      onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value, ...autoTotal({ unitPrice: e.target.value }) }))}
                    />
                  </FormRow>
                </>
              )}
              <FormRow label="کرایهٔ حمل (تومان)" hint="اگر این خرید کرایه داشت — به جمع کل اضافه می‌شود">
                <Input
                  inputMode="decimal" className="waffly-num-input h-11"
                  value={form.rentAmount}
                  onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value, ...autoTotal({ rentAmount: e.target.value }) }))}
                />
              </FormRow>
            </div>
            {computedBase <= 0 && (
              <FormRow label="مبلغ کل (تومان)">
                <Input
                  inputMode="decimal" className="waffly-num-input h-11"
                  value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                />
              </FormRow>
            )}
            {computedBase > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-muted/60 border px-3 py-2">
                <span className="text-xs text-muted-foreground">جمع کل (تعداد × قیمت + کرایه)</span>
                <span className="text-sm font-bold waffly-num">{faMoney(computedBase)} تومان</span>
              </div>
            )}
            <FormRow label="تاریخ">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <div className="grid sm:grid-cols-2 gap-3">
              <FormRow label="وضعیت تسویه">
                <InlinePicker
                  value={form.settledStatus}
                  options={[
                    { value: 'PAID', label: 'پرداخت‌شده کامل' },
                    { value: 'PARTIAL', label: 'پرداخت جزئی' },
                    { value: 'UNPAID', label: 'پرداخت‌نشده (نسیه)' },
                  ]}
                  onChange={v => setForm(f => ({ ...f, settledStatus: v as OpsExpense['settledStatus'] }))}
                />
              </FormRow>
              {form.settledStatus === 'PARTIAL' && (
                <FormRow label="مبلغ پرداخت‌شده (تومان)">
                  <Input
                    inputMode="decimal" className="waffly-num-input h-11"
                    value={form.paidAmount}
                    onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
                  />
                </FormRow>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <FormRow label="روش پرداخت" hint={form.settledStatus === 'UNPAID' ? 'با وضعیت پرداخت‌نشده ثبت نمی‌شود' : undefined}>
                <InlinePicker
                  value={form.method || ''}
                  options={[
                    { value: 'CASH', label: 'نقدی' },
                    { value: 'CARD', label: 'کارت به کارت' },
                    { value: 'POS', label: 'کارتخوان' },
                  ]}
                  onChange={v => setForm(f => ({ ...f, method: (v || null) as OpsExpense['method'] }))}
                  disabled={form.settledStatus === 'UNPAID'}
                  placeholder="تسویه نشده"
                />
              </FormRow>
              <FormRow label="پرداخت از حساب" hint="پول از این حساب/صندوق کم می‌شود (بخش حسابداری ← حساب‌ها)">
                <InlinePicker
                  value={form.accountId}
                  options={[{ value: '', label: 'بدون حساب (نقدی دستی)' }, ...active(accounts).map(a => ({ value: a.id, label: a.name, hint: a.kind === 'BANK' ? 'حساب بانکی' : 'صندوق نقدی' }))]}
                  onChange={v => setForm(f => ({ ...f, accountId: v }))}
                  placeholder="انتخاب حساب (اختیاری)"
                />
              </FormRow>
            </div>
            <FormRow label="یادداشت (اختیاری)">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button onClick={() => requireUserName(() => { void save() })} disabled={saving}>
              {saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}
