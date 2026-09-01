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
}

export default config
