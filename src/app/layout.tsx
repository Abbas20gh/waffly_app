import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/waffly/sw-register";
import { PwaInstall } from "@/components/waffly/pwa-install";
import { IOS_SPLASHES } from "@/lib/ios-splashes";

export const metadata: Metadata = {
  title: "Waffly — مدیریت و حسابداری نان سنتی",
  description:
    "نرم‌افزار مدیریت تولید، فروش، خرید مواد اولیه، دستگاه‌سازی و حسابداری نان بستنی فانتزی ایتالیایی — آفلاین‌محور با سینک خودکار",
  applicationName: "Waffly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Waffly",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2E9E44",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// تزریق هم‌زمان با پارس HTML — iOS هنگام Add to Home Screen
// لینک‌های اسپلش را از DOM می‌خواند، پس باید قبل از تعامل کاربر موجود باشند
const SPLASH_INJECTOR = `(function(){
  try {
    var L = ${JSON.stringify(IOS_SPLASHES)};
    for (var i = 0; i < L.length; i++) {
      var el = document.createElement('link');
      el.rel = 'apple-touch-startup-image';
      el.href = L[i].href;
      el.media = L[i].media;
      document.head.appendChild(el);
    }
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: SPLASH_INJECTOR }} />
        {children}
        <Toaster />
        <SwRegister />
        <PwaInstall />
      </body>
    </html>
  );
}
