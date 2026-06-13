// tests/notifCaregiver.test.ts
import { describe, it, expect } from 'vitest';
import {
  caregiverAlertConditions,
  caregiverAlerts,
  caregiverPatientStatus,
} from '@/lib/notifications/caregiver';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, Medication, NotificationContext, Person, SymptomLog } from '@/types';

const NOW = new Date('2026-06-12T10:00:00');
const TODAY = '2026-06-12';

function glucose(value: number, dateIso: string, personId = 'carlos'): GlucoseLog {
  return {
    id: `g-${personId}-${value}`,
    personId,
    type: 'glucose',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { value, moment: 'ayunas' },
  };
}

function symptom(description: string, dateIso: string, personId = 'carlos'): SymptomLog {
  return {
    id: `s-${personId}`,
    personId,
    type: 'symptom',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { description, redFlag: true },
  };
}

function ctx(over: Partial<NotificationContext> = {}): NotificationContext {
  return { stock: {}, capacity: {}, lastCheckinDate: null, ...over };
}

/** Carlos's med with this morning's dose already taken, so "forgot pill" stays quiet. */
const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1/día', schedule: ['08:00'],
  adherenceLog: [{ date: TODAY, scheduledTime: '08:00', taken: true }],
};

const PERSONS: Person[] = [{ id: 'carlos', name: 'Carlos', relation: 'self', color: '#000' }];

function state(over: Partial<AppState> = {}): AppState {
  return { ...SEED_STATE, persons: PERSONS, logs: [], medications: [MED], currentPersonId: 'carlos', ...over };
}

describe('caregiverAlertConditions', () => {
  it('flags high glucose only when the latest reading is >=180 and dated today', () => {
    const c = caregiverAlertConditions([glucose(210, `${TODAY}T09:00:00`)], 'carlos', NOW, { remaining: 30, capacity: 30 });
    expect(c.highToday).toBe(210);
  });

  it('does not flag a high reading from a previous day', () => {
    const c = caregiverAlertConditions([glucose(210, '2026-06-11T09:00:00')], 'carlos', NOW, { remaining: 30, capacity: 30 });
    expect(c.highToday).toBeNull();
  });

  it('flags low stock at or below max(6, 20% of capacity)', () => {
    expect(caregiverAlertConditions([], 'carlos', NOW, { remaining: 6, capacity: 30 }).stockLow).toBe(true);
    expect(caregiverAlertConditions([], 'carlos', NOW, { remaining: 10, capacity: 30 }).stockLow).toBe(false);
  });
});

describe('caregiverPatientStatus', () => {
  it('is calm with no alerts when everything is in order', () => {
    const s = caregiverPatientStatus([glucose(120, `${TODAY}T09:00:00`)], [MED], 'carlos', NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(s.severity).toBe('calm');
    expect(s.alerts).toHaveLength(0);
  });

  it('warns on high glucose today', () => {
    const s = caregiverPatientStatus([glucose(195, `${TODAY}T09:00:00`)], [MED], 'carlos', NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(s.severity).toBe('warn');
    expect(s.alerts.map((a) => a.kind)).toContain('high');
  });

  it('warns on a forgotten dose (window fully passed, not taken)', () => {
    const med: Medication = { ...MED, adherenceLog: [] };
    const s = caregiverPatientStatus([], [med], 'carlos', NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(s.severity).toBe('warn');
    expect(s.alerts.map((a) => a.kind)).toContain('forgotPill');
  });

  it('escalates to urgent on a red-flag symptom today', () => {
    const s = caregiverPatientStatus([symptom('dolor en el pecho', `${TODAY}T09:00:00`)], [MED], 'carlos', NOW, ctx());
    expect(s.severity).toBe('urgent');
    expect(s.alerts[0].kind).toBe('redFlag');
  });

  it('orders the red flag first and keeps urgent over warn', () => {
    const med: Medication = { ...MED, adherenceLog: [] };
    const s = caregiverPatientStatus(
      [symptom('dolor en el pecho', `${TODAY}T09:00:00`), glucose(220, `${TODAY}T09:30:00`)],
      [med], 'carlos', NOW, ctx({ stock: { 'med-x': 4 }, capacity: { 'med-x': 30 } }),
    );
    expect(s.severity).toBe('urgent');
    expect(s.alerts[0].kind).toBe('redFlag');
    expect(s.alerts.map((a) => a.kind)).toEqual(['redFlag', 'high', 'forgotPill', 'stock']);
  });
});

describe('caregiverAlerts', () => {
  it('emits a high-glucose alert with a per-day dedupe key', () => {
    const out = caregiverAlerts(state({ logs: [glucose(210, `${TODAY}T09:00:00`)] }), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('caregiver');
    expect(out[0].severity).toBe('warn');
    expect(out[0].dedupeKey).toBe('caregiver:high:carlos:2026-06-12');
  });

  it('emits a forgotten-pill alert when a dose window has passed unmarked', () => {
    const med: Medication = { ...MED, adherenceLog: [] };
    const out = caregiverAlerts(state({ medications: [med] }), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toBe('caregiver:forgotPill:carlos:2026-06-12');
  });

  it('emits a low-stock alert', () => {
    const out = caregiverAlerts(state(), NOW, ctx({ stock: { 'med-x': 4 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toBe('caregiver:stock:carlos:2026-06-12');
  });

  it('emits nothing when calm', () => {
    const out = caregiverAlerts(state(), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(0);
  });

  it('emits alerts for EVERY patient, not just the selected one', () => {
    const rosa: Person = { id: 'rosa', name: 'Rosa', relation: 'mother', color: '#111' };
    const rosaMed: Medication = {
      id: 'med-r', personId: 'rosa', name: 'Glibenclamida', dose: '5mg',
      frequency: '1/día', schedule: ['08:00'],
      adherenceLog: [{ date: TODAY, scheduledTime: '08:00', taken: true }],
    };
    const out = caregiverAlerts(
      state({
        persons: [...PERSONS, rosa],
        currentPersonId: 'carlos',
        medications: [MED, rosaMed],
        logs: [glucose(190, `${TODAY}T09:00:00`, 'rosa')],
      }),
      NOW,
      ctx({ stock: { 'med-x': 30, 'med-r': 30 }, capacity: { 'med-x': 30, 'med-r': 30 } }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].personId).toBe('rosa');
    expect(out[0].dedupeKey).toBe('caregiver:high:rosa:2026-06-12');
  });
});
