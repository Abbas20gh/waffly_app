'use client'

// خرید مواد اولیه — خریدها، انبار، تامین‌کنندگان، اقلام
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { ShoppingBasket, Plus, Trash2, Warehouse, Truck, PackageSearch, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, TabsBar, EmptyState, SettleBadge, Money, Num } from './bits'
import { JalaliDateInput } from './jalali-date'
import { useTable, useSetting, putRecord, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { Purchase, Supplier, Material, Consumption } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, materialStocks, effectiveSettled } from '@/lib/calc'
import { cn } from '@/lib/utils'

type Tab = 'purchases' | 'stock' | 'suppliers' | 'items'

const UNITS = ['کیلوگرم', 'گرم', 'کیسه', 'گونی', 'عدد', 'لیتر', 'بشکه', 'بسته']

export function PurchasesView() {
  const [tab, setTab] = useState<Tab>('purchases')
  return (
    <div>
      <PageHeader title="خرید مواد اولیه" subtitle="ثبت خرید، موجودی انبار با هشدار حد بحرانی، تامین‌کنندگان" icon={<ShoppingBasket className="h-5 w-5" />} />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'purchases', label: 'خریدها' },
          { key: 'stock', label: 'انبار و موجودی' },
          { key: 'suppliers', label: 'تامین‌کنندگان' },
          { key: 'items', label: 'اقلام' },
        ]}
      />
      {tab === 'purchases' && <PurchasesTab />}
      {tab === 'stock' && <StockTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'items' && <ItemsTab />}
    </div>
  )
}

function PurchasesTab() {
  const purchases = useTable<Purchase>('purchases')
  const materials = useTable<Material>('materials')
  const suppliers = useTable<Supplier>('suppliers')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    date: todayJalali(), materialId: '', quantity: '', cost: '',
    supplierId: '', settledStatus: 'PAID' as Purchase['settledStatus'], paidAmount: '', note: '',
  })
  const mat = materials.find(m => m.id === form.materialId)

  const save = async () => {
    const qty = parseFloat(form.quantity || '0')
    const cost = parseFloat(form.cost || '0')
    if (!form.materialId || qty <= 0) { toast({ title: 'ماده و مقدار را وارد کنید', variant: 'destructive' }); return }
    const paid = form.settledStatus === 'PAID' ? cost : parseFloat(form.paidAmount || '0')
    await putRecord<Purchase>('purchases', {
      id: uid(),
      date: form.date,
      materialId: form.materialId,
      quantity: qty,
      cost,
      supplierId: form.supplierId || null,
      settledStatus: form.settledStatus === 'PAID' || paid >= cost - 0.5 ? 'PAID' : paid > 0.5 ? 'PARTIAL' : 'UNPAID',
      paidAmount: Math.min(paid, cost),
      note: form.note || null,
      createdBy: getActiveUser() || null,
      updatedAt: 0, deleted: 0,
    })
    toast({ title: 'خرید ثبت شد', description: `${mat?.name}: ${faDigits(qty)} ${mat?.unit} — ${faMoney(cost)} تومان` })
    setOpen(false)
    setForm(f => ({ ...f, quantity: '', cost: '', paidAmount: '', note: '' }))
  }

  const list = [...purchases].filter(p => !p.deleted).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)).slice(0, 50)
  const matOf = (id: string) => materials.find(m => m.id === id)
  const supOf = (id: string | null) => suppliers.find(s => s.id === id)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="h-11" onClick={() => setOpen(true)}><Plus className="ml-1 h-4 w-4" /> خرید جدید</Button>
      </div>

      <Card className="waffly-card">
        <CardContent className="p-3">
          {list.length === 0 ? (
            <EmptyState title="خریدی ثبت نشده" desc="مواد اولیه خریداری‌شده را ثبت کنید تا موجودی انبار محاسبه شود." icon={<ShoppingBasket className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {list.map(p => {
                const m = matOf(p.materialId)
                const st = effectiveSettled(p)
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {m?.name || 'نامشخص'} — <Num value={p.quantity} /> {m?.unit}
                      </p>
                      <p className="text-[11px] text-muted-foreground waffly-num">
                        {prettyJalali(p.date)}{p.supplierId && ` • ${supOf(p.supplierId)?.name || ''}`}{p.createdBy && ` • ${p.createdBy}`}
                      </p>
                    </div>
                    <SettleBadge status={st} paid={p.paidAmount} total={p.cost} />
                    <Money value={p.cost} className="font-bold text-sm" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void removeRecord('purchases', p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ثبت خرید ماده اولیه</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="ماده اولیه">
              <Select value={form.materialId} onValueChange={v => setForm(f => ({ ...f, materialId: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
                <SelectContent>
                  {active(materials).map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="مقدار" hint={mat ? `واحد: ${mat.unit}` : undefined}>
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </FormRow>
              <FormRow label="هزینه کل (تومان)">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </FormRow>
            </div>
            <FormRow label="تامین‌کننده">
              <Select value={form.supplierId || 'none'} onValueChange={v => setForm(f => ({ ...f, supplierId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="انتخاب کنید (اختیاری)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تامین‌کننده</SelectItem>
                  {active(suppliers).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="تاریخ خرید">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="وضعیت تسویه">
              <Select value={form.settledStatus} onValueChange={v => setForm(f => ({ ...f, settledStatus: v as Purchase['settledStatus'] }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">پرداخت‌شده</SelectItem>
                  <SelectItem value="PARTIAL">پرداخت جزئی</SelectItem>
                  <SelectItem value="UNPAID">پرداخت‌نشده</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            {form.settledStatus === 'PARTIAL' && (
              <FormRow label="مبلغ پرداخت‌شده">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </FormRow>
            )}
            <FormRow label="یادداشت">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button onClick={save}>ثبت خرید</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StockTab() {
  const materials = useTable<Material>('materials')
  const purchases = useTable<Purchase>('purchases')
  const consumptions = useTable<Consumption>('consumptions')
  const stocks = useMemo(() => materialStocks({
    materials, purchases, consumptions,
    breadTypes: [], productions: [], customers: [], sales: [], suppliers: [], machines: [],
    machineCosts: [], expenseCategories: [], expenses: [],
    setting: { id: 'main', businessName: '', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: 0, deleted: 0 },
  }), [materials, purchases, consumptions])

  const setMin = async (m: Material, value: string) => {
    const v = parseFloat(value) || 0
    await putRecord<Material>('materials', { ...m, minStock: v })
  }

  const lowCount = stocks.filter(s => s.low).length

  return (
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Warehouse className="h-4 w-4" /> موجودی انبار
          {lowCount > 0 && (
            <span className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] waffly-num">
              {faDigits(lowCount)} ماده زیر حد بحرانی
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stocks.length === 0 ? (
          <EmptyState title="قلمی ثبت نشده" desc="از تب «اقلام» مواد اولیه را اضافه کنید." icon={<PackageSearch className="h-5 w-5" />} />
        ) : (
          <div className="space-y-2">
            {stocks.map(st => (
              <div key={st.material.id} className={cn('rounded-xl border p-3', st.low ? 'border-amber-300 bg-amber-50/50' : '')}>
                <div className="flex flex-wrap items-center gap-2">
                  {st.low && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                  <p className="text-sm font-semibold flex-1">{st.material.name}</p>
                  <span className={cn('text-sm font-bold waffly-num', st.stock <= 0 ? 'text-red-600' : st.low ? 'text-amber-700' : 'text-green-700')}>
                    {faDigits(Math.round(st.stock * 100) / 100)} <span className="text-[10px] font-normal text-muted-foreground">{st.material.unit}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground waffly-num">
                  <span>خرید: {faDigits(Math.round(st.purchased * 100) / 100)}</span>
                  <span>مصرف: {faDigits(Math.round(st.consumed * 100) / 100)}</span>
                  {st.avgPrice > 0 && <span>میانگین قیمت: {faMoney(st.avgPrice)}</span>}
                  <label className="flex items-center gap-1.5 mr-auto">
                    حد بحرانی:
                    <Input
                      inputMode="decimal"
                      defaultValue={st.material.minStock || ''}
                      onBlur={e => void setMin(st.material, e.target.value)}
                      className="waffly-num-input h-7 w-20 text-[11px]"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SuppliersTab() {
  const suppliers = useTable<Supplier>('suppliers')
  const purchases = useTable<Purchase>('purchases')
  const [form, setForm] = useState({ name: '', phone: '', address: '' })

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام تامین‌کننده لازم است', variant: 'destructive' }); return }
    await putRecord<Supplier>('suppliers', {
      id: uid(), name: form.name.trim(), phone: form.phone || null, address: form.address || null,
      updatedAt: 0, deleted: 0,
    })
    setForm({ name: '', phone: '', address: '' })
    toast({ title: 'تامین‌کننده ذخیره شد' })
  }

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; due: number }>()
    for (const p of active(purchases)) {
      if (!p.supplierId) continue
      const st = m.get(p.supplierId) || { count: 0, total: 0, due: 0 }
      st.count++
      st.total += p.cost || 0
      st.due += Math.max(0, (p.cost || 0) - (p.paidAmount || 0))
      m.set(p.supplierId, st)
    }
    return m
  }, [purchases])

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> تامین‌کننده جدید</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" /></FormRow>
          <FormRow label="تلفن"><Input inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="waffly-num h-11" dir="ltr" /></FormRow>
          <FormRow label="آدرس"><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-11" /></FormRow>
          <Button className="w-full h-11" onClick={save}>ذخیره</Button>
        </CardContent>
      </Card>
      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">تامین‌کنندگان ({faDigits(active(suppliers).length)})</CardTitle></CardHeader>
        <CardContent>
          {active(suppliers).length === 0 ? (
            <EmptyState title="تامین‌کننده‌ای ثبت نشده" icon={<Truck className="h-5 w-5" />} />
          ) : (
            <div className="space-y-1.5">
              {active(suppliers).map(s => {
                const st = stats.get(s.id)
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground waffly-num">
                        {s.phone && <span dir="ltr">{s.phone}</span>}
                        {st && ` • ${faDigits(st.count)} خرید`}
                      </p>
                    </div>
                    {st && (
                      <div className="text-left shrink-0">
                        {st.due > 0.5 && <p className="text-[11px] text-red-600 font-bold waffly-num">بدهی: {faMoney(st.due)}</p>}
                        <p className="text-[10px] text-muted-foreground waffly-num">مجموع: {faMoney(st.total)}</p>
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void removeRecord('suppliers', s.id)}>
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

function ItemsTab() {
  const materials = useTable<Material>('materials')
  const [form, setForm] = useState({ name: '', unit: UNITS[0], minStock: '' })

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام قلم لازم است', variant: 'destructive' }); return }
    await putRecord<Material>('materials', {
      id: uid(), name: form.name.trim(), unit: form.unit, minStock: parseFloat(form.minStock || '0') || 0,
      updatedAt: 0, deleted: 0,
    })
    setForm({ name: '', unit: UNITS[0], minStock: '' })
    toast({ title: 'قلم اضافه شد' })
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-sm">قلم جدید مواد اولیه</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام قلم"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" /></FormRow>
          <FormRow label="واحد اندازه‌گیری" hint="هر قلم واحد مخصوص خودش را دارد">
            <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </FormRow>
          <FormRow label="حد بحرانی هشدار" hint="وقتی موجودی به این مقدار برسد هشدار می‌دهد">
            <Input inputMode="decimal" className="waffly-num-input h-11" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>افزودن قلم</Button>
        </CardContent>
      </Card>
      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">اقلام ({faDigits(active(materials).length)})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {active(materials).map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium flex-1">{m.name}</span>
                <span className="text-[11px] text-muted-foreground">واحد: {m.unit}</span>
                <span className="text-[11px] text-muted-foreground waffly-num">حد: {faDigits(m.minStock)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void removeRecord('materials', m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
