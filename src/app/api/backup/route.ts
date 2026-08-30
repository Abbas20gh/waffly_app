import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, copyFile, mkdir, unlink } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { gregorianToJalali } from '@/lib/jalali'

export const dynamic = 'force-dynamic'

const DB_FILE = (() => {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'
  return path.resolve(process.cwd(), url.replace(/^file:/, ''))
})()
const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups')
const KEEP = 14

function backupStamp(kind: 'auto' | 'manual') {
  const now = new Date()
  const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `waffly-${kind}-${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}-${hh}${mm}.db`
}

async function createBackup(kind: 'auto' | 'manual') {
  await mkdir(BACKUP_DIR, { recursive: true })
  const file = backupStamp(kind)
  await copyFile(DB_FILE, path.join(BACKUP_DIR, file))
  // نگهداشت ۱۴ نسخه آخر از هر نوع
  for (const k of ['auto', 'manual'] as const) {
    const files = (await readdir(BACKUP_DIR)).filter(f => f.startsWith(`waffly-${k}-`) && f.endsWith('.db')).sort()
    while (files.length > KEEP) {
      const old = files.shift()!
      await unlink(path.join(BACKUP_DIR, old)).catch(() => {})
    }
  }
  return file
}

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action') || 'list'
  try {
    if (action === 'list') {
      await mkdir(BACKUP_DIR, { recursive: true }).catch(() => {})
      const files = (await readdir(BACKUP_DIR).catch(() => [] as string[])).filter(f => f.endsWith('.db')).sort().reverse()
      const items = []
      for (const f of files) {
        const st = await stat(path.join(BACKUP_DIR, f)).catch(() => null)
        if (st) items.push({ file: f, size: st.size, mtime: st.mtimeMs })
      }
      return NextResponse.json({ items })
    }

    if (action === 'create' || action === 'auto') {
      if (!existsSync(DB_FILE)) return NextResponse.json({ error: 'db missing' }, { status: 500 })
      if (action === 'auto') {
        // فقط اگر ۲۴ ساعت از آخرین پشتیبان گذشته باشد
        await mkdir(BACKUP_DIR, { recursive: true }).catch(() => {})
        const files = (await readdir(BACKUP_DIR).catch(() => [] as string[])).filter(f => f.endsWith('.db'))
        let lastMtime = 0
        for (const f of files) {
          const st = await stat(path.join(BACKUP_DIR, f)).catch(() => null)
          if (st) lastMtime = Math.max(lastMtime, st.mtimeMs)
        }
        if (Date.now() - lastMtime < 24 * 3600 * 1000 && files.length > 0) {
          return NextResponse.json({ skipped: true, file: null })
        }
      }
      const file = await createBackup(action)
      return NextResponse.json({ ok: true, file })
    }

    if (action === 'download') {
      const file = new URL(req.url).searchParams.get('file') || ''
      // جلوگیری از path traversal
      if (!/^[\w.-]+\.db$/.test(file)) return NextResponse.json({ error: 'bad file' }, { status: 400 })
      const full = path.join(BACKUP_DIR, file)
      if (!existsSync(full)) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const stream = createReadStream(full) as unknown as ReadableStream
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file}"`,
        },
      })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (e) {
    console.error('backup error', e)
    return NextResponse.json({ error: 'backup failed' }, { status: 500 })
  }
}
