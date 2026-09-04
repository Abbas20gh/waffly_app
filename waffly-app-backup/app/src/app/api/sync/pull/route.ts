import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { MODELS } from '@/lib/server/sync-tables'
import { normalizeGoodsUnitsServer } from '@/lib/server/goods-units'
import type { SyncTbl } from '@/lib/types'
import { jsonWithCors, optionsWithCors } from '@/lib/server/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return optionsWithCors()
}

type Delegate = { findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null> }
const delegate = (tbl: SyncTbl): Delegate =>
  (db as unknown as Record<string, Delegate>)[MODELS[tbl]]

// دریافت افزایشی بر اساس cursor (seq آخرین SyncLog دریافتی)
// GET و POST هر دو پشتیبانی می‌شوند — POST در APK از مسیر نیتیو CapacitorHttp می‌رود
async function handlePull(since: number, limit: number) {
  limit = Math.min(Math.max(limit, 1), 1000)

  try { await normalizeGoodsUnitsServer() } catch { /* مهاجرت واحدها — خطا سینک را نبندد */ }

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
  return jsonWithCors({
    rows,
    cursor,
    hasMore: logs.length === limit,
    serverTime: Date.now(),
  })
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const since = Number(url.searchParams.get('since') || 0) || 0
    const limit = Number(url.searchParams.get('limit') || 300) || 300
    return await handlePull(since, limit)
  } catch (e) {
    console.error('sync/pull error', e)
    return jsonWithCors({ error: 'pull failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { since?: unknown; limit?: unknown } | null
    const since = Number(body?.since || 0) || 0
    const limit = Number(body?.limit || 300) || 300
    return await handlePull(since, limit)
  } catch (e) {
    console.error('sync/pull error', e)
    return jsonWithCors({ error: 'pull failed' }, { status: 500 })
  }
}
