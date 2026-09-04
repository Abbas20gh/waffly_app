import Link from "next/link";
import { IceCreamCone, Phone } from "lucide-react";
import {
  BRAND_COMPANY,
  BRAND_PRODUCT,
  CONTACT_PHONES,
  CONTACT_PHONES_RAW,
} from "@/lib/arta/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-vanilla/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <IceCreamCone className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold text-choco">{BRAND_PRODUCT}</p>
              <p className="text-[11px] text-muted-foreground">تولیدکننده نان بستنی فانتزی</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            {BRAND_PRODUCT} برند محصول از {BRAND_COMPANY} است؛ تولید روزانه نان بستنی
            فانتزی با مواد اولیه تازه و ارسال به سراسر کشور.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-choco">دسترسی سریع</h3>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-muted-foreground hover:text-foreground" href="/products">فروشگاه و قیمت‌ها</Link></li>
            <li><Link className="text-muted-foreground hover:text-foreground" href="/cart">سبد خرید</Link></li>
            <li><Link className="text-muted-foreground hover:text-foreground" href="/track">پیگیری سفارش</Link></li>
            <li><Link className="text-muted-foreground hover:text-foreground" href="/about">درباره {BRAND_COMPANY}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-choco">تماس با ما</h3>
          <ul className="space-y-2.5 text-sm">
            {CONTACT_PHONES_RAW.map((p, i) => (
              <li key={p}>
                <a
                  href={`tel:${p}`}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="size-4 text-orange-deep" />
                  <span dir="ltr" className="font-medium">{CONTACT_PHONES[i]}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            پشتیبانی سفارش‌ها در ساعات کاری پاسخگو است.
          </p>
        </div>
      </div>

      <div className="border-t border-border/70 py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date())} — تمامی حقوق برای {BRAND_COMPANY} محفوظ است.
        </p>
      </div>
    </footer>
  );
}
