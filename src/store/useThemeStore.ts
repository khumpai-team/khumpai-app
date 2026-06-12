/**
 * Theme state. Defaults to the user's OS preference, then remembers their
 * explicit choice for the session. The actual `data-theme` attribute is applied
 * by the ThemeProvider.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeState {
  theme: Theme;
  /** True until the user makes an explicit choice; lets us follow the OS. */
  followSystem: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: systemTheme(),
      followSystem: true,
      setTheme: (theme) => set({ theme, followSystem: false }),
      toggleTheme: () =>
        set({ theme: get().theme === 'dark' ? 'light' : 'dark', followSystem: false }),
    }),
    {
      name: 'khumpai-theme',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
