// ===== احراز هویت ساده پنل مدیریت (کوکی امضاشده HMAC) =====
import crypto from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "arta_admin";

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "arta-dev-secret-change-me";
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "arta1404";
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function makeToken(): string {
  const exp = Date.now() + 14 * 24 * 3600 * 1000; // دو هفته
  const payload = `admin.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expRaw, sig] = parts;
  const payload = `${role}.${expRaw}`;
  const expected = hmac(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }
  const exp = Number(expRaw);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(ADMIN_COOKIE)?.value);
}
