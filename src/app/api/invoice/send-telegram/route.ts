import { NextRequest } from 'next/server'
import { jsonWithCors, optionsWithCors } from '@/lib/server/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return optionsWithCors()
}

// ارسال فاکتور به تلگرام — token/chat_id فقط سمت سرور (env)، هرگز در باندل کلاینت
// فرمت text → sendMessage | pdf → sendDocument | image (PNG) → sendPhoto
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return jsonWithCors({ ok: false, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID روی سرور تنظیم نشده است' }, { status: 500 })
  }
  try {
    const body = await req.json().catch(() => null) as {
      format?: string; text?: string; base64?: string; filename?: string; caption?: string
    } | null
    if (!body) return jsonWithCors({ ok: false, error: 'bad request' }, { status: 400 })
    const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`

    let tg: Response
    if (body.format === 'text') {
      if (!body.text?.trim()) return jsonWithCors({ ok: false, error: 'متن فاکتور خالی است' }, { status: 400 })
      tg = await fetch(api('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: body.text }),
      })
    } else {
      if (!body.base64) return jsonWithCors({ ok: false, error: 'فایل فاکتور دریافت نشد' }, { status: 400 })
      const buf = Buffer.from(body.base64, 'base64')
      const isImage = body.format === 'image'
      const mime = isImage ? 'image/png' : 'application/pdf'
      const filename = body.filename || (isImage ? 'invoice.png' : 'invoice.pdf')
      const fd = new FormData()
      fd.append('chat_id', chatId)
      if (body.caption) fd.append('caption', body.caption)
      fd.append(isImage ? 'photo' : 'document', new Blob([new Uint8Array(buf)], { type: mime }), filename)
      tg = await fetch(api(isImage ? 'sendPhoto' : 'sendDocument'), { method: 'POST', body: fd })
    }

    const out = await tg.json().catch(() => ({ ok: false, description: 'bad telegram response' })) as { ok?: boolean; description?: string }
    if (!tg.ok || !out.ok) return jsonWithCors({ ok: false, error: out.description || `telegram ${tg.status}` }, { status: 502 })
    return jsonWithCors({ ok: true })
  } catch (e) {
    return jsonWithCors({ ok: false, error: e instanceof Error ? e.message : 'telegram send failed' }, { status: 502 })
  }
}
