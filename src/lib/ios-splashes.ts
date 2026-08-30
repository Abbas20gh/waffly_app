// اسپلش‌اسکرین‌های iOS — نگاشت دستگاه → فایل و media query
// فایل‌های PNG توسط scripts/gen-ios-splash.mjs در public/splash/ تولید می‌شوند

interface Device {
  /** عرض CSS (point) */
  w: number
  /** ارتفاع CSS (point) */
  h: number
  /** device-pixel-ratio */
  dpr: number
  /** عرض پیکسلی تصویر portrait (w*dpr) — برای نام فایل */
  pw: number
  /** ارتفاع پیکسلی تصویر portrait (h*dpr) */
  ph: number
}

const DEVICES: Device[] = [
  // آیفون‌ها
  { w: 320, h: 568, dpr: 2, pw: 640, ph: 1136 },   // iPhone 5 / SE1
  { w: 375, h: 667, dpr: 2, pw: 750, ph: 1334 },   // iPhone 6/7/8 / SE2/SE3
  { w: 414, h: 736, dpr: 3, pw: 1242, ph: 2208 },  // iPhone 6+/7+/8+
  { w: 375, h: 812, dpr: 3, pw: 1125, ph: 2436 },  // iPhone X/XS/11 Pro/12 mini/13 mini
  { w: 414, h: 896, dpr: 2, pw: 828, ph: 1792 },   // iPhone XR/11
  { w: 414, h: 896, dpr: 3, pw: 1242, ph: 2688 },  // iPhone XS Max/11 Pro Max
  { w: 390, h: 844, dpr: 3, pw: 1170, ph: 2532 },  // iPhone 12/13/14
  { w: 428, h: 926, dpr: 3, pw: 1284, ph: 2778 },  // iPhone 12/13/14 Pro Max / 14 Plus
  { w: 393, h: 852, dpr: 3, pw: 1179, ph: 2556 },  // iPhone 14/15/16 Pro
  { w: 430, h: 932, dpr: 3, pw: 1290, ph: 2796 },  // iPhone 14/15/16 Pro Max / 15/16 Plus
  { w: 402, h: 874, dpr: 3, pw: 1206, ph: 2622 },  // iPhone 16 Pro
  { w: 440, h: 956, dpr: 3, pw: 1320, ph: 2868 },  // iPhone 16 Pro Max
  // آیپدها (همه dpr2)
  { w: 768, h: 1024, dpr: 2, pw: 1536, ph: 2048 }, // iPad 7.9"/9.7"
  { w: 820, h: 1180, dpr: 2, pw: 1640, ph: 2360 }, // iPad 10.9" (نسل ۱۰)
  { w: 834, h: 1112, dpr: 2, pw: 1668, ph: 2224 }, // iPad Air 10.5"
  { w: 834, h: 1194, dpr: 2, pw: 1668, ph: 2388 }, // iPad Pro 11" / Air 11"
  { w: 744, h: 1133, dpr: 2, pw: 1488, ph: 2266 }, // iPad mini 8.3"
  { w: 1024, h: 1366, dpr: 2, pw: 2048, ph: 2732 },// iPad Pro 12.9"
  { w: 1032, h: 1376, dpr: 2, pw: 2064, ph: 2752 },// iPad Pro/Air 13" (M2)
]

function build(orientation: 'portrait' | 'landscape') {
  return DEVICES.map((d) => {
    const pw = orientation === 'portrait' ? d.pw : d.ph
    const ph = orientation === 'portrait' ? d.ph : d.pw
    const cw = orientation === 'portrait' ? d.w : d.h
    const ch = orientation === 'portrait' ? d.h : d.w
    return {
      href: `/splash/${pw}x${ph}.png`,
      media: `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: ${orientation})`,
    }
  })
}

export const IOS_SPLASHES: { href: string; media: string }[] = [
  ...build('portrait'),
  ...build('landscape'),
]
