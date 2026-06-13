// tests/notifCaregiver.test.ts
import { describe, it, expect } from 'vitest';
import { caregiverAlertConditions, caregiverAlerts } from '@/lib/notifications/caregiver';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, Medication, NotificationContext } from '@/types';

const NOW = new Date('2026-06-12T10:00:00');
const TODAY = '2026-06-12';

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

function ctx(over: Partial<NotificationContext> = {}): NotificationContext {
  return { stock: {}, capacity: {}, lastCheckinDate: null, ...over };
}

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1/día', schedule: ['08:00'], adherenceLog: [],
};

function state(over: Partial<AppState> = {}): AppState {
  return { ...SEED_STATE, logs: [], medications: [MED], currentPersonId: 'carlos', ...over };
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

describe('caregiverAlerts', () => {
  it('emits a high-glucose alert with a per-day dedupe key', () => {
    const out = caregiverAlerts(state({ logs: [glucose(210, `${TODAY}T09:00:00`)] }), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('caregiver');
    expect(out[0].severity).toBe('warn');
    expect(out[0].dedupeKey).toBe('caregiver:high:carlos:2026-06-12');
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
});
