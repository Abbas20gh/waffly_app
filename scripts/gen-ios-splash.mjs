// تولید اسپلش‌اسکرین iOS — پس‌زمینه تیره + هاله سبز + لوگوی شفاف Waffly + وردمارک
// خروجی: public/splash/{W}x{H}.png (۳۸ سایز: پرتره + منظره)
import sharp from 'sharp'
import { readdirSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const OUT = resolve(process.cwd(), 'public/splash')
const UPLOAD = resolve(process.cwd(), 'upload')
const BG = '#101613'

const LOGO_SRC = (() => {
  const files = readdirSync(UPLOAD).filter(f => f.endsWith('.png'))
  return resolve(UPLOAD, files[0])
})()

const DEVICES = [
  // [cssW, cssH, dpr]
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2],
  [414, 896, 3], [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3],
  [402, 874, 3], [440, 956, 3],
  // آیپدها
  [768, 1024, 2], [820, 1180, 2], [834, 1112, 2], [834, 1194, 2],
  [744, 1133, 2], [1024, 1366, 2], [1032, 1376, 2],
]

mkdirSync(OUT, { recursive: true })

// کلید رنگی: پس‌زمینه مشکی لوگو → شفاف
async function makeTransparentLogo() {
  const { data, info } = await sharp(LOGO_SRC).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2]
    const lum = (r + g + b) / 3
    const isBg = r < 40 && g < 40 && b < 40 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22
    const alpha = isBg ? 0 : Math.min(255, Math.max(0, Math.round((lum > 60 ? 255 : (lum - 30) * 3))))
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = alpha
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

async function makeSplash(logoTransparent, pw, ph) {
  const min = Math.min(pw, ph)
  const iconSize = Math.round(min * 0.30)
  const cx = Math.round(pw / 2)
  const iconY = Math.round(ph * 0.40 - iconSize / 2)
  const textY = Math.round(ph * 0.40 + iconSize * 0.72)
  const fontSize = Math.round(iconSize * 0.18)

  const logoPng = await sharp(logoTransparent).resize(iconSize, iconSize, { fit: 'inside' }).png().toBuffer()
  const b64 = logoPng.toString('base64')

  const svg = `<svg width="${pw}" height="${ph}" viewBox="0 0 ${pw} ${ph}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2E9E44" stop-opacity="0.25"/>
      <stop offset="55%" stop-color="#2E9E44" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#2E9E44" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${pw}" height="${ph}" fill="${BG}"/>
  <circle cx="${cx}" cy="${ph * 0.40}" r="${iconSize * 1.05}" fill="url(#glow)"/>
  <image x="${Math.round(cx - iconSize / 2)}" y="${iconY}" width="${iconSize}" height="${iconSize}" href="data:image/png;base64,${b64}"/>
  <text x="${cx}" y="${textY}" text-anchor="middle"
    font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-weight="600"
    font-size="${fontSize}" letter-spacing="${Math.round(fontSize * 0.35)}" fill="#FFFFFF">WAFFLY</text>
</svg>`

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(OUT, `${pw}x${ph}.png`))
}

const logoTransparent = await makeTransparentLogo()

const jobs = []
for (const [cw, ch, dpr] of DEVICES) {
  const pw = cw * dpr, ph = ch * dpr
  jobs.push(makeSplash(logoTransparent, pw, ph))          // portrait
  jobs.push(makeSplash(logoTransparent, ph, pw))          // landscape
}

await Promise.all(jobs)
console.log(`✓ ${jobs.length} اسپلش تولید شد → public/splash/`)
