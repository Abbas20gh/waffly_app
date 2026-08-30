import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MODELS } from '@/lib/server/sync-tables'
import type { SyncTbl } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Delegate = { findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null> }
const delegate = (tbl: SyncTbl): Delegate =>
  (db as unknown as Record<string, Delegate>)[MODELS[tbl]]

// دریافت تغییرات افزایشی بر اساس cursor (seq آخرین SyncLog دریافتی)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const since = Number(url.searchParams.get('since') || 0) || 0
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 300), 1), 1000)

    const logs = await db.syncLog.findMany({
      where: { seq: { gt: since } },
      orderBy: { seq: 'asc' },
      take: limit,
    })

    // آخرین تغییر هر رکورد
    const latest = new Map<string, { tbl: SyncTbl; rid: string; seq: number }>()
    for (const l of logs) latest.set(`${l.tbl}:${l.rid}`, { tbl: l.tbl as SyncTbl, rid: l.rid, seq: l.seq })

    const rows: { tbl: SyncTbl; row: Record<string, unknown> }[] = []
    for (const { tbl, rid } of latest.values()) {
      const row = await delegate(tbl).findUnique({ where: { id: rid } })
      if (row) rows.push({ tbl, row })
    }

    const cursor = logs.length ? logs[logs.length - 1].seq : since
    return NextResponse.json({
      rows,
      cursor,
      hasMore: logs.length === limit,
      serverTime: Date.now(),
    })
  } catch (e) {
    console.error('sync/pull error', e)
    return NextResponse.json({ error: 'pull failed' }, { status: 500 })
  }
}
