import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MODELS, sanitizeRow } from '@/lib/server/sync-tables'
import { TABLES, type SyncTbl } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Delegate = {
  findUnique: (args: { where: { id: string } }) => Promise<{ updatedAt?: number } | null>
  upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>
}
const delegate = (tbl: SyncTbl): Delegate =>
  (db as unknown as Record<string, Delegate>)[MODELS[tbl]]

// ثبت تغییرات کلاینت‌ها با حل تعارض Last-Write-Wins
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const ops = Array.isArray(body?.ops) ? body.ops : []
    if (ops.length === 0) return NextResponse.json({ accepted: 0, skipped: 0, serverTime: Date.now() })

    let accepted = 0
    let skipped = 0
    const touchedTables = new Set<string>()

    for (const op of ops.slice(0, 2000)) {
      const tbl = String(op?.tbl || '') as SyncTbl
      if (!TABLES.includes(tbl)) continue
      const row = sanitizeRow(tbl, op?.row || {})
      if (!row) continue
      const model = delegate(tbl)
      const existing = await model.findUnique({ where: { id: row.id as string } })
      if (existing && (existing.updatedAt ?? 0) >= (row.updatedAt as number)) {
        skipped++
        continue
      }
      const { id, ...data } = row
      await model.upsert({ where: { id: id as string }, create: { id, ...data }, update: data })
      await db.syncLog.create({ data: { tbl, rid: id as string, ts: row.updatedAt as number } })
      accepted++
      touchedTables.add(tbl)
    }

    if (accepted > 0) {
      // اطلاع‌رسانی real-time به دستگاه‌های دیگر
      fetch('http://127.0.0.1:3003/notify', { method: 'POST' }).catch(() => {})
    }

    return NextResponse.json({ accepted, skipped, serverTime: Date.now() })
  } catch (e) {
    console.error('sync/push error', e)
    return NextResponse.json({ error: 'push failed' }, { status: 500 })
  }
}
