"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trash2,
  Truck,
  ArrowLeft,
  BadgePercent,
  ShoppingCart,
} from "lucide-react";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import { BoxStepper } from "@/components/arta/box-stepper";
import { useCart } from "@/store/cart";
import { computeCart, type PricingProduct } from "@/lib/arta/pricing";
import type { ProductDTO, ProvinceDTO } from "@/lib/arta/types";
import { faNumber, faToman } from "@/lib/arta/format";
import {
  FREE_SHIPPING_THRESHOLD,
  WHOLESALE_MIN_BOXES,
} from "@/lib/arta/constants";

export default function CartPage() {
  const { lines, setBoxes, remove } = useCart();
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [provinces, setProvinces] = useState<ProvinceDTO[]>([]);
  const [provinceName, setProvinceName] = useState("");
  const [freeThreshold, setFreeThreshold] = useState(FREE_SHIPPING_THRESHOLD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/provinces").then((r) => r.json()),
    ])
      .then(([p, pr]) => {
        if (p.ok) setProducts(p.products);
        if (pr.ok) {
          setProvinces(pr.provinces);
          setFreeThreshold(pr.freeShippingThreshold || FREE_SHIPPING_THRESHOLD);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const cart = useMemo(
    () =>
      computeCart(lines, products as PricingProduct[]),
    [lines, products]
  );

  const province = provinces.find((p) => p.name === provinceName);
  const freeShipping = cart.subtotal >= freeThreshold && cart.subtotal > 0;
  const shippingCost = cart.subtotal === 0 ? 0 : freeShipping ? 0 : province?.shippingCost ?? null;
  const total = cart.subtotal + (shippingCost ?? 0);

  if (!loading && lines.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 place-content-center bg-brand-soft px-4 py-24 text-center">
          <ShoppingCart className="mx-auto size-14 text-choco/25" />
          <h1 className="mt-4 text-xl font-bold text-choco">سبد خرید شما خالی است</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            از فروشگاه شروع کنید؛ هر جعبه {faNumber(200)} عدد نان بستنی تازه!
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground"
          >
            رفتن به فروشگاه
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-brand-soft">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="mb-6 text-2xl font-bold text-choco-deep">سبد خرید</h1>

          <div className="space-y-4">
            {cart.lines.map((l) => {
              const product = products.find((p) => p.id === l.productId);
              const raw = lines.find(
                (x) => x.productId === l.productId && x.essence === l.essence
              );
              const toWholesale = WHOLESALE_MIN_BOXES - l.boxes;
              return (
                <div
                  key={`${l.productId}-${l.essence}`}
                  className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-vanilla">
                    <Image
                      src={product?.imageUrl || "/images/hero.png"}
                      alt={l.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-choco">
                      {l.name} {l.essence && <span className="text-orange-deep">· اسانس پرتقال</span>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      هر جعبه {faNumber(200)} عدد ·{" "}
                      {l.wholesale ? (
                        <span className="font-bold text-pistachio-deep">قیمت عمده فعال شد</span>
                      ) : (
                        <>{faToman(l.boxPrice)} هر جعبه</>
                      )}
                    </p>
                    {!l.wholesale && toWholesale > 0 && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-pistachio-deep">
                        <BadgePercent className="size-3" />
                        {faNumber(toWholesale)} جعبه دیگر تا فعال شدن قیمت عمده
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <BoxStepper
                      compact
                      value={l.boxes}
                      onChange={(v) => raw && setBoxes(l.productId, l.essence, v)}
                    />
                    <div className="w-32 text-left">
                      <p className="text-sm font-bold text-choco-deep">{faToman(l.lineTotal)}</p>
                      {l.wholesaleSaved > 0 && (
                        <p className="text-[11px] text-pistachio-deep">
                          {faToman(l.wholesaleSaved)} صرفه‌جویی
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => remove(l.productId, l.essence)}
                      className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`حذف ${l.name} از سبد`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* هزینه ارسال */}
          <div className="mt-6 rounded-3xl border border-border bg-card p-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-choco" htmlFor="province">
              <Truck className="size-4 text-pistachio-deep" />
              استان مقصد را انتخاب کنید
            </label>
            <select
              id="province"
              value={provinceName}
              onChange={(e) => setProvinceName(e.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— انتخاب استان —</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="mt-4 space-y-2.5 border-t border-dashed border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>جمع سبد ({faNumber(cart.totalBoxes)} جعبه)</span>
                <span className="font-medium text-foreground">{faToman(cart.subtotal)}</span>
              </div>
              {cart.wholesaleSaved > 0 && (
                <div className="flex justify-between text-pistachio-deep">
                  <span>تخفیف عمده</span>
                  <span className="font-bold">−{faToman(cart.wholesaleSaved)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>هزینه ارسال</span>
                <span className="font-medium text-foreground">
                  {cart.subtotal === 0
                    ? "—"
                    : freeShipping
                      ? "رایگان 🎉"
                      : province
                        ? faToman(province.shippingCost)
                        : "پس از انتخاب استان"}
                </span>
              </div>
              {!freeShipping && cart.subtotal > 0 && (
                <p className="rounded-xl bg-vanilla px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                  با {faToman(Math.max(0, freeThreshold - cart.subtotal))} خرید بیشتر، ارسال رایگان می‌شود.
                </p>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-choco-deep">
                <span>مبلغ نهایی</span>
                <span>{faToman(total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/products" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              ← ادامه خرید
            </Link>
            <Link
              href={`/checkout${provinceName ? `?province=${encodeURIComponent(provinceName)}` : ""}`}
              aria-disabled={cart.lines.length === 0}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold shadow-lg transition-transform hover:scale-105 ${
                cart.lines.length === 0
                  ? "pointer-events-none bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground shadow-primary/25"
              }`}
            >
              ادامه و ثبت سفارش
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
