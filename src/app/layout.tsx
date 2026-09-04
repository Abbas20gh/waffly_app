import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "نان بستنی آرتا | فروشگاه اینترنتی گروه صنعتی آرتا",
    template: "%s | نان بستنی آرتا",
  },
  description:
    "فروشگاه اینترنتی نان بستنی فانتزی آرتا — تولیدکننده نان بستنی فانتزی کوچک، متوسط، بزرگ و کاسه‌ای؛ سفارش جعبه‌ای با ارسال به سراسر کشور. گروه صنعتی آرتا.",
  keywords: [
    "نان بستنی",
    "نان بستنی فانتزی",
    "نان بستنی آرتا",
    "گروه صنعتی آرتا",
    "خرید عمده نان بستنی",
  ],
  openGraph: {
    title: "نان بستنی آرتا | گروه صنعتی آرتا",
    description:
      "نان بستنی فانتزی تازه و خوشمزه — سفارش آنلاین جعبه‌ای با ارسال سراسری",
    siteName: "نان بستنی آرتا",
    type: "website",
    locale: "fa_IR",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF9F1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
