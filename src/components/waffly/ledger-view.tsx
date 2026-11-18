'use client'

// ===== دفتر حساب (v3.3.0 بازسازی‌شده در v3.4.0) =====
// پول‌هایی که جدا از فاکتور جابه‌جا می‌شود: واریز مشتری، پرداخت قسطی به تامین‌کننده،
// پول با شخص آزاد. ماندهٔ بدهکار/بستانکار هر شخص با ادغام فاکتورهای باز + تراکنش‌های دفتر
// + خریدهای عملیاتی پرداخت‌نشده (opsExpenses) محاسبه می‌شود.
// v3.4.0 — صورت‌حساب دوستونهٔ هر شخص (تاریخچهٔ کامل): فاکتورها/خریدها ستون راست،
// پرداخت‌ها ستون چپ — هر تراکنش در ردیف تاریخ خودش؛ و واریزی‌های دفتر خودکار
// روی فاکتورهای باز (FIFO) اعمال می‌شود (lib/settlement.ts) تا وضعیت تسویه در بخش
// فروش هم درست دیده شود.
import { useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  ArrowDownLeft, ArrowUpRight, Search, Plus, Pencil, Trash2, BookText, ChevronRight, Receipt,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, EmptyState, TabsBar, FormRow, useConfirm, confirmRemove } from './bits'
import { JalaliDateInput, toEnglishDigits } from './jalali-date'
import { InlinePicker } from './inline-picker'
import { useTable, putRecord, uid, getActiveUser } from '@/lib/localdb'
import { requireUserName } from '@/lib/user-gate'
import type { LedgerEntry, Sale, Purchase, Customer, Supplier, Account, OpsExpense, SaleItem } from '@/lib/types'
import { todayJalali, faDigits, faMoney, prettyJalali } from '@/lib/jalali'
import { active, parseItems } from '@/lib/calc'
import { ledgerAppliedToSales, ledgerAppliedToPurchases, saleDueWithLedger, settledWithLedger, purchaseDueWithLedger, opsDue } from '@/lib/settlement'
import { cn } from '@/lib/utils'

type PartyKind = 'CUSTOMER' | 'SUPPLIER' | 'FREE'

const NEW_KEY = '__NEW__'
const METHOD_LABELS: Record<string, string> = { CASH: 'نقدی', CARD: 'کارت به کارت', POS: 'کارتخوان', TRANSFER: 'کارت به کارت', CHECK: 'چک' }
const KIND_LABEL: Record<PartyKind, string> = { CUSTOMER: 'مشتری', SUPPLIER: 'تامین‌کننده', FREE: 'آزاد' }
const DIR_LABEL: Record<LedgerEntry['kind'], string> = { IN: 'دریافت از او', OUT: 'پرداخت به او' }

const partyKeyOf = (e: LedgerEntry): string =>
  e.customerId ? `C|${e.customerId}` : e.supplierId ? `S|${e.supplierId}` : `F|${String(e.freeName || '').trim()}`

const dirStyle = (kind: LedgerEntry['kind']) =>
  kind === 'IN'
    ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ArrowDownLeft, label: 'دریافت' }
    : { cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: ArrowUpRight, label: 'پرداخت' }

/** رنگ مانده: مثبت = او بدهکار (قرمز) | منفی = ما بدهکار (سبز) */
const balanceCls = (v: number) => (v > 0.5 ? 'text-red-600' : v < -0.5 ? 'text-emerald-600' : 'text-muted-foreground')

const toNum = (v: string): number => {
  const x = parseFloat(toEnglishDigits(v).replace(/[,\s٬]/g, ''))
  return Number.isFinite(x) ? x : 0
}

interface Party {
  key: string
  kind: PartyKind
  id?: string
  name: string
  phone?: string | null
  balance: number
  openCount: number
  openSum: number
}

interface HistRow {
  key: string
  date: string
  side: 'right' | 'left' // راست = فاکتور/خرید | چپ = پول
  badge: string
  badgeCls?: string
  title: string
  sub?: string
  movement: number // مثبت = بدهی بالا می‌رود | منفی = بدهی کم می‌شود
  entry?: LedgerEntry // فقط تراکنش‌های دفتر قابل ویرایش/حذف‌اند
}

export function LedgerView() {
  const ledger = useTable<LedgerEntry>('ledgerEntries')
  const sales = useTable<Sale>('sales')
  const purchases = useTable<Purchase>('purchases')
  const ops = useTable<OpsExpense>('opsExpenses')
  const customers = useTable<Customer>('customers')
  const suppliers = useTable<Supplier>('suppliers')
  const accounts = useTable<Account>('accounts')
  const { confirm, element: confirmDialog } = useConfirm()

  const [tab, setTab] = useState<'parties' | 'txns'>('parties')
  const [selected, setSelected] = useState<string | null>(null)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)
  const [preset, setPreset] = useState<{ party: string; kind: LedgerEntry['kind'] }>({ party: '', kind: 'IN' })

  // ===== اشخاص + مانده‌ها =====
  const parties = useMemo<Party[]>(() => {
    const list: Party[] = []
    const map = new Map<string, Party>()
    const ensure = (key: string, kind: PartyKind, id: string | undefined, name: string, phone?: string | null): Party => {
      let p = map.get(key)
      if (!p) {
        p = { key, kind, id, name, phone: phone || null, balance: 0, openCount: 0, openSum: 0 }
        map.set(key, p)
        list.push(p)
      }
      return p
    }
    for (const c of active(customers)) ensure(`C|${c.id}`, 'CUSTOMER', c.id, c.name, c.phone)
    for (const s of active(suppliers)) ensure(`S|${s.id}`, 'SUPPLIER', s.id, s.name, s.phone)
    // شخص آزاد از خود تراکنش‌ها + خریدهای عملیاتی پرداخت‌نشده
    for (const e of ledger) {
      if (e.deleted || e.customerId || e.supplierId) continue
      const name = String(e.freeName || '').trim()
      if (name) ensure(`F|${name}`, 'FREE', undefined, name)
    }

    // فاکتورهای فروش — بدهی مشتری (کل مبلغ منهای پرداخت لحظهٔ فاکتور)
    for (const s of sales) {
      if (s.deleted) continue
      const p = map.get(`C|${s.customerId}`)
      if (!p) continue
      const rem = Math.max(0, (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0))
      if (Math.abs(rem) > 0.5) { p.openCount++; p.openSum += rem }
      p.balance += rem
    }
    // فاکتورهای خرید — بدهی ما به تامین‌کننده
    for (const p of purchases) {
      if (p.deleted) continue
      const party = map.get(`S|${p.supplierId || ''}`)
      if (!party) continue
      const rem = Math.max(0, (Number(p.cost) || 0) - (Number(p.paidAmount) || 0))
      if (Math.abs(rem) > 0.5) { party.openCount++; party.openSum += rem }
      party.balance -= rem
    }
    // خریدهای عملیاتی پرداخت‌نشده (روزمره/دارایی/حقوق) — بدهی به فروشندهٔ آزاد
    for (const o of ops) {
      if (o.deleted) continue
      const due = opsDue(o)
      if (due <= 0.5) continue
      const name = String(o.person || o.title || '').trim()
      if (!name) continue
      const party = ensure(`F|${name}`, 'FREE', undefined, name)
      party.openCount++; party.openSum += due
      party.balance -= due
    }
    // تراکنش‌های دفتر
    for (const e of ledger) {
      if (e.deleted) continue
      const party = map.get(partyKeyOf(e))
      if (!party) continue
      const amt = Number(e.amount) || 0
      party.balance += e.kind === 'OUT' ? amt : -amt
    }
    return list.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name, 'fa'))
  }, [ledger, sales, purchases, ops, customers, suppliers])

  const totals = useMemo(() => {
    let receivable = 0
    let payable = 0
    for (const p of parties) {
      if (p.balance > 0.5) receivable += p.balance
      else if (p.balance < -0.5) payable += -p.balance
    }
    return { receivable, payable }
  }, [parties])

  const partyOf = (key: string) => parties.find(p => p.key === key)

  const appliedSales = useMemo(() => ledgerAppliedToSales(sales, ledger), [sales, ledger])
  const appliedPurchases = useMemo(() => ledgerAppliedToPurchases(purchases, ledger), [purchases, ledger])

  const openNew = (partyKey = '', kind: LedgerEntry['kind'] = 'IN') => {
    setEditing(null)
    setPreset({ party: partyKey, kind })
    setDlgOpen(true)
  }
  const openEdit = (e: LedgerEntry) => {
    setEditing(e)
    setPreset({ party: partyKeyOf(e), kind: e.kind })
    setDlgOpen(true)
  }
  const removeEntry = async (e: LedgerEntry) => {
    const p = partyOf(partyKeyOf(e))
    await confirmRemove(confirm, 'ledgerEntries', e.id, 'حذف تراکنش دفتر',
      `${faMoney(e.amount)} تومان — ${DIR_LABEL[e.kind]} ${p?.name || ''}`)
    setDlgOpen(false)
    toast({ title: 'تراکنش حذف شد' })
  }

  const sel = selected ? partyOf(selected) : undefined

  return (
    <div>
      <PageHeader
        title="دفتر حساب"
        subtitle="پول‌هایی که جدا از فاکتور می‌دهید یا می‌گیرید — مانده بدهکار/بستانکار هر شخص"
        icon={<BookText className="h-5 w-5" />}
        actions={
          <Button onClick={() => openNew('', 'IN')} className="h-11 shrink-0">
            <Plus className="ml-1 h-4 w-4" /> ثبت پول
          </Button>
        }
      />
      {sel ? (
        <PartyDetail
          party={sel}
          sales={sales}
          purchases={purchases}
          ops={ops}
          ledger={ledger}
          appliedSales={appliedSales}
          appliedPurchases={appliedPurchases}
          onBack={() => setSelected(null)}
          onNewEntry={k => openNew(sel.key, k)}
          onEditEntry={openEdit}
          onRemoveEntry={removeEntry}
        />
      ) : (
        <>
          <TabsBar<'parties' | 'txns'>
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'parties', label: 'اشخاص و مانده‌ها' },
              { key: 'txns', label: 'همه تراکنش‌ها' },
            ]}
          />
          {tab === 'parties' && (
            <PartiesList parties={parties} totals={totals} onSelect={setSelected} onNew={openNew} />
          )}
          {tab === 'txns' && (
            <TxnList entries={ledger} partyOf={partyOf} onEdit={openEdit} onRemove={removeEntry} />
          )}
        </>
      )}
      <EntryDialog
        key={`${editing?.id || 'new'}|${preset.party}|${preset.kind}`}
        open={dlgOpen}
        onOpenChange={v => { setDlgOpen(v); if (!v) setEditing(null) }}
        editing={editing}
        presetParty={preset.party}
        presetKind={preset.kind}
        parties={parties}
        accounts={active(accounts)}
        onSaved={() => setDlgOpen(false)}
        onRemove={removeEntry}
      />
      {confirmDialog}
    </div>
  )
}

// ================= لیست اشخاص =================
function PartiesList({ parties, totals, onSelect, onNew }: {
  parties: Party[]
  totals: { receivable: number; payable: number }
  onSelect: (key: string) => void
  onNew: (key: string, kind: LedgerEntry['kind']) => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'they' | 'we'>('all')
  const list = useMemo(() => {
    const t = q.trim()
    return parties.filter(p =>
      (!t || !!p.name.includes(t)) &&
      (filter !== 'they' || p.balance > 0.5) &&
      (filter !== 'we' || p.balance < -0.5))
  }, [parties, q, filter])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="waffly-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">جمع طلب ما از اشخاص</p>
            <p className="text-lg md:text-xl font-bold mt-1.5 waffly-num text-red-600">{faMoney(totals.receivable)} <span className="text-[11px] font-normal text-muted-foreground">تومان</span></p>
          </CardContent>
        </Card>
        <Card className="waffly-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">جمع بدهی ما به اشخاص</p>
            <p className="text-lg md:text-xl font-bold mt-1.5 waffly-num text-emerald-600">{faMoney(totals.payable)} <span className="text-[11px] font-normal text-muted-foreground">تومان</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="جستجوی نام شخص…"
            className="pr-9 h-11"
            aria-label="جستجوی شخص"
          />
        </div>
        <div className="flex gap-1.5">
          {([['all', 'همه'], ['they', 'بدهکار به ما'], ['we', 'ما بدهکاریم']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('rounded-xl px-3 py-2 text-xs font-medium min-h-11 transition-colors',
                filter === k ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border hover:bg-accent')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="waffly-card">
          <CardContent>
            <EmptyState
              icon={<BookText className="h-5 w-5" />}
              title={parties.length === 0 ? 'هنوز کسی در دفتر نیست' : 'کسی با این مشخصات پیدا نشد'}
              desc={parties.length === 0
                ? 'با دکمه «ثبت پول» اولین دریافت/پرداخت را ثبت کنید؛ مشتری‌ها و تامین‌کننده‌های موجود هم خودکار به لیست اضافه می‌شوند.'
                : 'عبارت جستجو یا فیلتر را عوض کنید.'}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {list.map(p => {
            const theyOwe = p.balance > 0.5
            const weOwe = p.balance < -0.5
            return (
              <Card key={p.key} className="waffly-card hover:border-primary/40 transition-colors">
                <CardContent className="p-3.5">
                  <button
                    onClick={() => onSelect(p.key)}
                    className="w-full text-right focus:outline-none"
                    aria-label={`صورت‌حساب ${p.name}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm truncate">{p.name}</span>
                          <span className={cn('rounded-md border px-1.5 py-px text-[10px] font-medium',
                            p.kind === 'CUSTOMER' ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : p.kind === 'SUPPLIER' ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200')}>
                            {KIND_LABEL[p.kind]}
                          </span>
                        </div>
                        {p.openCount > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1 waffly-num">
                            {faDigits(p.openCount)} فاکتور/خرید باز — مانده: {faMoney(p.openSum)}
                          </p>
                        )}
                        {p.phone && <p className="text-[11px] text-muted-foreground mt-0.5 waffly-num">{faDigits(p.phone)}</p>}
                      </div>
                      <div className="text-left shrink-0">
                        <p className={cn('text-sm font-bold waffly-num', balanceCls(p.balance))}>{faMoney(Math.abs(p.balance))}</p>
                        <p className={cn('text-[10px] mt-0.5', balanceCls(p.balance))}>
                          {theyOwe ? 'او بدهکار است' : weOwe ? 'ما بدهکاریم' : 'حساب صاف'}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t">
                    <Button
                      variant="outline" size="sm"
                      className="h-8 flex-1 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => onNew(p.key, 'IN')}
                    >
                      <ArrowDownLeft className="h-3.5 w-3.5 ml-1" /> پول گرفتیم
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="h-8 flex-1 text-[11px] text-rose-700 border-rose-200 hover:bg-rose-50"
                      onClick={() => onNew(p.key, 'OUT')}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" /> پول دادیم
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ================= صورت‌حساب دوستونهٔ شخص (تاریخچهٔ کامل) =================
function PartyDetail({ party, sales, purchases, ops, ledger, appliedSales, appliedPurchases, onBack, onNewEntry, onEditEntry, onRemoveEntry }: {
  party: Party
  sales: Sale[]
  purchases: Purchase[]
  ops: OpsExpense[]
  ledger: LedgerEntry[]
  appliedSales: Map<string, number>
  appliedPurchases: Map<string, number>
  onBack: () => void
  onNewEntry: (kind: LedgerEntry['kind']) => void
  onEditEntry: (e: LedgerEntry) => void
  onRemoveEntry: (e: LedgerEntry) => void
}) {
  const items = useMemo<HistRow[]>(() => {
    const rows: HistRow[] = []
    if (party.kind === 'CUSTOMER' && party.id) {
      // تاریخچهٔ کامل: همهٔ فاکتورهای فروش (ستون راست) + همهٔ پول‌ها (ستون چپ)
      const mine = sales.filter(s => !s.deleted && s.customerId === party.id)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
      for (const s of mine) {
        const total = Number(s.totalAmount) || 0
        const paidAtSale = Number(s.paidAmount) || 0
        const applied = appliedSales.get(s.id) || 0
        let itemCount = ''
        try {
          const its = parseItems(s) as SaleItem[]
          itemCount = its.map(it => `${faDigits(it.delivered || it.qty || 0)}×`).join(' + ')
        } catch { /* ignore */ }
        rows.push({
          key: `inv-${s.id}`, date: s.date, side: 'right',
          badge: 'فاکتور فروش', badgeCls: 'bg-slate-50 text-slate-600 border-slate-200',
          title: s.invoiceNumber ? `فاکتور فروش #${faDigits(s.invoiceNumber)}` : 'فاکتور فروش',
          sub: [
            prettyJalali(s.date),
            itemCount ? `${itemCount} قلم` : '',
            `ماندهٔ فاکتور: ${faMoney(saleDueWithLedger(s, applied))}`,
            settledWithLedger(s, applied) === 'PAID' ? 'تسویه‌شده ✓' : '',
          ].filter(Boolean).join(' — '),
          movement: total,
        })
        if (paidAtSale > 0.5) {
          rows.push({
            key: `pay-${s.id}`, date: s.paymentDate || s.date, side: 'left',
            badge: 'پرداخت هنگام فاکتور', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            title: 'پرداخت هنگام ثبت فاکتور',
            sub: [METHOD_LABELS[String(s.paymentMethod || '')] || null, s.paymentDate ? prettyJalali(s.paymentDate) : null].filter(Boolean).join(' — '),
            movement: -paidAtSale,
          })
        }
      }
    } else if (party.kind === 'SUPPLIER' && party.id) {
      const mine = purchases.filter(p => !p.deleted && p.supplierId === party.id)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
      for (const pu of mine) {
        const cost = Number(pu.cost) || 0
        const paidAtPurchase = Number(pu.paidAmount) || 0
        const applied = appliedPurchases.get(pu.id) || 0
        rows.push({
          key: `inv-${pu.id}`, date: pu.date, side: 'right',
          badge: 'فاکتور خرید', badgeCls: 'bg-slate-50 text-slate-600 border-slate-200',
          title: 'فاکتور خرید مواد',
          sub: [
            prettyJalali(pu.date),
            `ماندهٔ خرید: ${faMoney(purchaseDueWithLedger(pu, applied))}`,
            purchaseDueWithLedger(pu, applied) <= 0.5 ? 'تسویه‌شده ✓' : '',
          ].filter(Boolean).join(' — '),
          movement: -cost,
        })
        if (paidAtPurchase > 0.5) {
          rows.push({
            key: `pay-${pu.id}`, date: pu.date, side: 'left',
            badge: 'پرداخت هنگام خرید', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            title: 'پرداخت هنگام ثبت خرید',
            movement: paidAtPurchase,
          })
        }
      }
    } else if (party.kind === 'FREE') {
      // خریدهای عملیاتی پرداخت‌نشده به نام این شخص/فروشگاه — بدهی ما
      const name = party.name
      const mineOps = ops.filter(o => !o.deleted && opsDue(o) > 0.5 && String(o.person || o.title || '').trim() === name)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
      for (const o of mineOps) {
        const due = opsDue(o)
        const kindLabel = o.kind === 'ASSET' ? 'دستگاه' : o.kind === 'SALARY' ? 'حقوق' : o.kind === 'WAGE' ? 'دستمزد' : 'خرید روزمره'
        rows.push({
          key: `ops-${o.id}`, date: o.date, side: 'right',
          badge: kindLabel, badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
          title: o.title,
          sub: [prettyJalali(o.date), `مانده: ${faMoney(due)}`, 'ویرایش در بخش «خرید و هزینه»'].filter(Boolean).join(' — '),
          movement: -due,
        })
      }
    }
    // تراکنش‌های پول دفتر
    const mineEntries = ledger.filter(e => !e.deleted && partyKeyOf(e) === party.key)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
    for (const e of mineEntries) {
      const amt = Number(e.amount) || 0
      const st = dirStyle(e.kind)
      rows.push({
        key: `ent-${e.id}`, date: e.date,
        // همهٔ پول‌ها در ستون چپ — راست فقط فاکتور/خرید است
        side: 'left',
        badge: DIR_LABEL[e.kind], badgeCls: st.cls,
        title: e.kind === 'IN' ? 'دریافت پول' : 'پرداخت پول',
        sub: [METHOD_LABELS[String(e.method || '')] || null, e.note || null, e.createdBy ? `توسط ${e.createdBy}` : null].filter(Boolean).join(' — '),
        // مشتری: دریافتی از او بدهی او را کم می‌کند (−) و پرداخت به او زیاد (+)
        // تامین‌کننده/آزاد: پرداخت ما بدهی ما را کم می‌کند (+) و دریافت از او زیاد (−)
        movement: party.kind === 'CUSTOMER' ? (e.kind === 'IN' ? -amt : amt) : (e.kind === 'OUT' ? amt : -amt),
        entry: e,
      })
    }
    return rows.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.side === b.side ? 0 : a.side === 'right' ? -1 : 1) ||
      a.key.localeCompare(b.key))
  }, [party, sales, purchases, ops, ledger, appliedSales, appliedPurchases])

  // ماندهٔ لحظه‌ای بعد از هر ردیف — جدیدترین در بالا
  const withRunning = useMemo(() => {
    const acc: (HistRow & { running: number })[] = []
    let run = 0
    for (const r of items) {
      run += r.movement
      acc.push({ ...r, running: run })
    }
    return acc.reverse()
  }, [items])

  // گروه‌بندی بر اساس تاریخ — هر تاریخ یک ردیف دوستونه
  const byDate = useMemo(() => {
    const m = new Map<string, (HistRow & { running: number })[]>()
    for (const r of withRunning) {
      const arr = m.get(r.date) || []
      arr.push(r)
      m.set(r.date, arr)
    }
    return [...m.entries()]
  }, [withRunning])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onBack} aria-label="بازگشت">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="font-bold text-base truncate">{party.name}</h2>
          <p className="text-[11px] text-muted-foreground">
            {KIND_LABEL[party.kind]}{party.openCount > 0 && ` • ${faDigits(party.openCount)} فاکتور/خرید باز`}
          </p>
        </div>
      </div>

      <Card className="waffly-card">
        <CardContent className="p-4 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">مانده حساب</p>
            <p className={cn('text-2xl font-bold mt-0.5 waffly-num', balanceCls(party.balance))}>
              {faMoney(Math.abs(party.balance))}
              <span className="text-xs font-normal text-muted-foreground mr-1.5">تومان</span>
            </p>
            <p className={cn('text-xs mt-0.5', balanceCls(party.balance))}>
              {party.balance > 0.5 ? 'او به ما بدهکار است' : party.balance < -0.5 ? 'ما به او بدهکاریم' : 'حساب صاف است'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onNewEntry('IN')}>
              <ArrowDownLeft className="h-4 w-4 ml-1" /> پول گرفتیم
            </Button>
            <Button className="h-10 bg-rose-600 hover:bg-rose-700 text-white" onClick={() => onNewEntry('OUT')}>
              <ArrowUpRight className="h-4 w-4 ml-1" /> پول دادیم
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="waffly-card">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">صورت‌حساب و تاریخچهٔ کامل</p>
            <p className="text-[11px] text-muted-foreground">
              خریدها/فاکتورها در راست — پرداخت‌ها در چپ • قدیمی‌ترین در بالا
            </p>
          </div>
          {byDate.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="هنوز گردشی ثبت نشده"
              desc="فاکتور یا پول دریافت/پرداخت‌شده‌ای برای این شخص وجود ندارد. با دکمه‌های بالا اولین پول را ثبت کنید."
            />
          ) : (
            <ul className="divide-y" role="list">
              {byDate.map(([date, rows]) => {
                const right = rows.filter(r => r.side === 'right')
                const left = rows.filter(r => r.side === 'left')
                // rows داخل هر گروه جدیدترین‌اول است (باRunning معکوس شده) → ماندهٔ پایان روز = اولین عنصر
                const running = rows[0]?.running ?? 0
                return (
                  <li key={date} className="px-3 py-2.5 hover:bg-accent/30 transition-colors">
                    <div className="grid grid-cols-2 gap-2 items-stretch">
                      {/* ستون راست — فاکتورها/خریدها */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium">خرید / فاکتور</p>
                        {right.length === 0 ? (
                          <div className="rounded-lg border border-dashed h-9" aria-hidden />
                        ) : right.map(r => <HistCard key={r.key} r={r} onEditEntry={onEditEntry} onRemoveEntry={onRemoveEntry} />)}
                      </div>
                      {/* ستون چپ — پرداخت‌ها */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium text-left">پول / پرداخت</p>
                        {left.length === 0 ? (
                          <div className="rounded-lg border border-dashed h-9" aria-hidden />
                        ) : left.map(r => <HistCard key={r.key} r={r} onEditEntry={onEditEntry} onRemoveEntry={onRemoveEntry} />)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-dashed">
                      <span className="text-[11px] text-muted-foreground waffly-num">{prettyJalali(date)}</span>
                      <span className={cn('text-[11px] font-medium waffly-num', balanceCls(running))}>
                        مانده تا این تاریخ: {faMoney(running)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HistCard({ r, onEditEntry, onRemoveEntry }: {
  r: HistRow & { running?: number }
  onEditEntry: (e: LedgerEntry) => void
  onRemoveEntry: (e: LedgerEntry) => void
}) {
  return (
    <div className={cn('rounded-lg border px-2.5 py-2', r.movement > 0 ? 'border-red-100 bg-red-50/40' : r.movement < 0 ? 'border-emerald-100 bg-emerald-50/40' : '')}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('inline-flex items-center rounded-md border px-1.5 py-px text-[10px] font-medium', r.badgeCls || 'bg-slate-50 text-slate-600 border-slate-200')}>
          {r.badge}
        </span>
        <span className={cn('text-xs font-bold waffly-num mr-auto', r.movement > 0 ? 'text-red-600' : r.movement < 0 ? 'text-emerald-600' : '')}>
          {r.movement > 0 ? '+' : '−'}{faMoney(Math.abs(r.movement))}
        </span>
      </div>
      <p className="text-xs font-medium mt-1 leading-5">{r.title}</p>
      {r.sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-4 waffly-num">{r.sub}</p>}
      {r.entry && (
        <div className="flex gap-0.5 mt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="ویرایش تراکنش"
            onClick={() => onEditEntry(r.entry!)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600" aria-label="حذف تراکنش"
            onClick={() => onRemoveEntry(r.entry!)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ================= همه تراکنش‌ها =================
function TxnList({ entries, partyOf, onEdit, onRemove }: {
  entries: LedgerEntry[]
  partyOf: (key: string) => Party | undefined
  onEdit: (e: LedgerEntry) => void
  onRemove: (e: LedgerEntry) => void
}) {
  const [filter, setFilter] = useState<'all' | 'IN' | 'OUT'>('all')
  const list = useMemo(() =>
    active(entries)
      .filter(e => filter === 'all' || e.kind === filter)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0)),
  [entries, filter])

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {([['all', 'همه'], ['IN', 'دریافت‌ها'], ['OUT', 'پرداخت‌ها']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn('rounded-xl px-3.5 py-2 text-xs font-medium min-h-9 transition-colors',
              filter === k ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border hover:bg-accent')}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Card className="waffly-card">
          <CardContent>
            <EmptyState
              icon={<BookText className="h-5 w-5" />}
              title="تراکنشی ثبت نشده"
              desc="با دکمه «ثبت پول» پول‌های خارج از فاکتور (واریز مشتری یا پرداخت به تامین‌کننده) را اینجا ثبت کنید."
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="waffly-card">
          <CardContent className="p-0">
            <ul className="divide-y" role="list">
              {list.map(e => {
                const p = partyOf(partyKeyOf(e))
                const st = dirStyle(e.kind)
                const Icon = st.icon
                return (
                  <li key={e.id} className="px-4 py-3 flex items-start gap-3 hover:bg-accent/40 transition-colors">
                    <span className={cn('mt-0.5 h-8 w-8 shrink-0 rounded-xl border flex items-center justify-center', st.cls)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm">{p?.name || String(e.freeName || '—')}</span>
                        {p && (
                          <span className="rounded-md border px-1.5 py-px text-[10px] font-medium bg-slate-50 text-slate-600 border-slate-200">
                            {KIND_LABEL[p.kind]}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground waffly-num">{prettyJalali(e.date)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-5">
                        {st.label}{e.method && ` — ${METHOD_LABELS[String(e.method)]}`}{e.note && ` — ${e.note}`}{e.createdBy && ` — توسط ${e.createdBy}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <p className={cn('text-sm font-bold waffly-num', e.kind === 'IN' ? 'text-emerald-600' : 'text-rose-600')}>
                        {e.kind === 'IN' ? '+' : '−'}{faMoney(e.amount)}
                      </p>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="ویرایش" onClick={() => onEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" aria-label="حذف" onClick={() => onRemove(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ================= دیالوگ ثبت/ویرایش پول =================
function EntryDialog({ open, onOpenChange, editing, presetParty, presetKind, parties, accounts, onSaved, onRemove }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: LedgerEntry | null
  presetParty: string
  presetKind: LedgerEntry['kind']
  parties: Party[]
  accounts: Account[]
  onSaved: () => void
  onRemove: (e: LedgerEntry) => void
}) {
  const [party, setParty] = useState(presetParty)
  const [newName, setNewName] = useState('')
  const [kind, setKind] = useState<LedgerEntry['kind']>(presetKind)
  const [amount, setAmount] = useState(editing ? String(editing.amount || '') : '')
  const [date, setDate] = useState(editing?.date || todayJalali())
  const [method, setMethod] = useState<string>(editing?.method || 'CASH')
  const [accountId, setAccountId] = useState<string>(editing?.accountId || '')
  const [note, setNote] = useState<string>(editing?.note || '')
  const [saving, setSaving] = useState(false)

  const isNewFree = party === NEW_KEY
  const chosen = parties.find(p => p.key === party)
  const options: { value: string; label: string; hint?: string }[] = [
    ...parties.map(p => ({ value: p.key, label: p.name, hint: KIND_LABEL[p.kind] })),
    { value: NEW_KEY, label: '＋ شخص جدید (خارج از مشتری/تامین‌کننده)' },
  ]

  const save = async () => {
    let freeName: string | null = null
    let customerId: string | null = null
    let supplierId: string | null = null
    if (isNewFree) {
      freeName = newName.trim()
      if (!freeName) { toast({ title: 'نام شخص جدید را وارد کنید', variant: 'destructive' }); return }
    } else {
      if (!chosen) { toast({ title: 'شخص را انتخاب کنید', variant: 'destructive' }); return }
      if (chosen.kind === 'CUSTOMER') customerId = chosen.id!
      else if (chosen.kind === 'SUPPLIER') supplierId = chosen.id!
      else freeName = chosen.name
    }
    const amt = toNum(amount)
    if (amt <= 0) { toast({ title: 'مبلغ را وارد کنید', variant: 'destructive' }); return }
    if (saving) return
    setSaving(true)
    try {
      await putRecord<LedgerEntry>('ledgerEntries', {
        ...(editing || {}),
        id: editing ? editing.id : uid(),
        updatedAt: editing ? editing.updatedAt : 0,
        date,
        kind,
        amount: amt,
        customerId,
        supplierId,
        freeName,
        method: (method || null) as LedgerEntry['method'],
        note: note.trim() || null,
        accountId: accountId || null,
        createdBy: editing?.createdBy ?? (getActiveUser() || null),
        deleted: 0,
      })
      toast({
        title: editing ? 'تراکنش ویرایش شد' : kind === 'IN' ? 'دریافت ثبت شد' : 'پرداخت ثبت شد',
        description: `${faMoney(amt)} تومان${amt > 0 ? ' — واریزی‌های مشتری خودکار روی فاکتورهای باز اعمال می‌شود' : ''}`,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش تراکنش دفتر' : 'ثبت پول در دفتر حساب'}</DialogTitle>
          <DialogDescription>
            پولی که جدا از فاکتور است — مثل واریز بخشی از بدهی مشتری یا پرداخت قسطی به تامین‌کننده.
            واریز مشتری خودکار روی قدیمی‌ترین فاکتورهای بازش اعمال می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <FormRow label="شخص">
            <InlinePicker
              value={party}
              options={options}
              onChange={setParty}
              placeholder="انتخاب شخص…"
              disabled={!!editing}
            />
            {isNewFree && (
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="نام شخص (مثلاً اخوندزاده)"
                className="mt-2 h-11"
              />
            )}
            {editing && (
              <p className="text-[11px] text-muted-foreground mt-1">
                شخص تراکنش ثبت‌شده قابل تغییر نیست — حذف و دوباره ثبت کنید.
              </p>
            )}
          </FormRow>
          <FormRow label="جهت پول">
            <div className="grid grid-cols-2 gap-2">
              {(['IN', 'OUT'] as const).map(k => {
                const st = dirStyle(k)
                const Icon = st.icon
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn('flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium min-h-11 transition-colors',
                      kind === k ? st.cls : 'bg-card text-muted-foreground hover:bg-accent')}
                    aria-pressed={kind === k}
                  >
                    <Icon className="h-4 w-4" />
                    {k === 'IN' ? 'پول گرفتیم' : 'پول دادیم'}
                  </button>
                )
              })}
            </div>
          </FormRow>
          <FormRow label="مبلغ (تومان)">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="مثلاً ۲۰۰۰۰۰۰"
              className="h-11 waffly-num-input"
            />
          </FormRow>
          <FormRow label="تاریخ">
            <JalaliDateInput value={date} onChange={setDate} />
          </FormRow>
          <FormRow label="روش پرداخت">
            <InlinePicker
              value={method}
              options={[
                { value: '', label: '— بدون روش —' },
                { value: 'CASH', label: 'نقدی' },
                { value: 'CARD', label: 'کارت به کارت' },
                { value: 'POS', label: 'کارتخوان' },
              ]}
              onChange={setMethod}
            />
          </FormRow>
          {accounts.length > 0 && (
            <FormRow
              label="حساب بانکی/صندوق (اختیاری)"
              hint="اگر انتخاب شود، این پول در گردش حساب‌های بخش حسابداری هم لحاظ می‌شود."
            >
              <InlinePicker
                value={accountId}
                options={[{ value: '', label: '— بدون حساب —' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
                onChange={setAccountId}
              />
            </FormRow>
          )}
          <FormRow label="شرح (اختیاری)">
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="مثلاً واریز بدهی قبلی"
              className="h-11"
            />
          </FormRow>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button className="flex-1 h-11" onClick={() => requireUserName(() => { void save() })} disabled={saving}>
            {saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت'}
          </Button>
          {editing && (
            <Button variant="destructive" className="h-11" onClick={() => onRemove(editing)} aria-label="حذف تراکنش">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>انصراف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
