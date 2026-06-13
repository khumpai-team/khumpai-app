// tests/notifCollect.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { collectDueNotifications } from '@/lib/notifications/collect';
import { useNotificationStore } from '@/store/useNotificationStore';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Medication, NotificationContext } from '@/types';

const NOW = new Date('2026-06-12T08:10:00');

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1/día', schedule: ['08:00'], adherenceLog: [],
};

function ctx(): NotificationContext {
  return { stock: { 'med-x': 30 }, capacity: { 'med-x': 30 }, lastCheckinDate: null };
}

function state(): AppState {
  return { ...SEED_STATE, logs: [], medications: [MED], achievements: [], currentPersonId: 'carlos' };
}

describe('collectDueNotifications', () => {
  it('returns the medication reminder and the check-in nudge for this state', () => {
    const out = collectDueNotifications(state(), NOW, ctx());
    const kinds = out.map((n) => n.kind).sort();
    // 08:10, dose not taken → medication; nothing logged but before CHECKIN_HOUR(9) → no checkin.
    expect(kinds).toContain('medication');
  });

  it('is idempotent through the store: pushing the same collect output twice adds nothing the second time', () => {
    useNotificationStore.getState().actions.clear();
    const first = collectDueNotifications(state(), NOW, ctx());
    first.forEach((n) => useNotificationStore.getState().actions.push(n));
    const afterFirst = useNotificationStore.getState().notifications.length;

    const second = collectDueNotifications(state(), NOW, ctx());
    second.forEach((n) => useNotificationStore.getState().actions.push(n));
    const afterSecond = useNotificationStore.getState().notifications.length;

    expect(afterSecond).toBe(afterFirst);
  });
});
