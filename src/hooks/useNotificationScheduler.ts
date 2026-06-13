// src/hooks/useNotificationScheduler.ts
/**
 * Drives the in-app notification system while a tab is open: ticks every 60s
 * (and once on mount, to catch up), pushes newly-due notifications, raises an
 * OS toast for warn/urgent items when permission is granted, and marks the
 * SafetyCard 'notified' flag when a red-flag notification first appears.
 */
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { collectDueNotifications } from '@/lib/notifications/collect';

const TICK_MS = 60_000;

export function useNotificationScheduler(): void {
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const ctx = {
        stock: usePillboxStore.getState().stock,
        capacity: usePillboxStore.getState().capacity,
        lastCheckinDate: useSessionStore.getState().lastCheckinDate,
      };
      const due = collectDueNotifications(useAppStore.getState(), now, ctx);
      const { actions } = useNotificationStore.getState();

      let markedSafety = false;
      for (const n of due) {
        const before = useNotificationStore.getState().notifications.length;
        actions.push(n); // dedupes on dedupeKey
        const added = useNotificationStore.getState().notifications.length > before;
        if (!added) continue;

        // When a red-flag notification first appears, mark any un-notified
        // safety cards in the chat as notified (same urgent event surfaced in
        // two places). Done once per tick.
        if (n.kind === 'red_flag' && !markedSafety) {
          const chat = useChatStore.getState();
          chat.items.forEach((it) => {
            if (it.kind === 'safety' && !it.notified) chat.markSafetyNotified(it.id);
          });
          markedSafety = true;
        }

        // OS toast for attention-worthy items only, and only with permission.
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          n.severity !== 'info'
        ) {
          new Notification(n.title, { body: n.body });
          useNotificationStore.getState().actions.markShown(n.id);
        }
      }
    };

    tick(); // catch-up on mount
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
}
