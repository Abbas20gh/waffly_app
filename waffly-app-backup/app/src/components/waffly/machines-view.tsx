'use client'

// دستگاه‌سازی — تجهیزات نانوایی (در حال ساخت) و کسب‌وکار دستگاه‌سازی
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { Wrench, Plus, Trash2, Factory, Hammer, DollarSign, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, EmptyState, Money, Num, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, putRecord, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { Machine, MachineCost } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, machineTotals } from '@/lib/calc'
import { cn } from '@/lib/utils'

export function MachinesView() {
  const machines = useTable<Machine>('machines')
  const machineCosts = useTable<MachineCost>('machineCosts')
  return <MachinesBody machines={machines} machineCosts={machineCosts} />
}

function MachinesBody({ machines, machineCosts }: { machines: Machine[]; machineCosts: MachineCost[] }) {
  const { confirm, element: confirmDialog } = useConfirm()
  const [section, setSection] = useState<'BAKING' | 'BUSINESS'>('BAKING')
  const [machineDlg, setMachineDlg] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [mFormKind, setMFormKind] = useState<Machine['kind']>('BAKING')
  const [costDlgFor, setCostDlgFor] = useState<Machine | null>(null)
  const [editingCost, setEditingCost] = useState<MachineCost | null>(null)
  const [mForm, setMForm] = useState({ name: '', startDate: todayJalali(), status: 'IN_PROGRESS' as Machine['status'], note: '' })
  const [cForm, setCForm] = useState({ kind: 'CONSUMABLE' as MachineCost['kind'], name: '', quantity: '1', date: todayJalali(), cost: '', note: '' })

  const list = active(machines).filter(m => m.kind === section)
  const totals = (m: Machine) => machineTotals({ machines: [], machineCosts } as never, m.id)
  const grand = list.reduce((acc, m) => {
    const t = totals(m)
    return { consumable: acc.consumable + t.consumable, capital: acc.capital + t.capital }
  }, { consumable: 0, capital: 0 })

  const openNewMachine = () => {
    setEditingMachine(null)
    setMFormKind(section)
    setMForm({ name: '', startDate: todayJalali(), status: 'IN_PROGRESS', note: '' })
    setMachineDlg(true)
  }
  const openEditMachine = (m: Machine) => {
    setEditingMachine(m)
    setMFormKind(m.kind)
    setMForm({ name: m.name, startDate: m.startDate, status: m.status, note: m.note || '' })
    setMachineDlg(true)
  }

  const saveMachine = async () => {
    if (!mForm.name.trim()) { toast({ title: 'نام دستگاه لازم است', variant: 'destructive' }); return }
    await putRecord<Machine>('machines', {
      ...(editingMachine || {}),
      id: editingMachine ? editingMachine.id : uid(),
      updatedAt: editingMachine ? editingMachine.updatedAt : 0,
      name: mForm.name.trim(), kind: mFormKind, startDate: mForm.startDate,
      status: mForm.status, note: mForm.note || null, deleted: 0,
    })
    setMForm({ name: '', startDate: todayJalali(), status: 'IN_PROGRESS', note: '' })
    setMachineDlg(false)
    setEditingMachine(null)
    toast({ title: editingMachine ? 'دستگاه ویرایش شد' : 'دستگاه ثبت شد' })
  }

  const openNewCost = (m: Machine) => {
    setCostDlgFor(m)
    setEditingCost(null)
    setCForm({ kind: 'CONSUMABLE', name: '', quantity: '1', date: todayJalali(), cost: '', note: '' })
  }
  const openEditCost = (c: MachineCost, m: Machine) => {
    setCostDlgFor(m)
    setEditingCost(c)
    setCForm({ kind: c.kind, name: c.name, quantity: c.quantity ? String(c.quantity) : '1', date: c.date, cost: c.cost ? String(c.cost) : '', note: c.note || '' })
  }

  const saveCost = async () => {
    if (!costDlgFor) return
    const cost = parseFloat(cForm.cost || '0')
    if (!cForm.name.trim() || cost <= 0) { toast({ title: 'شرح و مبلغ لازم است', variant: 'destructive' }); return }
    await putRecord<MachineCost>('machineCosts', {
      ...(editingCost || {}),
      id: editingCost ? editingCost.id : uid(),
      updatedAt: editingCost ? editingCost.updatedAt : 0,
      machineId: costDlgFor.id, kind: cForm.kind, name: cForm.name.trim(),
      quantity: parseFloat(cForm.quantity || '1') || 1, date: cForm.date, cost,
      note: cForm.note.trim() ? cForm.note.trim() : null,
      deleted: 0,
    })
    setCForm({ kind: 'CONSUMABLE', name: '', quantity: '1', date: todayJalali(), cost: '', note: '' })
    setCostDlgFor(null)
    setEditingCost(null)
    toast({ title: editingCost ? 'هزینه ویرایش شد' : 'هزینه ثبت شد' })
  }

  const statusLabel: Record<Machine['status'], string> = {
    IN_PROGRESS: 'در حال ساخت', DONE: 'تکمیل شد', PAUSED: 'متوقف',
  }

  return (
    <div>
      <PageHeader
        title="دستگاه‌سازی"
        subtitle="هزینه‌های مصرفی و قطعات سرمایه‌ای — فقط ثبت هزینه، بدون محاسبه استهلاک"
        icon={<Wrench className="h-5 w-5" />}
      />
      <div className="flex gap-1.5 mb-4">
        <button
          onClick={() => setSection('BAKING')}
          className={cn('rounded-xl px-4 py-2 text-xs font-medium border min-h-10',
            section === 'BAKING' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground')}
        >
          <Factory className="inline h-4 w-4 ml-1" /> تجهیزات نانوایی (در حال ساخت)
        </button>
        <button
          onClick={() => setSection('BUSINESS')}
          className={cn('rounded-xl px-4 py-2 text-xs font-medium border min-h-10',
            section === 'BUSINESS' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground')}
        >
          <Hammer className="inline h-4 w-4 ml-1" /> دستگاه‌سازی (کسب‌وکار)
        </button>
        <div className="flex-1" />
        <Button className="h-10" onClick={openNewMachine}><Plus className="ml-1 h-4 w-4" /> دستگاه جدید</Button>
      </div>

      {/* جمع کل بخش */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="waffly-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">جمع هزینه‌های مصرفی بخش</p>
            <p className="text-lg font-bold waffly-num mt-1">{faMoney(grand.consumable)} <span className="text-[11px] font-normal">تومان</span></p>
          </CardContent>
        </Card>
        <Card className="waffly-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">جمع قطعات سرمایه‌ای بخش</p>
            <p className="text-lg font-bold waffly-num mt-1">{faMoney(grand.capital)} <span className="text-[11px] font-normal">تومان</span></p>
          </CardContent>
        </Card>
      </div>

      {list.length === 0 ? (
        <EmptyState title="دستگاهی ثبت نشده" desc="با دکمه «دستگاه جدید» اولین دستگاه را اضافه کنید." icon={<Wrench className="h-5 w-5" />} />
      ) : (
        <div className="space-y-3">
          {list.map(m => {
            const t = totals(m)
            return (
              <Card key={m.id} className="waffly-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                    <span className="font-bold">{m.name}</span>
                    <span className={cn('text-[10px] rounded px-1.5 py-0.5 border',
                      m.status === 'DONE' ? 'bg-green-50 text-green-700 border-green-200'
                        : m.status === 'PAUSED' ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200')}>
                      {statusLabel[m.status]}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground waffly-num">شروع: {prettyJalali(m.startDate)}</span>
                    <div className="flex-1" />
                    <span className="text-[11px] waffly-num text-muted-foreground">
                      مصرفی: <Money value={t.consumable} className="text-foreground" /> • سرمایه‌ای: <Money value={t.capital} className="text-foreground" />
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {t.costs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">هنوز هزینه‌ای ثبت نشده.</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto thin-scroll space-y-1">
                      {t.costs.map(c => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                            c.kind === 'CAPITAL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>
                            {c.kind === 'CAPITAL' ? 'سرمایه‌ای' : 'مصرفی'}
                          </span>
                          <span className="font-medium">{c.name}{c.quantity > 1 ? ` × ${faDigits(c.quantity)}` : ''}{c.note ? ` — ${c.note}` : ''}</span>
                          <span className="text-muted-foreground waffly-num">{prettyJalali(c.date)}</span>
                          <div className="flex-1" />
                          <Money value={c.cost} className="font-bold" />
                          <span className="text-[10px] text-muted-foreground">تومان</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="ویرایش هزینه"
                            onClick={() => openEditCost(c, m)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600" aria-label="حذف هزینه"
                            onClick={() => void confirmRemove(confirm, 'machineCosts', c.id, 'حذف هزینهٔ دستگاه', `آیا از حذف «${c.name}» (${faMoney(c.cost)} تومان) مطمئن هستید؟`)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => openNewCost(m)}>
                      <DollarSign className="h-3.5 w-3.5" /> ثبت هزینه
                    </Button>
                    <InlinePicker
                      className="w-32 [&>button]:h-8 [&>button]:text-[11px]"
                      value={m.status}
                      options={[
                        { value: 'IN_PROGRESS', label: 'در حال ساخت' },
                        { value: 'DONE', label: 'تکمیل شد' },
                        { value: 'PAUSED', label: 'متوقف' },
                      ]}
                      onChange={v => void putRecord<Machine>('machines', { ...m, status: v as Machine['status'] })}
                    />
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش دستگاه"
                      onClick={() => openEditMachine(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف دستگاه"
                      onClick={() => void confirmRemove(confirm, 'machines', m.id, 'حذف دستگاه', `آیا از حذف «${m.name}» مطمئن هستید؟ هزینه‌های ثبت‌شدهٔ آن هم حذف می‌شوند.`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* دیالوگ دستگاه */}
      <Dialog open={machineDlg} onOpenChange={setMachineDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMachine ? `ویرایش دستگاه: ${editingMachine.name}` : (section === 'BAKING' ? 'تجهیزات نانوایی' : 'دستگاه سفارشی') + ' جدید'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نام دستگاه / تجهیز">
              <Input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
            </FormRow>
            <FormRow label="بخش" hint="تغییر بخش، دستگاه را به تب دیگر منتقل می‌کند">
              <InlinePicker
                value={mFormKind}
                options={[{ value: 'BAKING', label: 'تجهیزات نانوایی' }, { value: 'BUSINESS', label: 'دستگاه‌سازی (کسب‌وکار)' }]}
                onChange={v => setMFormKind(v as Machine['kind'])}
              />
            </FormRow>
            <FormRow label="وضعیت">
              <InlinePicker
                value={mForm.status}
                options={[{ value: 'IN_PROGRESS', label: 'در حال ساخت' }, { value: 'DONE', label: 'تکمیل شد' }, { value: 'PAUSED', label: 'متوقف' }]}
                onChange={v => setMForm(f => ({ ...f, status: v as Machine['status'] }))}
              />
            </FormRow>
            <FormRow label="تاریخ شروع">
              <JalaliDateInput value={mForm.startDate} onChange={v => setMForm(f => ({ ...f, startDate: v }))} />
            </FormRow>
            <FormRow label="یادداشت">
              <Input value={mForm.note} onChange={e => setMForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMachineDlg(false); setEditingMachine(null) }}>انصراف</Button>
            <Button onClick={saveMachine}>{editingMachine ? 'ذخیره تغییرات' : 'ثبت'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ هزینه */}
      <Dialog open={!!costDlgFor} onOpenChange={v => !v && setCostDlgFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCost ? 'ویرایش هزینه' : 'ثبت هزینه'} — {costDlgFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نوع هزینه" hint="قطعات سرمایه‌ای فقط ثبت می‌شوند و در سود محاسبه نمی‌شوند">
              <InlinePicker
                value={cForm.kind}
                options={[
                  { value: 'CONSUMABLE', label: 'مصرفی (مواد و لوازم)' },
                  { value: 'CAPITAL', label: 'سرمایه‌ای (قطعات اصلی)' },
                ]}
                onChange={v => setCForm(f => ({ ...f, kind: v as MachineCost['kind'] }))}
              />
            </FormRow>
            <FormRow label="شرح">
              <Input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} className="h-11" placeholder="مثلاً المنت حرارتی" />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="تعداد">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={cForm.quantity} onChange={e => setCForm(f => ({ ...f, quantity: e.target.value }))} />
              </FormRow>
              <FormRow label="هزینه (تومان)">
                <Input inputMode="decimal" className="waffly-num-input h-11" value={cForm.cost} onChange={e => setCForm(f => ({ ...f, cost: e.target.value }))} />
              </FormRow>
            </div>
            <FormRow label="تاریخ">
              <JalaliDateInput value={cForm.date} onChange={v => setCForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <FormRow label="یادداشت (اختیاری)">
              <Input value={cForm.note} onChange={e => setCForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCostDlgFor(null); setEditingCost(null) }}>انصراف</Button>
            <Button onClick={saveCost}>{editingCost ? 'ذخیره تغییرات' : 'ثبت هزینه'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}
