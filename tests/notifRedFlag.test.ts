// tests/notifRedFlag.test.ts
import { describe, it, expect } from 'vitest';
import { pendingRedFlagNotifications } from '@/lib/notifications/redFlag';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, SymptomLog } from '@/types';

const NOW = new Date('2026-06-12T10:00:00');
const TODAY = '2026-06-12';

function symptom(description: string, dateIso: string): SymptomLog {
  return {
    id: `s-${description}`,
    personId: 'carlos',
    type: 'symptom',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { description, redFlag: true },
  };
}

function glucose(value: number, dateIso: string): GlucoseLog {
  return {
    id: `g-${value}`,
    personId: 'carlos',
    type: 'glucose',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { value, moment: 'ayunas' },
  };
}

function state(logs: AppState['logs']): AppState {
  return { ...SEED_STATE, logs, medications: [], currentPersonId: 'carlos' };
}

describe('pendingRedFlagNotifications', () => {
  it('emits an urgent notification for a very low glucose reading today', () => {
    const out = pendingRedFlagNotifications(state([glucose(45, `${TODAY}T09:00:00`)]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('red_flag');
    expect(out[0].severity).toBe('urgent');
    expect(out[0].dedupeKey).toBe('redflag:g-45');
  });

  it('does not emit for an in-range glucose reading', () => {
    expect(pendingRedFlagNotifications(state([glucose(120, `${TODAY}T09:00:00`)]), NOW)).toHaveLength(0);
  });

  it('does not emit for red-flag logs from a previous day', () => {
    expect(pendingRedFlagNotifications(state([glucose(45, '2026-06-11T09:00:00')]), NOW)).toHaveLength(0);
  });

  it('emits for an emergency symptom description', () => {
    const out = pendingRedFlagNotifications(state([symptom('dolor en el pecho', `${TODAY}T09:00:00`)]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('urgent');
  });
});
