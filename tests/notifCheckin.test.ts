// tests/notifCheckin.test.ts
import { describe, it, expect } from 'vitest';
import { dueCheckinNudge } from '@/lib/notifications/checkin';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, NotificationContext } from '@/types';

const TODAY = '2026-06-12';

function ctx(over: Partial<NotificationContext> = {}): NotificationContext {
  return { stock: {}, capacity: {}, lastCheckinDate: null, ...over };
}

function state(logs: AppState['logs'] = []): AppState {
  return { ...SEED_STATE, logs, medications: [], currentPersonId: 'carlos' };
}

function glucose(dateIso: string): GlucoseLog {
  return {
    id: 'g', personId: 'carlos', type: 'glucose', timestamp: dateIso, createdAt: dateIso,
    source: 'conversation', confirmed: true, isOfflineCapture: false,
    payload: { value: 110, moment: 'ayunas' },
  };
}

describe('dueCheckinNudge', () => {
  it('nudges after the morning hour when nothing is logged today', () => {
    const out = dueCheckinNudge(state(), new Date('2026-06-12T10:00:00'), ctx());
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('checkin');
    expect(out[0].dedupeKey).toBe(`checkin:${TODAY}`);
  });

  it('stays silent before the morning hour', () => {
    expect(dueCheckinNudge(state(), new Date('2026-06-12T07:00:00'), ctx())).toHaveLength(0);
  });

  it('stays silent once the morning check-in is already done today', () => {
    expect(dueCheckinNudge(state(), new Date('2026-06-12T10:00:00'), ctx({ lastCheckinDate: TODAY }))).toHaveLength(0);
  });

  it('stays silent when something is already logged today', () => {
    expect(dueCheckinNudge(state([glucose(`${TODAY}T08:00:00`)]), new Date('2026-06-12T10:00:00'), ctx())).toHaveLength(0);
  });
});
