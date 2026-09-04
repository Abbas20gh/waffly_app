import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/arta/admin-auth";
import { toEn } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

const EDITABLE_KEYS = ["originCity", "freeShippingThreshold", "cardNumber", "cardOwner"];

// GET /api/admin/settings
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const settings = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({ ok: true, settings: map });
}

// PUT /api/admin/settings — {originCity, freeShippingThreshold, cardNumber, cardOwner}
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "دسترسی ندارید" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "داده نامعتبر" }, { status: 400 });
  }

  for (const key of EDITABLE_KEYS) {
    if (body[key] === undefined) continue;
    let value = String(body[key]).trim();
    if (key === "freeShippingThreshold") {
      value = toEn(value).replace(/\D/g, "") || "10000000";
    }
    if (key === "originCity" && value.length < 2) continue;
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  const settings = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({ ok: true, settings: map });
}
