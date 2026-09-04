import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCart, type CartLineInput } from "@/lib/arta/pricing";
import { isValidIranMobile, toEn } from "@/lib/arta/format";
import { FREE_SHIPPING_THRESHOLD, PAYMENT_METHODS } from "@/lib/arta/constants";

export const dynamic = "force-dynamic";

interface CreateOrderBody {
  customerName?: string;
  phone?: string;
  provinceName?: string;
  cityName?: string;
  address?: string;
  postalCode?: string;
  note?: string;
  paymentMethod?: string;
  items?: CartLineInput[];
}

// POST /api/orders — ثبت سفارش مهمان (قیمت‌ها فقط روی سرور محاسبه می‌شوند)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const customerName = (body.customerName || "").trim();
    const phoneRaw = toEn(body.phone || "").replace(/\D/g, "");
    const provinceName = (body.provinceName || "").trim();
    const cityName = (body.cityName || "").trim();
    const address = (body.address || "").trim();
    const postalCode = toEn(body.postalCode || "").replace(/\D/g, "");
    const note = (body.note || "").trim().slice(0, 500);
    const paymentMethod = body.paymentMethod || "ON_DELIVERY";
    const items = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2) {
      return NextResponse.json({ ok: false, error: "نام و نام خانوادگی را کامل وارد کنید" }, { status: 400 });
    }
    if (!isValidIranMobile(phoneRaw)) {
      return NextResponse.json({ ok: false, error: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)" }, { status: 400 });
    }
    if (!provinceName || !cityName) {
      return NextResponse.json({ ok: false, error: "استان و شهر مقصد را انتخاب کنید" }, { status: 400 });
    }
    if (address.length < 10) {
      return NextResponse.json({ ok: false, error: "نشانی کامل پستی را وارد کنید" }, { status: 400 });
    }
    if (postalCode && postalCode.length !== 10) {
      return NextResponse.json({ ok: false, error: "کد پستی باید ۱۰ رقم باشد" }, { status: 400 });
    }
    if (!PAYMENT_METHODS.some((m) => m.id === paymentMethod)) {
      return NextResponse.json({ ok: false, error: "روش پرداخت نامعتبر است" }, { status: 400 });
    }
    if (items.length === 0 || items.length > 50) {
      return NextResponse.json({ ok: false, error: "سبد خرید خالی است" }, { status: 400 });
    }

    const products = await db.product.findMany({ where: { active: true } });
    const cart = computeCart(items, products);
    if (cart.lines.length === 0) {
      return NextResponse.json({ ok: false, error: "محصولات سبد یافت نشدند" }, { status: 400 });
    }

    const province = await db.province.findUnique({ where: { name: provinceName } });
    if (!province) {
      return NextResponse.json({ ok: false, error: "استان مقصد معتبر نیست" }, { status: 400 });
    }

    const thresholdSetting = await db.setting.findUnique({ where: { key: "freeShippingThreshold" } });
    const threshold = Number(thresholdSetting?.value || FREE_SHIPPING_THRESHOLD);
    const shippingCost = cart.subtotal >= threshold ? 0 : province.shippingCost;
    const total = cart.subtotal + shippingCost;

    // شماره سریال اتمیک — ۱۰۰۱ به بعد (هماهنگ با ساختار فاکتور Waffly)
    const serial = await db.$transaction(async (tx) => {
      await tx.orderCounter.upsert({
        where: { id: "main" },
        create: { id: "main", lastNumber: 1000 },
        update: {},
      });
      const c = await tx.orderCounter.update({
        where: { id: "main" },
        data: { lastNumber: { increment: 1 } },
      });
      return c.lastNumber;
    });

    const order = await db.order.create({
      data: {
        serial,
        customerName,
        phone: phoneRaw,
        provinceName,
        cityName,
        address,
        postalCode: postalCode || null,
        note: note || null,
        // ذخیره با نام فیلدهای همخوان Waffly (boxCount)
        items: JSON.stringify(
          cart.lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            sizeLabel: l.sizeLabel,
            essence: l.essence,
            essenceLabel: l.essenceLabel,
            boxCount: l.boxes,
            units: l.units,
            unitPrice: l.unitPrice,
            boxPrice: l.boxPrice,
            lineTotal: l.lineTotal,
            wholesale: l.wholesale,
          }))
        ),
        subtotal: cart.subtotal,
        shippingCost,
        total,
        paymentMethod,
        status: "PENDING",
      },
    });

    return NextResponse.json({ ok: true, serial: order.serial, total, shippingCost, subtotal: cart.subtotal });
  } catch (e) {
    console.error("order create error", e);
    return NextResponse.json({ ok: false, error: "ثبت سفارش انجام نشد؛ دوباره تلاش کنید" }, { status: 500 });
  }
}
