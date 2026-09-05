"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  HandCoins,
  CheckCircle2,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import { useCart } from "@/store/cart";
import { computeCart, type PricingProduct } from "@/lib/arta/pricing";
import type { ProductDTO, ProvinceDTO } from "@/lib/arta/types";
import { faNumber, faToman, isValidIranMobile, toFa, faCardNumber } from "@/lib/arta/format";
import { PAYMENT_METHODS, FREE_SHIPPING_THRESHOLD } from "@/lib/arta/constants";
import { toast } from "@/hooks/use-toast";

function CheckoutInner() {
  const sp = useSearchParams();
  const { lines, clear } = useCart();
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [provinces, setProvinces] = useState<ProvinceDTO[]>([]);
  const [freeThreshold, setFreeThreshold] = useState(FREE_SHIPPING_THRESHOLD);
  const [cardNumber, setCardNumber] = useState("");
  const [cardOwner, setCardOwner] = useState("");
  const [cardBank, setCardBank] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ serial: number } | null>(null);

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    provinceName: sp.get("province") || "",
    cityName: "",
    address: "",
    postalCode: "",
    note: "",
    paymentMethod: "ON_DELIVERY" as string,
  });

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
          setCardNumber(pr.cardNumber || "");
          setCardOwner(pr.cardOwner || "");
          setCardBank(pr.cardBank || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const cart = useMemo(() => computeCart(lines, products as PricingProduct[]), [lines, products]);
  const province = provinces.find((p) => p.name === form.provinceName);
  const freeShipping = cart.subtotal >= freeThreshold && cart.subtotal > 0;
  const shippingCost = cart.subtotal === 0 ? 0 : freeShipping ? 0 : province?.shippingCost ?? 0;
  const total = cart.subtotal + shippingCost;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (submitting) return;
    if (cart.lines.length === 0) {
      toast({ title: "سبد خرید خالی است", variant: "destructive" });
      return;
    }
    if (form.customerName.trim().length < 2) {
      toast({ title: "نام و نام خانوادگی را کامل وارد کنید", variant: "destructive" });
      return;
    }
    if (!isValidIranMobile(form.phone)) {
      toast({ title: "شماره موبایل معتبر نیست", description: "مثال: ۰۹۱۲۱۲۳۴۵۶۷", variant: "destructive" });
      return;
    }
    if (!form.provinceName || !form.cityName.trim()) {
      toast({ title: "استان و شهر مقصد را وارد کنید", variant: "destructive" });
      return;
    }
    if (form.address.trim().length < 10) {
      toast({ title: "نشانی کامل پستی را وارد کنید", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: lines }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "ثبت سفارش انجام نشد", variant: "destructive" });
        return;
      }
      setDone({ serial: data.serial });
      clear();
    } catch {
      toast({ title: "خطای شبکه؛ دوباره تلاش کنید", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex-1 place-content-center bg-brand-soft px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto size-16 text-pistachio" />
        <h1 className="mt-5 text-2xl font-bold text-choco-deep">سفارش شما ثبت شد!</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          شماره سفارش شما:{" "}
          <b className="text-lg text-choco" dir="ltr">{toFa(done.serial)}</b>
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
          این شماره را نگه دارید؛ با شماره موبایل خود می‌توانید از صفحه «پیگیری سفارش»
          وضعیت لحظه‌ای سفارش را ببینید. همکاران ما برای هماهنگی ارسال با شما تماس می‌گیرند.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href={`/track?serial=${done.serial}`}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground"
          >
            <PackageCheck className="size-4" />
            پیگیری سفارش
          </Link>
          <Link
            href="/products"
            className="inline-flex h-12 items-center rounded-full border-2 border-choco px-7 text-sm font-bold text-choco"
          >
            ادامه خرید
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-brand-soft">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-choco-deep">تکمیل و ثبت سفارش</h1>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* فرم */}
          <div className="space-y-4 rounded-3xl border border-border bg-card p-5 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="name">نام و نام خانوادگی *</label>
                <input
                  id="name"
                  value={form.customerName}
                  onChange={(e) => set("customerName", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="مثلاً علی محمدی"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="phone">شماره موبایل *</label>
                <input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="prov">استان *</label>
                <select
                  id="prov"
                  value={form.provinceName}
                  onChange={(e) => set("provinceName", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— انتخاب استان —</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="city">شهر *</label>
                <input
                  id="city"
                  value={form.cityName}
                  onChange={(e) => set("cityName", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="مثلاً کرج"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="addr">نشانی کامل پستی *</label>
              <textarea
                id="addr"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
                className="w-full rounded-2xl border border-input bg-background p-4 text-sm leading-7 outline-none focus:ring-2 focus:ring-ring"
                placeholder="خیابان، کوچه، پلاک، واحد"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="postal">کد پستی (اختیاری)</label>
                <input
                  id="postal"
                  inputMode="numeric"
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor="note">توضیحات (اختیاری)</label>
                <input
                  id="note"
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* روش پرداخت — لایه انتزاعی؛ درگاه آنلاین بعداً همین‌جا اضافه می‌شود */}
            <div>
              <p className="mb-2 text-xs font-bold text-choco">روش پرداخت *</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("paymentMethod", m.id)}
                    aria-pressed={form.paymentMethod === m.id}
                    className={`rounded-2xl border p-4 text-right transition-all ${
                      form.paymentMethod === m.id
                        ? "border-choco bg-choco/5 ring-2 ring-choco/20"
                        : "border-border hover:border-choco/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-choco">
                      {m.id === "ON_DELIVERY" ? <HandCoins className="size-4" /> : <CreditCard className="size-4" />}
                      {m.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>
              {form.paymentMethod === "CARD_TRANSFER" && (
                <div className="mt-3 rounded-2xl bg-vanilla p-4 text-xs leading-6 text-muted-foreground">
                  {cardNumber ? (
                    <>
                      {cardBank && (
                        <>
                          بانک: <b className="text-choco">{cardBank}</b>
                          <br />
                        </>
                      )}
                      شماره کارت: <b className="text-choco" dir="ltr">{faCardNumber(cardNumber)}</b>
                      {cardOwner && <> — به نام <b className="text-choco">{cardOwner}</b></>}
                      <br />
                      پس از واریز، رسید را برای پشتیبانی ارسال کنید تا سفارش شما پردازش شود.
                    </>
                  ) : (
                    <>
                      شماره کارت هنوز در سیستم ثبت نشده؛ پس از ثبت سفارش، همکاران ما برای
                      هماهنگی پرداخت با شما تماس می‌گیرند.
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* خلاصه سفارش */}
          <aside className="h-fit space-y-3 rounded-3xl border border-border bg-card p-5 lg:col-span-2">
            <h2 className="text-sm font-bold text-choco">خلاصه سفارش</h2>
            <div className="nice-scroll max-h-56 space-y-2.5 overflow-y-auto pl-1">
              {cart.lines.map((l) => (
                <div key={`${l.productId}-${l.essence}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {faNumber(l.boxes)} جعبه {l.name}
                    {l.essence && " (اسانس پرتقال)"}
                    {l.wholesale && " · عمده"}
                  </span>
                  <span className="shrink-0 font-medium">{faToman(l.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-dashed border-border pt-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>جمع سبد</span>
                <span className="font-medium text-foreground">{faToman(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ارسال {province ? `به ${province.name}` : ""}</span>
                <span className="font-medium text-foreground">
                  {freeShipping ? "رایگان" : province ? faToman(province.shippingCost) : "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2.5 text-sm font-bold text-choco-deep">
                <span>مبلغ نهایی</span>
                <span>{faToman(total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || loading || cart.lines.length === 0}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {submitting ? "در حال ثبت..." : "ثبت نهایی سفارش"}
            </button>
            <p className="text-center text-[11px] leading-5 text-muted-foreground">
              با ثبت سفارش، همکاران ما برای تأیید نهایی و هماهنگی ارسال با شما تماس می‌گیرند.
            </p>
            <Link href="/cart" className="block text-center text-xs text-muted-foreground hover:text-foreground">
              ← بازگشت به سبد خرید
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="flex-1 bg-brand-soft" />}>
        <CheckoutInner />
      </Suspense>
      <SiteFooter />
    </>
  );
}
