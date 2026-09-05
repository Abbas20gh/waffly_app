import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FREE_SHIPPING_THRESHOLD, DEFAULT_ORIGIN_CITY } from "@/lib/arta/constants";

export const dynamic = "force-dynamic";

// GET /api/provinces — استان‌ها + هزینه ارسال + تنظیمات عمومی
export async function GET() {
  try {
    const [provinces, settings] = await Promise.all([
      db.province.findMany({ orderBy: { name: "asc" } }),
      db.setting.findMany(),
    ]);
    const map = new Map(settings.map((s) => [s.key, s.value]));
    return NextResponse.json({
      ok: true,
      provinces,
      originCity: map.get("originCity") || DEFAULT_ORIGIN_CITY,
      freeShippingThreshold: Number(
        map.get("freeShippingThreshold") || FREE_SHIPPING_THRESHOLD
      ),
      cardNumber: map.get("cardNumber") || "",
      cardOwner: map.get("cardOwner") || "",
      cardBank: map.get("cardBank") || "",
    });
  } catch (e) {
    console.error("provinces error", e);
    return NextResponse.json(
      { ok: false, error: "خطا در دریافت هزینه ارسال" },
      { status: 500 }
    );
  }
}
