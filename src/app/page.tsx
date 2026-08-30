'use client'

import { useEffect, useState } from 'react'
import { AppShell, type ViewKey } from '@/components/waffly/app-shell'
import { DashboardView } from '@/components/waffly/dashboard-view'
import { ProductionView } from '@/components/waffly/production-view'
import { SalesView } from '@/components/waffly/sales-view'
import { PurchasesView } from '@/components/waffly/purchases-view'
import { MachinesView } from '@/components/waffly/machines-view'
import { AccountingView } from '@/components/waffly/accounting-view'
import { SettingsView } from '@/components/waffly/settings-view'
import { startSyncEngine } from '@/lib/sync-engine'
import { Toaster } from '@/components/ui/toaster'

const VALID_VIEWS: ViewKey[] = ['dashboard', 'production', 'sales', 'purchases', 'machines', 'accounting', 'settings']

export default function Home() {
  const [view, setView] = useState<ViewKey>('dashboard')

  // راه‌اندازی موتور سینک (فقط کلاینت)
  useEffect(() => {
    const stop = startSyncEngine()
    return stop
  }, [])

  // مسیریابی با hash برای عمق‌لینک (مثلاً /#/production)
  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace('#/', '') as ViewKey
      if (VALID_VIEWS.includes(h)) setView(h)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const navigate = (v: ViewKey) => {
    setView(v)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', v === 'dashboard' ? '#' : `#/${v}`)
    }
  }

  return (
    <>
      <AppShell view={view} onNavigate={navigate}>
        {view === 'dashboard' && <DashboardView onNavigate={navigate} />}
        {view === 'production' && <ProductionView />}
        {view === 'sales' && <SalesView />}
        {view === 'purchases' && <PurchasesView />}
        {view === 'machines' && <MachinesView />}
        {view === 'accounting' && <AccountingView />}
        {view === 'settings' && <SettingsView />}
      </AppShell>
      <Toaster />
    </>
  )
}
