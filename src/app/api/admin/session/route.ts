import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminPassword,
  isAdminRequest,
  makeToken,
} from "@/lib/arta/admin-auth";
import { toEn } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

// GET /api/admin/session — بررسی وضعیت ورود
export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true, authed: isAdminRequest(req) });
}

// POST /api/admin/session — ورود با رمز
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = toEn(body?.password || "");
  if (!password || password !== adminPassword()) {
    return NextResponse.json({ ok: false, error: "رمز عبور اشتباه است" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 3600,
  });
  return res;
}

// DELETE /api/admin/session — خروج
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
