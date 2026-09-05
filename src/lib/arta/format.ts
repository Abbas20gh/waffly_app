// ===== فرمت‌دهی فارسی: اعداد، قیمت، تاریخ =====

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی */
export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** تبدیل ارقام فارسی/عربی به لاتین (برای ورودی فرم‌ها) */
export function toEn(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ۱۲۳۴۵۶ → «۱۲۳٬۴۵۶» */
export function faNumber(n: number): string {
  const safe = Number(n) || 0;
  return toFa(safe.toLocaleString("en-US")).replace(/,/g, "٬");
}

/** قیمت به تومان با جداکننده فارسی */
export function faToman(n: number): string {
  return `${faNumber(n)} تومان`;
}

/** تاریخ شمسی خوانا */
export function faDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return toFa(date.toISOString().slice(0, 10));
  }
}

/** تاریخ و ساعت شمسی */
export function faDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return toFa(date.toISOString().slice(0, 16).replace("T", " "));
  }
}

/** اعتبارسنجی موبایل ایران (۰۹xxxxxxxxx) */
export function isValidIranMobile(raw: string): boolean {
  const s = toEn(raw).replace(/\D/g, "");
  return /^09\d{9}$/.test(s);
}

/** شماره کارت ۱۶ رقمی → گروه‌های ۴ رقمی «۶۰۶۳-۷۳۱۲-۵۵۵۸-۲۲۹۹» */
export function faCardNumber(raw: string): string {
  const digits = toEn(raw).replace(/\D/g, "").slice(0, 16);
  return toFa((digits.match(/.{1,4}/g) || []).join("-"));
}
