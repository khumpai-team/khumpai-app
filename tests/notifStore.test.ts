// tests/notifStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore, unreadCount } from '@/store/useNotificationStore';
import type { AppNotification } from '@/types';

function notif(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'medication',
    title: 't',
    body: 'b',
    severity: 'info',
    createdAt: '2026-06-12T08:00:00.000Z',
    dedupeKey: 'med:x:2026-06-12:08:00',
    status: 'pending',
    ...over,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => useNotificationStore.getState().actions.clear());

  it('ignores a push whose dedupeKey already exists', () => {
    const { push } = useNotificationStore.getState().actions;
    push(notif());
    push(notif({ id: 'n2' })); // same dedupeKey
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it('adds notifications with distinct dedupeKeys', () => {
    const { push } = useNotificationStore.getState().actions;
    push(notif());
    push(notif({ id: 'n2', dedupeKey: 'checkin:2026-06-12' }));
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });

  it('markRead moves a notification out of the unread set', () => {
    const { push, markRead } = useNotificationStore.getState().actions;
    push(notif());
    markRead('n1');
    expect(useNotificationStore.getState().notifications[0].status).toBe('read');
    expect(unreadCount(useNotificationStore.getState().notifications)).toBe(0);
  });
});
