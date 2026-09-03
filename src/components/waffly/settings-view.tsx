'use client'

// تنظیمات — کسب‌وکار، سینک، پشتیبان‌گیری، نصب PWA، سرفصل هزینه‌ها
import { useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  Settings as SettingsIcon, Save, DatabaseBackup, Download, Upload,
  CalendarDays, ShieldAlert, RefreshCw, HardDriveDownload, Smartphone, Plus, Trash2, Pencil,
} from 'lucide-react'
import {
  useSetting, useTable, putRecord, removeRecord, exportAllToJson, importAllFromJson, uid,
} from '@/lib/localdb'
import { PageHeader, FormRow } from './bits'
import { PwaGuideContent, getPlatform, isStandalone } from './pwa-install'
import { faDigits, faMoney } from '@/lib/jalali'
import { forceSyncNow, useSyncStore, repairSync, forceFullResync } from '@/lib/sync-engine'
import { downloadTextFile } from '@/lib/export'
import type { ExpenseCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface BackupItem { file: string; size: number; mtime: number }

// بسته‌بندی اندروید (Capacitor): آدرس سرور در زمان build تزریق می‌شود؛ روی وب نسبی می‌ماند
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

export function SettingsView() {
  const setting = useSetting()
  const { pendingCount, online, lastSyncAt, error, syncing } = useSyncStore()
  const expenseCategories = useTable<ExpenseCategory>('expenseCategories')

  const [businessName, setBusinessName] = useState('')
  const [accountingDay, setAccountingDay] = useState('5')
  const [badDebtDays, setBadDebtDays] = useState('30')
  const [checkAlertDays, setCheckAlertDays] = useState('7')
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [busy, setBusy] = useState(false)
  const [pwaState, setPwaState] = useState<{ platform: string; standalone: boolean }>({ platform: '', standalone: false })
  const [newCat, setNewCat] = useState('')
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPwaState({ platform: getPlatform(), standalone: isStandalone() })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // مقداردهی اولیه فرم
  const [initialized, setInitialized] = useState(false)
  if (!initialized && setting) {
    setBusinessName(setting.businessName)
    setAccountingDay(String(setting.monthStartDay))
    setBadDebtDays(String(setting.badDebtDays))
    setCheckAlertDays(String(setting.checkAlertDays))
    setInitialized(true)
  }

  const loadBackups = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/backup?action=list`)
      const data = await res.json() as { items?: BackupItem[] }
      setBackups(data.items || [])
    } catch { /* آفلاین */ }
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => void loadBackups())
    return () => cancelAnimationFrame(id)
  }, [])

  const save = async () => {
    await putRecord('settings', {
      ...setting,
      id: 'main',
      businessName: businessName.trim() || 'Waffly',
      monthStartDay: Math.min(Math.max(parseInt(accountingDay || '1', 10) || 1, 1), 29),
      badDebtDays: Math.max(parseInt(badDebtDays || '30', 10) || 30, 1),
      checkAlertDays: Math.max(parseInt(checkAlertDays || '7', 10) || 7, 1),
    })
    toast({ title: 'تنظیمات ذخیره شد', description: 'روی همه دستگاه‌ها سینک می‌شود.' })
  }

  const createBackup = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/backup?action=create`)
      const data = await res.json() as { ok?: boolean; file?: string }
      if (data.ok) { toast({ title: 'پشتیبان ساخته شد', description: data.file || undefined }); void loadBackups() }
      else toast({ title: 'ساخت پشتیبان ناموفق بود', variant: 'destructive' })
    } catch { toast({ title: 'برای پشتیبان سرور، اینترنت لازم است', variant: 'destructive' }) }
    setBusy(false)
  }

  const exportJson = async () => {
    const json = await exportAllToJson()
    downloadTextFile(json, `waffly-backup-${Date.now()}.json`, 'application/json')
    toast({ title: 'فایل JSON دانلود شد' })
  }

  const importJson = async (file: File) => {
    setBusy(true)
    try {
      const n = await importAllFromJson(file)
      toast({ title: 'بازیابی انجام شد', description: `${faDigits(n)} رکورد` })
    } catch {
      toast({ title: 'فایل نامعتبر است', variant: 'destructive' })
    }
    setBusy(false)
  }

  const addCategory = async () => {
    if (!newCat.trim()) return
    if (editingCat) {
      await putRecord<ExpenseCategory>('expenseCategories', { ...editingCat, name: newCat.trim() })
      toast({ title: 'سرفصل ویرایش شد' })
    } else {
      await putRecord<ExpenseCategory>('expenseCategories', { id: uid(), name: newCat.trim(), includeInProfit: 1, updatedAt: 0, deleted: 0 })
      toast({ title: 'سرفصل اضافه شد' })
    }
    setNewCat('')
    setEditingCat(null)
  }

  return (
    <div className="space-y-5">
      {/* APP_VERSION — با هر آپدیت APK/وب به‌روز شود */}
      <PageHeader title="تنظیمات" subtitle="دوره حسابداری، هشدارها، سینک، پشتیبان‌گیری و نصب اپ — نسخه ۲.۶.۰" icon={<SettingsIcon className="h-5 w-5" />} />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card className="waffly-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" /> تنظیمات کسب‌وکار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormRow label="نام کسب‌وکار">
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} className="h-11" />
            </FormRow>
            <FormRow label="روز شروع دوره حسابداری در هر ماه" hint="مثلاً ۵ یعنی دوره از ۵ام تا ۴ام ماه بعد محاسبه می‌شود">
              <Input type="number" min={1} max={29} className="waffly-num-input" value={accountingDay} onChange={e => setAccountingDay(e.target.value)} />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="روز مجاز تسویه مشتری">
                <Input type="number" className="waffly-num-input" value={badDebtDays} onChange={e => setBadDebtDays(e.target.value)} />
              </FormRow>
              <FormRow label="هشدار سررسید چک (روز قبل)">
                <Input type="number" className="waffly-num-input" value={checkAlertDays} onChange={e => setCheckAlertDays(e.target.value)} />
              </FormRow>
            </div>
            <p className="text-[11px] text-muted-foreground">
              مشتریانی که بیش از {faDigits(badDebtDays)} روز از فروش‌شان بگذرد و تسویه نکرده باشند «بدحساب» علامت می‌خورند.
            </p>
            <Button onClick={save} className="h-11 min-w-32"><Save className="ml-2 h-4 w-4" /> ذخیره تنظیمات</Button>

            {/* سرفصل هزینه‌ها */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">سرفصل هزینه‌ها (معین)</p>
              <p className="text-[11px] text-muted-foreground">سرفصل‌های فعال در فرمول سود خالص حساب می‌شوند؛ «برداشت صاحب کار» پیش‌فرض غیرمشمول است.</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto thin-scroll">
                {expenseCategories.filter(c => !c.deleted).map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="flex-1">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="ویرایش"
                      onClick={() => { setEditingCat(c); setNewCat(c.name) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-7 text-[10px]"
                      onClick={() => void putRecord<ExpenseCategory>('expenseCategories', { ...c, includeInProfit: c.includeInProfit ? 0 : 1 })}
                    >
                      {c.includeInProfit ? 'مشمول سود ✓' : 'غیرمشمول'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" aria-label="حذف"
                      onClick={() => void removeRecord('expenseCategories', c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={editingCat ? `ویرایش «${editingCat.name}»…` : 'سرفصل جدید…'} className="h-10" />
                <Button variant="outline" className="h-10 shrink-0" onClick={addCategory}>{editingCat ? 'ذخیره' : <><Plus className="h-4 w-4" /> افزودن</>}</Button>
                {editingCat && <Button variant="ghost" className="h-10 shrink-0" onClick={() => { setEditingCat(null); setNewCat('') }}>انصراف</Button>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== سینک و پشتیبان ===== */}
        <div className="space-y-4">
          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> همگام‌سازی</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-lg px-2.5 py-1.5 ${online ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {online ? 'اینترنت: متصل' : 'اینترنت: قطع (آفلاین)'}
                </span>
                <span className="rounded-lg bg-muted px-2.5 py-1.5 waffly-num">
                  {pendingCount > 0 ? `${faDigits(pendingCount)} تغییر در صف ارسال` : 'همه تغییرات ارسال شده'}
                </span>
                {lastSyncAt > 0 && (
                  <span className="rounded-lg bg-muted px-2.5 py-1.5 waffly-num">
                    آخرین سینک: {faDigits(new Date(lastSyncAt).toTimeString().slice(0, 5))}
                  </span>
                )}
                {error && (
                  <span className="rounded-lg bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 waffly-num">
                    خطای سینک: {error}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11" disabled={syncing} onClick={() => { forceSyncNow(); toast({ title: 'سینک انجام شد' }) }}>
                  <RefreshCw className="ml-2 h-4 w-4" /> سینک فوری
                </Button>
                <Button variant="outline" className="h-11" disabled={busy} onClick={async () => {
                  setBusy(true)
                  const n = await repairSync()
                  toast({ title: 'تعمیر سینک انجام شد', description: `${faDigits(n)} رکورد دوباره در صف قرار گرفت` })
                  setBusy(false)
                }}>
                  <DatabaseBackup className="ml-2 h-4 w-4" /> تعمیر سینک
                </Button>
                <Button variant="outline" className="h-11 border-primary/40 text-primary" disabled={busy || syncing} onClick={async () => {
                  setBusy(true)
                  try {
                    await forceFullResync()
                    toast({ title: 'دریافت کامل انجام شد', description: 'همه داده‌ها با سرور هم‌سطح شد — اگر هنوز اختلاف می‌بینید صفحه را ببندید و دوباره باز کنید.' })
                  } catch {
                    toast({ title: 'دریافت کامل ناموفق بود', description: 'اینترنت را چک کنید و دوباره تلاش کنید.', variant: 'destructive' })
                  } finally {
                    setBusy(false)
                  }
                }}>
                  <HardDriveDownload className="ml-2 h-4 w-4" /> دریافت کامل از سرور
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-5">
                حالت آفلاین‌محور: همه داده‌ها اول روی همین دستگاه ذخیره می‌شوند. با برقراری اینترنت، تغییرات خودکار
                به سرور رفته و روی دستگاه ۳ کاربر دیگر هم اعمال می‌شود (حل تعارض بر اساس آخرین ویرایش — LWW).
                «دریافت کامل از سرور» برای رفع اختلاف شدید است: اول همه تغییرات محلی بالا می‌رود، بعد نسخه سرور
                دقیقاً جایگزین داده‌های همین دستگاه می‌شود (اقلام محلیِ اضافه/تکراری که روی سرور نیستند حذف می‌شوند).
              </p>
            </CardContent>
          </Card>

          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><DatabaseBackup className="h-4 w-4" /> پشتیبان‌گیری</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-10" disabled={busy} onClick={createBackup}>
                  <HardDriveDownload className="ml-2 h-4 w-4" /> پشتیبان روی سرور
                </Button>
                <Button variant="outline" className="h-10" onClick={exportJson}>
                  <Download className="ml-2 h-4 w-4" /> دانلود JSON
                </Button>
                <label className="cursor-pointer">
                  <span className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
                    <Upload className="h-4 w-4" /> بازیابی از JSON
                  </span>
                  <input
                    type="file" accept=".json" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void importJson(f) }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-5">
                پشتیبان‌گیری خودکار روزانه: هر روز که اپ باز شود (و آنلاین باشد)، در صورت گذشت ۲۴ ساعت از آخرین
                پشتیبان، خودکار یک نسخه روی سرور ذخیره می‌شود (۱۴ نسخه آخر نگه داشته می‌شوند).
              </p>

              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right h-9">فایل پشتیبان سرور</TableHead>
                      <TableHead className="text-right h-9">حجم</TableHead>
                      <TableHead className="w-16 h-9"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-4">هنوز پشتیبانی ساخته نشده</TableCell>
                      </TableRow>
                    ) : (
                      backups.slice(0, 6).map(b => (
                        <TableRow key={b.file}>
                          <TableCell className="text-xs waffly-num" dir="ltr">{b.file}</TableCell>
                          <TableCell className="text-xs waffly-num">{faDigits(Math.round(b.size / 1024))} KB</TableCell>
                          <TableCell>
                            <a href={`${API_BASE}/api/backup?action=download&file=${encodeURIComponent(b.file)}`} download>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="دانلود">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="waffly-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> نصب روی گوشی (iPhone / iPad / Android)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-muted px-2.5 py-1.5">
                  پلتفرم: <b>{pwaState.platform === 'ios' ? 'iOS / iPadOS' : pwaState.platform === 'android' ? 'اندروید' : 'دسکتاپ'}</b>
                </span>
                {pwaState.standalone ? (
                  <span className="rounded-lg px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200">
                    ✓ اپ نصب شده و حالت تمام‌صفحه فعال است
                  </span>
                ) : (
                  <span className="rounded-lg px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200">
                    هنوز در مرورگر باز شده — برای تجربه کامل نصب کنید
                  </span>
                )}
              </div>
              <PwaGuideContent />
              <p className="text-[11px] text-muted-foreground leading-5">
                روی iPhone حتماً از Safari استفاده کنید (دکمه اشتراک در نوار پایین). روی اندروید Chrome → منوی سه‌نقطه ←
                «افزودن به صفحه اصلی». نسخه اندروید APK مستقل هم دارد.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== راهنمای آفلاین ===== */}
      <Card className="waffly-card border-dashed">
        <CardContent className="p-4 text-xs leading-6 text-muted-foreground">
          <p className="font-bold text-foreground mb-1 flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> نکته درباره کارکرد آفلاین</p>
          اپ را یک بار با اینترنت باز کنید تا در حافظه مرورگر/اپلیکیشن نصب شود (PWA). بعد از آن حتی بدون اینترنت
          کامل کار می‌کند و داده‌ها روی دستگاه ذخیره می‌شوند. برای نصب روی اندروید: منوی کروم ← «افزودن به صفحه اصلی».
        </CardContent>
      </Card>
    </div>
  )
}
