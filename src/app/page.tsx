import Link from "next/link";
import Image from "next/image";
import {
  Truck,
  Gift,
  Sparkles,
  ShoppingBasket,
  Phone,
  BadgePercent,
  IceCreamBowl,
} from "lucide-react";
import { db } from "@/lib/db";
import { HomeHero } from "@/components/arta/home-hero";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import { ProductCard } from "@/components/arta/product-card";
import type { ProductDTO } from "@/lib/arta/types";
import {
  BRAND_COMPANY,
  CONTACT_PHONES,
  CONTACT_PHONES_RAW,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/arta/constants";
import { faNumber, faToman } from "@/lib/arta/format";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: Sparkles, title: "تازه و روزانه", desc: "تولید روزانه با مواد اولیه درجه‌یک" },
  { icon: Truck, title: "ارسال سراسری", desc: "به همه استان‌های کشور" },
  { icon: Gift, title: "ارسال رایگان", desc: `خرید بالای ${faNumber(FREE_SHIPPING_THRESHOLD)} تومان` },
  { icon: ShoppingBasket, title: "سفارش آسان", desc: "بدون نیاز به ثبت‌نام، در چند کلیک" },
];

export default async function HomePage() {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const products: ProductDTO[] = rows;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeHero />

        {/* نوار مزایا */}
        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-pistachio-deep">
                  <b.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-choco">{b.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* محصولات */}
        <section id="products" className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-pistachio-deep">
              <IceCreamBowl className="size-3.5" />
              محصولات ما
            </span>
            <h2 className="mt-4 text-2xl font-bold text-choco-deep sm:text-3xl">
              چهار طعم از یک خوشمزگی
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              فروش فقط جعبه‌ای است؛ هر جعبه {faNumber(200)} عدد. قیمت هر دو حالت خرده و
              عمده همین‌جا مشخص است — بدون نیاز به تماس.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/products"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-choco px-8 text-sm font-bold text-choco transition-colors hover:bg-choco hover:text-primary-foreground"
            >
              رفتن به فروشگاه
            </Link>
          </div>
        </section>

        {/* بنر تخفیف عمده */}
        <section className="bg-dots border-y border-border bg-vanilla/50">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/25 px-4 py-1.5 text-xs font-bold text-choco">
                <BadgePercent className="size-3.5 text-orange-deep" />
                قیمت عمده
              </span>
              <h2 className="mt-4 text-2xl font-bold leading-relaxed text-choco-deep sm:text-3xl">
                از {faNumber(10)} جعبه، قیمت‌ها خودکار عمده می‌شود
              </h2>
              <p className="mt-4 text-sm leading-8 text-muted-foreground">
                کافیست از هر نوع محصول {faNumber(10)} جعبه یا بیشتر به سبد اضافه کنید؛
                قیمت همان نوع به‌صورت خودکار عمده حساب می‌شود: هر عدد{" "}
                <b className="text-choco">{faNumber(200)} تومان</b> ارزان‌تر، یعنی هر جعبه
                حدود <b className="text-choco">{faToman(40000)}</b> تخفیف. محاسبه در سبد
                خرید به‌صورت زنده انجام می‌شود.
              </p>
              <Link
                href="/products"
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
              >
                شروع خرید عمده
              </Link>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-border shadow-lg">
              <Image
                src="/images/hero.png"
                alt="نان بستنی فانتزی آرتا در کنار میوه‌ها"
                width={1344}
                height={768}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* درباره — کوتاه */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-2xl font-bold text-choco-deep">{BRAND_COMPANY}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground">
              «نان بستنی آرتا» برند محصول از {BRAND_COMPANY} است؛ سال‌هاست با همان فرمول
              دوست‌داشتنی، نان بستنی فانتزی تازه را به قفسه فروشگاه‌ها و سفره خانه‌ها
              می‌رسانیم. حالا سفارش آنلاین جعبه‌ای، همان کیفیت را مستقیم به دست شما
              می‌رساند.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {CONTACT_PHONES_RAW.map((p, i) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium text-choco transition-colors hover:bg-accent"
                >
                  <Phone className="size-4 text-orange-deep" />
                  <span dir="ltr">{CONTACT_PHONES[i]}</span>
                </a>
              ))}
              <Link
                href="/about"
                className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-pistachio hover:text-white"
              >
                بیشتر درباره ما
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
