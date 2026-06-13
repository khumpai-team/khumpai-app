// src/store/useNotificationStore.ts
/**
 * In-app notification inbox. Like the sibling stores it persists to
 * sessionStorage purely as a cold-start cache. `push` is idempotent on
 * `dedupeKey`, which is what lets the 60s scheduler tick run freely.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppNotification } from '@/types';

interface NotificationState {
  notifications: AppNotification[];
  actions: {
    push: (n: AppNotification) => void;
    markShown: (id: string) => void;
    markRead: (id: string) => void;
    dismiss: (id: string) => void;
    clear: () => void;
  };
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      actions: {
        push: (n) =>
          set((s) => {
            if (s.notifications.some((x) => x.dedupeKey === n.dedupeKey)) return {};
            return { notifications: [n, ...s.notifications] };
          }),
        markShown: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'shown' as const } : x,
            ),
          })),
        markRead: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'read' as const } : x,
            ),
          })),
        dismiss: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'dismissed' as const } : x,
            ),
          })),
        clear: () => set({ notifications: [] }),
      },
    }),
    {
      name: 'khumpai-notifications',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ notifications: s.notifications }),
    },
  ),
);

/** Count of notifications still demanding attention (pending or just shown). */
export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => n.status === 'pending' || n.status === 'shown').length;
}
