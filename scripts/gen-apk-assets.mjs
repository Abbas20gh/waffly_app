// تولید دارایی‌های آیکون و اسپلش برای بسته‌بندی اندروید (Capacitor)
// منبع: maskable-512.png (بستنی سبز روی پس‌زمینه تیره برند)
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const SRC = path.join(root, 'public', 'icons', 'maskable-512.png')
const OUT = path.join(root, 'assets')
const BG = { r: 0x10, g: 0x16, b: 0x13, alpha: 1 } // #101613

fs.mkdirSync(OUT, { recursive: true })

// 1) آیکون اصلی ۱۰۲۴ (legacy + adaptive)
await sharp(SRC).resize(1024, 1024, { kernel: 'lanczos3' }).png().toFile(path.join(OUT, 'icon-only.png'))
console.log('✓ icon-only.png (1024)')

// 2) لایه پس‌زمینه adaptive — رنگ برند
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
  .png().toFile(path.join(OUT, 'icon-background.png'))
console.log('✓ icon-background.png (1024)')

// 3) لایه foreground adaptive — همان آیکون (padding داخل maskable به عنوان safe-zone کافی است)
await sharp(SRC).resize(1024, 1024, { kernel: 'lanczos3' }).png().toFile(path.join(OUT, 'icon-foreground.png'))
console.log('✓ icon-foreground.png (1024)')

// 4) اسپلش ۲۷۳۲ — پس‌زمینه برند + لوگو بزرگ وسط
const logoSize = 900
const logo = await sharp(SRC).resize(logoSize, logoSize, { kernel: 'lanczos3' }).png().toBuffer()
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
  .composite([{ input: logo, left: Math.round((2732 - logoSize) / 2), top: Math.round((2732 - logoSize) / 2) }])
  .png().toFile(path.join(OUT, 'splash.png'))
console.log('✓ splash.png (2732)')

console.log('🎉 دارایی‌های APK در assets/ آماده شد')
