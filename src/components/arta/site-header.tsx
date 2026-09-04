"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShoppingBasket, IceCreamCone, Phone, Menu, X, PackageSearch } from "lucide-react";
import { useCart } from "@/store/cart";
import { toFa, faNumber } from "@/lib/arta/format";
import { CONTACT_PHONES_RAW } from "@/lib/arta/constants";

const NAV = [
  { href: "/products", label: "فروشگاه" },
  { href: "/track", label: "پیگیری سفارش" },
  { href: "/about", label: "درباره ما" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);
  const count = lines.reduce((s, l) => s + l.boxes, 0);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="نان بستنی آرتا — صفحه اصلی">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <IceCreamCone className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold text-choco">نان بستنی آرتا</span>
            <span className="block text-[11px] text-muted-foreground">گروه صنعتی آرتا</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="منوی اصلی">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith(n.href) ? "bg-accent text-accent-foreground" : "text-foreground/80"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <a
            href={`tel:${CONTACT_PHONES_RAW[0]}`}
            className="mr-1 hidden items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:flex"
            dir="ltr"
          >
            <Phone className="size-3.5" />
            {CONTACT_PHONES_RAW[0]}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative grid size-11 place-items-center rounded-full bg-secondary/90 text-secondary-foreground shadow-sm transition-transform hover:scale-105"
            aria-label={`سبد خرید، ${faNumber(count)} جعبه`}
          >
            <ShoppingBasket className="size-5" />
            {count > 0 && (
              <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-pistachio-deep px-1 text-[11px] font-bold text-white">
                {toFa(count)}
              </span>
            )}
          </Link>
          <button
            className="grid size-11 place-items-center rounded-full border border-border md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="باز و بسته کردن منو"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden" aria-label="منوی موبایل">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent"
            >
              {n.href === "/track" && <PackageSearch className="size-4 text-pistachio-deep" />}
              {n.label}
            </Link>
          ))}
          <a
            href={`tel:${CONTACT_PHONES_RAW[0]}`}
            className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent"
          >
            <Phone className="size-4 text-orange-deep" />
            <span dir="ltr">{CONTACT_PHONES_RAW[0]}</span>
          </a>
        </nav>
      )}
    </header>
  );
}
