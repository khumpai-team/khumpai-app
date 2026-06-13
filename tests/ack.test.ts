import { describe, it, expect } from 'vitest';
import { ackForEntries, glucoseMessage } from '@/agent/ack';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { evaluateRedFlag } from '@/agent/tools';
import type { LogEntry } from '@/types';

// Minimal entry builder — only the fields ackForEntries reads matter.
function entry(partial: Pick<LogEntry, 'type' | 'payload'>): LogEntry {
  return {
    id: 'log_test',
    personId: 'p1',
    timestamp: '2026-06-12T08:00:00.000Z',
    createdAt: '2026-06-12T08:00:00.000Z',
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    ...partial,
  } as LogEntry;
}

describe('glucoseMessage — range-aware', () => {
  it('low (<70)', () => expect(glucoseMessage(60)).toBe(AGENT_ES.glucose.low(60)));
  it('ok (70–179)', () => expect(glucoseMessage(110)).toBe(AGENT_ES.glucose.ok(110)));
  it('high (180–249)', () => expect(glucoseMessage(200)).toBe(AGENT_ES.glucose.high(200)));
  it('veryHigh (≥250)', () => expect(glucoseMessage(260)).toBe(AGENT_ES.glucose.veryHigh(260)));
});

describe('ackForEntries', () => {
  it('glucose entry → range-aware glucose message', () => {
    const e = entry({ type: 'glucose', payload: { value: 110, moment: 'ayunas' } });
    expect(ackForEntries(e)).toBe(AGENT_ES.glucose.ok(110));
  });

  it('meal paired with glucose → the glucose message', () => {
    const meal = entry({ type: 'meal', payload: { description: 'pan con palta', context: 'casa' } });
    const glucose = entry({ type: 'glucose', payload: { value: 160, moment: 'post-desayuno' } });
    expect(ackForEntries(meal, glucose)).toBe(AGENT_ES.glucose.ok(160));
  });

  it('meal alone → savedMeal', () => {
    const meal = entry({ type: 'meal', payload: { description: 'pan con palta', context: 'casa' } });
    expect(ackForEntries(meal)).toBe(AGENT_ES.confirmations.savedMeal);
  });

  it('short sleep (<6h) → sleepShort', () => {
    const e = entry({ type: 'sleep', payload: { hours: 4 } });
    expect(ackForEntries(e)).toBe(AGENT_ES.offline.sleepShort(4));
  });

  it('normal sleep (≥6h) → savedSleep', () => {
    const e = entry({ type: 'sleep', payload: { hours: 8 } });
    expect(ackForEntries(e)).toBe(AGENT_ES.confirmations.savedSleep);
  });

  it('medication → savedMedication', () => {
    const e = entry({ type: 'medication', payload: { name: 'Metformina', taken: true } });
    expect(ackForEntries(e)).toBe(AGENT_ES.confirmations.savedMedication);
  });

  it('symptom → red-flag evaluation message', () => {
    const e = entry({ type: 'symptom', payload: { description: 'me duele un poco la cabeza' } });
    // Routed through evaluateRedFlag — assert it is non-empty and matches that path.
    expect(ackForEntries(e)).toBe(evaluateRedFlag('me duele un poco la cabeza').message);
  });

  it('unknown type → savedLong default', () => {
    const e = entry({ type: 'mood', payload: { score: 3 } });
    expect(ackForEntries(e)).toBe(AGENT_ES.confirmations.savedLong);
  });
});
