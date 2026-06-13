// tests/notifMedication.test.ts
import { describe, it, expect } from 'vitest';
import { dueMedicationReminders, forgottenDosesToday } from '@/lib/notifications/medication';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Medication } from '@/types';

function makeState(meds: Medication[], currentPersonId = 'carlos'): AppState {
  return { ...SEED_STATE, logs: [], medications: meds, currentPersonId };
}

function med(over: Partial<Medication> = {}): Medication {
  return {
    id: 'med-x',
    personId: 'carlos',
    name: 'Metformina',
    dose: '850 mg',
    frequency: '2 veces al día',
    schedule: ['08:00'],
    adherenceLog: [],
    ...over,
  };
}

describe('dueMedicationReminders', () => {
  it('emits a reminder when now is inside the dose window', () => {
    const out = dueMedicationReminders(makeState([med()]), new Date('2026-06-12T08:10:00'));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('medication');
    expect(out[0].severity).toBe('info');
    expect(out[0].dedupeKey).toBe('med:med-x:2026-06-12:08:00');
    expect(out[0].relatedId).toBe('med-x');
  });

  it('does not emit before or after the window', () => {
    expect(dueMedicationReminders(makeState([med()]), new Date('2026-06-12T07:30:00'))).toHaveLength(0);
    expect(dueMedicationReminders(makeState([med()]), new Date('2026-06-12T09:30:00'))).toHaveLength(0);
  });

  it('suppresses the reminder once the dose is taken today', () => {
    const m = med({ adherenceLog: [{ date: '2026-06-12', scheduledTime: '08:00', taken: true }] });
    expect(dueMedicationReminders(makeState([m]), new Date('2026-06-12T08:10:00'))).toHaveLength(0);
  });

  it('ignores medications belonging to other persons', () => {
    const out = dueMedicationReminders(makeState([med({ personId: 'rosa' })]), new Date('2026-06-12T08:10:00'));
    expect(out).toHaveLength(0);
  });

  it('handles multiple scheduled times independently', () => {
    const out = dueMedicationReminders(makeState([med({ schedule: ['08:00', '20:00'] })]), new Date('2026-06-12T20:05:00'));
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toBe('med:med-x:2026-06-12:20:00');
  });
});

describe('forgottenDosesToday', () => {
  it('reports a dose only once its reminder window has fully passed', () => {
    const m = med({ schedule: ['08:00'], adherenceLog: [] });
    // 08:50 — still inside the 60-min window, not yet "forgotten"
    expect(forgottenDosesToday(m, new Date('2026-06-12T08:50:00'))).toEqual([]);
    // 09:30 — window passed, dose untaken
    expect(forgottenDosesToday(m, new Date('2026-06-12T09:30:00'))).toEqual(['08:00']);
  });

  it('does not report a dose that was taken', () => {
    const m = med({ schedule: ['08:00'], adherenceLog: [{ date: '2026-06-12', scheduledTime: '08:00', taken: true }] });
    expect(forgottenDosesToday(m, new Date('2026-06-12T09:30:00'))).toEqual([]);
  });

  it('does not report future doses', () => {
    const m = med({ schedule: ['08:00', '20:00'], adherenceLog: [] });
    expect(forgottenDosesToday(m, new Date('2026-06-12T09:30:00'))).toEqual(['08:00']);
  });
});
