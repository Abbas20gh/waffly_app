// بیلد خروجی استاتیک برای Cloudflare Pages
// مسیر api را موقتاً کنار می‌گذارد (Functions جایگزینش هستند) → next build با output: export → برمی‌گرداند
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const API_DIR = path.join(root, 'src', 'app', 'api')
const HIDDEN_DIR = path.join(root, '.cf-api-hidden')

// اگر از اجرای قبلی نیمه‌کاره مانده، اول برگردان
if (fs.existsSync(HIDDEN_DIR) && !fs.existsSync(API_DIR)) {
  fs.renameSync(HIDDEN_DIR, API_DIR)
  console.log('↩️  اجرای نیمه‌کاره قبلی بازیابی شد')
}
if (fs.existsSync(HIDDEN_DIR) && fs.existsSync(API_DIR)) {
  fs.rmSync(HIDDEN_DIR, { recursive: true, force: true })
}

console.log('⏳ کنار گذاشتن src/app/api (جایگزین: functions/)...')
fs.renameSync(API_DIR, HIDDEN_DIR)

try {
  console.log('⏳ next build با خروجی استاتیک (CF_EXPORT=1)...')
  execSync('npx next build', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CF_EXPORT: '1' },
  })
  console.log('✓ خروجی استاتیک در out/ آماده است')
} finally {
  console.log('⏳ برگرداندن src/app/api...')
  if (fs.existsSync(HIDDEN_DIR)) fs.renameSync(HIDDEN_DIR, API_DIR)
}

// چک سلامت
const outDir = path.join(root, 'out')
const checks = ['out/index.html', 'out/sw.js', 'out/manifest.webmanifest', 'out/icons/logo-64.png']
const missing = checks.filter((c) => !fs.existsSync(path.join(root, c)))
if (missing.length > 0) {
  console.error('✗ فایل‌های جاافتاده در خروجی:', missing.join(', '))
  process.exit(1)
}

// تزریق نسخه build به Service Worker (cache-busting) — هر دیپلوی کش جدید می‌سازد
const swPath = path.join(outDir, 'sw.js')
const buildId = `${process.env.NEXT_PUBLIC_API_BASE ? 'apk-' : ''}${Date.now().toString(36)}`
const swCode = fs.readFileSync(swPath, 'utf8').replace(/__WAFFLY_BUILD__/g, buildId)
fs.writeFileSync(swPath, swCode)
console.log(`✓ Service Worker با نسخه کش «${buildId}» نسخه‌دار شد`)

console.log('🎉 out/ کامل و سالم است — آماده دیپلوی Pages')
