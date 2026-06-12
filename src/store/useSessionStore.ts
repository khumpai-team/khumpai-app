/**
 * Session-only UI flags that don't belong in the persisted health AppState:
 * whether the user is "logged in" (mock), whether onboarding is done, and the
 * date of the last morning check-in. Persisted to sessionStorage so a brand-new
 * browser session starts at Welcome (as the demo expects) but reloads don't.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SessionState {
  loggedIn: boolean;
  onboardingCompleted: boolean;
  /** YYYY-MM-DD of the last completed morning check-in. */
  lastCheckinDate: string | null;

  setLoggedIn: (v: boolean) => void;
  setOnboardingCompleted: (v: boolean) => void;
  setLastCheckinDate: (d: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      loggedIn: false,
      onboardingCompleted: false,
      lastCheckinDate: null,
      setLoggedIn: (v) => set({ loggedIn: v }),
      setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),
      setLastCheckinDate: (d) => set({ lastCheckinDate: d }),
    }),
    { name: 'khumpai-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);
