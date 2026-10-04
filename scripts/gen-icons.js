/* eslint-disable @typescript-eslint/no-require-imports */
// تولید آیکون‌های PWA از لوگوی Waffly
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SRC = '/home/z/my-project/upload/file_00000000d58c820a82ff4db9cf89ea27.png'
const OUT = '/home/z/my-project/public/icons'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  // پس‌زمینه تیره اپ (هماهنگ با لوگو)
  const sizes = [192, 512, 384, 256, 144, 96, 72, 48]
  for (const size of sizes) {
    const pad = Math.round(size * 0.1)
    const inner = size - pad * 2
    const logo = await sharp(SRC).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 16, g: 22, b: 19, alpha: 1 } },
    })
      .composite([{ input: logo, left: pad, top: pad }])
      .png()
      .toFile(path.join(OUT, `icon-${size}.png`))
  }

  // maskable: لوگو کوچک‌تر برای ناحیه امن
  const size = 512
  const pad = Math.round(size * 0.22)
  const inner = size - pad * 2
  const logo = await sharp(SRC).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 16, g: 22, b: 19, alpha: 1 } } })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(path.join(OUT, 'maskable-512.png'))

  // favicon و apple-touch
  await sharp(path.join(OUT, 'icon-192.png')).resize(32, 32).png().toFile('/home/z/my-project/public/favicon.png')
  await sharp(path.join(OUT, 'icon-192.png')).resize(180, 180).png().toFile(path.join(OUT, 'apple-touch-icon.png'))

  // نسخه لوگو برای هدر (روی شفاف)
  await sharp(SRC).resize(64, 64, { fit: 'contain' }).png().toFile(path.join(OUT, 'logo-64.png'))

  console.log('icons generated:', fs.readdirSync(OUT).join(', '))
}

main().catch(e => { console.error(e); process.exit(1) })
