import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { jsonWithCors, optionsWithCors } from '@/lib/server/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return optionsWithCors()
}

// شمارهٔ سریال بعدی فاکتور — atomic با تراکنش تعاملی Prisma
export async function POST(_req: NextRequest) {
  try {
    const number = await db.$transaction(async (tx) => {
      const row = await tx.invoiceCounter.findUnique({ where: { id: 'main' } })
      if (!row) {
        const created = await tx.invoiceCounter.create({ data: { id: 'main', lastNumber: 1001, updatedAt: Date.now() } })
        return created.lastNumber
      }
      const updated = await tx.invoiceCounter.update({
        where: { id: 'main' },
        data: { lastNumber: { increment: 1 }, updatedAt: Date.now() },
      })
      return updated.lastNumber
    })
    return jsonWithCors({ number })
  } catch (e) {
    console.error('invoice/next-number error', e)
    return jsonWithCors({ error: 'next-number failed' }, { status: 500 })
  }
}
