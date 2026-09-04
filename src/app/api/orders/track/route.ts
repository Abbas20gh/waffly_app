import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toEn } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

// GET /api/orders/track?serial=1001&phone=09123456789 — پیگیری سفارش بدون حساب
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const serial = Number(toEn(sp.get("serial") || "").replace(/\D/g, ""));
    const phone = toEn(sp.get("phone") || "").replace(/\D/g, "");

    if (!serial || !/^09\d{9}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "شماره سفارش و موبایل ثبت‌شده را وارد کنید" },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({ where: { serial } });
    if (!order || order.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "سفارشی با این شماره و موبایل پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      order: {
        serial: order.serial,
        customerName: order.customerName,
        status: order.status,
        items: JSON.parse(order.items || "[]"),
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        total: order.total,
        paymentMethod: order.paymentMethod,
        provinceName: order.provinceName,
        cityName: order.cityName,
        createdAt: order.createdAt,
      },
    });
  } catch (e) {
    console.error("track error", e);
    return NextResponse.json({ ok: false, error: "خطا در پیگیری سفارش" }, { status: 500 });
  }
}
