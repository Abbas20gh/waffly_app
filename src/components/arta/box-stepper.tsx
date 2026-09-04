"use client";

import { Minus, Plus } from "lucide-react";
import { toFa } from "@/lib/arta/format";

// ===== شمارنده جعبه — واحد فروش فقط جعبه است =====
// با توضیح «هر جعبه = ۲۰۰ عدد» زیر آن نمایش داده می‌شود

export function BoxStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 ${compact ? "" : "shadow-sm"}`}
      role="group"
      aria-label="تعداد جعبه"
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 active:scale-95"
        aria-label="افزودن جعبه"
      >
        <Plus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        value={toFa(value)}
        onChange={(e) => {
          const en = e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
          onChange(clamp(Number(en || min)));
        }}
        className="w-12 bg-transparent text-center text-sm font-bold text-choco outline-none"
        aria-label="تعداد جعبه"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="grid size-9 place-items-center rounded-full bg-muted text-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
        disabled={value <= min}
        aria-label="کاهش جعبه"
      >
        <Minus className="size-4" />
      </button>
    </div>
  );
}
