"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ShoppingBasket, BadgePercent } from "lucide-react";
import { BoxStepper } from "./box-stepper";
import { useCart } from "@/store/cart";
import { faNumber, faToman } from "@/lib/arta/format";
import { boxPriceOf } from "@/lib/arta/pricing";
import {
  UNITS_PER_BOX,
  WHOLESALE_DISCOUNT_PER_UNIT,
  WHOLESALE_MIN_BOXES,
} from "@/lib/arta/constants";
import type { ProductDTO } from "@/lib/arta/types";
import { toast } from "@/hooks/use-toast";

export function ProductCard({ product }: { product: ProductDTO }) {
  const add = useCart((s) => s.add);
  const [essence, setEssence] = useState(false);
  const [boxes, setBoxes] = useState(1);

  const retailBox = product.pricePerUnit * product.unitsPerBox;
  const currentBox = useMemo(
    () => boxPriceOf(product.pricePerUnit, boxes),
    [product.pricePerUnit, boxes]
  );
  const wholesale = boxes >= WHOLESALE_MIN_BOXES;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-choco/10">
      <div className="relative aspect-square overflow-hidden bg-vanilla">
        <Image
          src={product.imageUrl || "/images/hero.png"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute right-3 top-3 rounded-full bg-choco/90 px-3 py-1 text-[11px] font-bold text-primary-foreground">
          سایز {product.sizeLabel}
        </span>
        {product.essenceEnabled && essence && (
          <span className="absolute left-3 top-3 rounded-full bg-orange-brand px-3 py-1 text-[11px] font-bold text-choco-deep shadow">
            با اسانس پرتقال
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-bold text-choco">{product.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-muted-foreground">
            {product.description}
          </p>
        </div>

        {/* قیمت خرده و عمده هر دو نمایش داده می‌شود — بدون نیاز به تماس */}
        <div className="flex items-end justify-between rounded-2xl bg-vanilla/70 p-3.5">
          <div>
            <p className="text-[11px] text-muted-foreground">قیمت هر جعبه ({faNumber(product.unitsPerBox)} عدد)</p>
            <p className={`mt-0.5 text-lg font-bold ${wholesale ? "text-muted-foreground line-through decoration-destructive/60" : "text-choco-deep"}`}>
              {faToman(retailBox)}
            </p>
          </div>
          {wholesale && (
            <div className="text-left">
              <p className="text-[11px] font-medium text-pistachio-deep">قیمت عمده شما</p>
              <p className="text-lg font-bold text-pistachio-deep">{faToman(currentBox)}</p>
            </div>
          )}
        </div>

        {product.essenceEnabled && (
          <div className="flex gap-1.5" role="radiogroup" aria-label="انتخاب طعم">
            <button
              type="button"
              role="radio"
              aria-checked={!essence}
              onClick={() => setEssence(false)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                !essence ? "border-choco bg-choco text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-choco/40"
              }`}
            >
              ساده
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={essence}
              onClick={() => setEssence(true)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                essence ? "border-orange-deep bg-orange-brand text-choco-deep" : "border-border bg-background text-muted-foreground hover:border-orange-deep/40"
              }`}
            >
              با اسانس پرتقال
            </button>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <BoxStepper value={boxes} onChange={setBoxes} />
          <button
            type="button"
            onClick={() => {
              add(product.id, essence, boxes);
              toast({
                title: "به سبد خرید اضافه شد",
                description: `${faNumber(boxes)} جعبه ${product.name}${essence ? " (اسانس پرتقال)" : ""}`,
              });
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-bold text-secondary-foreground shadow-sm transition-all hover:bg-orange-brand active:scale-95"
          >
            <ShoppingBasket className="size-4" />
            افزودن به سبد
          </button>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <BadgePercent className="size-3.5 shrink-0 text-pistachio-deep" />
          از {faNumber(WHOLESALE_MIN_BOXES)} جعبه، هر عدد {faNumber(WHOLESALE_DISCOUNT_PER_UNIT)} تومان ارزان‌تر — هر جعبه {faToman(WHOLESALE_DISCOUNT_PER_UNIT * UNITS_PER_BOX)} تخفیف
        </p>
      </div>
    </article>
  );
}
