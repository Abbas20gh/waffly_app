// Cloudflare Pages Functions — معادل کامل API های Next.js
// /api — /api/sync/push — /api/sync/pull — /api/sync/full — /api/backup
import { createClient, type Client } from '@libsql/client'
import { pushOps, pullRows, fullSnapshot } from './_sync'

interface Env {
  TURSO_URL: string
  TURSO_TOKEN?: string
}

interface Ctx {
  request: Request
  env: Env
  params: { route?: string | string[] }
}

// کلاینت libsql در سطح isolate کش می‌شود (ارزان است، ولی بهتر است یک بار ساخته شود)
let cached: Client | null = null
let cachedUrl = ''
function getClient(env: Env): Client {
  if (!cached || cachedUrl !== env.TURSO_URL) {
    cached = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN || undefined })
    cachedUrl = env.TURSO_URL
  }
  return cached
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export async function onRequest(ctx: Ctx): Promise<Response> {
  const url = new URL(ctx.request.url)
  const parts = ctx.params.route
  const path = (Array.isArray(parts) ? parts.join('/') : parts || '').replace(/\/+$/, '')

  try {
    const db = getClient(ctx.env)

    // سلامت سرور
    if (path === '') {
      return json({ message: 'Hello, world!' })
    }

    // ثبت تغییرات
    if (path === 'sync/push' && ctx.request.method === 'POST') {
      const body = await ctx.request.json().catch(() => null) as { ops?: unknown } | null
      const ops = Array.isArray(body?.ops) ? body!.ops : []
      if (ops.length === 0) return json({ accepted: 0, skipped: 0, serverTime: Date.now() })
      const { accepted, skipped } = await pushOps(db, ops)
      return json({ accepted, skipped, serverTime: Date.now() })
    }

    // دریافت افزایشی
    if (path === 'sync/pull' && ctx.request.method === 'GET') {
      const since = Number(url.searchParams.get('since') || 0) || 0
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 300), 1), 1000)
      const result = await pullRows(db, since, limit)
      return json({ ...result, serverTime: Date.now() })
    }

    // اسنپ‌شات کامل (bootstrap دستگاه جدید)
    if (path === 'sync/full' && ctx.request.method === 'GET') {
      const result = await fullSnapshot(db)
      return json({ ...result, serverTime: Date.now() })
    }

    // بکاپ — در حالت Turso بکاپ سمت پلتفرم مدیریت می‌شود
    if (path === 'backup' && ctx.request.method === 'GET') {
      const action = url.searchParams.get('action') || 'list'
      if (action === 'list') return json({ items: [], serverless: true })
      if (action === 'create' || action === 'auto') {
        return json({ error: 'serverless', message: 'در حالت هاست ابری، بکاپ‌گیری به‌صورت خودکار توسط پلتفرم انجام می‌شود.' }, 501)
      }
      return json({ error: 'not found' }, 404)
    }

    return json({ error: 'not found' }, 404)
  } catch (e) {
    console.error('api error', path, e)
    return json({ error: 'internal error' }, 500)
  }
}
