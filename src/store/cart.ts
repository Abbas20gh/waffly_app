"use client";

// ===== استور سبد خرید (Zustand + localStorage) =====
// ردیف سبد: محصول + انتخاب اسانس + تعداد جعبه (واحد فروش فقط جعبه)

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  essence: boolean;
  boxes: number;
}

interface CartState {
  lines: CartLine[];
  add: (productId: string, essence: boolean, boxes?: number) => void;
  setBoxes: (productId: string, essence: boolean, boxes: number) => void;
  remove: (productId: string, essence: boolean) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (productId, essence, boxes = 1) =>
        set((st) => {
          const i = st.lines.findIndex(
            (l) => l.productId === productId && l.essence === essence
          );
          if (i >= 0) {
            const lines = [...st.lines];
            lines[i] = { ...lines[i], boxes: lines[i].boxes + boxes };
            return { lines };
          }
          return { lines: [...st.lines, { productId, essence, boxes }] };
        }),
      setBoxes: (productId, essence, boxes) =>
        set((st) => ({
          lines: st.lines.map((l) =>
            l.productId === productId && l.essence === essence
              ? { ...l, boxes: Math.max(1, Math.min(999, boxes)) }
              : l
          ),
        })),
      remove: (productId, essence) =>
        set((st) => ({
          lines: st.lines.filter(
            (l) => !(l.productId === productId && l.essence === essence)
          ),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "arta-cart" }
  )
);
