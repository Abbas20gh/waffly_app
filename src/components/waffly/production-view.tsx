'use client'

// تولید — ثبت روزانه، جعبه‌ها و کدها، مصرف مواد، انواع نان
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { Wheat, Package, Trash2, Boxes, Plus, Cookie } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader, FormRow, TabsBar, EmptyState, Num } from './bits'
import { JalaliDateInput } from './jalali-date'
import { useTable, useDexie, dexie, putRecord, putMany, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { BreadType, Box, Production, Material, Consumption } from '@/lib/types'
import { todayJalali, faDigits, parseJalali, prettyJalali, addJalaliDays } from '@/lib/jalali'
import { boxCode } from '@/lib/boxcode'
import { active } from '@/lib/calc'

type Tab = 'daily' | 'boxes' | 'consumption' | 'types'

export function ProductionView() {
  const [tab, setTab] = useState<Tab>('daily')
  return (
    <div>
      <PageHeader title="تولید" subtitle="ثبت تولید روزانه، جعبه‌ها با کد یکتا، ضایعات و مصرف مواد" icon={<Wheat className="h-5 w-5" />} />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'daily', label: 'ثبت تولید روزانه' },
          { key: 'boxes', label: 'جعبه‌ها و کدها' },
          { key: 'consumption', label: 'مصرف مواد' },
          { key: 'types', label: 'انواع نان' },
        ]}
      />
      {tab === 'daily' && <DailyTab />}
      {tab === 'boxes' && <BoxesTab />}
      {tab === 'consumption' && <ConsumptionTab />}
      {tab === 'types' && <TypesTab />}
    </div>
  )
}

// ================= ثبت تولید روزانه =================
function DailyTab() {
  const breadTypes = useTable<BreadType>('breadTypes')
  const productions = useTable<Production>('productions')
  const [open, setOpen] = useState(false)

  const editing = null // ثبت جدید
  const [form, setForm] = useState({
    date: todayJalali(),
    breadTypeId: '',
    totalProduced: '',
    boxesCount: '',
    perBoxCount: '',
    waste: '',
    carriedFrom: '',
    note: '',
  })
  const bt = breadTypes.find(b => b.id === form.breadTypeId)

  const openNew = () => {
    setForm({ date: todayJalali(), breadTypeId: active(breadTypes)[0]?.id || '', totalProduced: '', boxesCount: '', perBoxCount: '', waste: '', carriedFrom: '', note: '' })
    setOpen(true)
  }

  // پیش‌نمایش کدهای جعبه
  const previewCodes = useMemo(() => {
    const boxes = parseInt(form.boxesCount || '0', 10)
    const per = parseInt(form.perBoxCount || '0', 10)
    if (!bt || boxes <= 0) return []
    const n = Math.min(boxes, 5)
    const codes: string[] = []
    for (let i = 0; i < n; i++) codes.push(boxCode(bt.code, form.date, per, i + 1))
    return codes
  }, [bt, form.boxesCount, form.perBoxCount, form.date])

  const save = async () => {
    if (!form.breadTypeId || !bt) { toast({ title: 'نوع نان را انتخاب کنید', variant: 'destructive' }); return }
    const total = parseFloat(form.totalProduced || '0')
    const boxes = parseInt(form.boxesCount || '0', 10)
    const per = parseInt(form.perBoxCount || '0', 10)
    const waste = parseFloat(form.waste || '0')
    if (total <= 0 && boxes <= 0) { toast({ title: 'تعداد تولید یا جعبه را وارد کنید', variant: 'destructive' }); return }

    const prodId = uid()
    await putRecord<Production>('productions', {
      id: prodId,
      date: form.date,
      breadTypeId: bt.id,
      totalProduced: total || boxes * per,
      boxesCount: boxes,
      perBoxCount: per,
      waste: waste || 0,
      carriedFrom: form.carriedFrom || null,
      note: form.note || null,
      createdBy: getActiveUser() || null,
      updatedAt: 0,
      deleted: 0,
    })
    // ساخت کدهای یکتای جعبه‌ها
    if (boxes > 0 && per > 0) {
      const boxRows: Box[] = []
      for (let i = 0; i < boxes; i++) {
        boxRows.push({
          id: uid(),
          code: boxCode(bt.code, form.date, per, i + 1),
          productionId: prodId,
          breadTypeId: bt.id,
          count: per,
          date: form.date,
          updatedAt: 0,
          deleted: 0,
        })
      }
      await putMany('boxes', boxRows)
    }
    toast({ title: 'تولید ثبت شد', description: boxes > 0 ? `${faDigits(boxes)} جعبه با کد یکتا ساخته شد.` : undefined })
    setOpen(false)
  }

  // لیست تولیدهای اخیر
  const recent = [...productions].filter(p => !p.deleted).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)).slice(0, 40)
  const btName = (id: string) => breadTypes.find(b => b.id === id)?.name || 'نامشخص'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="h-11"><Plus className="ml-1 h-4 w-4" /> ثبت تولید جدید</Button>
      </div>

      <Card className="waffly-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تولیدهای اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState title="هنوز تولیدی ثبت نشده" desc="اولین تولید امروز را با دکمه بالا ثبت کنید." icon={<Wheat className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {recent.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {btName(p.breadTypeId)}
                      {p.carriedFrom && <span className="text-[10px] text-amber-600 mr-2">(انتقال از {prettyJalali(p.carriedFrom)})</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground waffly-num">
                      {prettyJalali(p.date)} • {faDigits(p.totalProduced)} نان
                      {p.boxesCount > 0 && ` • ${faDigits(p.boxesCount)} جعبه × ${faDigits(p.perBoxCount)}`}
                      {p.waste > 0 && <span className="text-red-600"> • ضایعات: {faDigits(p.waste)}</span>}
                      {p.createdBy && ` • ${p.createdBy}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    aria-label="حذف"
                    onClick={() => { void removeRecord('productions', p.id); toast({ title: 'حذف شد' }) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ ثبت */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ثبت تولید روزانه</DialogTitle>
            <DialogDescription>کدهای جعبه به‌صورت خودکار ساخته می‌شوند: کد نوع + روز + ماه + تعداد + سری</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نوع نان">
              <Select value={form.breadTypeId} onValueChange={v => setForm(f => ({ ...f, breadTypeId: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
                <SelectContent>
                  {active(breadTypes).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name} (کد {b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="تاریخ تولید (شمسی)">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="جعبه‌ها">
                <Input inputMode="numeric" className="waffly-num-input h-11" value={form.boxesCount} onChange={e => setForm(f => ({ ...f, boxesCount: e.target.value }))} placeholder="۰" />
              </FormRow>
              <FormRow label="نان در هر جعبه">
                <Input inputMode="numeric" className="waffly-num-input h-11" value={form.perBoxCount} onChange={e => setForm(f => ({ ...f, perBoxCount: e.target.value }))} placeholder="۰" />
              </FormRow>
              <FormRow label="مجموع نان">
                <Input inputMode="numeric" className="waffly-num-input h-11" value={form.totalProduced} onChange={e => setForm(f => ({ ...f, totalProduced: e.target.value }))} placeholder="خودکار" />
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="ضایعات / خراب (عدد)">
                <Input inputMode="numeric" className="waffly-num-input h-11" value={form.waste} onChange={e => setForm(f => ({ ...f, waste: e.target.value }))} placeholder="۰" />
              </FormRow>
              <FormRow label="انتقال از تاریخ" hint="برای محاسبه باقیمانده روزهای قبل (اختیاری)">
                <JalaliDateInput value={form.carriedFrom || ''} onChange={v => setForm(f => ({ ...f, carriedFrom: v === '' ? '' : v }))} />
              </FormRow>
            </div>
            <FormRow label="یادداشت">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
            {previewCodes.length > 0 && (
              <div className="rounded-xl bg-muted/60 border p-3">
                <p className="text-[11px] font-bold mb-1.5 flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> پیش‌نمایش کد جعبه‌ها</p>
                <div className="flex flex-wrap gap-1.5" dir="ltr">
                  {previewCodes.map(c => (
                    <code key={c} className="rounded bg-background border px-2 py-0.5 text-[11px] waffly-num">{c}</code>
                  ))}
                  {parseInt(form.boxesCount || '0', 10) > 5 && (
                    <code className="rounded bg-background border px-2 py-0.5 text-[11px] text-muted-foreground">…</code>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button onClick={save}>ثبت تولید</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editing === null && null}
    </div>
  )
}

// ================= جعبه‌ها و کدها =================
function BoxesTab() {
  const boxes = useTable<Box>('boxes')
  const breadTypes = useTable<BreadType>('breadTypes')
  const [filterDate, setFilterDate] = useState('')

  const list = [...boxes]
    .filter(b => !b.deleted)
    .filter(b => !filterDate || b.date === filterDate)
    .sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code))
    .slice(0, 100)
  const btName = (id: string) => breadTypes.find(b => b.id === id)?.name || '؟'

  return (
    <Card className="waffly-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Boxes className="h-4 w-4" /> کدهای یکتای جعبه‌ها</span>
          <div className="w-52">
            <JalaliDateInput value={filterDate} onChange={setFilterDate} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[11px] text-muted-foreground mb-3 leading-5">
          فرمت کد: <code className="waffly-num" dir="ltr">TT DD MM NN SS</code> — نوع نان، روز، ماه، تعداد در جعبه، شماره سری.
          کد را روی جعبه بنویسید یا برچسب بزنید؛ در نسخه‌های بعدی QR اضافه می‌شود.
        </p>
        {list.length === 0 ? (
          <EmptyState title="جعبه‌ای یافت نشد" desc="با ثبت تولید روزانه، کد جعبه‌ها خودکار ساخته می‌شود." icon={<Boxes className="h-5 w-5" />} />
        ) : (
          <div className="max-h-[480px] overflow-y-auto thin-scroll space-y-1.5">
            {list.map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <code className="rounded bg-primary/5 border border-primary/20 px-2 py-0.5 text-xs font-bold waffly-num" dir="ltr">{b.code}</code>
                <span className="text-xs text-muted-foreground flex-1 truncate">{btName(b.breadTypeId)} • {prettyJalali(b.date)} • <Num value={b.count} /> عدد</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ================= مصرف مواد =================
function ConsumptionTab() {
  const materials = useTable<Material>('materials')
  const consumptions = useTable<Consumption>('consumptions')
  const [form, setForm] = useState({ date: todayJalali(), materialId: '', quantity: '', note: '' })
  const mat = materials.find(m => m.id === form.materialId)

  const save = async () => {
    const qty = parseFloat(form.quantity || '0')
    if (!form.materialId || qty <= 0) { toast({ title: 'ماده و مقدار را وارد کنید', variant: 'destructive' }); return }
    await putRecord<Consumption>('consumptions', {
      id: uid(),
      date: form.date,
      materialId: form.materialId,
      quantity: qty,
      note: form.note || null,
      createdBy: getActiveUser() || null,
      updatedAt: 0,
      deleted: 0,
    })
    setForm(f => ({ ...f, quantity: '', note: '' }))
    toast({ title: 'مصرف ثبت شد', description: `${mat?.name}: ${faDigits(qty)} ${mat?.unit}` })
  }

  const recent = [...consumptions].filter(c => !c.deleted).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)).slice(0, 30)
  const matName = (id: string) => materials.find(m => m.id === id)

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Cookie className="h-4 w-4" /> ثبت مصرف امروز</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow label="ماده اولیه">
            <Select value={form.materialId} onValueChange={v => setForm(f => ({ ...f, materialId: v }))}>
              <SelectTrigger className="h-11"><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
              <SelectContent>
                {active(materials).map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="مقدار مصرف" hint={mat ? `واحد: ${mat.unit}` : undefined}>
            <Input inputMode="decimal" className="waffly-num-input h-11" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="۰" />
          </FormRow>
          <FormRow label="تاریخ">
            <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
          </FormRow>
          <FormRow label="یادداشت">
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>ثبت مصرف</Button>
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">مصرف‌های اخیر</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState title="مصرفی ثبت نشده" icon={<Cookie className="h-5 w-5" />} />
          ) : (
            <div className="max-h-[480px] overflow-y-auto thin-scroll space-y-1.5">
              {recent.map(c => {
                const m = matName(c.materialId)
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m?.name || 'نامشخص'}</p>
                      <p className="text-[11px] text-muted-foreground waffly-num">{prettyJalali(c.date)}{c.createdBy ? ` • ${c.createdBy}` : ''}{c.note ? ` • ${c.note}` : ''}</p>
                    </div>
                    <span className="text-sm font-bold waffly-num">{faDigits(c.quantity)} <span className="text-[11px] font-normal text-muted-foreground">{m?.unit}</span></span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => { void removeRecord('consumptions', c.id) }}>
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

// ================= انواع نان =================
function TypesTab() {
  const breadTypes = useTable<BreadType>('breadTypes')
  const [form, setForm] = useState({ name: '', code: '' })

  const save = async () => {
    const name = form.name.trim()
    const code = form.code.trim().replace(/\D/g, '').slice(0, 2)
    if (!name || code.length !== 2) { toast({ title: 'نام و کد ۲ رقمی لازم است', variant: 'destructive' }); return }
    await putRecord<BreadType>('breadTypes', { id: uid(), name, code, active: 1, updatedAt: 0, deleted: 0 })
    setForm({ name: '', code: '' })
    toast({ title: 'نوع نان اضافه شد' })
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">افزودن نوع/طعم جدید</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow label="نام نوع نان" hint="مثلاً: نان بزرگ، کاسه‌ای، با طعم وانیل…">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
          </FormRow>
          <FormRow label="کد ۲ رقمی (برای کد جعبه)" hint="با کدهای موجود تکراری نباشد">
            <Input inputMode="numeric" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="waffly-num-input h-11" placeholder="۰۶" dir="ltr" />
          </FormRow>
          <Button className="w-full h-11" onClick={save}><Plus className="ml-1 h-4 w-4" /> افزودن</Button>
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">انواع نان ({faDigits(active(breadTypes).length)})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {active(breadTypes).map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <code className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold waffly-num" dir="ltr">{b.code}</code>
                <span className="text-sm font-medium flex-1">{b.name}</span>
                <Button
                  variant="ghost" size="sm" className="h-8 text-[11px]"
                  onClick={() => putRecord<BreadType>('breadTypes', { ...b, active: b.active ? 0 : 1 })}
                >
                  {b.active ? 'غیرفعال' : 'فعال'}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void removeRecord('breadTypes', b.id)}>
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
