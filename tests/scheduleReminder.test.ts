// tests/scheduleReminder.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/appStore';
import { scheduleReminder } from '@/agent/tools/scheduleReminder';
import type { Medication } from '@/types';

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1 vez al día', schedule: ['08:00'], adherenceLog: [],
};

describe('scheduleReminder', () => {
  beforeEach(() => useAppStore.setState({ medications: [{ ...MED, schedule: ['08:00'] }] }));

  it('returns a scheduled result', () => {
    expect(scheduleReminder({ medicationId: 'med-x', time: '20:00' })).toEqual({
      scheduled: true,
      medicationId: 'med-x',
      time: '20:00',
    });
  });

  it('adds a new time to the medication schedule (sorted)', () => {
    scheduleReminder({ medicationId: 'med-x', time: '20:00' });
    const med = useAppStore.getState().medications.find((m) => m.id === 'med-x');
    expect(med?.schedule).toEqual(['08:00', '20:00']);
  });

  it('is idempotent for a time that already exists', () => {
    scheduleReminder({ medicationId: 'med-x', time: '08:00' });
    const med = useAppStore.getState().medications.find((m) => m.id === 'med-x');
    expect(med?.schedule).toEqual(['08:00']);
  });

  it('still validates input', () => {
    expect(() => scheduleReminder({ medicationId: '', time: '08:00' })).toThrow();
    expect(() => scheduleReminder({ medicationId: 'med-x', time: '8am' })).toThrow();
  });
});
