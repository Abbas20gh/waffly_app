import type { CapacitorConfig } from '@capacitor/cli'

// پیکربندی بسته‌بندی اندروید وافلی
// webDir = خروجی استاتیک (scripts/build-pages.mjs با NEXT_PUBLIC_API_BASE سرور سینک را ست می‌کند)
const config: CapacitorConfig = {
  appId: 'com.abbas20gh.waffly',
  appName: 'Waffly',
  webDir: 'out',
  android: {
    isLoggingEnabled: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // ⚠️ حیاتی برای سینک: WebView اندروید درخواست‌های fetch به waffly.pages.dev را
    // به‌دلیل CORS بلاک می‌کرد (origin اپ https://localhost است) — نتیجه: هیچ داده‌ای
    // بین گوشی و سرور جابه‌جا نمی‌شد. با فعال‌سازی CapacitorHttp همه fetch/XHRها
    // از استک HTTP نیتیو اندروید عبور می‌کنند و CORS اصلاً اعمال نمی‌شود.
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
