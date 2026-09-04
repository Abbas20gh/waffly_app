import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/arta/admin-auth";
import { toEn } from "@/lib/arta/format";
import { ORDER_STATUSES } from "@/lib/arta/constants";

export const dynamic = "force-dynamic";

// GET /api/admin/orders — فهرست سفارش‌ها (?status=&q=&page=)
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, Number(sp.get("page") || 1));
  const take = 30;

  const where: {
    status?: string;
    OR?: Array<{ customerName?: { contains: string } } | { phone?: { contains: string } } | { serial?: number }>;
  } = {};
  if (status && ORDER_STATUSES.some((s) => s.id === status)) where.status = status;
  if (q) {
    const qEn = toEn(q).replace(/\D/g, "");
    const or: Array<Record<string, unknown>> = [{ customerName: { contains: q } }];
    if (qEn) {
      or.push({ phone: { contains: qEn } });
      const serialNum = Number(qEn);
      if (serialNum) or.push({ serial: serialNum });
    }
    where.OR = or as never;
  }

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { serial: "desc" },
      skip: (page - 1) * take,
      take,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
    orders: orders.map((o) => ({ ...o, items: JSON.parse(o.items || "[]") })),
  });
}

// PATCH /api/admin/orders — تغییر وضعیت سفارش
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string }
    | null;
  if (!body?.id || !body.status || !ORDER_STATUSES.some((s) => s.id === body.status)) {
    return NextResponse.json({ ok: false, error: "داده نامعتبر" }, { status: 400 });
  }
  const updated = await db.order.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json({ ok: true, status: updated.status });
}
