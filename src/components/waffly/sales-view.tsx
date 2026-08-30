'use client'

// فروش — ثبت فروش چندقلمی، تسویه (کامل/جزئی)، چک، مشتریان، بدحساب‌ها
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  ShoppingCart, Plus, Trash2, Users, Landmark, AlertOctagon, Check, Wallet, Phone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader, FormRow, TabsBar, EmptyState, SettleBadge, Money, Num } from './bits'
import { JalaliDateInput } from './jalali-date'
import { useTable, useSetting, putRecord, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { Sale, Customer, BreadType, SaleItem } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, saleDue, effectiveSettled, isBadDebt, daysSince, effectivePaymentDate } from '@/lib/calc'
import { cn } from '@/lib/utils'

type Tab = 'sales' | 'customers' | 'checks' | 'debts'

const PAY_METHODS = [
  { key: 'CASH', label: 'نقدی' },
  { key: 'CARD', label: 'کارت به کارت' },
  { key: 'TRANSFER', label: 'حواله بانکی' },
  { key: 'CHECK', label: 'چک' },
] as const

export function SalesView() {
  const [tab, setTab] = useState<Tab>('sales')
  return (
    <div>
      <PageHeader title="فروش" subtitle="ثبت فروش، تسویه مشتریان، چک‌ها و پیگیری بدهی" icon={<ShoppingCart className="h-5 w-5" />} />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'sales', label: 'فروش‌ها' },
          { key: 'customers', label: 'مشتریان' },
          { key: 'checks', label: 'چک‌ها' },
          { key: 'debts', label: 'بدحساب‌ها' },
        ]}
      />
      {tab === 'sales' && <SalesTab />}
      {tab === 'customers' && <CustomersTab />}
      {tab === 'checks' && <ChecksTab />}
      {tab === 'debts' && <DebtsTab />}
    </div>
  )
}

// ================= فرم/لیست فروش‌ها =================
function SalesTab() {
  const sales = useTable<Sale>('sales')
  const customers = useTable<Customer>('customers')
  const breadTypes = useTable<BreadType>('breadTypes')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'checks'>('all')

  const emptyItem: SaleItem = { breadTypeId: '', qty: 0, unitPrice: 0, delivered: 0, returned: 0, returnCost: 0 }
  const [form, setForm] = useState({
    date: todayJalali(),
    customerId: '',
    items: [{ ...emptyItem } as SaleItem],
    settledStatus: 'UNPAID' as Sale['settledStatus'],
    paidAmount: '',
    paymentMethod: 'CASH' as Sale['paymentMethod'],
    checkDueDate: '',
    checkNumber: '',
    checkBank: '',
    paymentDate: '',
    note: '',
  })

  const itemsTotal = form.items.reduce((a, it) => a + (it.qty || 0) * (it.unitPrice || 0), 0)
  const returnTotal = form.items.reduce((a, it) => a + (it.returnCost || 0), 0)
  const grandTotal = Math.max(0, itemsTotal - returnTotal)

  const openNew = () => {
    setForm({
      date: todayJalali(),
      customerId: '',
      items: [{ ...emptyItem }],
      settledStatus: 'UNPAID',
      paidAmount: '',
      paymentMethod: 'CASH',
      checkDueDate: '',
      checkNumber: '',
      checkBank: '',
      paymentDate: '',
      note: '',
    })
    setOpen(true)
  }

  const updateItem = (idx: number, patch: Partial<SaleItem>) => {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
      return { ...f, items }
    })
  }

  const save = async () => {
    if (!form.customerId) { toast({ title: 'مشتری را انتخاب کنید', variant: 'destructive' }); return }
    const items = form.items.filter(it => it.breadTypeId && (it.qty > 0 || it.delivered > 0))
    if (items.length === 0) { toast({ title: 'حداقل یک قلم کالا اضافه کنید', variant: 'destructive' }); return }
    const paid = form.settledStatus === 'PAID' ? grandTotal : parseFloat(form.paidAmount || '0')
    const status: Sale['settledStatus'] = form.settledStatus === 'PAID' || paid >= grandTotal - 0.5
      ? 'PAID'
      : paid > 0.5 ? 'PARTIAL' : 'UNPAID'
    await putRecord<Sale>('sales', {
      id: uid(),
      date: form.date,
      customerId: form.customerId,
      items: JSON.stringify(items),
      totalAmount: grandTotal,
      settledStatus: status,
      paidAmount: Math.min(paid, grandTotal),
      paymentMethod: form.paymentMethod,
      checkDueDate: form.paymentMethod === 'CHECK' ? (form.checkDueDate || null) : null,
      checkNumber: form.paymentMethod === 'CHECK' ? (form.checkNumber || null) : null,
      checkBank: form.paymentMethod === 'CHECK' ? (form.checkBank || null) : null,
      paymentDate: status === 'PAID' ? (form.paymentDate || null) : (form.paymentDate || null),
      note: form.note || null,
      createdBy: getActiveUser() || null,
      updatedAt: 0,
      deleted: 0,
    })
    toast({ title: 'فروش ثبت شد', description: `${faMoney(grandTotal)} تومان` })
    setOpen(false)
  }

  const quickSettle = async (s: Sale) => {
    await putRecord<Sale>('sales', { ...s, settledStatus: 'PAID', paidAmount: s.totalAmount, paymentDate: s.paymentDate || todayJalali() })
    toast({ title: 'تسویه شد', description: `${faMoney(saleDue(s))} تومان` })
  }

  const list = [...sales]
    .filter(s => !s.deleted)
    .filter(s => filter === 'all' || (filter === 'unpaid' ? effectiveSettled(s) !== 'PAID' : s.paymentMethod === 'CHECK'))
    .sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt))
    .slice(0, 60)
  const cName = (id: string) => customers.find(c => c.id === id)?.name || 'نامشخص'
  const btLabel = (id: string) => {
    const b = breadTypes.find(x => x.id === id)
    return b ? b.name : 'کالا'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {([['all', 'همه'], ['unpaid', 'تسویه‌نشده'], ['checks', 'چکی']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium border min-h-9',
                filter === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={openNew} className="h-11"><Plus className="ml-1 h-4 w-4" /> فروش جدید</Button>
      </div>

      <Card className="waffly-card">
        <CardContent className="p-3">
          {list.length === 0 ? (
            <EmptyState title="فروشی یافت نشد" desc="با دکمه «فروش جدید» اولین فروش را ثبت کنید." icon={<ShoppingCart className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {list.map(s => {
                const items = (() => { try { return JSON.parse(s.items || '[]') as SaleItem[] } catch { return [] } })()
                const st = effectiveSettled(s)
                return (
                  <div key={s.id} className="rounded-xl border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{cName(s.customerId)}</p>
                      <span className="text-[11px] text-muted-foreground waffly-num">{prettyJalali(s.date)}</span>
                      <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{PAY_METHODS.find(p => p.key === s.paymentMethod)?.label}</span>
                      {s.paymentMethod === 'CHECK' && s.checkDueDate && (
                        <span className="text-[10px] rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 waffly-num">چک: {prettyJalali(s.checkDueDate)}</span>
                      )}
                      <div className="flex-1" />
                      <SettleBadge status={st} paid={s.paidAmount} total={s.totalAmount} />
                      <Money value={s.totalAmount} className="font-bold text-sm" />
                      <span className="text-[10px] text-muted-foreground">تومان</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground waffly-num">
                      {items.map((it, i) => `${btLabel(it.breadTypeId)} × ${faDigits(it.delivered || it.qty)}`).join(' • ')}
                      {s.paymentDate && ` • وصول: ${prettyJalali(s.paymentDate)}`}
                      {s.createdBy && ` • ${s.createdBy}`}
                    </p>
                    {st !== 'PAID' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => void quickSettle(s)}>
                          <Check className="h-3.5 w-3.5" /> تسویه کامل
                        </Button>
                        <span className="text-[11px] text-red-600 waffly-num">مانده: {faMoney(saleDue(s))}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SaleFormDialog
        open={open} onOpenChange={setOpen}
        form={form} setForm={setForm}
        customers={active(customers)} breadTypes={active(breadTypes)}
        itemsTotal={itemsTotal} returnTotal={returnTotal} grandTotal={grandTotal}
        onSave={save}
        onQuickAddCustomer={async (name) => {
          const id = uid()
          await putRecord<Customer>('customers', { id, name, phone: null, address: null, cooperationType: null, updatedAt: 0, deleted: 0 })
          setForm(f => ({ ...f, customerId: id }))
          toast({ title: 'مشتری اضافه شد', description: name })
        }}
      />
    </div>
  )
}

function SaleFormDialog({ open, onOpenChange, form, setForm, customers, breadTypes, itemsTotal, returnTotal, grandTotal, onSave, onQuickAddCustomer }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: {
    date: string; customerId: string; items: SaleItem[]
    settledStatus: Sale['settledStatus']; paidAmount: string
    paymentMethod: Sale['paymentMethod']; checkDueDate: string; checkNumber: string; checkBank: string
    paymentDate: string; note: string
  }
  setForm: React.Dispatch<React.SetStateAction<{
    date: string; customerId: string; items: SaleItem[]
    settledStatus: Sale['settledStatus']; paidAmount: string
    paymentMethod: Sale['paymentMethod']; checkDueDate: string; checkNumber: string; checkBank: string
    paymentDate: string; note: string
  }>>
  customers: Customer[]
  breadTypes: BreadType[]
  itemsTotal: number
  returnTotal: number
  grandTotal: number
  onSave: () => void
  onQuickAddCustomer: (name: string) => void
}) {
  const [newCustomer, setNewCustomer] = useState('')
  const updateItem = (idx: number, patch: Partial<SaleItem>) => {
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت فروش</DialogTitle>
          <DialogDescription>اقلام را انتخاب کنید، قیمت هر نان را وارد کنید؛ جمع خودکار حساب می‌شود.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="تاریخ فروش">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="مشتری">
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="انتخاب مشتری" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
          </div>
          <div className="flex gap-2">
            <Input
              value={newCustomer}
              onChange={e => setNewCustomer(e.target.value)}
              placeholder="نام مشتری جدید…"
              className="h-10"
            />
            <Button
              type="button" variant="outline" className="h-10 shrink-0"
              disabled={!newCustomer.trim()}
              onClick={() => { onQuickAddCustomer(newCustomer.trim()); setNewCustomer('') }}
            >
              <Plus className="h-4 w-4" /> افزودن
            </Button>
          </div>

          {/* اقلام */}
          <div className="space-y-2">
            <p className="text-sm font-medium">اقلام فروش</p>
            {form.items.map((it, idx) => (
              <div key={idx} className="rounded-xl border p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Select value={it.breadTypeId} onValueChange={v => updateItem(idx, { breadTypeId: v })}>
                    <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="کالا" /></SelectTrigger>
                    <SelectContent>
                      {breadTypes.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input inputMode="decimal" className="waffly-num-input h-10 text-xs" placeholder="تعداد" value={it.qty || ''} onChange={e => updateItem(idx, { qty: parseFloat(e.target.value) || 0, delivered: parseFloat(e.target.value) || 0 })} />
                  <Input inputMode="decimal" className="waffly-num-input h-10 text-xs" placeholder="قیمت هر نان" value={it.unitPrice || ''} onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} />
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-600" aria-label="حذف قلم"
                    onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>تحویل واقعی</span>
                    <Input inputMode="decimal" className="waffly-num-input h-9 text-xs" value={it.delivered || ''} onChange={e => updateItem(idx, { delivered: parseFloat(e.target.value) || 0 })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>برگشتی/خراب</span>
                    <Input inputMode="decimal" className="waffly-num-input h-9 text-xs" value={it.returned || ''} onChange={e => updateItem(idx, { returned: parseFloat(e.target.value) || 0 })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>هزینه برگشتی (تومان)</span>
                    <Input inputMode="decimal" className="waffly-num-input h-9 text-xs" value={it.returnCost || ''} onChange={e => updateItem(idx, { returnCost: parseFloat(e.target.value) || 0 })} />
                  </label>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full h-10" onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...form.items[0], breadTypeId: '', qty: 0, unitPrice: 0, delivered: 0, returned: 0, returnCost: 0 }] }))}>
              <Plus className="h-4 w-4" /> افزودن قلم
            </Button>
          </div>

          {/* جمع */}
          <div className="rounded-xl bg-muted/60 border p-3 space-y-1 text-xs waffly-num">
            <div className="flex justify-between"><span>جمع اقلام</span><span>{faMoney(itemsTotal)}</span></div>
            {returnTotal > 0 && <div className="flex justify-between text-red-600"><span>هزینه برگشتی</span><span>−{faMoney(returnTotal)}</span></div>}
            <div className="flex justify-between font-bold text-sm pt-1 border-t"><span>مبلغ نهایی</span><span>{faMoney(grandTotal)} تومان</span></div>
          </div>

          {/* تسویه */}
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="وضعیت تسویه">
              <Select value={form.settledStatus} onValueChange={v => setForm(f => ({ ...f, settledStatus: v as Sale['settledStatus'] }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">تسویه‌شده کامل</SelectItem>
                  <SelectItem value="PARTIAL">پرداخت جزئی</SelectItem>
                  <SelectItem value="UNPAID">پرداخت‌نشده</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            {form.settledStatus === 'PARTIAL' && (
              <FormRow label="مبلغ پرداخت‌شده (تومان)">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </FormRow>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="روش پرداخت">
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v as Sale['paymentMethod'] }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_METHODS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="تاریخ وصول واقعی" hint="اگر با تاریخ فروش متفاوت است">
              <JalaliDateInput value={form.paymentDate} onChange={v => setForm(f => ({ ...f, paymentDate: v }))} />
            </FormRow>
          </div>
          {form.paymentMethod === 'CHECK' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 grid sm:grid-cols-3 gap-3">
              <FormRow label="سررسید چک">
                <JalaliDateInput value={form.checkDueDate} onChange={v => setForm(f => ({ ...f, checkDueDate: v }))} />
              </FormRow>
              <FormRow label="شماره چک">
                <Input value={form.checkNumber} onChange={e => setForm(f => ({ ...f, checkNumber: e.target.value }))} className="waffly-num h-11" dir="ltr" />
              </FormRow>
              <FormRow label="بانک">
                <Input value={form.checkBank} onChange={e => setForm(f => ({ ...f, checkBank: e.target.value }))} className="h-11" />
              </FormRow>
            </div>
          )}
          <FormRow label="یادداشت">
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
          </FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={onSave}>ثبت فروش</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ================= مشتریان =================
function CustomersTab() {
  const customers = useTable<Customer>('customers')
  const sales = useTable<Sale>('sales')
  const [form, setForm] = useState({ name: '', phone: '', address: '', cooperationType: '' })

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام مشتری لازم است', variant: 'destructive' }); return }
    await putRecord<Customer>('customers', {
      id: uid(),
      name: form.name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      cooperationType: form.cooperationType || null,
      updatedAt: 0, deleted: 0,
    })
    setForm({ name: '', phone: '', address: '', cooperationType: '' })
    toast({ title: 'مشتری ذخیره شد' })
  }

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; due: number; last: string }>()
    for (const s of active(sales)) {
      const st = m.get(s.customerId) || { count: 0, total: 0, due: 0, last: '' }
      st.count++
      st.total += s.totalAmount || 0
      st.due += saleDue(s)
      if (s.date > st.last) st.last = s.date
      m.set(s.customerId, st)
    }
    return m
  }, [sales])

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> مشتری جدید</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام و نام خانوادگی / نام مغازه">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
          </FormRow>
          <FormRow label="تلفن">
            <Input inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="waffly-num h-11" dir="ltr" />
          </FormRow>
          <FormRow label="نوع همکاری" hint="مثلاً: روزانه، هفتگی، عمده">
            <Input value={form.cooperationType} onChange={e => setForm(f => ({ ...f, cooperationType: e.target.value }))} className="h-11" />
          </FormRow>
          <FormRow label="آدرس">
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-11" />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>ذخیره مشتری</Button>
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">مشتریان ({faDigits(active(customers).length)})</CardTitle></CardHeader>
        <CardContent>
          {active(customers).length === 0 ? (
            <EmptyState title="مشتری ثبت نشده" icon={<Users className="h-5 w-5" />} />
          ) : (
            <div className="max-h-[480px] overflow-y-auto thin-scroll space-y-1.5">
              {active(customers).map(c => {
                const st = stats.get(c.id)
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground waffly-num">
                        {c.phone && <span dir="ltr">{c.phone}</span>}
                        {c.cooperationType && ` • ${c.cooperationType}`}
                        {st && ` • ${faDigits(st.count)} فروش • آخرین: ${prettyJalali(st.last)}`}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      {st && st.due > 0.5 && <p className="text-[11px] text-red-600 font-bold waffly-num">بدهی: {faMoney(st.due)}</p>}
                      {st && <p className="text-[10px] text-muted-foreground waffly-num">مجموع: {faMoney(st.total)}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void removeRecord('customers', c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ================= چک‌ها =================
function ChecksTab() {
  const sales = useTable<Sale>('sales')
  const customers = useTable<Customer>('customers')
  const checks = active(sales)
    .filter(s => s.paymentMethod === 'CHECK')
    .sort((a, b) => (a.checkDueDate || a.date).localeCompare(b.checkDueDate || b.date))
  const cName = (id: string) => customers.find(c => c.id === id)?.name || 'نامشخص'

  const collect = async (s: Sale) => {
    await putRecord<Sale>('sales', { ...s, settledStatus: 'PAID', paidAmount: s.totalAmount, paymentDate: todayJalali() })
    toast({ title: 'چک وصول شد' })
  }

  const statusChip = (s: Sale) => {
    const st = effectiveSettled(s)
    if (st === 'PAID') return <span className="rounded bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-[10px]">وصول‌شده</span>
    const days = daysSince(s.checkDueDate || s.date)
    if (s.checkDueDate && days > 0 || (!s.checkDueDate && days > 0)) {
      return <span className="rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] waffly-num">{faDigits(days)} روز گذشته</span>
    }
    if (days >= -7) return <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] waffly-num">نزدیک سررسید</span>
    return <span className="rounded bg-muted px-2 py-0.5 text-[10px] waffly-num">{faDigits(-days)} روز مانده</span>
  }

  return (
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" /> فروش‌های چکی</CardTitle>
      </CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <EmptyState title="چکی ثبت نشده" desc="در ثبت فروش، روش پرداخت «چک» را انتخاب کنید." icon={<Landmark className="h-5 w-5" />} />
        ) : (
          <div className="space-y-2">
            {checks.map(s => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{cName(s.customerId)}</p>
                  <p className="text-[11px] text-muted-foreground waffly-num">
                    فروش {prettyJalali(s.date)}
                    {s.checkDueDate && ` • سررسید ${prettyJalali(s.checkDueDate)}`}
                    {s.checkNumber && ` • چک ${s.checkNumber}`}
                    {s.checkBank && ` • ${s.checkBank}`}
                  </p>
                </div>
                {statusChip(s)}
                <Money value={s.totalAmount} className="font-bold text-sm" />
                {effectiveSettled(s) !== 'PAID' && (
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => void collect(s)}>
                    <Wallet className="h-3.5 w-3.5" /> وصول شد
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ================= بدحساب‌ها =================
function DebtsTab() {
  const sales = useTable<Sale>('sales')
  const customers = useTable<Customer>('customers')
  const setting = useSetting()
  const badDays = setting.badDebtDays || 30
  const debts = active(sales)
    .filter(s => isBadDebt(s, badDays))
    .map(s => ({ s, c: customers.find(x => x.id === s.customerId), days: daysSince(s.date) }))
    .sort((a, b) => b.days - a.days)

  const total = debts.reduce((a, d) => a + saleDue(d.s), 0)

  return (
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-500" /> بدهکاران (بیش از {faDigits(badDays)} روز)
          {debts.length > 0 && <span className="text-red-600 waffly-num mr-auto">جمع: {faMoney(total)} تومان</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {debts.length === 0 ? (
          <EmptyState title="بدحسابی ثبت نشده" desc="مشتریانی که بیش از ۳۰ روز بدهی داشته باشند اینجا نمایش داده می‌شوند." icon={<Check className="h-5 w-5" />} />
        ) : (
          <div className="space-y-2">
            {debts.map(({ s, c, days }) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/40 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{c?.name || 'نامشخص'}</p>
                  <p className="text-[11px] text-muted-foreground waffly-num">
                    فروش {prettyJalali(s.date)} • {faDigits(days)} روز بی‌تسویه
                    {c?.phone && <span dir="ltr"> • {c.phone}</span>}
                  </p>
                </div>
                <span className="text-sm font-bold text-red-700 waffly-num">{faMoney(saleDue(s))}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void removeRecord('sales', s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
