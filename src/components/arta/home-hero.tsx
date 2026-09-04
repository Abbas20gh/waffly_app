"use client";

import dynamic from "next/dynamic";

const Hero3D = dynamic(() => import("./hero-3d"), {
  ssr: false,
  loading: () => <div className="h-screen bg-brand-hero" aria-hidden />,
});

export function HomeHero() {
  return <Hero3D />;
}
