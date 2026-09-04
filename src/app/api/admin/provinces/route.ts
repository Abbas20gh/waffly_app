import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/arta/admin-auth";
import { toEn } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

// GET /api/admin/provinces — جدول هزینه ارسال
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const provinces = await db.province.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ ok: true, provinces });
}

// PUT /api/admin/provinces — ذخیره دسته‌ای هزینه‌ها [{id, shippingCost}]
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { items?: Array<{ id?: string; shippingCost?: number | string }> }
    | null;
  const items = Array.isArray(body?.items) ? body!.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "داده‌ای ارسال نشد" }, { status: 400 });
  }

  let updated = 0;
  for (const it of items) {
    if (!it.id) continue;
    const cost = Number(toEn(String(it.shippingCost ?? "")).replace(/\D/g, ""));
    if (!cost || cost < 0 || cost > 100_000_000) continue;
    await db.province.update({ where: { id: it.id }, data: { shippingCost: cost } });
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
