// Waffly Service Worker — پشتیبانی آفلاین کامل اپ
// استراتژی:
//  - App shell (HTML/CSS/JS): network-first با fallback به کش
//  - استاتیک (_next/static، فونت، آیکون): cache-first
//  - API سینک: هرگز کش نمی‌شود
//  - صفحه آفلاین fallback

// نسخه کش در زمان build تزریق می‌شود (build-pages.mjs جای __WAFFLY_BUILD__ را پر می‌کند)
// تا هر دیپلوی، کش کاربران را باطل کند و آخرین نسخه بگیرند
const CACHE = 'waffly-v__WAFFLY_BUILD__'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/icons/logo-64.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API — همیشه شبکه (سینک نباید کش شود)
  if (url.pathname.startsWith('/api/')) return

  // استاتیک — cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname.startsWith('/fonts') || url.pathname.startsWith('/splash')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
      )
    )
    return
  }

  // ناوبری و بقیه — network-first با fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  )
})
