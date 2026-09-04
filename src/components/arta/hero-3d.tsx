"use client";

// ===== هیرو سه‌بعدی با چرخش وابسته به اسکرول =====
// بخش ۱۹۰vh؛ بوم چسبان full-screen؛ زاویه چرخش مستقیم تابع مقدار اسکرول است

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { ChevronDown, ShoppingBasket, Sparkles } from "lucide-react";
import { IcecreamBread, SceneLights, CameraFit, type ProgressRef } from "./icecream-bread";
import { toFa } from "@/lib/arta/format";

export default function Hero3D() {
  const wrapRef = useRef<HTMLElement | null>(null);
  const progressRef: ProgressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      progressRef.current = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
    };
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(onScroll);
    };
    onScroll();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={wrapRef} className="relative h-[190vh]" aria-label="معرفی نان بستنی آرتا">
      <div className="bg-brand-hero sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* تصویر جایگزین زیر بوم — تا لحظه آماده شدن بوم و در نبود WebGL */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: "url(/images/hero.png)",
            opacity: ready && !webglFailed ? 0 : 0.9,
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/72 via-background/28 to-background/85" aria-hidden />

        {/* بوم سه‌بعدی */}
        {!webglFailed && (
          <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
            <Canvas
              camera={{ position: [0, 0.3, 6.4], fov: 40 }}
              dpr={[1, 1.75]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              onCreated={() => setReady(true)}
              onError={() => setWebglFailed(true)}
            >
              <SceneLights />
              <CameraFit />
              <IcecreamBread progressRef={progressRef} />
            </Canvas>
          </div>
        )}

        {/* لایه متن */}
        <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pt-14 text-center sm:pt-20">
          <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-choco/15 bg-card/80 px-4 py-1.5 text-xs font-medium text-choco shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-orange-deep" />
            تولید روزانه با مواد تازه
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.25] text-choco-deep sm:text-5xl lg:text-6xl">
            نان بستنی فانتزی{" "}
            <span className="relative inline-block text-orange-deep">
              آرتا
              <svg className="absolute -bottom-2 right-0 w-full" viewBox="0 0 120 12" fill="none" aria-hidden>
                <path d="M3 9C30 3 60 3 117 8" stroke="#7fb069" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-foreground/75 sm:text-lg">
            تازه، خامه‌ای و به‌شدت خوشمزه! سفارش جعبه‌ای ۲۰۰عددی برای خانه، مغازه و
            مهمانی‌ها — با ارسال به سراسر کشور.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
            >
              <ShoppingBasket className="size-4.5" />
              مشاهده محصولات و قیمت‌ها
            </Link>
            <span className="inline-flex h-12 items-center rounded-full border border-choco/20 bg-card/80 px-5 text-sm font-medium text-choco backdrop-blur">
              هر جعبه = {toFa(200)} عدد
            </span>
          </div>
        </div>

        {/* راهنمای اسکرول — چرخش محصول با اسکرول شما می‌چرخد */}
        <div className="pointer-events-none relative z-10 pb-7 text-center">
          <p className="mb-2 text-xs text-muted-foreground">برای چرخاندن نان بستنی اسکرول کنید</p>
          <ChevronDown className="mx-auto size-5 animate-bounce text-muted-foreground" aria-hidden />
        </div>
      </div>
    </section>
  );
}
