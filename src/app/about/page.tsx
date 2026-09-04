import type { Metadata } from "next";
import Link from "next/link";
import { Phone, IceCreamCone, Factory, HeartHandshake } from "lucide-react";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import {
  BRAND_COMPANY,
  BRAND_PRODUCT,
  CONTACT_PHONES,
  CONTACT_PHONES_RAW,
} from "@/lib/arta/constants";

export const metadata: Metadata = {
  title: "درباره ما",
  description: `${BRAND_COMPANY} — تولیدکننده ${BRAND_PRODUCT}`,
};

const VALUES = [
  {
    icon: Factory,
    title: "تولید اصولی",
    desc: "کارگاه تولید ما با رعایت کامل بهداشت و استانداردهای صنایع غذایی، روزانه نان بستنی فانتزی تازه تولید می‌کند.",
  },
  {
    icon: IceCreamCone,
    title: "طعم دوست‌داشتنی",
    desc: "فرمول ویژه نان تازه و بستنی خامه‌ای، همان خوشمزگی آشنایی است که مشتری‌ها سال‌هاست می‌شناسند و دنبالش می‌گردند.",
  },
  {
    icon: HeartHandshake,
    title: "اعتماد فروشگاه‌ها",
    desc: "قفسه فروشگاه‌ها و بستنی‌فروشی‌های سراسر کشور میزبان محصولات ماست؛ سفارش عمده با قیمت ویژه پشتیبانی می‌شود.",
  },
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-brand-soft">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <header className="text-center">
            <h1 className="text-3xl font-bold text-choco-deep">{BRAND_COMPANY}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground">
              {BRAND_COMPANY} تولیدکننده {BRAND_PRODUCT} است؛ برندی که با تکیه بر مواد
              اولیه تازه و تولید روزانه، نان بستنی فانتزی را برای خانه‌ها، مهمانی‌ها و
              فروشگاه‌ها می‌سازد. فروشگاه اینترنتی ما همان کیفیت را با سفارش آسان جعبه‌ای
              و ارسال سراسری در اختیار شما می‌گذارد.
            </p>
          </header>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-pistachio-deep">
                  <v.icon className="size-6" />
                </span>
                <h2 className="mt-4 text-sm font-bold text-choco">{v.title}</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-choco-deep">تماس با ما</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              برای سفارش‌های عمده و هماهنگی ویژه، مستقیم با ما در تماس باشید.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {CONTACT_PHONES_RAW.map((p, i) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
                >
                  <Phone className="size-4" />
                  <span dir="ltr">{CONTACT_PHONES[i]}</span>
                </a>
              ))}
            </div>
            <Link
              href="/products"
              className="mt-6 inline-flex h-12 items-center rounded-full border-2 border-choco px-8 text-sm font-bold text-choco transition-colors hover:bg-choco hover:text-primary-foreground"
            >
              مشاهده محصولات و قیمت‌ها
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
