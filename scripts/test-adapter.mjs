// تست مسیر آداپتر libsql (همان مسیری که Turso استفاده می‌کند) روی فایل محلی
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaLibSQL({ url: 'file:/tmp/adapter-test.db' })
const db = new PrismaClient({ adapter })

await db.$executeRawUnsafe('DROP TABLE IF EXISTS t')
await db.$executeRawUnsafe('CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)')
await db.$executeRawUnsafe("INSERT INTO t (id, v) VALUES ('a', 'hello-turso-path')")
const rows = await db.$queryRawUnsafe('SELECT * FROM t')
console.log('ADAPTER TEST OK:', JSON.stringify(rows))
process.exit(0)
