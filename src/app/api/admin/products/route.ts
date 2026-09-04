import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/arta/admin-auth";
import { toEn } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

// GET /api/admin/products — همه محصولات (شامل غیرفعال)
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const products = await db.product.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ ok: true, products });
}

// PATCH /api/admin/products — ویرایش قیمت/فعال بودن/اسانس/نام/توضیح
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        pricePerUnit?: number | string;
        active?: boolean;
        essenceEnabled?: boolean;
        name?: string;
        description?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "داده نامعتبر" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.pricePerUnit !== undefined) {
    const p = Number(toEn(String(body.pricePerUnit)).replace(/\D/g, ""));
    if (!p || p < 100 || p > 10_000_000) {
      return NextResponse.json({ ok: false, error: "قیمت معتبر نیست" }, { status: 400 });
    }
    data.pricePerUnit = p;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.essenceEnabled === "boolean") data.essenceEnabled = body.essenceEnabled;
  if (body.name !== undefined && body.name.trim().length >= 2) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "چیزی برای بروزرسانی نیست" }, { status: 400 });
  }

  const product = await db.product.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, product });
}
