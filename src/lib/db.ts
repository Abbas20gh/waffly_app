import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// اگر DATABASE_URL با libsql:// شروع شود (مثل Turso) از درایور آداپتر استفاده می‌کنیم؛
// در غیر این صورت (فایل محلی file:) از موتور استاندارد SQLite.
function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'
  if (url.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({
      url,
      authToken: process.env.DATABASE_URL_AUTH_TOKEN || undefined,
    })
    return new PrismaClient({ adapter, log: ['warn', 'error'] })
  }
  return new PrismaClient({ log: ['warn', 'error'] })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db: PrismaClient = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
