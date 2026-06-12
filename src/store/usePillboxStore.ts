/**
 * Pill stock — a UI-side concern the core `Medication` type doesn't model, kept
 * out of the persisted health AppState. Tracks remaining pills and capacity per
 * medication id, persisted to sessionStorage. Stock decrements when a dose is
 * marked taken and can be topped back up ("Reponer").
 *
 * Seeded so Carlos's Metformina starts low — to show the low-stock reminder.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const DEFAULT_CAPACITY = 30;

interface PillboxState {
  stock: Record<string, number>;
  capacity: Record<string, number>;
  getStock: (medId: string) => number;
  getCapacity: (medId: string) => number;
  decrement: (medId: string) => void;
  refill: (medId: string) => void;
}

export const usePillboxStore = create<PillboxState>()(
  persist(
    (set, get) => ({
      // Seed: Metformina deliberately low so the refill nudge is visible.
      stock: { 'med-metformina': 8 },
      capacity: { 'med-metformina': 30 },

      getStock: (medId) => get().stock[medId] ?? DEFAULT_CAPACITY,
      getCapacity: (medId) => get().capacity[medId] ?? DEFAULT_CAPACITY,

      decrement: (medId) =>
        set((s) => {
          const cur = s.stock[medId] ?? DEFAULT_CAPACITY;
          return { stock: { ...s.stock, [medId]: Math.max(0, cur - 1) } };
        }),

      refill: (medId) =>
        set((s) => ({
          stock: { ...s.stock, [medId]: s.capacity[medId] ?? DEFAULT_CAPACITY },
        })),
    }),
    { name: 'khumpai-pillbox', storage: createJSONStorage(() => sessionStorage) },
  ),
);
