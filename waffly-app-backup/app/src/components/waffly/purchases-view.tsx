'use client'

// خرید مواد اولیه — خریدها، انبار، تامین‌کنندگان، اقلام
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { ShoppingBasket, Plus, Trash2, Warehouse, Truck, PackageSearch, AlertTriangle, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, TabsBar, EmptyState, SettleBadge, Money, Num, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, useSetting, putRecord, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { Purchase, Supplier, Material, Consumption, Good, Sale, Account } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, materialStocks, goodsStocks, effectiveSettled } from '@/lib/calc'
import { cn } from '@/lib/utils'

type Tab = 'purchases' | 'stock' | 'suppliers' | 'items' | 'goods'

const UNITS = ['کیلوگرم', 'گرم', 'کیسه', 'گونی', 'عدد', 'لیتر', 'بشکه', 'بسته']

/** عدد بدون صفرهای اضافی و با حداکثر ۴ رقم اعشار — برای پیش‌پرکردن فرم ویرایش */
const trimNum = (n: number) => String(Math.round(n * 10000) / 10000)

export function PurchasesView() {
  const [tab, setTab] = useState<Tab>('purchases')
  return (
    <div>
      <PageHeader title="خرید و انبار" subtitle="خرید مواد و کالاها، موجودی انبار با هشدار حد بحرانی، تامین‌کنندگان" icon={<ShoppingBasket className="h-5 w-5" />} />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'purchases', label: 'خریدها' },
          { key: 'stock', label: 'انبار و موجودی' },
          { key: 'goods', label: 'کالاها' },
          { key: 'suppliers', label: 'تامین‌کنندگان' },
          { key: 'items', label: 'اقلام' },
        ]}
      />
      {tab === 'purchases' && <PurchasesTab />}
      {tab === 'stock' && <StockTab />}
      {tab === 'goods' && <GoodsTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'items' && <ItemsTab />}
    </div>
  )
}

function PurchasesTab() {
  const purchases = useTable<Purchase>('purchases')
  const materials = useTable<Material>('materials')
  const goods = useTable<Good>('goods')
  const suppliers = useTable<Supplier>('suppliers')
  const accounts = useTable<Account>('accounts')
  const { confirm, element: confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const blankForm = {
    date: todayJalali(), itemKind: 'MATERIAL' as 'MATERIAL' | 'GOOD', materialId: '',
    quantity: '', cost: '', pricePerBox: '',
    supplierId: '', settledStatus: 'PAID' as Purchase['settledStatus'], paidAmount: '', note: '',
    accountId: '',
  }
  const [form, setForm] = useState(blankForm)

  const openNew = () => { setEditing(null); setForm({ ...blankForm, date: todayJalali() }); setOpen(true) }
  const openEdit = (p: Purchase) => {
    const isG = p.itemKind === 'GOOD'
    setEditing(p)
    setForm({
      date: p.date, itemKind: p.itemKind || 'MATERIAL', materialId: p.materialId,
      quantity: trimNum(p.quantity), cost: isG ? '' : trimNum(p.cost),
      pricePerBox: isG && p.quantity > 0 ? trimNum(p.cost / p.quantity) : '',
      supplierId: p.supplierId || '', settledStatus: p.settledStatus,
      paidAmount: p.settledStatus === 'PARTIAL' ? trimNum(p.paidAmount || 0) : '',
      note: p.note || '',
      accountId: p.accountId || '',
    })
    setOpen(true)
  }
  const mat = form.itemKind === 'MATERIAL' ? materials.find(m => m.id === form.materialId) : undefined
  const good = form.itemKind === 'GOOD' ? goods.find(g => g.id === form.materialId) : undefined
  // کالا همیشه جعبه‌ای است (v2.5) — تعداد جعبه × قیمت هر جعبه
  const isGood = form.itemKind === 'GOOD'
  const qtyNum = parseFloat(form.quantity || '0')
  // در ویرایش کالا اگر تعداد/قیمت دست‌نخورده باشد هزینهٔ اصلی حفظ می‌شود (بدون خطای گردکردن)
  const goodCostUntouched = !!editing && isGood &&
    form.quantity === trimNum(editing.quantity) && form.pricePerBox === (editing.quantity > 0 ? trimNum(editing.cost / editing.quantity) : '')
  const costNum = isGood
    ? (goodCostUntouched ? editing!.cost : qtyNum * (parseFloat(form.pricePerBox || '0') || 0))
    : parseFloat(form.cost || '0')

  const switchKind = (kind: 'MATERIAL' | 'GOOD') => setForm(f => ({ ...f, itemKind: kind, materialId: '', quantity: '', cost: '', pricePerBox: '' }))

  const save = async () => {
    if (!form.materialId || qtyNum <= 0 || costNum <= 0) { toast({ title: 'قلم، مقدار و هزینه را وارد کنید', variant: 'destructive' }); return }
    const paid = form.settledStatus === 'PAID' ? costNum : parseFloat(form.paidAmount || '0')
    // ویرایش = همان id با putRecord (updatedAt جدید → سینک)؛ createdBy اصلی حفظ می‌شود
    await putRecord<Purchase>('purchases', {
      ...(editing || {}),
      id: editing ? editing.id : uid(),
      updatedAt: editing ? editing.updatedAt : 0,
      date: form.date,
      materialId: form.materialId,
      quantity: qtyNum,
      cost: costNum,
      supplierId: form.supplierId || null,
      settledStatus: form.settledStatus === 'PAID' || paid >= costNum - 0.5 ? 'PAID' : paid > 0.5 ? 'PARTIAL' : 'UNPAID',
      paidAmount: Math.min(paid, costNum),
      itemKind: form.itemKind,
      boxesCount: isGood ? qtyNum : 0,
      note: form.note || null,
      accountId: form.accountId || null,
      createdBy: editing?.createdBy ?? (getActiveUser() || null),
      deleted: 0,
    })
    toast({
      title: editing ? 'خرید ویرایش شد' : 'خرید ثبت شد',
      description: `${(isGood ? good?.name : mat?.name) || ''}: ${isGood ? `${faDigits(qtyNum)} جعبه` : `${faDigits(qtyNum)} ${(mat?.unit || '')}`} — ${faMoney(costNum)} تومان`,
    })
    setOpen(false)
    setEditing(null)
    setForm(f => ({ ...f, quantity: '', cost: '', pricePerBox: '', paidAmount: '', note: '' }))
  }

  const list = [...purchases].filter(p => !p.deleted).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)).slice(0, 50)
  const matOf = (id: string) => materials.find(m => m.id === id)
  const gOf = (id: string) => goods.find(g => g.id === id)
  const supOf = (id: string | null) => suppliers.find(s => s.id === id)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="h-11" onClick={openNew}><Plus className="ml-1 h-4 w-4" /> خرید جدید</Button>
      </div>

      <Card className="waffly-card">
        <CardContent className="p-3">
          {list.length === 0 ? (
            <EmptyState title="خریدی ثبت نشده" desc="مواد اولیه و کالاها را ثبت کنید تا موجودی انبار محاسبه شود." icon={<ShoppingBasket className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {list.map(p => {
                const isGoodRow = p.itemKind === 'GOOD'
                const item = isGoodRow ? gOf(p.materialId) : matOf(p.materialId)
                const st = effectiveSettled(p)
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {isGoodRow && <span className="ml-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">کالا</span>}
                        {item?.name || 'نامشخص'} — <Num value={p.quantity} /> {isGoodRow ? 'جعبه' : (item as Material | undefined)?.unit}
                      </p>
                      <p className="text-[11px] text-muted-foreground waffly-num">
                        {prettyJalali(p.date)}{p.supplierId && ` • ${supOf(p.supplierId)?.name || ''}`}{p.createdBy && ` • ${p.createdBy}`}
                      </p>
                    </div>
                    <SettleBadge status={st} paid={p.paidAmount} total={p.cost} />
                    <Money value={p.cost} className="font-bold text-sm" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                      onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'purchases', p.id, 'حذف خرید', `آیا از حذف این خرید (${item?.name || 'نامشخص'} — ${faMoney(p.cost)} تومان) مطمئن هستید؟ موجودی انبار و آمار به‌روز می‌شود.`)}>
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
            <DialogTitle>{editing ? 'ویرایش خرید' : 'ثبت خرید'}</DialogTitle>
            {editing && <p className="text-[11px] text-muted-foreground">همهٔ فیلدها قابل تغییر است؛ بعد از ذخیره، موجودی و آمار خودکار به‌روز می‌شود.</p>}
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نوع قلم">
              <InlinePicker
                value={form.itemKind}
                options={[{ value: 'MATERIAL', label: 'ماده اولیه' }, { value: 'GOOD', label: 'کالا (خرید و فروشی)' }]}
                onChange={v => switchKind(v as 'MATERIAL' | 'GOOD')}
              />
            </FormRow>
            {form.itemKind === 'GOOD' && (
              <FormRow label="کالا">
                <InlinePicker
                  value={form.materialId}
                  options={active(goods).filter(g => g.active !== 0).map(g => ({ value: g.id, label: g.name, hint: 'جعبه‌ای' }))}
                  onChange={v => setForm(f => ({ ...f, materialId: v, quantity: '', cost: '', pricePerBox: '' }))}
                  placeholder="انتخاب کالا"
                />
              </FormRow>
            )}
            {form.itemKind !== 'GOOD' && (
              <FormRow label="ماده اولیه">
                <InlinePicker
                  value={form.materialId}
                  options={active(materials).filter(m => m.active !== 0).map(m => ({ value: m.id, label: m.name, hint: m.unit }))}
                  onChange={v => setForm(f => ({ ...f, materialId: v }))}
                  placeholder="انتخاب کنید"
                />
              </FormRow>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormRow label={form.itemKind === 'GOOD' ? 'تعداد جعبه' : 'مقدار'} hint={mat ? `واحد: ${mat.unit}` : undefined}>
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </FormRow>
              {form.itemKind === 'GOOD' ? (
                <FormRow label="قیمت هر جعبه (تومان)" hint={`جمع: ${faMoney(costNum)} تومان`}>
                  <Input inputMode="decimal" className="waffly-num-input h-11" value={form.pricePerBox} onChange={e => setForm(f => ({ ...f, pricePerBox: e.target.value }))} />
                </FormRow>
              ) : (
                <FormRow label="هزینه کل (تومان)">
                  <Input inputMode="decimal" className="waffly-num-input h-11" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
                </FormRow>
              )}
            </div>
            <FormRow label="تامین‌کننده">
              <InlinePicker
                value={form.supplierId || 'none'}
                options={[{ value: 'none', label: 'بدون تامین‌کننده' }, ...active(suppliers).map(s => ({ value: s.id, label: s.name }))]}
                onChange={v => setForm(f => ({ ...f, supplierId: v === 'none' ? '' : v }))}
                placeholder="انتخاب کنید (اختیاری)"
              />
            </FormRow>
            <FormRow label="تاریخ خرید">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="وضعیت تسویه">
              <InlinePicker
                value={form.settledStatus}
                options={[
                  { value: 'PAID', label: 'پرداخت‌شده' },
                  { value: 'PARTIAL', label: 'پرداخت جزئی' },
                  { value: 'UNPAID', label: 'پرداخت‌نشده' },
                ]}
                onChange={v => setForm(f => ({ ...f, settledStatus: v as Purchase['settledStatus'] }))}
              />
            </FormRow>
            {form.settledStatus === 'PARTIAL' && (
              <FormRow label="مبلغ پرداخت‌شده">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </FormRow>
            )}
            <FormRow label="پرداخت از حساب" hint="مبلغ پرداختی از موجودی این حساب کم می‌شود (در بخش حسابداری ← حساب‌ها)">
              <InlinePicker
                value={form.accountId}
                options={[{ value: '', label: 'بدون حساب' }, ...accounts.filter(a => !a.deleted).map(a => ({ value: a.id, label: a.name, hint: a.kind === 'BANK' ? 'حساب بانکی' : 'صندوق نقدی' }))]}
                onChange={v => setForm(f => ({ ...f, accountId: v }))}
                placeholder="انتخاب حساب (اختیاری)"
              />
            </FormRow>
            <FormRow label="یادداشت">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>انصراف</Button>
            <Button onClick={save}>{editing ? 'ذخیره تغییرات' : 'ثبت خرید'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}

function StockTab() {
  const materials = useTable<Material>('materials')
  const goods = useTable<Good>('goods')
  const purchases = useTable<Purchase>('purchases')
  const consumptions = useTable<Consumption>('consumptions')
  const sales = useTable<Sale>('sales')
  const stocks = useMemo(() => materialStocks({
    materials, goods: [], purchases, consumptions,
    breadTypes: [], productions: [], customers: [], sales: [], suppliers: [], machines: [],
    machineCosts: [], expenseCategories: [], expenses: [], otherFunds: [],
    setting: { id: 'main', businessName: '', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: 0, deleted: 0 },
  }), [materials, purchases, consumptions])
  const goodStocks = useMemo(() => goodsStocks({
    goods, purchases, sales,
    breadTypes: [], productions: [], materials: [], consumptions: [], customers: [], suppliers: [], machines: [],
    machineCosts: [], expenseCategories: [], expenses: [], otherFunds: [],
    setting: { id: 'main', businessName: '', monthStartDay: 1, badDebtDays: 30, checkAlertDays: 7, updatedAt: 0, deleted: 0 },
  }), [goods, purchases, sales])

  const setMin = async (m: Material, value: string) => {
    const v = parseFloat(value) || 0
    await putRecord<Material>('materials', { ...m, minStock: v })
  }
  const setGoodMin = async (g: Good, value: string) => {
    const v = parseFloat(value) || 0
    await putRecord<Good>('goods', { ...g, minStock: v })
  }

  const lowCount = stocks.filter(s => s.low).length + goodStocks.filter(s => s.low).length

  return (
    <div className="space-y-4">
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Warehouse className="h-4 w-4" /> موجودی انبار
          {lowCount > 0 && (
            <span className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] waffly-num">
              {faDigits(lowCount)} قلم زیر حد بحرانی
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

    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PackageSearch className="h-4 w-4" /> موجودی کالاها
          {goodStocks.filter(s => s.low).length > 0 && (
            <span className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] waffly-num">
              {faDigits(goodStocks.filter(s => s.low).length)} کالا زیر حد بحرانی
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goodStocks.length === 0 ? (
          <EmptyState title="کالایی ثبت نشده" desc="از تب «کالاها» کالای خرید و فروشی (مثل نان مشعلی) اضافه کنید." icon={<PackageSearch className="h-5 w-5" />} />
        ) : (
          <div className="space-y-2">
            {goodStocks.map(st => (
              <div key={st.good.id} className={cn('rounded-xl border p-3', st.low ? 'border-amber-300 bg-amber-50/50' : '')}>
                <div className="flex flex-wrap items-center gap-2">
                  {st.low && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">کالا</span>
                  <p className="text-sm font-semibold flex-1">{st.good.name}</p>
                  <span className={cn('text-sm font-bold waffly-num', st.stock <= 0 ? 'text-red-600' : st.low ? 'text-amber-700' : 'text-green-700')}>
                    {faDigits(Math.round(st.stock * 100) / 100)} <span className="text-[10px] font-normal text-muted-foreground">جعبه</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground waffly-num">
                  <span>خرید: {faDigits(Math.round(st.purchased * 100) / 100)} جعبه</span>
                  <span>فروش: {faDigits(Math.round(st.sold * 100) / 100)} جعبه</span>
                  {st.avgPrice > 0 && <span>میانگین بهای هر جعبه: {faMoney(st.avgPrice)}</span>}
                  <label className="flex items-center gap-1.5 mr-auto">
                    حد بحرانی (جعبه):
                    <Input
                      inputMode="decimal"
                      defaultValue={st.good.minStock || ''}
                      onBlur={e => void setGoodMin(st.good, e.target.value)}
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
    </div>
  )
}

function GoodsTab() {
  const goods = useTable<Good>('goods')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Good | null>(null)
  const [form, setForm] = useState({ name: '', minStock: '' })

  const openEdit = (g: Good) => { setEditing(g); setForm({ name: g.name, minStock: g.minStock ? trimNum(g.minStock) : '' }) }

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام کالا لازم است', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<Good>('goods', { ...editing, name: form.name.trim(), minStock: parseFloat(form.minStock || '0') || 0 })
      toast({ title: 'کالا ویرایش شد' })
    } else {
      await putRecord<Good>('goods', {
        id: uid(), name: form.name.trim(),
        piecesPerBox: 1, // منسوخ — واحد همه‌جا جعبه است (v2.5)
        minStock: parseFloat(form.minStock || '0') || 0,
        active: 1, updatedAt: 0, deleted: 0,
      })
      toast({ title: 'کالا اضافه شد' })
    }
    setForm({ name: '', minStock: '' })
    setEditing(null)
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{editing ? `ویرایش کالا: ${editing.name}` : 'کالای جدید (خرید و فروش بدون تولید)'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام کالا" hint="مثلاً: نان مشعلی، نان فانتزی">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
          </FormRow>
          <FormRow label="حد بحرانی هشدار (جعبه)" hint="وقتی موجودی به این تعداد جعبه رسید هشدار می‌دهد">
            <Input inputMode="decimal" className="waffly-num-input h-11" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>{editing ? 'ذخیره تغییرات' : 'افزودن کالا'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ name: '', minStock: '' }) }}>انصراف از ویرایش</Button>}
          <p className="text-[11px] text-muted-foreground leading-5">
            کالاها همیشه با واحد «جعبه» ثبت می‌شوند — خرید و فروش جعبه‌ای، بدون نیاز به تعداد داخل جعبه. در همان فاکتور فروش کنار نان‌ها می‌آیند و بهای خریدشان (میانگین موزون هر جعبه) از سود کم می‌شود.
          </p>
        </CardContent>
      </Card>
      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">کالاها ({faDigits(active(goods).filter(g => g.active !== 0).length)} فعال)</CardTitle></CardHeader>
        <CardContent>
          {goods.filter(g => !g.deleted).length === 0 ? (
            <EmptyState title="کالایی ثبت نشده" desc="نان مشعلی، نان فانتزی و کالاهای مشابه را اینجا اضافه کنید." icon={<PackageSearch className="h-5 w-5" />} />
          ) : (
            <div className="space-y-1.5">
              {[...goods].filter(g => !g.deleted).sort((a, b) => (b.active || 0) - (a.active || 0) || a.name.localeCompare(b.name, 'fa')).map(g => (
                <div key={g.id} className={cn('flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5', g.active === 0 && 'opacity-60')}>
                  <span className="text-sm font-medium flex-1">{g.name}</span>
                  {g.active === 0 && <span className="rounded-full bg-muted text-muted-foreground text-[10px] px-2 py-0.5">غیرفعال</span>}
                  <span className="text-[11px] text-muted-foreground waffly-num">واحد: جعبه • حد: {faDigits(g.minStock)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                    onClick={() => openEdit(g)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 shrink-0 text-[11px]"
                    onClick={() => void putRecord<Good>('goods', { ...g, active: g.active === 0 ? 1 : 0 })}
                  >
                    {g.active === 0 ? 'فعال‌سازی' : 'غیرفعال'}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600" aria-label="حذف"
                    onClick={() => void confirmRemove(confirm, 'goods', g.id, 'حذف کالا', `آیا از حذف «${g.name}» مطمئن هستید؟ خریدها و فروش‌های قبلی این کالا حفظ می‌شوند.`)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SuppliersTab() {
  const suppliers = useTable<Supplier>('suppliers')
  const purchases = useTable<Purchase>('purchases')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })

  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', address: s.address || '' }) }

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام تامین‌کننده لازم است', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<Supplier>('suppliers', { ...editing, name: form.name.trim(), phone: form.phone || null, address: form.address || null })
      toast({ title: 'تامین‌کننده ویرایش شد' })
    } else {
      await putRecord<Supplier>('suppliers', {
        id: uid(), name: form.name.trim(), phone: form.phone || null, address: form.address || null,
        updatedAt: 0, deleted: 0,
      })
      toast({ title: 'تامین‌کننده ذخیره شد' })
    }
    setForm({ name: '', phone: '', address: '' })
    setEditing(null)
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
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> {editing ? `ویرایش تامین‌کننده: ${editing.name}` : 'تامین‌کننده جدید'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" /></FormRow>
          <FormRow label="تلفن"><Input inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="waffly-num h-11" dir="ltr" /></FormRow>
          <FormRow label="آدرس"><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-11" /></FormRow>
          <Button className="w-full h-11" onClick={save}>{editing ? 'ذخیره تغییرات' : 'ذخیره'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ name: '', phone: '', address: '' }) }}>انصراف از ویرایش</Button>}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                      onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'suppliers', s.id, 'حذف تامین‌کننده', `آیا از حذف «${s.name}» مطمئن هستید؟ خریدهای قبلی او حفظ می‌شوند.`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  )
}

function ItemsTab() {
  const materials = useTable<Material>('materials')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Material | null>(null)
  const [form, setForm] = useState({ name: '', unit: UNITS[0], minStock: '' })

  const openEdit = (m: Material) => { setEditing(m); setForm({ name: m.name, unit: m.unit || UNITS[0], minStock: m.minStock ? trimNum(m.minStock) : '' }) }

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام قلم لازم است', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<Material>('materials', { ...editing, name: form.name.trim(), unit: form.unit, minStock: parseFloat(form.minStock || '0') || 0 })
      toast({ title: 'قلم ویرایش شد' })
    } else {
      await putRecord<Material>('materials', {
        id: uid(), name: form.name.trim(), unit: form.unit, minStock: parseFloat(form.minStock || '0') || 0,
        active: 1, updatedAt: 0, deleted: 0,
      })
      toast({ title: 'قلم اضافه شد' })
    }
    setForm({ name: '', unit: UNITS[0], minStock: '' })
    setEditing(null)
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-sm">{editing ? `ویرایش قلم: ${editing.name}` : 'قلم جدید مواد اولیه'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FormRow label="نام قلم"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" /></FormRow>
          <FormRow label="واحد اندازه‌گیری" hint="هر قلم واحد مخصوص خودش را دارد">
            <InlinePicker
              value={form.unit}
              options={UNITS.map(u => ({ value: u, label: u }))}
              onChange={v => setForm(f => ({ ...f, unit: v }))}
            />
          </FormRow>
          <FormRow label="حد بحرانی هشدار" hint="وقتی موجودی به این مقدار برسد هشدار می‌دهد">
            <Input inputMode="decimal" className="waffly-num-input h-11" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>{editing ? 'ذخیره تغییرات' : 'افزودن قلم'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ name: '', unit: UNITS[0], minStock: '' }) }}>انصراف از ویرایش</Button>}
        </CardContent>
      </Card>
      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">اقلام ({faDigits(active(materials).filter(m => m.active !== 0).length)} فعال)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {[...materials].filter(m => !m.deleted).sort((a, b) => (b.active || 0) - (a.active || 0) || a.name.localeCompare(b.name, 'fa')).map(m => (
              <div key={m.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5', m.active === 0 && 'opacity-60')}>
                <span className="text-sm font-medium flex-1">{m.name}</span>
                {m.active === 0 && <span className="rounded-full bg-muted text-muted-foreground text-[10px] px-2 py-0.5">غیرفعال</span>}
                <span className="text-[11px] text-muted-foreground">واحد: {m.unit}</span>
                <span className="text-[11px] text-muted-foreground waffly-num">حد: {faDigits(m.minStock)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                  onClick={() => openEdit(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 shrink-0 text-[11px]"
                  onClick={() => void putRecord<Material>('materials', { ...m, active: m.active === 0 ? 1 : 0 })}
                >
                  {m.active === 0 ? 'فعال‌سازی' : 'غیرفعال'}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void confirmRemove(confirm, 'materials', m.id, 'حذف قلم', `آیا از حذف «${m.name}» مطمئن هستید؟ خریدها و مصرف‌های قبلی این قلم حفظ می‌شوند.`)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  )
}
