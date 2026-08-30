import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MODELS, ensureSeed } from '@/lib/server/sync-tables'
import { TABLES, type SyncTbl } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Delegate = { findMany: () => Promise<Record<string, unknown>[]> }
const delegate = (tbl: SyncTbl): Delegate =>
  (db as unknown as Record<string, Delegate>)[MODELS[tbl]]

// اسنپ‌شات کامل برای دستگاه جدید (bootstrap)
export async function GET() {
  try {
    await ensureSeed()
    const rows: { tbl: SyncTbl; row: Record<string, unknown> }[] = []
    for (const tbl of TABLES) {
      const all = await delegate(tbl).findMany()
      for (const row of all) rows.push({ tbl, row })
    }
    const last = await db.syncLog.findFirst({ orderBy: { seq: 'desc' } })
    return NextResponse.json({
      rows,
      cursor: last?.seq ?? 0,
      serverTime: Date.now(),
    })
  } catch (e) {
    console.error('sync/full error', e)
    return NextResponse.json({ error: 'full sync failed' }, { status: 500 })
  }
}
