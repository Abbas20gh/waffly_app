import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/arta/site-header";
import { SiteFooter } from "@/components/arta/site-footer";
import { ProductCard } from "@/components/arta/product-card";
import type { ProductDTO } from "@/lib/arta/types";
import { faNumber } from "@/lib/arta/format";
import { UNITS_PER_BOX, WHOLESALE_MIN_BOXES } from "@/lib/arta/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "فروشگاه",
  description: "خرید جعبه‌ای نان بستنی فانتزی آرتا — چهار سایز، با و بدون اسانس پرتقال",
};

export default async function ProductsPage() {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const products: ProductDTO[] = rows;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-brand-soft">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="mb-9 text-center">
            <h1 className="text-3xl font-bold text-choco-deep">فروشگاه نان بستنی آرتا</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              واحد فروش جعبه است و هر جعبه {faNumber(UNITS_PER_BOX)} عدد؛ حداقل سفارش{" "}
              {faNumber(1)} جعبه. با رسیدن هر نوع به {faNumber(WHOLESALE_MIN_BOXES)}{" "}
              جعبه، قیمت همان نوع خودکار عمده محاسبه می‌شود.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
