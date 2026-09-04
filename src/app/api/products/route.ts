import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products — فهرست محصولات فعال + اسانس‌های فعال
export async function GET() {
  try {
    const [products, essences] = await Promise.all([
      db.product.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.essence.findMany({ where: { active: true } }),
    ]);
    return NextResponse.json({ ok: true, products, essences });
  } catch (e) {
    console.error("products error", e);
    return NextResponse.json(
      { ok: false, error: "خطا در دریافت محصولات" },
      { status: 500 }
    );
  }
}
