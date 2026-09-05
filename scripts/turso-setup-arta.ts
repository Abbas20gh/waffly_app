// ===== راه‌اندازی یک‌باره دیتابیس Turso برای سایت آرتا =====
// استفاده:
//   TURSO_DATABASE_URL="libsql://xxx.turso.io" TURSO_AUTH_TOKEN="..." bun run scripts/turso-setup-arta.ts
// کارها: ساخت جدول‌ها (IF NOT EXISTS) + seed محصولات/استان‌ها/تنظیمات
// روی محیط محلی هم کار می‌کند: TURSO_DATABASE_URL="file:./db/test.db"
import { createClient } from "@libsql/client";
import { db } from "@/lib/db";
import { main as seed } from "./seed-arta";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL تنظیم نشده است.");
  process.exit(1);
}

// DDL دقیقاً هم‌ساز با prisma/schema.prisma (خروجی prisma migrate diff)
const DDL = [
  `CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "unitsPerBox" INTEGER NOT NULL DEFAULT 200,
    "essenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS "Essence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
)`,
  `CREATE TABLE IF NOT EXISTS "Province" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shippingCost" INTEGER NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serial" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "provinceName" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT,
    "note" TEXT,
    "items" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "shippingCost" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ON_DELIVERY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "OrderCounter" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "lastNumber" INTEGER NOT NULL DEFAULT 1000
)`,
  `CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Province_name_key" ON "Province"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Order_serial_key" ON "Order"("serial")`,
  `CREATE INDEX IF NOT EXISTS "Order_phone_idx" ON "Order"("phone")`,
  `CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status")`,
];

async function main() {
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  console.log("1/2 ساخت جدول‌ها روی:", url.replace(/\/$/, ""));
  for (const stmt of DDL) {
    await client.execute(stmt);
  }
  console.log("   جدول‌ها آماده شد ✓");

  console.log("2/2 اجرای seed (محصولات، اسانس، ۳۱ استان، تنظیمات)...");
  await seed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
