// ===== موتور قیمت‌گذاری — منبع واحد برای کلاینت و سرور =====
// قانون طلایی: سرور هرگز به قیمت ارسالی کلاینت اعتماد نمی‌کند و همه‌چیز را
// از روی جدول محصولات دیتابیس با همین توابع از نو محاسبه می‌کند.

import { UNITS_PER_BOX, WHOLESALE_MIN_BOXES, WHOLESALE_DISCOUNT_PER_UNIT } from "./constants";

export interface PricingProduct {
  id: string;
  name: string;
  sizeLabel: string;
  pricePerUnit: number; // تومان — قیمت هر عدد (خرده)
  unitsPerBox: number; // ۲۰۰
  essenceEnabled: boolean;
}

export interface CartLineInput {
  productId: string;
  essence: boolean; // با اسانس پرتقال؟
  boxes: number; // ≥ ۱ — واحد فروش فقط جعبه
}

export interface ComputedLine {
  productId: string;
  name: string;
  sizeLabel: string;
  essence: boolean;
  essenceLabel: string;
  boxes: number;
  units: number;
  baseUnitPrice: number; // قیمت خرده هر عدد
  unitPrice: number; // پس از تخفیف عمده (در صورت رسیدن به آستانه)
  boxPrice: number; // قیمت هر جعبه
  lineTotal: number; // جمع این ردیف
  wholesale: boolean; // آیا این ردیف عمده محاسبه شده؟
  wholesaleSaved: number; // مبلغ صرفه‌جویی عمده این ردیف
}

export interface ComputedCart {
  lines: ComputedLine[];
  subtotal: number;
  wholesaleSaved: number;
  totalBoxes: number;
}

/** قیمت هر عدد با توجه به تعداد جعبه همین نوع (آستانه عمده برای هر نوع جداگانه است) */
export function effectiveUnitPrice(baseUnitPrice: number, boxes: number): number {
  return boxes >= WHOLESALE_MIN_BOXES
    ? baseUnitPrice - WHOLESALE_DISCOUNT_PER_UNIT
    : baseUnitPrice;
}

export function boxPriceOf(baseUnitPrice: number, boxes: number): number {
  return effectiveUnitPrice(baseUnitPrice, boxes) * UNITS_PER_BOX;
}

export function essenceName(withEssence: boolean): string {
  return withEssence ? "با اسانس پرتقال" : "ساده";
}

/** محاسبه کامل سبد از روی محصولات معتبر دیتابیس */
export function computeCart(
  lines: CartLineInput[],
  products: PricingProduct[]
): ComputedCart {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: ComputedLine[] = [];

  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p) continue; // محصول نامعتبر — نادیده گرفته می‌شود
    const boxes = Math.max(1, Math.floor(line.boxes || 0));
    const essence = p.essenceEnabled ? !!line.essence : false;
    const baseUnitPrice = p.pricePerUnit;
    const unitPrice = effectiveUnitPrice(baseUnitPrice, boxes);
    const boxPrice = unitPrice * p.unitsPerBox;
    const lineTotal = boxPrice * boxes;
    const baseBoxPrice = baseUnitPrice * p.unitsPerBox;
    out.push({
      productId: p.id,
      name: p.name,
      sizeLabel: p.sizeLabel,
      essence,
      essenceLabel: essenceName(essence),
      boxes,
      units: boxes * p.unitsPerBox,
      baseUnitPrice,
      unitPrice,
      boxPrice,
      lineTotal,
      wholesale: boxes >= WHOLESALE_MIN_BOXES,
      wholesaleSaved: Math.max(0, baseBoxPrice - boxPrice) * boxes,
    });
  }

  const subtotal = out.reduce((s, l) => s + l.lineTotal, 0);
  const wholesaleSaved = out.reduce((s, l) => s + l.wholesaleSaved, 0);
  const totalBoxes = out.reduce((s, l) => s + l.boxes, 0);
  return { lines: out, subtotal, wholesaleSaved, totalBoxes };
}
