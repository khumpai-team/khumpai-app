/**
 * UI-side store for attachments on a doctor visit. The core DoctorVisit type has
 * no media field, so attachments live here keyed by visit id, persisted to
 * sessionStorage. An attachment is either an image (thumbnail data URL) or a
 * non-image file (e.g. a PDF receta), shown as a 📄 chip.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type VisitMedia = { kind: 'image'; url: string } | { kind: 'file'; name: string };

interface VisitMediaState {
  media: Record<string, VisitMedia[]>;
  add: (visitId: string, items: VisitMedia[]) => void;
}

export const useVisitMediaStore = create<VisitMediaState>()(
  persist(
    (set) => ({
      media: {},
      add: (visitId, items) =>
        set((s) => ({ media: { ...s.media, [visitId]: [...(s.media[visitId] ?? []), ...items] } })),
    }),
    { name: 'khumpai-visit-media', storage: createJSONStorage(() => sessionStorage) },
  ),
);
