// ===== ثابت‌های فروشگاه نان بستنی آرتا =====
// منبع واحد حقیقت برای منطق قیمت‌گذاری؛ هم کلاینت و هم سرور از اینجا استفاده می‌کنند.

/** هر جعبه = ۲۰۰ عدد (واحد فروش فقط جعبه است) */
export const UNITS_PER_BOX = 200;

/** آستانه قیمت عمده: از ۱۰ جعبه به بالا (برای هر نوع محصول جداگانه) */
export const WHOLESALE_MIN_BOXES = 10;

/** تخفیف عمده: هر عدد ۲۰۰ تومان ارزان‌تر (یعنی هر جعبه ۴۰٬۰۰۰ تومان) */
export const WHOLESALE_DISCOUNT_PER_UNIT = 200;

/** ارسال رایگان برای خرید بالای ۱۰٬۰۰۰٬۰۰۰ تومان */
export const FREE_SHIPPING_THRESHOLD = 10_000_000;

/** شهر مبدأ تولید/ارسال (قابل تغییر از پنل مدیریت) */
export const DEFAULT_ORIGIN_CITY = "تهران";

/** شماره‌های تماس رسمی سایت */
export const CONTACT_PHONES = ["۰۹۱۰۴۳۶۱۲۳۳", "۰۹۳۹۱۵۳۱۶۶۴"];
export const CONTACT_PHONES_RAW = ["09104361233", "09391531664"];

/** نام‌ها طبق سند برند */
export const BRAND_PRODUCT = "نان بستنی آرتا";
export const BRAND_COMPANY = "گروه صنعتی آرتا";

/** روش‌های پرداخت نسخه اول — لایه انتزاعی برای اتصال درگاه آنلاین در آینده */
export const PAYMENT_METHODS = [
  {
    id: "ON_DELIVERY",
    label: "پرداخت در محل",
    hint: "مبلغ را هنگام تحویل سفارش می‌پردازید",
  },
  {
    id: "CARD_TRANSFER",
    label: "کارت به کارت",
    hint: "شماره کارت پس از ثبت سفارش نمایش داده می‌شود؛ ارسال پس از تأیید واریز",
  },
  // اسلات درگاه آنلاین (زرین‌پال و…) — بعداً اضافه می‌شود
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

/** وضعیت‌های سفارش */
export const ORDER_STATUSES = [
  { id: "PENDING", label: "در انتظار تأیید", color: "#f4a259" },
  { id: "PROCESSING", label: "در حال پردازش", color: "#d9b48f" },
  { id: "SHIPPED", label: "ارسال شده", color: "#7fb069" },
  { id: "DELIVERED", label: "تحویل شده", color: "#5e8c4a" },
  { id: "CANCELED", label: "لغو شده", color: "#d9534f" },
] as const;

export type OrderStatusId = (typeof ORDER_STATUSES)[number]["id"];

export function statusLabel(id: string): string {
  return ORDER_STATUSES.find((s) => s.id === id)?.label ?? id;
}
