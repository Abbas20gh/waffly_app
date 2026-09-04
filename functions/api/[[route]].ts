// Cloudflare Pages Functions — معادل کامل API های Next.js
// /api — /api/sync/push — /api/sync/pull — /api/sync/full — /api/backup
import { createClient, type Client } from '@libsql/client'
import { pushOps, pullRows, fullSnapshot, ensureSchema } from './_sync'

// ⚠️ CORS — حیاتی برای اپ اندروید (Capacitor WebView با origin https://localhost)
// بدون این هدرها، fetch های سمت APK توسط مرورگر بلاک می‌شوند:
//  - POST push (Content-Type: application/json) → preflight OPTIONS → شکست → هیچ داده‌ای از گوشی به سرور نمی‌رسد
//  - GET pull → پاسخ قابل خواندن نیست → هیچ داده‌ای از سرور به گوشی نمی‌رسد
// اپ بدون احراز هویت است، پس "*" کاملاً امن است.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

interface Env {
  TURSO_URL: string
  TURSO_TOKEN?: string
  /** v2.8 — فاکتور: ارسال به تلگرام (هرگز در کد هاردکد نمی‌شود) */
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
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
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
    },
  })
}

export async function onRequest(ctx: Ctx): Promise<Response> {
  const url = new URL(ctx.request.url)
  const parts = ctx.params.route
  const path = (Array.isArray(parts) ? parts.join('/') : parts || '').replace(/\/+$/, '')

  // preflight — باید قبل از هر چیز و بدون دست به دیتابیس پاسخ شود
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const db = getClient(ctx.env)

    // سلامت سرور
    if (path === '') {
      return json({ message: 'Hello, world!' })
    }

    // ثبت تغییرات
    if (path === 'sync/push' && ctx.request.method === 'POST') {
      await ensureSchema(db)
      const body = await ctx.request.json().catch(() => null) as { ops?: unknown } | null
      const ops = Array.isArray(body?.ops) ? body!.ops : []
      if (ops.length === 0) return json({ accepted: 0, skipped: 0, serverTime: Date.now() })
      const { accepted, skipped } = await pushOps(db, ops)
      return json({ accepted, skipped, serverTime: Date.now() })
    }

    // دریافت افزایشی — GET و POST هر دو پشتیبانی می‌شوند
    // (POST در APK از مسیر نیتیو CapacitorHttp می‌رود — قابل‌اتکاترین مسیر)
    if (path === 'sync/pull' && (ctx.request.method === 'GET' || ctx.request.method === 'POST')) {
      await ensureSchema(db)
      let since = 0
      let limit = 300
      if (ctx.request.method === 'POST') {
        const body = await ctx.request.json().catch(() => null) as { since?: unknown; limit?: unknown } | null
        since = Number(body?.since || 0) || 0
        limit = Number(body?.limit || 300) || 300
      } else {
        since = Number(url.searchParams.get('since') || 0) || 0
        limit = Number(url.searchParams.get('limit') || 300) || 300
      }
      limit = Math.min(Math.max(limit, 1), 1000)
      const result = await pullRows(db, since, limit)
      return json({ ...result, serverTime: Date.now() })
    }

    // اسنپ‌شات کامل (bootstrap دستگاه جدید) — GET و POST هر دو
    if (path === 'sync/full' && (ctx.request.method === 'GET' || ctx.request.method === 'POST')) {
      await ensureSchema(db)
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

    // ===== v2.8 فاکتور =====

    // شمارهٔ سریال بعدی فاکتور — atomic روی سرور (هر دو GET/POST)
    if (path === 'invoice/next-number' && (ctx.request.method === 'POST' || ctx.request.method === 'GET')) {
      await ensureSchema(db)
      const res = await db.execute({
        sql: `UPDATE "InvoiceCounter" SET "lastNumber" = "lastNumber" + 1, "updatedAt" = ? WHERE "id" = 'main' RETURNING "lastNumber"`,
        args: [Date.now()],
      })
      const num = res.rows.length > 0 ? Number(res.rows[0]['lastNumber']) : 0
      if (!num) {
        // ردیف نبود (نباید رخ دهد — ensureSchema می‌سازد) — بساز و از ۱۰۰۱ شروع کن
        const r2 = await db.execute({
          sql: `INSERT INTO "InvoiceCounter" ("id","lastNumber","updatedAt") VALUES ('main', 1001, ?) ON CONFLICT("id") DO UPDATE SET "lastNumber" = "InvoiceCounter"."lastNumber" + 1 RETURNING "lastNumber"`,
          args: [Date.now()],
        })
        return json({ number: Number(r2.rows[0]?.['lastNumber'] || 1001) })
      }
      return json({ number: num })
    }

    // ارسال فاکتور به تلگرام — متن با sendMessage، فایل با sendDocument/sendPhoto
    if (path === 'invoice/send-telegram' && ctx.request.method === 'POST') {
      const token = ctx.env.TELEGRAM_BOT_TOKEN
      const chatId = ctx.env.TELEGRAM_CHAT_ID
      if (!token || !chatId) {
        return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID روی سرور تنظیم نشده است' }, 500)
      }
      const body = await ctx.request.json().catch(() => null) as {
        format?: string; text?: string; base64?: string; filename?: string; caption?: string
      } | null
      if (!body) return json({ ok: false, error: 'bad request' }, 400)
      const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`
      try {
        let tg: Response
        if (body.format === 'text') {
          if (!body.text?.trim()) return json({ ok: false, error: 'متن فاکتور خالی است' }, 400)
          tg = await fetch(api('sendMessage'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: body.text }),
          })
        } else {
          if (!body.base64) return json({ ok: false, error: 'فایل فاکتور دریافت نشد' }, 400)
          const bin = atob(body.base64)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const isImage = body.format === 'image'
          const mime = isImage ? 'image/png' : 'application/pdf'
          const filename = body.filename || (isImage ? 'invoice.png' : 'invoice.pdf')
          const fd = new FormData()
          fd.append('chat_id', chatId)
          if (body.caption) fd.append('caption', body.caption)
          fd.append(isImage ? 'photo' : 'document', new Blob([bytes], { type: mime }), filename)
          tg = await fetch(api(isImage ? 'sendPhoto' : 'sendDocument'), { method: 'POST', body: fd })
        }
        const out = await tg.json().catch(() => ({ ok: false, description: 'bad telegram response' })) as { ok?: boolean; description?: string }
        if (!tg.ok || !out.ok) return json({ ok: false, error: out.description || `telegram ${tg.status}` }, 502)
        return json({ ok: true })
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'telegram send failed' }, 502)
      }
    }

    return json({ error: 'not found' }, 404)
  } catch (e) {
    console.error('api error', path, e)
    return json({ error: 'internal error' }, 500)
  }
}
