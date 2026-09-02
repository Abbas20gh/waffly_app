// CORS مشترک برای API روت‌های Next.js (توسعه/سندباکس) — پاریتی با functions/api/[[route]].ts
// ⚠️ حیاتی برای اپ اندروید (Capacitor WebView با origin https://localhost):
// بدون این هدرها push/pull سمت APK توسط WebView بلاک می‌شود.
// اپ بدون احراز هویت است، پس "*" کاملاً امن است.
import { NextResponse } from 'next/server'

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function jsonWithCors(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: CORS })
}

export function optionsWithCors() {
  return new Response(null, { status: 204, headers: CORS })
}
