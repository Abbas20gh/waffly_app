// تولید آیکون‌های PWA از لوگوی اصلی کاربر (upload/file_*.png)
// + نسخه شفاف برای هدر و اسپلش
import sharp from 'sharp'
import { readdirSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const UPLOAD = resolve(process.cwd(), 'upload')
const ICONS = resolve(process.cwd(), 'public/icons')
const LOGO_SRC = (() => {
  const files = readdirSync(UPLOAD).filter(f => f.endsWith('.png'))
  if (files.length === 0) throw new Error('لوگو در upload پیدا نشد')
  return resolve(UPLOAD, files[0])
})()

mkdirSync(ICONS, { recursive: true })

// کلید رنگی: پس‌زمینه مشکی لوگو → شفاف (برای هدر و اسپلش)
async function transparentLogo() {
  const { data, info } = await sharp(LOGO_SRC).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2]
    const lum = (r + g + b) / 3
    const isBg = r < 40 && g < 40 && b < 40 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22
    // لبه‌های نرم: آلفا تدریجی
    const alpha = isBg ? 0 : Math.min(255, Math.max(0, Math.round((lum > 60 ? 255 : (lum - 30) * 3))))
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = alpha
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

async function main() {
  const transparent = await transparentLogo()
  const meta = await sharp(LOGO_SRC).metadata()
  console.log(`لوگو: ${LOGO_SRC} (${meta.width}x${meta.height})`)

  // ۱) لوگوی شفاف هدر
  await sharp(transparent).resize(128, 128, { fit: 'inside' }).png().toFile(resolve(ICONS, 'logo-64.png'))

  // ۲) آیکون‌های مربعی با پس‌زمینه مشکی برند + گوشه گرد (غیر maskable)
  const sizes = [48, 72, 96, 144, 192, 256, 384, 512]
  for (const size of sizes) {
    const radius = Math.round(size * 0.18)
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
    )
    const inner = Math.round(size * 0.78)
    const pad = Math.round((size - inner) / 2)
    const logo = await sharp(transparent).resize(inner, inner, { fit: 'inside' }).png().toBuffer()
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 8, g: 10, b: 9, alpha: 1 } },
    })
      .composite([
        { input: logo, top: pad, left: pad },
        { input: mask, blend: 'dest-in' },
      ])
      .png()
      .toFile(resolve(ICONS, `icon-${size}.png`))
  }

  // ۳) maskable 512 — تمام‌صفحه مشکی با لوگو ۶۸٪ در مرکز ناحیه امن
  const safe = Math.round(512 * 0.68)
  const logoM = await sharp(transparent).resize(safe, safe, { fit: 'inside' }).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 8, g: 10, b: 9, alpha: 1 } } })
    .composite([{ input: logoM, top: Math.round((512 - safe) / 2), left: Math.round((512 - safe) / 2) }])
    .png()
    .toFile(resolve(ICONS, 'maskable-512.png'))

  // ۴) apple-touch-icon 180 — تمام‌صفحه (خود iOS گوشه را گرد می‌کند)
  const innerA = Math.round(180 * 0.76)
  const logoA = await sharp(transparent).resize(innerA, innerA, { fit: 'inside' }).png().toBuffer()
  await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 8, g: 10, b: 9, alpha: 1 } } })
    .composite([{ input: logoA, top: Math.round((180 - innerA) / 2), left: Math.round((180 - innerA) / 2) }])
    .png()
    .toFile(resolve(ICONS, 'apple-touch-icon.png'))

  // ۵) favicon 32
  await sharp(transparent).resize(32, 32, { fit: 'inside' }).png().toFile(resolve(process.cwd(), 'public/favicon.png'))

  console.log('✓ آیکون‌ها ساخته شدند')
}

main().catch(e => { console.error(e); process.exit(1) })
