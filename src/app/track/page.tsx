"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PackageSearch, Loader2, MapPin, Hash } from "lucide-react";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import { ORDER_STATUSES, statusLabel } from "@/lib/arta/constants";
import type { TrackResult } from "@/lib/arta/types";
import { faDateTime, faNumber, faToman, toEn, toFa } from "@/lib/arta/format";

function TrackInner() {
  const sp = useSearchParams();
  const [serial, setSerial] = useState(sp.get("serial") || "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);

  async function search() {
    setError("");
    setResult(null);
    const s = toEn(serial).replace(/\D/g, "");
    const p = toEn(phone).replace(/\D/g, "");
    if (!s || !/^09\d{9}$/.test(p)) {
      setError("شماره سفارش و موبایل ۱۱ رقمی ثبت‌شده را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/track?serial=${s}&phone=${p}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "سفارش پیدا نشد");
        return;
      }
      setResult(data as TrackResult);
    } catch {
      setError("خطای شبکه؛ دوباره تلاش کنید");
    } finally {
      setLoading(false);
    }
  }

  const statusIdx = result ? ORDER_STATUSES.findIndex((s) => s.id === result.order.status) : -1;
  const canceled = result?.order.status === "CANCELED";

  return (
    <main className="flex-1 bg-brand-soft">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-accent text-pistachio-deep">
              <PackageSearch className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-choco-deep">پیگیری سفارش</h1>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              شماره سفارش و موبایلی که هنگام ثبت وارد کردید را بنویسید.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-choco" htmlFor="serial">
                <Hash className="size-3.5" /> شماره سفارش
              </label>
              <input
                id="serial"
                inputMode="numeric"
                value={toFa(serial)}
                onChange={(e) => setSerial(toEn(e.target.value))}
                placeholder="۱۰۰۱"
                className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="tphone">موبایل ثبت‌شده</label>
              <input
                id="tphone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            onClick={search}
            disabled={loading}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <PackageSearch className="size-4" />}
            {loading ? "در حال جستجو..." : "جستجوی سفارش"}
          </button>
        </div>

        {result && (
          <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-choco">
                سفارش {toFa(result.order.serial)} — {result.order.customerName}
              </p>
              <span className="text-xs text-muted-foreground">{faDateTime(result.order.createdAt)}</span>
            </div>

            {!canceled ? (
              <ol className="mt-6 space-y-0">
                {ORDER_STATUSES.filter((s) => s.id !== "CANCELED").map((s, i) => {
                  const active = i <= statusIdx;
                  return (
                    <li key={s.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                            active ? "text-white" : "bg-muted text-muted-foreground"
                          }`}
                          style={active ? { backgroundColor: s.color } : undefined}
                        >
                          {toFa(i + 1)}
                        </span>
                        {i < 3 && <span className={`h-8 w-0.5 ${i < statusIdx ? "bg-pistachio" : "bg-muted"}`} />}
                      </div>
                      <p className={`pb-8 text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.label}
                        {i === statusIdx && <span className="mr-2 text-[11px] text-pistachio-deep">· وضعیت فعلی</span>}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-5 rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs font-bold text-destructive">
                این سفارش لغو شده است. برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.
              </p>
            )}

            <div className="mt-2 space-y-2 border-t border-dashed border-border pt-4 text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5" />
                مقصد: {result.order.provinceName}، {result.order.cityName}
              </p>
              {result.order.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {faNumber(it.boxCount)} جعبه {it.name}
                    {it.essence && " (اسانس پرتقال)"}
                  </span>
                  <span className="font-medium">{faToman(it.lineTotal)}</span>
                </div>
              ))}
              <div className="flex justify-between text-muted-foreground">
                <span>هزینه ارسال</span>
                <span>{result.order.shippingCost === 0 ? "رایگان" : faToman(result.order.shippingCost)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2.5 text-sm font-bold text-choco-deep">
                <span>مبلغ کل</span>
                <span>{faToman(result.order.total)}</span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                وضعیت: {statusLabel(result.order.status)} — روش پرداخت:{" "}
                {result.order.paymentMethod === "CARD_TRANSFER" ? "کارت به کارت" : "پرداخت در محل"}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrackPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="flex-1 bg-brand-soft" />}>
        <TrackInner />
      </Suspense>
      <SiteFooter />
    </>
  );
}
