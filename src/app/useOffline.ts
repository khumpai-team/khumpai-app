/**
 * useOffline — the offline demo toggle and reconnect choreography.
 *
 * Going offline just flips the flag (the chat send path queues entries).
 * Going online flushes the sync queue into logs, clears the pending dots on
 * chat bubbles, and has Khumpi acknowledge what was captured offline.
 * `goOnline` returns the number of entries that were synced (for the banner).
 */

import { useCallback } from 'react';
import { es } from '@/data/i18n/es';
import { uid } from '@/lib/id';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';

export function useOffline() {
  const isOffline = useAppStore((s) => s.isOffline);

  const goOffline = useCallback(() => {
    useAppStore.getState().actions.setOffline(true);
  }, []);

  const goOnline = useCallback((): number => {
    const app = useAppStore.getState();
    const n = app.syncQueue.length;
    app.actions.setOffline(false);
    app.actions.flushSyncQueue();
    const chat = useChatStore.getState();
    chat.clearPending();
    if (n > 0) {
      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'khumpi', text: es.offline.reconnectMsg });
    }
    return n;
  }, []);

  const toggle = useCallback((): number => {
    return useAppStore.getState().isOffline ? goOnline() : (goOffline(), -1);
  }, [goOffline, goOnline]);

  return { isOffline, goOffline, goOnline, toggle };
}
