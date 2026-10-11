'use client'

// هزینه‌ها (v3.0) — ثبت هزینه‌های جاری (دستمزد، کرایه، برق، گاز…) با سرفصل و دخالت در سود
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { Wallet, Plus, Trash2, Pencil, Tags, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, TabsBar, EmptyState, Money, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, putRecord, uid, getActiveUser } from '@/lib/localdb'
import type { Expense, ExpenseCategory, Account } from '@/lib/types'
import { todayJalali, faDigits, prettyJalali, parseJalali } from '@/lib/jalali'
import { active } from '@/lib/calc'
import { exportRowsToExcel } from '@/lib/export'

type Tab = 'entry' | 'categories'

export function ExpensesView() {
  const [tab, setTab] = useState<Tab>('entry')
  return (
    <div>
      <PageHeader
        title="هزینه‌ها"
        subtitle="ثبت هزینه‌های جاری کسب‌وکار — دستمزد، کرایه، برق، گاز — که در سود خالص حسابداری لحاظ می‌شود"
        icon={<Wallet className="h-5 w-5" />}
      />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'entry', label: 'ثبت و پیگیری' },
          { key: 'categories', label: 'سرفصل‌ها' },
        ]}
      />
      {tab === 'entry' && <EntryTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  )
}

// ================= ثبت و پیگیری =================
function EntryTab() {
  const expenses = useTable<Expense>('expenses')
  const categories = useTable<ExpenseCategory>('expenseCategories')
  const accounts = useTable<Account>('accounts')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Expense | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: todayJalali(), categoryId: '', amount: '', description: '', accountId: '' })
  const [monthFilter, setMonthFilter] = useState('') // YYYY/MM — خالی = همه

  const liveCats = active(categories)
  const catName = (id: string) => categories.find(c => c.id === id)?.name || 'نامشخص'

  const openNew = () => {
    setEditing(null)
    setForm({ date: todayJalali(), categoryId: active(categories)[0]?.id || '', amount: '', description: '', accountId: '' })
    setOpen(true)
  }

  const openEdit = (e: Expense) => {
    setEditing(e)
    setForm({ date: e.date, categoryId: e.categoryId, amount: String(e.amount || ''), description: e.description || '', accountId: e.accountId || '' })
    setOpen(true)
  }

  const save = async () => {
    const amount = parseFloat(form.amount || '0') || 0
    if (!form.categoryId || amount <= 0) {
      toast({ title: 'سرفصل و مبلغ را درست وارد کنید', variant: 'destructive' })
      return
    }
    await putRecord<Expense>('expenses', {
      ...(editing || {}),
      id: editing ? editing.id : uid(),
      updatedAt: editing ? editing.updatedAt : 0,
      date: form.date,
      categoryId: form.categoryId,
      amount,
      description: form.description.trim() || null,
      accountId: form.accountId || null,
      createdBy: editing?.createdBy ?? (getActiveUser() || null),
      deleted: 0,
    })
    toast({ title: editing ? 'هزینه ویرایش شد' : 'هزینه ثبت شد', description: `${catName(form.categoryId)} — ${faDigits(amount)} تومان` })
    setOpen(false)
    setEditing(null)
  }

  // فیلتر ماه جاری ماهانه + آمار
  const list = useMemo(() => {
    return [...expenses]
      .filter(e => !e.deleted)
      .filter(e => {
        if (!monthFilter) return true
        const p = parseJalali(e.date)
        return p ? `${p.jy}/${String(p.jm).padStart(2, '0')}` === monthFilter : true
      })
      .sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt))
      .slice(0, 120)
  }, [expenses, monthFilter])

  const total = list.reduce((a, e) => a + (e.amount || 0), 0)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of list) m.set(e.categoryId, (m.get(e.categoryId) || 0) + (e.amount || 0))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [list])

  // ماه‌های موجود برای فیلتر
  const months = useMemo(() => {
    const s = new Set<string>()
    for (const e of expenses.filter(x => !x.deleted)) {
      const p = parseJalali(e.date)
      if (p) s.add(`${p.jy}/${String(p.jm).padStart(2, '0')}`)
    }
    return [...s].sort().reverse()
  }, [expenses])

  const exportExcel = () => {
    exportRowsToExcel(
      `Waffly-Expenses-${todayJalali().replace(/\//g, '-')}.xlsx`,
      'هزینه‌ها',
      ['تاریخ', 'سرفصل', 'شرح', 'مبلغ (تومان)', 'حساب', 'ثبت‌کننده'],
      list.map(e => {
        const acc = accounts.find(a => a.id === e.accountId)
        return [prettyJalali(e.date), catName(e.categoryId), e.description || '', e.amount || 0, acc?.name || '', e.createdBy || '']
      }),
    )
    toast({ title: 'اکسل هزینه‌ها دانلود شد' })
  }

  const accName = (id: string | null | undefined) => accounts.find(a => a.id === id)?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openNew} className="h-11"><Plus className="ml-1 h-4 w-4" /> ثبت هزینه جدید</Button>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="h-11 rounded-xl border bg-card px-3 text-sm"
            aria-label="فیلتر ماه"
          >
            <option value="">همه ماه‌ها</option>
            {months.map(m => <option key={m} value={m}>{m.replace('/', ' / ')}</option>)}
          </select>
        </div>
        <Button variant="outline" className="h-11" onClick={exportExcel} disabled={list.length === 0}>خروجی اکسل</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="waffly-card">
          <CardContent className="pt-4">
            <p className="text-[11px] text-muted-foreground">{monthFilter ? 'جمع هزینه ماه انتخابی' : 'جمع کل هزینه‌ها'}</p>
            <Money value={total} className="text-lg font-black" />
          </CardContent>
        </Card>
        <Card className="waffly-card">
          <CardContent className="pt-4">
            <p className="text-[11px] text-muted-foreground">تعداد رکوردها</p>
            <p className="text-lg font-black waffly-num">{faDigits(list.length)}</p>
          </CardContent>
        </Card>
        <Card className="waffly-card col-span-2 lg:col-span-1">
          <CardContent className="pt-4">
            <p className="text-[11px] text-muted-foreground mb-1.5">تفکیک سرفصل (بیشترین)</p>
            <div className="flex flex-wrap gap-1.5">
              {byCat.slice(0, 4).map(([id, v]) => (
                <span key={id} className="rounded-lg bg-muted/60 border px-2 py-0.5 text-[10px] waffly-num">
                  {catName(id)}: {faDigits(v)}
                </span>
              ))}
              {byCat.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="waffly-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> هزینه‌های ثبت‌شده</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState
              title="هزینه‌ای ثبت نشده"
              desc="هزینه‌های جاری مثل دستمزد کارگران، کرایه، برق و گاز را ثبت کنید تا در محاسبه سود خالص حسابداری دخالت داده شود."
              icon={<Wallet className="h-5 w-5" />}
            />
          ) : (
            <div className="max-h-[480px] overflow-y-auto thin-scroll space-y-1.5">
              {list.map(e => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{catName(e.categoryId)}{e.description ? ` — ${e.description}` : ''}</p>
                    <p className="text-[11px] text-muted-foreground waffly-num">
                      {prettyJalali(e.date)}{accName(e.accountId) ? ` • از ${accName(e.accountId)}` : ''}{e.createdBy ? ` • ${e.createdBy}` : ''}
                    </p>
                  </div>
                  <Money value={e.amount || 0} className="text-sm font-bold" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" aria-label="ویرایش" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 shrink-0" aria-label="حذف"
                    onClick={() => void confirmRemove(confirm, 'expenses', e.id, 'حذف هزینه', `آیا از حذف این هزینه (${catName(e.categoryId)} — ${faDigits(e.amount || 0)} تومان) مطمئن هستید؟ محاسبات سود به‌روز می‌شود.`)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ ثبت/ویرایش */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</DialogTitle>
            <DialogDescription>هزینه‌های مشمول سود در گزارش حسابداری از سود کسر می‌شوند (سرفصل «برداشت شخصی» مشمول نیست).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="سرفصل هزینه">
              <InlinePicker
                value={form.categoryId}
                options={liveCats.map(c => ({ value: c.id, label: c.name, hint: (c.includeInProfit ?? 1) === 1 ? 'مشمول سود' : 'غیرمشمول' }))}
                onChange={v => setForm(f => ({ ...f, categoryId: v }))}
                placeholder="انتخاب کنید"
              />
            </FormRow>
            <FormRow label="مبلغ (تومان)">
              <Input inputMode="numeric" className="waffly-num-input h-11" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="۰" />
            </FormRow>
            <FormRow label="تاریخ (شمسی)">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            {accounts.length > 0 && (
              <FormRow label="پرداخت از حساب (اختیاری)" hint="موجودی آن حساب کم می‌شود">
                <InlinePicker
                  value={form.accountId}
                  options={[{ value: '', label: 'بدون اتصال به حساب' }, ...active(accounts).map(a => ({ value: a.id, label: a.name }))]}
                  onChange={v => setForm(f => ({ ...f, accountId: v }))}
                  placeholder="انتخاب کنید"
                />
              </FormRow>
            )}
            <FormRow label="شرح (اختیاری)">
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-11" placeholder="مثلاً کرایه ماه، حقوق شهریور…" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>انصراف</Button>
            <Button onClick={save}>{editing ? 'ذخیره تغییرات' : 'ثبت هزینه'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}

// ================= سرفصل‌ها =================
function CategoriesTab() {
  const categories = useTable<ExpenseCategory>('expenseCategories')
  const expenses = useTable<Expense>('expenses')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [name, setName] = useState('')
  const [includeInProfit, setIncludeInProfit] = useState(true)

  const openEdit = (c: ExpenseCategory) => {
    setEditing(c)
    setName(c.name)
    setIncludeInProfit((c.includeInProfit ?? 1) === 1)
  }

  const save = async () => {
    const n = name.trim()
    if (!n) { toast({ title: 'نام سرفصل را وارد کنید', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<ExpenseCategory>('expenseCategories', { ...editing, name: n, includeInProfit: includeInProfit ? 1 : 0 })
      toast({ title: 'سرفصل ویرایش شد' })
    } else {
      await putRecord<ExpenseCategory>('expenseCategories', { id: uid(), name: n, includeInProfit: includeInProfit ? 1 : 0, updatedAt: 0, deleted: 0 })
      toast({ title: 'سرفصل اضافه شد' })
    }
    setName('')
    setIncludeInProfit(true)
    setEditing(null)
  }

  const usageCount = (id: string) => expenses.filter(e => !e.deleted && e.categoryId === id).length

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Tags className="h-4 w-4" /> {editing ? `ویرایش سرفصل: ${editing.name}` : 'افزودن سرفصل'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow label="نام سرفصل" hint="مثلاً: کرایه مغازه، حقوق کارگر، برق و گاز">
            <Input value={name} onChange={e => setName(e.target.value)} className="h-11" />
          </FormRow>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-xs font-bold">مشمول سود</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">در محاسبه سود خالص از سود کسر شود</p>
            </div>
            <Switch checked={includeInProfit} onCheckedChange={setIncludeInProfit} />
          </div>
          <Button className="w-full h-11" onClick={save}><Plus className="ml-1 h-4 w-4" /> {editing ? 'ذخیره تغییرات' : 'افزودن'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setName(''); setIncludeInProfit(true) }}>انصراف از ویرایش</Button>}
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">سرفصل‌های هزینه ({faDigits(active(categories).length)})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {active(categories).map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium flex-1">{c.name}</span>
                <span className={`text-[10px] rounded-full px-2 py-0.5 ${(c.includeInProfit ?? 1) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {(c.includeInProfit ?? 1) === 1 ? 'مشمول سود' : 'غیرمشمول'}
                </span>
                <span className="text-[10px] text-muted-foreground waffly-num hidden sm:inline">{faDigits(usageCount(c.id))} رکورد</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void confirmRemove(confirm, 'expenseCategories', c.id, 'حذف سرفصل', `آیا از حذف سرفصل «${c.name}» مطمئن هستید؟ هزینه‌های قبلی این سرفصل با نام «نامشخص» نمایش داده می‌شوند.`)}>
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
