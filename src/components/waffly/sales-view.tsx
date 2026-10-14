'use client'

// فروش — ثبت فروش چندقلمی، تسویه (کامل/جزئی)، چک، مشتریان، بدحساب‌ها
import { useCallback, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  ShoppingCart, Plus, Trash2, Users, AlertOctagon, Check, Pencil, FileText, ListChecks, Percent,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, TabsBar, EmptyState, SettleBadge, Money, Num, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { InvoiceDialog } from './invoice-dialog'
import { useTable, useSetting, putRecord, removeRecord, uid, getActiveUser, DEFAULT_BANK } from '@/lib/localdb'
import { requireUserName } from '@/lib/user-gate'
import type { Sale, Customer, BreadType, Good, SaleItem, Production, Account, CombinedInvoice, DiscountType } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, saleDue, effectiveSettled, isBadDebt, daysSince, effectivePaymentDate } from '@/lib/calc'
import { buildSaleInvoice, buildCombinedInvoice, combinedInvoiceRecord, computeDiscount, type InvoiceCtx, type InvoiceModel } from '@/lib/invoice'
import { API_BASE } from '@/lib/sync-engine'
import { cn } from '@/lib/utils'

type Tab = 'sales' | 'customers' | 'debts'

// v3.2.0 — سه روش پرداخت (نقدی/کارت به کارت/کارتخوان)؛ چک از انتخاب حذف شد (فقط برای رکوردهای قدیمی لیبل دارد)
const PAY_METHODS = [
  { key: 'CASH', label: 'نقدی' },
  { key: 'CARD', label: 'کارت به کارت' },
  { key: 'POS', label: 'کارتخوان' },
] as const

// لیبل نمایشی — شامل روش‌های قدیمی برای رکوردهای قبلی (TRANSFER/CHECK)
const PAY_LABELS: Record<string, string> = { CASH: 'نقدی', CARD: 'کارت به کارت', POS: 'کارتخوان', TRANSFER: 'کارت به کارت', CHECK: 'چک' }

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
          { key: 'debts', label: 'بدحساب‌ها' },
        ]}
      />
      {tab === 'sales' && <SalesTab />}
      {tab === 'customers' && <CustomersTab />}
      {tab === 'debts' && <DebtsTab />}
    </div>
  )
}

// ================= فرم/لیست فروش‌ها =================
function SalesTab() {
  const sales = useTable<Sale>('sales')
  const customers = useTable<Customer>('customers')
  const breadTypes = useTable<BreadType>('breadTypes')
  const goods = useTable<Good>('goods')
  const productions = useTable<Production>('productions')
  const accounts = useTable<Account>('accounts')
  const setting = useSetting()
  const { confirm, element: confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [filter, setFilter] = useState<'all' | 'unpaid'>('all')
  const [saving, setSaving] = useState(false)

  const emptyItem: SaleItem = { breadTypeId: '', qty: 0, unitPrice: 0, delivered: 0, returned: 0, returnCost: 0, kind: 'BREAD' }
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
    accountId: '',
    discountType: 'NONE' as DiscountType,
    discountValue: '',
  })

  // v3.2.0 — موجودی هر محصول (تولید − فروش) و آخرین قیمت فروش هر کالا
  // با حذف انتخاب کد کارتون از فروش، کسر موجودی در سطح «محصول» انجام می‌شود:
  // موجودی = مجموع تولید (منهای ضایعات) − مجموع فروش خالص (تحویل − برگشتی) همان کالا
  const { breadStock, lastPrice } = useMemo(() => {
    const stock = new Map<string, number>()
    for (const p of productions) {
      if (p.deleted) continue
      const produced = (Number(p.totalProduced) || 0) - (Number(p.waste) || 0)
      if (p.breadTypeId) stock.set(p.breadTypeId, (stock.get(p.breadTypeId) || 0) + produced)
    }
    const prices = new Map<string, number>()
    const ordered = [...sales].filter(s => !s.deleted && s.id !== editing?.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    for (const s of ordered) {
      let items: SaleItem[] = []
      try { items = JSON.parse(s.items || '[]') as SaleItem[] } catch { continue }
      for (const it of items) {
        if (!it.breadTypeId) continue
        const net = (it.delivered ?? it.qty ?? 0) - (it.returned ?? 0)
        if (net) stock.set(it.breadTypeId, (stock.get(it.breadTypeId) || 0) - net)
        if ((it.unitPrice || 0) > 0 && !prices.has(it.breadTypeId)) prices.set(it.breadTypeId, it.unitPrice)
      }
    }
    return { breadStock: stock, lastPrice: prices }
  }, [productions, sales, editing])

  const itemsTotal = form.items.reduce((a, it) => a + (it.qty || 0) * (it.unitPrice || 0), 0)
  const returnTotal = form.items.reduce((a, it) => a + (it.returnCost || 0), 0)
  const formSubtotal = Math.max(0, itemsTotal - returnTotal)
  const discountAmount = computeDiscount(formSubtotal, form.discountType, parseFloat(form.discountValue || '0') || 0)
  const grandTotal = Math.max(0, formSubtotal - discountAmount)

  const openNew = () => {
    setEditing(null)
    setForm({
      date: todayJalali(),
      customerId: '',
      items: [{ ...emptyItem }],
      settledStatus: 'UNPAID',
      paidAmount: '',
      paymentMethod: null,
      checkDueDate: '',
      checkNumber: '',
      checkBank: '',
      paymentDate: '',
      note: '',
      accountId: '',
      discountType: 'NONE' as DiscountType,
      discountValue: '',
    })
    setOpen(true)
  }

  const openEdit = (s: Sale) => {
    let items: SaleItem[] = []
    try { items = (JSON.parse(s.items || '[]') as SaleItem[]).map(it => ({ ...it })) } catch { /* JSON خراب → خالی */ }
    setEditing(s)
    setForm({
      date: s.date,
      customerId: s.customerId,
      items: items.length ? items : [{ ...emptyItem }],
      settledStatus: s.settledStatus,
      paidAmount: s.settledStatus === 'PARTIAL' ? String(s.paidAmount || '') : '',
      paymentMethod: s.paymentMethod || (s.settledStatus === 'UNPAID' ? null : 'CASH'),
      checkDueDate: s.checkDueDate || '',
      checkNumber: s.checkNumber || '',
      checkBank: s.checkBank || '',
      paymentDate: s.paymentDate || '',
      note: s.note || '',
      accountId: s.accountId || '',
      discountType: s.discountType || 'NONE',
      discountValue: s.discountValue ? String(s.discountValue) : '',
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
    if (saving) return
    setSaving(true)
    try {
      const paid = form.settledStatus === 'PAID' ? grandTotal : parseFloat(form.paidAmount || '0')
      const status: Sale['settledStatus'] = form.settledStatus === 'PAID' || paid >= grandTotal - 0.5
        ? 'PAID'
        : paid > 0.5 ? 'PARTIAL' : 'UNPAID'
      await putRecord<Sale>('sales', {
        ...(editing || {}),
        id: editing ? editing.id : uid(),
        updatedAt: editing ? editing.updatedAt : 0,
        date: form.date,
        customerId: form.customerId,
        items: JSON.stringify(items),
        totalAmount: grandTotal,
        settledStatus: status,
        paidAmount: Math.min(paid, grandTotal),
        paymentMethod: status === 'UNPAID' ? null : (form.paymentMethod || 'CASH'),
        checkDueDate: form.paymentMethod === 'CHECK' ? (form.checkDueDate || null) : null,
        checkNumber: form.paymentMethod === 'CHECK' ? (form.checkNumber || null) : null,
        checkBank: form.paymentMethod === 'CHECK' ? (form.checkBank || null) : null,
        paymentDate: status === 'PAID' ? (form.paymentDate || null) : (form.paymentDate || null),
        note: form.note || null,
        accountId: form.accountId || null,
        discountType: form.discountType,
        discountValue: discountAmount,
        invoiceNumber: editing?.invoiceNumber ?? null,
        createdBy: editing?.createdBy ?? (getActiveUser() || null),
        deleted: 0,
      })
      toast({ title: editing ? 'فروش ویرایش شد' : 'فروش ثبت شد', description: `${faMoney(grandTotal)} تومان` })
      setOpen(false)
      setEditing(null)
    } catch (e) {
      // v3.1.4 — هیچ شکست ذخیره‌ای بی‌صدا نیست: پیام واقعی خطا دیده می‌شود
      console.error('sale save failed', e)
      toast({
        title: 'ثبت فروش انجام نشد',
        description: e instanceof Error ? e.message : 'خطای ذخیره‌سازی محلی — صفحه را دوباره باز کنید.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const quickSettle = async (s: Sale) => {
    await putRecord<Sale>('sales', { ...s, settledStatus: 'PAID', paidAmount: s.totalAmount, paymentDate: s.paymentDate || todayJalali() })
    toast({ title: 'تسویه شد', description: `${faMoney(saleDue(s))} تومان` })
  }

  const list = [...sales]
    .filter(s => !s.deleted)
    .filter(s => filter === 'all' || effectiveSettled(s) !== 'PAID')
    // v3.1.4 — مرتب‌سازی بر اساس آخرین ثبت/به‌روزرسانی: جدیدترین فاکتورِ ثبت‌شده بالا
    .sort((a, b) => ((b.updatedAt || 0) - (a.updatedAt || 0)) || (b.date || '').localeCompare(a.date || ''))
    .slice(0, 60)

  // ===== فاکتور (v2.8) =====
  const invoiceCtx = useCallback((): InvoiceCtx => {
    // سربرگ فاکتور طبق سند: «نان بستنی آرتا» — اگر کاربر در تنظیمات نام دیگری گذاشته باشد همان استفاده می‌شود
    const title = !setting.businessName || setting.businessName === 'Waffly' ? 'نان بستنی آرتا' : setting.businessName
    const phones = (setting.shopPhones || DEFAULT_BANK.shopPhones).split(/[،,]/).map(x => x.trim()).filter(Boolean)
    return {
      businessName: title,
      phones,
      bank: {
        accountName: setting.bankAccountName || DEFAULT_BANK.bankAccountName,
        cardNumber: setting.bankCardNumber || DEFAULT_BANK.bankCardNumber,
        sheba: setting.bankSheba || DEFAULT_BANK.bankSheba,
        bankName: setting.bankName || DEFAULT_BANK.bankName,
      },
      nameOf: (id, kind) => {
        if (kind === 'GOOD') return goods.find(g => g.id === id)?.name || 'کالا'
        return breadTypes.find(b => b.id === id)?.name || goods.find(g => g.id === id)?.name || 'قلم فروش'
      },
    }
  }, [setting, breadTypes, goods])

  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null)
  const [invoiceSales, setInvoiceSales] = useState<Sale[]>([])
  const [invoiceModel, setInvoiceModel] = useState<InvoiceModel | null>(null)
  const [invoiceKey, setInvoiceKey] = useState('')
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [multiMode, setMultiMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchNextNumber = async (): Promise<number | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/invoice/next-number`, { method: 'POST' })
      if (!res.ok) return null
      const data = await res.json() as { number?: number }
      return data.number && data.number > 0 ? data.number : null
    } catch { return null }
  }

  // لحظهٔ صدور — شماره از سرور + ثبت روی رکورد (فروش یا فاکتور ترکیبی) — آفلاین = پیش‌نویس
  const getNumberForInvoice = async (m: InvoiceModel): Promise<number | null> => {
    const n = await fetchNextNumber()
    if (!n) return null
    if (invoiceSale) {
      const next = { ...invoiceSale, invoiceNumber: n }
      await putRecord<Sale>('sales', next)
      setInvoiceSale(next)
    } else if (invoiceSales.length > 0) {
      await putRecord<CombinedInvoice>('combinedInvoices', combinedInvoiceRecord({ ...m, number: n }, invoiceSales, getActiveUser() || null))
    }
    return n
  }

  const issueInvoiceFor = (s: Sale) => {
    setInvoiceSale(s)
    setInvoiceSales([])
    setInvoiceModel(buildSaleInvoice(s, invoiceCtx(), customers.find(c => c.id === s.customerId)))
    setInvoiceKey(`sale-${s.id}`)
    setInvoiceOpen(true)
  }

  const toggleSelect = (id: string) => setSelectedIds(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]))
  const selectedSales = sales.filter(s => !s.deleted && selectedIds.includes(s.id))
  const selectionValid = selectedSales.length > 0 && new Set(selectedSales.map(s => s.customerId)).size === 1

  const issueCombined = () => {
    if (!selectionValid) return
    const sel = selectedSales
    setInvoiceSale(null)
    setInvoiceSales(sel)
    setInvoiceModel(buildCombinedInvoice(sel, invoiceCtx(), customers.find(c => c.id === sel[0].customerId)))
    setInvoiceKey(`combined-${Date.now()}`)
    setInvoiceOpen(true)
  }

  const cName = (id: string) => customers.find(c => c.id === id)?.name || 'نامشخص'
  const accName = (id: string | null | undefined) => accounts.find(a => a.id === id && !a.deleted)?.name
  const btLabel = (id: string) => {
    const g = goods.find(x => x.id === id)
    if (g) return g.name
    const b = breadTypes.find(x => x.id === id)
    return b ? b.name : 'کالا'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {([['all', 'همه'], ['unpaid', 'تسویه‌نشده']] as const).map(([k, label]) => (
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
        <div className="flex gap-2">
          <Button
            variant={multiMode ? 'default' : 'outline'}
            className="h-11"
            onClick={() => { setMultiMode(v => !v); setSelectedIds([]); if (!multiMode) setFilter('unpaid') }}
          >
            <ListChecks className="ml-1 h-4 w-4" /> فاکتور ترکیبی
          </Button>
          <Button onClick={openNew} className="h-11"><Plus className="ml-1 h-4 w-4" /> فروش جدید</Button>
        </div>
      </div>

      {multiMode && (
        <div className="rounded-xl border bg-primary/5 p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs waffly-num">{faDigits(selectedIds.length)} فروش انتخاب شد</span>
          {selectedIds.length > 0 && !selectionValid && (
            <span className="text-[11px] text-red-600">فروش‌های انتخابی باید همه برای یک مشتری باشند</span>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setSelectedIds(list.map(s => s.id))}>
            انتخاب همهٔ نمایش‌داده‌شده
          </Button>
          <Button size="sm" className="h-8 text-[11px]" disabled={!selectionValid} onClick={issueCombined}>
            <FileText className="h-3.5 w-3.5" /> صدور فاکتور ترکیبی
          </Button>
        </div>
      )}

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
                  <div key={s.id} className={cn('rounded-xl border p-3 space-y-2', multiMode && selectedIds.includes(s.id) && 'border-primary bg-primary/5')}>
                    <div className="flex flex-wrap items-center gap-2">
                      {multiMode && (
                        <input
                          type="checkbox"
                          aria-label="انتخاب برای فاکتور ترکیبی"
                          className="h-4 w-4 accent-violet-600 shrink-0"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      )}
                      <p className="text-sm font-bold">{cName(s.customerId)}</p>
                      <span className="text-[11px] text-muted-foreground waffly-num">{prettyJalali(s.date)}</span>
                      {(() => {
                        const pmLabel = st === 'UNPAID' ? 'تسویه نشده' : (PAY_LABELS[String(s.paymentMethod || '')] || '')
                        return pmLabel ? <span className={cn('text-[10px] rounded px-1.5 py-0.5 border', st === 'UNPAID' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-muted border-transparent')}>{pmLabel}</span> : null
                      })()}
                      {s.paymentMethod === 'CHECK' && s.checkDueDate && (
                        <span className="text-[10px] rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 waffly-num">چک: {prettyJalali(s.checkDueDate)}</span>
                      )}
                      {s.invoiceNumber ? (
                        <span className="text-[10px] rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 waffly-num">فاکتور {faDigits(s.invoiceNumber)}</span>
                      ) : null}
                      <div className="flex-1" />
                      <SettleBadge status={st} paid={s.paidAmount} total={s.totalAmount} />
                      <Money value={s.totalAmount} className="font-bold text-sm" />
                      <span className="text-[10px] text-muted-foreground">تومان</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="فاکتور"
                        onClick={() => issueInvoiceFor(s)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                        onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                        onClick={() => void confirmRemove(confirm, 'sales', s.id, 'حذف فروش', `آیا از حذف فروش «${cName(s.customerId)}» به مبلغ ${faMoney(s.totalAmount)} تومان مطمئن هستید؟ این عملیات قابل بازگشت نیست.`)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground waffly-num flex flex-wrap items-center gap-x-1">
                      {items.map((it, i) => {
                        const isGoodRow = it.kind === 'GOOD' || goods.some(g => g.id === it.breadTypeId)
                        return (
                          <span key={i} className="inline-flex items-center gap-1">
                            {btLabel(it.breadTypeId)} × {faDigits(it.delivered || it.qty)}{isGoodRow ? ' جعبه' : ''}
                            {it.boxCode && (
                              <code className="rounded bg-primary/5 border border-primary/20 px-1 py-px text-[10px] font-bold" dir="ltr">{it.boxCode}</code>
                            )}
                          </span>
                        )
                      })}
                      {s.paymentDate && ` • وصول: ${prettyJalali(s.paymentDate)}`}
                      {accName(s.accountId) && ` • حساب: ${accName(s.accountId)}`}
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
        open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null) }}
        isEdit={!!editing}
        form={form} setForm={setForm}
        customers={active(customers)} breadTypes={active(breadTypes)} goods={active(goods).filter(g => g.active !== 0)}
        accounts={accounts.filter(a => !a.deleted)} breadStock={breadStock} lastPrice={lastPrice}
        itemsTotal={itemsTotal} returnTotal={returnTotal} discountAmount={discountAmount} grandTotal={grandTotal}
        saving={saving}
        onSave={() => requireUserName(() => { void save() })}
        onQuickAddCustomer={async (name) => {
          const id = uid()
          await putRecord<Customer>('customers', { id, name, phone: null, address: null, cooperationType: null, updatedAt: 0, deleted: 0 })
          setForm(f => ({ ...f, customerId: id }))
          toast({ title: 'مشتری اضافه شد', description: name })
        }}
      />
      <InvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} model={invoiceModel} invoiceKey={invoiceKey} getNumber={getNumberForInvoice} />
      {confirmDialog}
    </div>
  )
}

function SaleFormDialog({ open, onOpenChange, isEdit, form, setForm, customers, breadTypes, goods, accounts, breadStock, lastPrice, itemsTotal, returnTotal, discountAmount, grandTotal, onSave, onQuickAddCustomer, saving }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isEdit?: boolean
  form: {
    date: string; customerId: string; items: SaleItem[]
    settledStatus: Sale['settledStatus']; paidAmount: string
    paymentMethod: Sale['paymentMethod']; checkDueDate: string; checkNumber: string; checkBank: string
    paymentDate: string; note: string; accountId: string
    discountType: DiscountType; discountValue: string
  }
  setForm: React.Dispatch<React.SetStateAction<{
    date: string; customerId: string; items: SaleItem[]
    settledStatus: Sale['settledStatus']; paidAmount: string
    paymentMethod: Sale['paymentMethod']; checkDueDate: string; checkNumber: string; checkBank: string
    paymentDate: string; note: string; accountId: string
    discountType: DiscountType; discountValue: string
  }>>
  customers: Customer[]
  breadTypes: BreadType[]
  goods: Good[]
  accounts: Account[]
  breadStock: Map<string, number>
  lastPrice: Map<string, number>
  itemsTotal: number
  returnTotal: number
  discountAmount: number
  grandTotal: number
  onSave: () => void
  onQuickAddCustomer: (name: string) => void
  saving?: boolean
}) {
  const [newCustomer, setNewCustomer] = useState('')
  const updateItem = (idx: number, patch: Partial<SaleItem>) => {
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))
  }
  const isGoodItem = (it: SaleItem) => it.kind === 'GOOD' || goods.some(g => g.id === it.breadTypeId)
  // v3.2.0 — انتخاب کد جعبه از فرم فروش حذف شد؛ فروش = کالا + تعداد، از موجودی همان کالا کم می‌شود
  // و قیمت پیش‌فرض هر کالا از آخرین فروش همان کالا می‌آید
  const itemOptions = [
    ...breadTypes.map(b => {
      const st = breadStock.get(b.id)
      return { value: b.id, label: b.name, hint: st != null ? `مانده انبار: ${faDigits(Math.max(0, st))} عدد` : undefined }
    }),
    ...goods.map(g => ({ value: g.id, label: g.name, hint: 'جعبه‌ای' })),
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش فروش' : 'ثبت فروش'}</DialogTitle>
          <DialogDescription>{isEdit ? 'همهٔ فیلدها و اقلام قابل تغییر است؛ موجودی و آمار بعد از ذخیره خودکار اصلاح می‌شود.' : 'کالا را انتخاب کنید (قیمت پیش‌فرض از آخرین فروش می‌آید)، تعداد را بزنید و جمع هر ردیف همان‌جا حساب می‌شود؛ از موجودی تولید همان کالا هم کم می‌شود.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="تاریخ فروش">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="مشتری">
              <InlinePicker
                value={form.customerId}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                onChange={v => setForm(f => ({ ...f, customerId: v }))}
                placeholder="انتخاب مشتری"
              />
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
            {form.items.map((it, idx) => {
              const isGood = isGoodItem(it)
              const stock = !isGood && it.breadTypeId ? breadStock.get(it.breadTypeId) : undefined
              const overStock = stock != null && (it.qty || 0) > stock
              const rowTotal = (it.qty || 0) * (it.unitPrice || 0)
              return (
              <div key={idx} className="rounded-xl border p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <InlinePicker
                    value={it.breadTypeId}
                    options={itemOptions}
                    onChange={v => {
                      const g = goods.some(x => x.id === v)
                      // v3.2.0 — قیمت پیش‌فرض از آخرین فروش همان کالا می‌آید (در صورت نیاز قابل تغییر است)
                      updateItem(idx, { breadTypeId: v, kind: g ? 'GOOD' : 'BREAD', unitPrice: lastPrice.get(v) ?? it.unitPrice ?? 0, boxId: undefined, boxCode: undefined })
                    }}
                    placeholder="کالا"
                    buttonClassName="h-10 text-xs"
                  />
                  <Input
                    inputMode="decimal" className="waffly-num-input h-10 text-xs"
                    placeholder={isGood ? 'تعداد جعبه' : 'تعداد'}
                    value={it.qty || ''}
                    onChange={e => {
                      const q = parseFloat(e.target.value) || 0
                      updateItem(idx, { qty: q, delivered: q })
                    }}
                  />
                  <Input
                    inputMode="decimal" className="waffly-num-input h-10 text-xs"
                    placeholder={isGood ? 'قیمت هر جعبه' : 'قیمت هر نان'}
                    value={it.unitPrice || ''}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      updateItem(idx, { unitPrice: v })
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-600" aria-label="حذف قلم"
                    onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* v3.2.0 — جمع هر ردیف داخل همان باکس نمایش داده می‌شود */}
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5">
                  <span className="text-[10px] text-muted-foreground">جمع این ردیف</span>
                  <span className={cn('text-xs font-bold waffly-num', overStock && 'text-red-600')}>{faMoney(rowTotal)} تومان</span>
                </div>
                {overStock && (
                  <p className="text-[10px] text-red-600">موجودی کافی نیست — ماندهٔ انبار این کالا: {faDigits(Math.max(0, stock || 0))} عدد</p>
                )}
                {isGood && (
                  <p className="text-[10px] text-muted-foreground">این کالا با واحد «جعبه» ثبت می‌شود — تحویل و برگشتی هم جعبه‌ای است.</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>تحویل واقعی{isGood ? ' (جعبه)' : ''}</span>
                    <Input
                      inputMode="decimal" className="waffly-num-input h-9 text-xs"
                      value={it.delivered || ''}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        updateItem(idx, { delivered: v })
                      }}
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>برگشتی/خراب{isGood ? ' (جعبه)' : ''}</span>
                    <Input
                      inputMode="decimal" className="waffly-num-input h-9 text-xs"
                      value={it.returned || ''}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        updateItem(idx, { returned: v })
                      }}
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground space-y-1">
                    <span>هزینه برگشتی (تومان)</span>
                    <Input inputMode="decimal" className="waffly-num-input h-9 text-xs" value={it.returnCost || ''} onChange={e => updateItem(idx, { returnCost: parseFloat(e.target.value) || 0 })} />
                  </label>
                </div>
              </div>
              )
            })}
            <Button variant="outline" className="w-full h-10" onClick={() => setForm(f => ({ ...f, items: [...f.items, { breadTypeId: '', qty: 0, unitPrice: 0, delivered: 0, returned: 0, returnCost: 0, kind: 'BREAD' } as SaleItem] }))}>
              <Plus className="h-4 w-4" /> افزودن قلم
            </Button>
          </div>

          {/* جمع */}
          <div className="rounded-xl bg-muted/60 border p-3 space-y-1 text-xs waffly-num">
            <div className="flex justify-between"><span>جمع اقلام</span><span>{faMoney(itemsTotal)}</span></div>
            {returnTotal > 0 && <div className="flex justify-between text-red-600"><span>هزینه برگشتی</span><span>−{faMoney(returnTotal)}</span></div>}
            {discountAmount > 0 && <div className="flex justify-between text-emerald-700 font-medium"><span>تخفیف</span><span>−{faMoney(discountAmount)}</span></div>}
            <div className="flex justify-between font-bold text-sm pt-1 border-t"><span>مبلغ نهایی</span><span>{faMoney(grandTotal)} تومان</span></div>
          </div>

          {/* تخفیف (v2.8) */}
          <div className="rounded-xl border p-3">
            <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr] gap-2 items-center">
              <span className="text-xs font-medium flex items-center gap-1 whitespace-nowrap"><Percent className="h-3.5 w-3.5" /> تخفیف:</span>
              <InlinePicker
                value={form.discountType}
                options={[
                  { value: 'NONE', label: 'بدون تخفیف' },
                  { value: 'AMOUNT', label: 'مبلغ ثابت (تومان)' },
                  { value: 'PERCENT', label: 'درصد از جمع' },
                ]}
                onChange={v => setForm(f => ({ ...f, discountType: v as DiscountType }))}
                buttonClassName="h-9 text-xs"
              />
              {form.discountType !== 'NONE' && (
                <Input
                  inputMode="decimal" className="waffly-num-input h-9 text-xs col-span-2 sm:col-span-1"
                  placeholder={form.discountType === 'PERCENT' ? 'مثلاً ۱۰' : 'مبلغ به تومان'}
                  value={form.discountValue}
                  onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                />
              )}
            </div>
          </div>

          {/* تسویه */}
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="وضعیت تسویه">
              <InlinePicker
                value={form.settledStatus}
                options={[
                  { value: 'PAID', label: 'تسویه‌شده کامل' },
                  { value: 'PARTIAL', label: 'پرداخت جزئی' },
                  { value: 'UNPAID', label: 'پرداخت‌نشده' },
                ]}
                onChange={v => setForm(f => ({ ...f, settledStatus: v as Sale['settledStatus'], ...(v === 'UNPAID' ? { paymentMethod: null } : {}) }))}
              />
            </FormRow>
            {form.settledStatus === 'PARTIAL' && (
              <FormRow label="مبلغ پرداخت‌شده (تومان)">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </FormRow>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FormRow label="روش پرداخت" hint={form.settledStatus === 'UNPAID' ? 'با وضعیت «تسویه نشده» روش پرداختی ثبت نمی‌شود' : undefined}>
              {/* v3.1.4 + v3.2.0 — تا وقتی وضعیت تسویه «پرداخت‌نشده» است، روش پرداخت غیرفعال است و «تسویه نشده» نشان می‌دهد */}
              <InlinePicker
                value={form.paymentMethod || ''}
                options={PAY_METHODS.map(p => ({ value: p.key, label: p.label }))}
                onChange={v => setForm(f => ({ ...f, paymentMethod: v as Sale['paymentMethod'] }))}
                disabled={form.settledStatus === 'UNPAID'}
                placeholder="تسویه نشده"
              />
            </FormRow>
            <FormRow label="تاریخ وصول واقعی" hint="اگر با تاریخ فروش متفاوت است">
              <JalaliDateInput value={form.paymentDate} onChange={v => setForm(f => ({ ...f, paymentDate: v }))} />
            </FormRow>
          </div>
          <FormRow label="واریز به حساب" hint="مبلغ پرداختی این فروش به این حساب اضافه می‌شود (در بخش حسابداری ← حساب‌ها)">
            <InlinePicker
              value={form.accountId}
              options={[{ value: '', label: 'بدون حساب (فقط ثبت فروش)' }, ...accounts.map(a => ({ value: a.id, label: a.name, hint: a.kind === 'BANK' ? 'حساب بانکی' : 'صندوق نقدی' }))]}
              onChange={v => setForm(f => ({ ...f, accountId: v }))}
              placeholder="انتخاب حساب (اختیاری)"
            />
          </FormRow>
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
          <Button onClick={onSave} disabled={saving}>{saving ? 'در حال ذخیره…' : (isEdit ? 'ذخیره تغییرات' : 'ثبت فروش')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ================= مشتریان =================
function CustomersTab() {
  const customers = useTable<Customer>('customers')
  const sales = useTable<Sale>('sales')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', cooperationType: '' })

  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', cooperationType: c.cooperationType || '' }) }

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'نام مشتری لازم است', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<Customer>('customers', {
        ...editing,
        name: form.name.trim(),
        phone: form.phone || null,
        address: form.address || null,
        cooperationType: form.cooperationType || null,
      })
      toast({ title: 'مشتری ویرایش شد' })
    } else {
      await putRecord<Customer>('customers', {
        id: uid(),
        name: form.name.trim(),
        phone: form.phone || null,
        address: form.address || null,
        cooperationType: form.cooperationType || null,
        updatedAt: 0, deleted: 0,
      })
      toast({ title: 'مشتری ذخیره شد' })
    }
    setForm({ name: '', phone: '', address: '', cooperationType: '' })
    setEditing(null)
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
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> {editing ? `ویرایش مشتری: ${editing.name}` : 'مشتری جدید'}</CardTitle>
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
          <Button className="w-full h-11" onClick={save}>{editing ? 'ذخیره تغییرات' : 'ذخیره مشتری'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ name: '', phone: '', address: '', cooperationType: '' }) }}>انصراف از ویرایش</Button>}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                      onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'customers', c.id, 'حذف مشتری', `آیا از حذف «${c.name}» مطمئن هستید؟ فروش‌های قبلی او حفظ می‌شوند ولی نامش «نامشخص» نمایش داده می‌شود.`)}>
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

// ================= بدحساب‌ها =================
function DebtsTab() {
  const sales = useTable<Sale>('sales')
  const customers = useTable<Customer>('customers')
  const { confirm, element: confirmDialog } = useConfirm()
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
                  onClick={() => void confirmRemove(confirm, 'sales', s.id, 'حذف فروش', `آیا از حذف فروش «${c?.name || 'نامشخص'}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  )
}
