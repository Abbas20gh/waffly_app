import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * دو حالت اجرا:
 * ۱) TURSO_DATABASE_URL تنظیم شده باشد (مثل Vercel) → دیتابیس ابری Turso/libsql
 * ۲) نبود → SQLite محلی file (توسعه و پیش‌نمایش) با DATABASE_URL
 */
function createClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // با درایور اداپتور، DATABASE_URL استفاده نمی‌شود ولی برخی محیط‌ها به آن نیاز دارند
    process.env.DATABASE_URL ||= "file:./db/unused.db";
    return new PrismaClient({ adapter, log: ["error"] });
  }
  return new PrismaClient({ log: ["error"] });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
