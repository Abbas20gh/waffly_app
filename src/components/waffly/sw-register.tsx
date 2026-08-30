'use client'

import { useEffect } from 'react'

// ثبت Service Worker برای کارکرد آفلاین PWA
export function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // فقط در HTTPS (پیش‌نمایش واقعی) فعال شود؛
    // در dev محلی (http) کش SW باعث کهنگی باندل می‌شود
    if (window.location.protocol !== 'https:') return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // در محیط dev ممکن است ثبت نشود — مشکلی نیست
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
  return null
}
