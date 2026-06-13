/**
 * UI-side store for photos/receipts attached to a doctor visit. The core
 * DoctorVisit type has no media field, so attachments live here keyed by visit
 * id (thumbnail data URLs), persisted to sessionStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface VisitMediaState {
  media: Record<string, string[]>;
  add: (visitId: string, urls: string[]) => void;
}

export const useVisitMediaStore = create<VisitMediaState>()(
  persist(
    (set) => ({
      media: {},
      add: (visitId, urls) =>
        set((s) => ({ media: { ...s.media, [visitId]: [...(s.media[visitId] ?? []), ...urls] } })),
    }),
    { name: 'khumpai-visit-media', storage: createJSONStorage(() => sessionStorage) },
  ),
);
