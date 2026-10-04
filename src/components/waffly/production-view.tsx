'use client'

// تولید — ثبت سریع دسته‌ای چندنوعی، سوابق، جعبه‌ها و کدها، انواع نان، رسپی مواد (v3.0)
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { Wheat, Package, Trash2, Boxes, Plus, FlaskConical, Pencil, Sparkles, ChevronDown, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, FormRow, TabsBar, EmptyState, Num, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, putRecord, putMany, removeRecord, uid, getActiveUser } from '@/lib/localdb'
import type { BreadType, Box, Production, Material, Recipe, Consumption } from '@/lib/types'
import { ESSENCE_TYPES } from '@/lib/types'
import { todayJalali, faDigits, parseJalali, prettyJalali, addJalaliDays } from '@/lib/jalali'
import { boxCode, nextBoxSerial, planProductionBoxes } from '@/lib/boxcode'
import { active, recipeDeductions, materialStocks, faQty, type DataBundle } from '@/lib/calc'
import { useDataBundle } from '@/lib/hooks'

type Tab = 'quick' | 'daily' | 'boxes' | 'types' | 'recipes'

export function ProductionView() {
  const [tab, setTab] = useState<Tab>('quick')
  return (
    <div>
      <PageHeader title="تولید" subtitle="ثبت سریع چند نوع نان در یک صفحه، جعبه‌ها با کد یکتا و کسر خودکار مواد طبق رسپی" icon={<Wheat className="h-5 w-5" />} />
      <TabsBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'quick', label: 'ثبت سریع' },
          { key: 'daily', label: 'سوابق تولید' },
          { key: 'boxes', label: 'جعبه‌ها و کدها' },
          { key: 'types', label: 'انواع نان' },
          { key: 'recipes', label: 'رسپی مواد' },
        ]}
      />
      {tab === 'quick' && <QuickTab />}
      {tab === 'daily' && <DailyTab onQuick={() => setTab('quick')} />}
      {tab === 'boxes' && <BoxesTab />}
      {tab === 'types' && <TypesTab />}
      {tab === 'recipes' && <RecipesTab />}
    </div>
  )
}

// ================= ثبت سریع تولید (v3.0 — دسته‌ای چندنوعی) =================
interface QRow { key: string; breadTypeId: string; boxes: string; per: string }
const emptyRow = (): QRow => ({ key: uid(), breadTypeId: '', boxes: '', per: '' })

function QuickTab() {
  const d = useDataBundle()
  const recipes = useTable<Recipe>('recipes')
  const [date, setDate] = useState(todayJalali())
  const [rows, setRows] = useState<QRow[]>([emptyRow()])
  const [waste, setWaste] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deductOn, setDeductOn] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('waffly-auto-deduct') !== '0' } catch { return true }
  })

  const liveBreadTypes = active(d.breadTypes).filter(b => b.active !== 0)
  const btName = (id: string) => d.breadTypes.find(b => b.id === id)?.name || 'نامشخص'

  const setRow = (key: string, patch: Partial<QRow>) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () => setRows(rs => [...rs, emptyRow()])
  const removeRow = (key: string) => setRows(rs => (rs.length > 1 ? rs.filter(r => r.key !== key) : rs))

  // تجمیع ردیف‌ها بر اساس نوع نان (چند ردیف از یک نوع = یک تولید ادامه‌دار)
  const groups = useMemo(() => {
    const map = new Map<string, { breadTypeId: string; totalBoxes: number; breads: number; parts: { per: number; boxes: number }[] }>()
    for (const r of rows) {
      const boxes = parseInt(r.boxes || '0', 10) || 0
      const per = parseInt(r.per || '0', 10) || 0
      if (!r.breadTypeId || boxes <= 0 || per <= 0) continue
      const g = map.get(r.breadTypeId) || { breadTypeId: r.breadTypeId, totalBoxes: 0, breads: 0, parts: [] }
      g.totalBoxes += boxes
      g.breads += boxes * per
      g.parts.push({ per, boxes })
      map.set(r.breadTypeId, g)
    }
    return [...map.values()]
  }, [rows])

  const totalBoxes = groups.reduce((a, g) => a + g.totalBoxes, 0)
  const totalBreads = groups.reduce((a, g) => a + g.breads, 0)

  // پیش‌نمایش کسر مواد طبق رسپی
  const deductions = useMemo(() => {
    if (!deductOn) return []
    const out = new Map<string, { name: string; unit: string; qty: number; stock: number }>()
    const stocks = materialStocks(d)
    for (const g of groups) {
      for (const ded of recipeDeductions(recipes, d.materials, g.breadTypeId, g.breads)) {
        const prev = out.get(ded.materialId)
        const st = stocks.find(s => s.material.id === ded.materialId)
        out.set(ded.materialId, {
          name: ded.material.name,
          unit: ded.material.unit,
          qty: (prev?.qty || 0) + ded.qty,
          stock: st?.stock ?? 0,
        })
      }
    }
    return [...out.entries()].map(([id, v]) => ({ id, ...v }))
  }, [groups, deductOn, recipes, d])

  // پیش‌نمایش کد جعبه‌ها (۵ تای اول) — ادامهٔ شماره‌های همان روز
  const previewCodes = useMemo(() => {
    if (totalBoxes <= 0) return []
    const start = nextBoxSerial(d.boxes.map(b => b.code), date)
    const codes: string[] = []
    for (let i = 0; i < Math.min(totalBoxes, 5); i++) codes.push(boxCode(date, start + i))
    return codes
  }, [totalBoxes, d.boxes, date])

  const toggleDeduct = (v: boolean) => {
    setDeductOn(v)
    try { localStorage.setItem('waffly-auto-deduct', v ? '1' : '0') } catch { /* ignore */ }
  }

  const save = async () => {
    if (groups.length === 0) {
      toast({ title: 'حداقل یک ردیف کامل کنید', description: 'نوع نان، تعداد جعبه و تعداد در هر جعبه لازم است.', variant: 'destructive' })
      return
    }
    const incomplete = rows.some(r => r.breadTypeId && ((parseInt(r.boxes || '0', 10) || 0) <= 0 || (parseInt(r.per || '0', 10) || 0) <= 0))
    if (incomplete) {
      toast({ title: 'ردیف ناقص', description: 'برای هر ردیف، تعداد جعبه و تعداد در هر جعبه را وارد کنید یا ردیف خالی را حذف کنید.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const wasteN = parseFloat(waste || '0') || 0
      let serial = nextBoxSerial(d.boxes.map(b => b.code), date)
      const newBoxes: Box[] = []
      const prodRows: Production[] = []
      let wasteApplied = false
      let createdTypes = 0
      let mergedTypes = 0

      for (const g of groups) {
        const existing = d.productions.find(p => !p.deleted && p.date === date && p.breadTypeId === g.breadTypeId)
        const per = g.parts[g.parts.length - 1]?.per || 0
        let prodId: string
        if (existing) {
          prodId = existing.id
          mergedTypes++
          prodRows.push({
            ...existing,
            boxesCount: (existing.boxesCount || 0) + g.totalBoxes,
            totalProduced: (existing.totalProduced || 0) + g.breads,
            perBoxCount: per || existing.perBoxCount,
            waste: (existing.waste || 0) + (!wasteApplied ? wasteN : 0),
            note: note.trim() ? (existing.note ? `${existing.note} — ${note.trim()}` : note.trim()) : existing.note,
            updatedAt: 0,
            deleted: 0,
          })
        } else {
          prodId = uid()
          createdTypes++
          prodRows.push({
            id: prodId,
            date,
            breadTypeId: g.breadTypeId,
            totalProduced: g.breads,
            boxesCount: g.totalBoxes,
            perBoxCount: per,
            waste: !wasteApplied ? wasteN : 0,
            carriedFrom: null,
            note: note.trim() || null,
            createdBy: getActiveUser() || null,
            updatedAt: 0,
            deleted: 0,
          })
        }
        wasteApplied = true // ضایعات فقط یک‌بار روی اولین تولیدِ این ثبت اعمال می‌شود
        for (const part of g.parts) {
          for (let i = 0; i < part.boxes; i++) {
            newBoxes.push({
              id: uid(),
              code: boxCode(date, serial++),
              productionId: prodId,
              breadTypeId: g.breadTypeId,
              count: part.per,
              date,
              hasEssence: 0,
              essenceType: null,
              note: null,
              updatedAt: 0,
              deleted: 0,
            })
          }
        }
      }

      await putMany('productions', prodRows)
      if (newBoxes.length) await putMany('boxes', newBoxes)

      // کسر خودکار مواد طبق رسپی (رکورد مصرف — در حسابداری و انبار لحاظ می‌شود)
      let deductedCount = 0
      if (deductOn && deductions.length > 0) {
        const consRows: Consumption[] = deductions
          .filter(x => x.qty > 0)
          .map(x => ({
            id: uid(),
            date,
            materialId: x.id,
            quantity: Math.round(x.qty * 10000) / 10000,
            note: 'کسر خودکار رسپی',
            createdBy: getActiveUser() || null,
            updatedAt: 0,
            deleted: 0,
          }))
        if (consRows.length) {
          await putMany('consumptions', consRows)
          deductedCount = consRows.length
        }
      }

      toast({
        title: 'تولید ثبت شد ✓',
        description: [
          `${faDigits(createdTypes)} نوع جدید${mergedTypes > 0 ? ` + ادامهٔ ${faDigits(mergedTypes)} نوع موجود` : ''}`,
          `${faDigits(totalBoxes)} جعبه با کد یکتا`,
          deductedCount > 0 ? `کسر مواد: ${deductions.map(x => `${x.name} ${faQty(x.qty)} ${x.unit}`).join('، ')}` : '',
        ].filter(Boolean).join(' • '),
      })
      setRows([emptyRow()])
      setWaste('')
      setNote('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="waffly-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
            <span>ثبت تولید یک روز — چند نوع نان، فقط یک بار</span>
            <div className="w-44"><JalaliDateInput value={date} onChange={setDate} /></div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid grid-cols-[1fr_8rem_8rem_2.5rem] gap-2 px-1 text-[10px] text-muted-foreground">
            <span>نوع نان</span><span>تعداد جعبه</span><span>در هر جعبه</span><span />
          </div>
          {rows.map(r => (
            <div key={r.key} className="grid grid-cols-2 md:grid-cols-[1fr_8rem_8rem_2.5rem] gap-2 items-center">
              <div className="col-span-2 md:col-span-1">
                <InlinePicker
                  value={r.breadTypeId}
                  options={liveBreadTypes.map(b => ({ value: b.id, label: b.name }))}
                  onChange={v => setRow(r.key, { breadTypeId: v })}
                  placeholder="نوع نان را انتخاب کنید"
                />
              </div>
              <Input inputMode="numeric" className="waffly-num-input h-11" value={r.boxes} onChange={e => setRow(r.key, { boxes: e.target.value })} placeholder="جعبه" aria-label="تعداد جعبه" />
              <Input inputMode="numeric" className="waffly-num-input h-11" value={r.per} onChange={e => setRow(r.key, { per: e.target.value })} placeholder="در جعبه" aria-label="تعداد در هر جعبه" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-600" aria-label="حذف ردیف"
                onClick={() => removeRow(r.key)} disabled={rows.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="h-10" onClick={addRow}><Plus className="ml-1 h-4 w-4" /> افزودن ردیف</Button>

          {totalBoxes > 0 && (
            <div className="rounded-xl bg-muted/50 border p-3 space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs waffly-num">
                <span>جمع: <b>{faDigits(totalBoxes)}</b> جعبه • <b>{faDigits(totalBreads)}</b> نان</span>
                {groups.map(g => (
                  <span key={g.breadTypeId} className="text-muted-foreground">{btName(g.breadTypeId)}: {faDigits(g.totalBoxes)} جعبه ({faDigits(g.breads)} نان)</span>
                ))}
              </div>
              {previewCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                  {previewCodes.map(c => (
                    <code key={c} className="rounded bg-background border px-2 py-0.5 text-[11px] waffly-num">{c}</code>
                  ))}
                  {totalBoxes > 5 && <code className="rounded bg-background border px-2 py-0.5 text-[11px] text-muted-foreground">…</code>}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> کسر خودکار مواد طبق رسپی</p>
              <Switch checked={deductOn} onCheckedChange={toggleDeduct} />
            </div>
            {deductOn && (
              deductions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 leading-5">
                  <Info className="h-3 w-3 shrink-0" />
                  برای این انواع نان رسپی تعریف نشده — از تب «رسپی مواد» مقدار مواد هر نان را تعریف کنید تا هنگام ثبت تولید خودکار کم شود.
                </p>
              ) : (
                <div className="space-y-1">
                  {deductions.map(x => (
                    <div key={x.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] waffly-num ${x.qty > x.stock ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-muted/40'}`}>
                      <span className="font-medium">{x.name}</span>
                      <span>{faQty(x.qty)} {x.unit}{x.qty > x.stock && <b className="mr-2">موجودی کافی نیست (الان {faQty(x.stock)})</b>}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="ضایعات کل این ثبت (عدد نان)" hint="اختیاری — فقط یک عدد برای کل ثبت؛ بدون تکرار برای هر جعبه">
              <Input inputMode="numeric" className="waffly-num-input h-11" value={waste} onChange={e => setWaste(e.target.value)} placeholder="۰" />
            </FormRow>
            <FormRow label="یادداشت (اختیاری)">
              <Input value={note} onChange={e => setNote(e.target.value)} className="h-11" />
            </FormRow>
          </div>

          <Button className="w-full h-12 text-base font-bold" onClick={save} disabled={saving}>
            <Package className="ml-2 h-5 w-5" /> {saving ? 'در حال ثبت…' : totalBoxes > 0 ? `ثبت همه (${faDigits(totalBoxes)} جعبه)` : 'ثبت همه'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center leading-5">
            اسانس هر جعبه بعداً از «سوابق تولید» یا «جعبه‌ها و کدها» قابل تنظیم است؛ اگر همان روز و همان نوع قبلاً ثبت شده، جعبه‌ها با کد ادامه‌دار به همان تولید اضافه می‌شوند.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ================= سوابق تولید روزانه =================
function DailyTab({ onQuick }: { onQuick: () => void }) {
  const breadTypes = useTable<BreadType>('breadTypes')
  const productions = useTable<Production>('productions')
  const boxes = useTable<Box>('boxes')
  const { confirm, element: confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [expandedProd, setExpandedProd] = useState<string | null>(null)
  const [editBox, setEditBox] = useState<Box | null>(null)
  const [editing, setEditing] = useState<Production | null>(null)
  const [form, setForm] = useState({
    date: todayJalali(),
    breadTypeId: '',
    totalProduced: '',
    boxesCount: '',
    perBoxCount: '',
    waste: '',
    carriedFrom: '',
    note: '',
    essenceOn: false,
    essenceType: ESSENCE_TYPES[0] || '',
    essenceCount: '',
  })
  const bt = breadTypes.find(b => b.id === form.breadTypeId)

  const openNew = () => { onQuick() }

  const liveBoxesOf = (prodId: string) => boxes.filter(b => !b.deleted && b.productionId === prodId)

  const openEdit = (p: Production) => {
    const pBoxes = liveBoxesOf(p.id)
    const essCount = pBoxes.filter(b => b.hasEssence).length
    setEditing(p)
    setForm({
      date: p.date,
      breadTypeId: p.breadTypeId,
      totalProduced: p.totalProduced ? String(p.totalProduced) : '',
      boxesCount: String(pBoxes.length || p.boxesCount || 0),
      perBoxCount: p.perBoxCount ? String(p.perBoxCount) : '',
      waste: p.waste ? String(p.waste) : '',
      carriedFrom: p.carriedFrom || '',
      note: p.note || '',
      essenceOn: essCount > 0,
      essenceType: pBoxes.find(b => b.hasEssence)?.essenceType || ESSENCE_TYPES[0] || '',
      essenceCount: essCount ? String(essCount) : '',
    })
    setOpen(true)
  }

  // پیش‌نمایش کدهای جعبه — ماه + روز + شمارهٔ جعبهٔ همان روز (ادامهٔ شماره‌های موجود)
  // در حالت ویرایش فقط کد جعبه‌های جدیدِ اضافه‌شده نشان داده می‌شود
  const liveBoxCount = editing ? boxes.filter(b => !b.deleted && b.productionId === editing.id).length : 0
  const previewCodes = useMemo(() => {
    const count = parseInt(form.boxesCount || '0', 10)
    if (!bt || count <= 0) return []
    const addCount = editing ? Math.max(0, count - liveBoxCount) : count
    if (addCount <= 0) return []
    const start = nextBoxSerial(boxes.map(b => b.code), form.date)
    const n = Math.min(addCount, 5)
    const codes: string[] = []
    for (let i = 0; i < n; i++) codes.push(boxCode(form.date, start + i))
    return codes
  }, [bt, boxes, form.boxesCount, form.date, editing, liveBoxCount])

  const save = async () => {
    if (!form.breadTypeId || !bt) { toast({ title: 'نوع نان را انتخاب کنید', variant: 'destructive' }); return }
    const total = parseFloat(form.totalProduced || '0')
    const boxCount = parseInt(form.boxesCount || '0', 10)
    const per = parseInt(form.perBoxCount || '0', 10)
    const waste = parseFloat(form.waste || '0')
    if (total <= 0 && boxCount <= 0) { toast({ title: 'تعداد تولید یا جعبه را وارد کنید', variant: 'destructive' }); return }

    if (editing) {
      // ویرایش تولید — تعداد جعبه: زیاد کردن → جعبهٔ جدید با کد ادامه‌دار؛ کم کردن → حذف از آخر (بزرگ‌ترین کد)
      // کدهای چاپی موجود هرگز تغییر نمی‌کنند؛ نوع/تاریخ به جعبه‌های موجود هم‌تراز می‌شود
      const live = liveBoxesOf(editing.id).sort((a, b) => a.code.localeCompare(b.code))
      const { addCodes, removeIds } = planProductionBoxes(live, boxCount, form.date, boxes.map(b => b.code))
      const addCount = addCodes.length
      const removeCount = removeIds.length
      const essenceCount = form.essenceOn
        ? Math.max(0, Math.min(addCount, parseInt(form.essenceCount || '0', 10) || 0))
        : 0
      await putRecord<Production>('productions', {
        ...editing,
        date: form.date,
        breadTypeId: bt.id,
        totalProduced: total || boxCount * per,
        boxesCount: boxCount,
        perBoxCount: per,
        waste: waste || 0,
        carriedFrom: form.carriedFrom || null,
        note: form.note || null,
        createdBy: editing.createdBy ?? null,
        deleted: 0,
      })
      const cascade = live
        .filter(b => b.breadTypeId !== bt.id || b.date !== form.date || (per > 0 && editing.perBoxCount > 0 && b.count === editing.perBoxCount && per !== editing.perBoxCount))
        .map(b => ({ ...b, breadTypeId: bt.id, date: form.date, count: (per > 0 && editing.perBoxCount > 0 && b.count === editing.perBoxCount) ? per : b.count, updatedAt: 0, deleted: 0 }))
      const newBoxes: Box[] = []
      if (addCount > 0 && per > 0) {
        for (let i = 0; i < addCount; i++) {
          const withEssence = i < essenceCount
          newBoxes.push({
            id: uid(),
            code: addCodes[i],
            productionId: editing.id,
            breadTypeId: bt.id,
            count: per,
            date: form.date,
            hasEssence: withEssence ? 1 : 0,
            essenceType: withEssence ? (form.essenceType || ESSENCE_TYPES[0] || null) : null,
            note: null,
            updatedAt: 0,
            deleted: 0,
          })
        }
      }
      if (cascade.length || newBoxes.length) await putMany('boxes', [...cascade, ...newBoxes])
      for (const id of removeIds) await removeRecord('boxes', id)
      toast({
        title: 'تولید ویرایش شد',
        description: [
          addCount > 0 ? `${faDigits(addCount)} جعبه با کد جدید اضافه شد` : '',
          removeCount > 0 ? `${faDigits(removeCount)} جعبه حذف شد` : '',
          cascade.length > 0 ? 'نوع/تاریخ جعبه‌های موجود هم‌تراز شد' : '',
        ].filter(Boolean).join(' • ') || undefined,
      })
      setOpen(false)
      setEditing(null)
      return
    }
  }

  // لیست تولیدهای اخیر
  const recent = [...productions].filter(p => !p.deleted).sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt)).slice(0, 40)
  const btName = (id: string) => breadTypes.find(b => b.id === id)?.name || 'نامشخص'
  const boxesOf = (prodId: string) => boxes.filter(b => !b.deleted && b.productionId === prodId).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="h-11"><Plus className="ml-1 h-4 w-4" /> ثبت سریع تولید جدید</Button>
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
              {recent.map(p => {
                const pBoxes = boxesOf(p.id)
                const essenceBoxes = pBoxes.filter(b => b.hasEssence)
                return (
                <div key={p.id} className="rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {btName(p.breadTypeId)}
                        {p.carriedFrom && <span className="text-[10px] text-amber-600 mr-2">(انتقال از {prettyJalali(p.carriedFrom)})</span>}
                        {essenceBoxes.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 mr-2">
                            <Sparkles className="h-3 w-3" /> {faDigits(essenceBoxes.length)} جعبه اسانس‌دار{essenceBoxes[0]?.essenceType ? ` (${essenceBoxes[0].essenceType})` : ''}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground waffly-num">
                        {prettyJalali(p.date)} • {faDigits(p.totalProduced)} نان
                        {p.boxesCount > 0 && ` • ${faDigits(p.boxesCount)} جعبه × ${faDigits(p.perBoxCount)}`}
                        {p.waste > 0 && <span className="text-red-600"> • ضایعات: {faDigits(p.waste)}</span>}
                        {p.createdBy && ` • ${p.createdBy}`}
                      </p>
                    </div>
                    {pBoxes.length > 0 && (
                      <Button
                        variant="outline" size="sm" className="h-8 shrink-0 text-[11px]"
                        onClick={() => setExpandedProd(expandedProd === p.id ? null : p.id)}
                      >
                        <Boxes className="ml-1 h-3.5 w-3.5" /> جعبه‌ها ({faDigits(pBoxes.length)})
                        <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${expandedProd === p.id ? 'rotate-180' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="ویرایش"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 shrink-0"
                      aria-label="حذف"
                      onClick={() => void confirmRemove(confirm, 'productions', p.id, 'حذف تولید', `آیا از حذف این تولید (${prettyJalali(p.date)}) مطمئن هستید؟ جعبه‌های آن هم حذف می‌شوند و آمار به‌روز می‌شود.`)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {expandedProd === p.id && pBoxes.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t pt-3">
                      {pBoxes.map(b => (
                        <div key={b.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                          <code className="rounded bg-primary/5 border border-primary/20 px-2 py-0.5 text-[11px] font-bold waffly-num" dir="ltr">{b.code}</code>
                          <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">
                            {btName(b.breadTypeId)} • <Num value={b.count} /> عدد
                            {b.note ? ` • ${b.note}` : ''}
                          </span>
                          {!!b.hasEssence && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 shrink-0">
                              <Sparkles className="h-3 w-3" /> {b.essenceType || 'اسانس'}
                            </span>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label="ویرایش جعبه"
                            onClick={() => setEditBox(b)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600" aria-label="حذف جعبه"
                            onClick={() => void confirmRemove(confirm, 'boxes', b.id, 'حذف جعبه', `آیا از حذف جعبه با کد «${b.code}» مطمئن هستید؟ کد چاپی روی جعبه دیگر معتبر نخواهد بود.`)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground">با دکمه ویرایش، نوع نان، اسانس و یادداشت هر جعبه را جداگانه تنظیم کنید.</p>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ ویرایش */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش تولید</DialogTitle>
            <DialogDescription>کدهای چاپی موجود ثابت می‌مانند؛ کم/زیاد کردن تعداد جعبه، جعبه حذف یا جعبهٔ جدید با کد ادامه‌دار می‌سازد.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormRow label="نوع نان">
              <InlinePicker
                value={form.breadTypeId}
                options={active(breadTypes).map(b => ({ value: b.id, label: b.name }))}
                onChange={v => setForm(f => ({ ...f, breadTypeId: v }))}
                placeholder="انتخاب کنید"
              />
            </FormRow>
            <FormRow label="تاریخ تولید (شمسی)">
              <JalaliDateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
            </FormRow>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="جعبه‌ها" hint={editing ? `الان ${faDigits(liveBoxesOf(editing.id).length)} جعبه دارد — کم/زیاد کردن عدد، جعبه حذف/اضافه می‌کند` : undefined}>
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
            <div className="rounded-xl border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> اسانس روی جعبه‌ها (اختیاری)</p>
                <Switch checked={form.essenceOn} onCheckedChange={v => setForm(f => ({ ...f, essenceOn: v }))} />
              </div>
              {form.essenceOn && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormRow label="طعم اسانس">
                      <InlinePicker
                        value={form.essenceType}
                        options={ESSENCE_TYPES.map(t => ({ value: t, label: t }))}
                        onChange={v => setForm(f => ({ ...f, essenceType: v }))}
                      />
                    </FormRow>
                    <FormRow label="تعداد جعبه اسانس‌دار" hint="اولین جعبه‌ها (بر اساس سری) اسانس‌دار می‌شوند">
                      <Input inputMode="numeric" className="waffly-num-input h-11" value={form.essenceCount} onChange={e => setForm(f => ({ ...f, essenceCount: e.target.value }))} placeholder="۰" />
                    </FormRow>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-5">{editing ? 'اسانس فقط روی جعبه‌های جدیدِ اضافه‌شده اعمال می‌شود؛ اسانس جعبه‌های فعلی را از دکمهٔ «جعبه‌ها» ویرایش کنید.' : 'بعداً می‌توانید از دکمه «جعبه‌ها» در کارت هر تولید، اسانس هر جعبه را جداگانه ویرایش یا حذف کنید.'}</p>
                </>
              )}
            </div>
            <FormRow label="یادداشت">
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
            </FormRow>
            {previewCodes.length > 0 && (
              <div className="rounded-xl bg-muted/60 border p-3">
                <p className="text-[11px] font-bold mb-1.5 flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> {editing ? 'کد جعبه‌های جدید' : 'پیش‌نمایش کد جعبه‌ها'}</p>
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
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>انصراف</Button>
            <Button onClick={save}>ذخیره تغییرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BoxEditDialog box={editBox} breadTypes={breadTypes} onClose={() => setEditBox(null)} />
      {confirmDialog}
    </div>
  )
}

// ================= جعبه‌ها و کدها =================
function BoxesTab() {
  const boxes = useTable<Box>('boxes')
  const breadTypes = useTable<BreadType>('breadTypes')
  const { confirm, element: confirmDialog } = useConfirm()
  const [filterDate, setFilterDate] = useState('')
  const [editBox, setEditBox] = useState<Box | null>(null)

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
          فرمت کد: <code className="waffly-num" dir="ltr">MM DD S</code> — ماه و روز تولید + شمارهٔ جعبهٔ همان روز؛ مثلاً <code className="waffly-num" dir="ltr">07263</code> یعنی مهر ۲۶، جعبهٔ ۳. اگر یک روز بیش از ۹ جعبه تولید شود کد ۶ رقمی می‌شود؛ کدهای قدیمی ۱۰ رقمی هم معتبرند.
          با دکمه ویرایش، نوع نان/اسانس/یادداشت هر جعبه را جدا تنظیم کنید؛ کد چاپی ثابت می‌ماند.
        </p>
        {list.length === 0 ? (
          <EmptyState title="جعبه‌ای یافت نشد" desc="با ثبت تولید روزانه، کد جعبه‌ها خودکار ساخته می‌شود." icon={<Boxes className="h-5 w-5" />} />
        ) : (
          <div className="max-h-[480px] overflow-y-auto thin-scroll space-y-1.5">
            {list.map(b => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <code className="rounded bg-primary/5 border border-primary/20 px-2 py-0.5 text-xs font-bold waffly-num" dir="ltr">{b.code}</code>
                <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                  {btName(b.breadTypeId)} • {prettyJalali(b.date)} • <Num value={b.count} /> عدد
                  {b.note ? ` • ${b.note}` : ''}
                </span>
                {!!b.hasEssence && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 shrink-0">
                    <Sparkles className="h-3 w-3" /> {b.essenceType || 'اسانس'}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label="ویرایش جعبه"
                  onClick={() => setEditBox(b)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600" aria-label="حذف جعبه"
                  onClick={() => void confirmRemove(confirm, 'boxes', b.id, 'حذف جعبه', `آیا از حذف جعبه با کد «${b.code}» مطمئن هستید؟ کد چاپی روی جعبه دیگر معتبر نخواهد بود.`)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <BoxEditDialog box={editBox} breadTypes={breadTypes} onClose={() => setEditBox(null)} />
      {confirmDialog}
    </Card>
  )
}

// ================= رسپی مواد (v3.0) =================
function RecipesTab() {
  const breadTypes = useTable<BreadType>('breadTypes')
  const materials = useTable<Material>('materials')
  const recipes = useTable<Recipe>('recipes')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [form, setForm] = useState({ breadTypeId: '', materialId: '', amount: '', forCount: '30', note: '' })

  const liveMaterials = active(materials).filter(m => m.active !== 0)
  const liveBreadTypes = active(breadTypes).filter(b => b.active !== 0)

  const openEdit = (r: Recipe) => {
    setEditing(r)
    setForm({
      breadTypeId: r.breadTypeId,
      materialId: r.materialId,
      amount: String(Math.round(r.qtyPerBread * 1000) / 1000),
      forCount: '1',
      note: r.note || '',
    })
  }

  const perBreadPreview = (() => {
    const amount = parseFloat(form.amount || '0') || 0
    if (amount <= 0) return null
    const n = parseFloat(form.forCount || '0') || 0
    return n > 0 ? amount / n : amount
  })()

  const save = async () => {
    const amount = parseFloat(form.amount || '0') || 0
    if (!form.breadTypeId || !form.materialId) {
      toast({ title: 'نوع نان و ماده اولیه را انتخاب کنید', variant: 'destructive' })
      return
    }
    const n = parseFloat(form.forCount || '0') || 0
    if (amount <= 0 || (n <= 0 && !editing)) {
      toast({ title: 'مقدار ماده را وارد کنید', description: editing ? undefined : 'و «به ازای چند نان» — مثلاً ۱٫۵ کیلوگرم برای ۳۰ نان', variant: 'destructive' })
      return
    }
    const qtyPerBread = n > 0 ? amount / n : amount
    if (qtyPerBread <= 0) { toast({ title: 'مقدار برای هر نان باید بزرگ‌تر از صفر باشد', variant: 'destructive' }); return }
    await putRecord<Recipe>('recipes', {
      ...(editing || {}),
      id: editing ? editing.id : uid(),
      updatedAt: editing ? editing.updatedAt : 0,
      breadTypeId: form.breadTypeId,
      materialId: form.materialId,
      qtyPerBread,
      note: form.note.trim() ? form.note.trim() : null,
      deleted: 0,
    })
    toast({ title: editing ? 'رسپی ویرایش شد' : 'رسپی ثبت شد', description: `${faQty(qtyPerBread)} برای هر یک نان — با ثبت تولید خودکار کم می‌شود.` })
    setForm(f => ({ ...f, materialId: '', amount: '', forCount: '30', note: '' }))
    setEditing(null)
  }

  const matOf = (id: string) => materials.find(m => m.id === id)
  const grouped = liveBreadTypes
    .map(bt => ({ bt, rows: recipes.filter(r => !r.deleted && r.breadTypeId === bt.id) }))
    .filter(g => g.rows.length > 0)

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" /> {editing ? 'ویرایش رسپی' : 'افزودن رسپی'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow label="نوع نان">
            <InlinePicker
              value={form.breadTypeId}
              options={liveBreadTypes.map(b => ({ value: b.id, label: b.name }))}
              onChange={v => setForm(f => ({ ...f, breadTypeId: v }))}
              placeholder="انتخاب کنید"
            />
          </FormRow>
          <FormRow label="ماده اولیه">
            <InlinePicker
              value={form.materialId}
              options={liveMaterials.map(m => ({ value: m.id, label: m.name, hint: m.unit }))}
              onChange={v => setForm(f => ({ ...f, materialId: v }))}
              placeholder="انتخاب کنید"
            />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label={editing ? 'مقدار (هر نان)' : 'مقدار ماده'} hint={matOf(form.materialId) ? `واحد: ${matOf(form.materialId)!.unit}` : undefined}>
              <Input inputMode="decimal" className="waffly-num-input h-11" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder={editing ? '۰' : '۱٫۵'} />
            </FormRow>
            {editing ? (
              <div className="text-[11px] text-muted-foreground self-end pb-3 leading-5">مقدار مستقیماً به ازای هر یک نان است.</div>
            ) : (
              <FormRow label="به ازای چند نان؟" hint="مثلاً مقدار خمیرِ یک جعبهٔ ۳۰تایی">
                <Input inputMode="numeric" className="waffly-num-input h-11" value={form.forCount} onChange={e => setForm(f => ({ ...f, forCount: e.target.value }))} placeholder="۳۰" />
              </FormRow>
            )}
          </div>
          {perBreadPreview !== null && (
            <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/50 border px-3 py-2 waffly-num">
              یعنی <b className="text-foreground">{faQty(perBreadPreview)}</b> {matOf(form.materialId)?.unit || ''} برای هر یک نان
            </p>
          )}
          <FormRow label="یادداشت (اختیاری)">
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-11" />
          </FormRow>
          <Button className="w-full h-11" onClick={save}>{editing ? 'ذخیره تغییرات' : 'افزودن به رسپی'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ breadTypeId: '', materialId: '', amount: '', forCount: '30', note: '' }) }}>انصراف از ویرایش</Button>}
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">رسپی انواع نان</CardTitle>
        </CardHeader>
        <CardContent>
          {grouped.length === 0 ? (
            <EmptyState
              title="هنوز رسپی‌ای تعریف نشده"
              desc="برای هر نوع نان، مقدار مواد لازم برای هر نان را تعریف کنید؛ بعد از آن با هر ثبت تولید، مواد خودکار از انبار کم می‌شود."
              icon={<FlaskConical className="h-5 w-5" />}
            />
          ) : (
            <div className="space-y-4">
              {grouped.map(({ bt, rows }) => (
                <div key={bt.id} className="rounded-xl border overflow-hidden">
                  <p className="text-xs font-bold bg-muted/50 px-3 py-2">{bt.name}</p>
                  <div className="divide-y">
                    {rows.map(r => {
                      const m = matOf(r.materialId)
                      return (
                        <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-xs font-medium flex-1 min-w-0 truncate">{m?.name || 'ماده حذف‌شده'}</span>
                          <span className="text-[11px] text-muted-foreground waffly-num shrink-0">
                            {faQty(r.qtyPerBread)} {m?.unit || ''} / هر نان
                            <span className="mx-1.5 text-border">|</span>
                            جعبه ۳۰تایی ≈ {faQty(r.qtyPerBread * 30)} {m?.unit || ''}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label="ویرایش رسپی" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600" aria-label="حذف رسپی"
                            onClick={() => void confirmRemove(confirm, 'recipes', r.id, 'حذف رسپی', `آیا از حذف «${m?.name || 'این ماده'}» از رسپی ${bt.name} مطمئن هستید؟ کسر خودکار این ماده متوقف می‌شود.`)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground leading-5">
                کسر خودکار با هر ثبت تولید انجام می‌شود (قابل خاموش‌کردن در فرم ثبت سریع)؛ رکوردهای کسر با برچسب «کسر خودکار رسپی» در انبار و حسابداری لحاظ می‌شوند.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  )
}
// ================= انواع نان =================
function TypesTab() {
  const breadTypes = useTable<BreadType>('breadTypes')
  const { confirm, element: confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<BreadType | null>(null)
  const [form, setForm] = useState({ name: '' })

  const openEdit = (b: BreadType) => { setEditing(b); setForm({ name: b.name }) }

  const save = async () => {
    const name = form.name.trim()
    if (!name) { toast({ title: 'نام نوع نان را وارد کنید', variant: 'destructive' }); return }
    if (editing) {
      await putRecord<BreadType>('breadTypes', { ...editing, name })
      toast({ title: 'نوع نان ویرایش شد' })
    } else {
      // کد داخلی ۲ رقمی فقط برای سازگاری سینک نگه داشته می‌شود و دیگر در کد جعبه نقشی ندارد
      const maxCode = breadTypes.reduce((m, b) => Math.max(m, parseInt(b.code || '0', 10) || 0), 0)
      const code = String(Math.min(99, maxCode + 1)).padStart(2, '0')
      await putRecord<BreadType>('breadTypes', { id: uid(), name, code, active: 1, updatedAt: 0, deleted: 0 })
      toast({ title: 'نوع نان اضافه شد' })
    }
    setForm({ name: '' })
    setEditing(null)
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="waffly-card lg:col-span-2 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{editing ? `ویرایش نوع نان: ${editing.name}` : 'افزودن نوع/طعم جدید'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow label="نام نوع نان" hint="مثلاً: نان بزرگ، کاسه‌ای، با طعم وانیل…">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
          </FormRow>
          <Button className="w-full h-11" onClick={save}><Plus className="ml-1 h-4 w-4" /> {editing ? 'ذخیره تغییرات' : 'افزودن'}</Button>
          {editing && <Button variant="ghost" className="w-full" onClick={() => { setEditing(null); setForm({ name: '' }) }}>انصراف از ویرایش</Button>}
        </CardContent>
      </Card>

      <Card className="waffly-card lg:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">انواع نان ({faDigits(active(breadTypes).length)})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {active(breadTypes).map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium flex-1">{b.name}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                  onClick={() => openEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 text-[11px]"
                  onClick={() => putRecord<BreadType>('breadTypes', { ...b, active: b.active ? 0 : 1 })}
                >
                  {b.active ? 'غیرفعال' : 'فعال'}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" aria-label="حذف"
                  onClick={() => void confirmRemove(confirm, 'breadTypes', b.id, 'حذف نوع نان', `آیا از حذف «${b.name}» مطمئن هستید؟ تولیدها و فروش‌های قبلی این نوع حفظ می‌شوند ولی دیگر قابل انتخاب نیست.`)}>
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

// ================= دیالوگ ویرایش جعبه (مشترک) =================
function BoxEditDialog({ box, breadTypes, onClose }: {
  box: Box | null
  breadTypes: BreadType[]
  onClose: () => void
}) {
  // ریمانت با key تا state از props مقداردهی شود (بدون useEffect/setState)
  if (!box) return null
  return <BoxEditForm key={box.id} box={box} breadTypes={breadTypes} onClose={onClose} />
}

function BoxEditForm({ box, breadTypes, onClose }: {
  box: Box
  breadTypes: BreadType[]
  onClose: () => void
}) {
  const [breadTypeId, setBreadTypeId] = useState(box.breadTypeId)
  const [hasEssence, setHasEssence] = useState(!!box.hasEssence)
  const [essenceType, setEssenceType] = useState(box.essenceType || ESSENCE_TYPES[0] || '')
  const [note, setNote] = useState(box.note || '')

  const save = async () => {
    await putRecord<Box>('boxes', {
      ...box,
      breadTypeId,
      hasEssence: hasEssence ? 1 : 0,
      essenceType: hasEssence ? (essenceType || null) : null,
      note: note.trim() ? note.trim() : null,
      updatedAt: 0,
      deleted: 0,
    })
    toast({ title: 'جعبه ویرایش شد', description: 'کد چاپی جعبه ثابت ماند.' })
    onClose()
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            ویرایش جعبه
            <code className="waffly-num text-xs bg-muted px-2 py-0.5 rounded border" dir="ltr">{box.code}</code>
          </DialogTitle>
          <DialogDescription>کد چاپی جعبه ثابت می‌ماند (شناسه تاریخی)؛ فقط مشخصات داخلی تغییر می‌کند.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormRow label="نوع نان این جعبه">
            <InlinePicker
              value={breadTypeId}
              options={active(breadTypes).map(b => ({ value: b.id, label: b.name }))}
              onChange={setBreadTypeId}
              placeholder="انتخاب کنید"
            />
          </FormRow>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-xs font-bold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> اسانس‌دار</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">این جعبه حاوی نان اسانس‌دار است</p>
            </div>
            <Switch checked={hasEssence} onCheckedChange={setHasEssence} />
          </div>
          {hasEssence && (
            <FormRow label="طعم اسانس">
              <InlinePicker
                value={essenceType}
                options={ESSENCE_TYPES.map(t => ({ value: t, label: t }))}
                onChange={setEssenceType}
              />
            </FormRow>
          )}
          <FormRow label="یادداشت جعبه" hint="مثلاً توضیح تغییر نوع نان یا وضعیت ویژه">
            <Input value={note} onChange={e => setNote(e.target.value)} className="h-11" />
          </FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={save}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
