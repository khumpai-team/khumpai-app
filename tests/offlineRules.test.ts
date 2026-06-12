import { describe, it, expect } from 'vitest';
import { evaluateOfflineRules } from '@/lib/offlineRules';
import type { AppState, GlucoseLog, SleepLog } from '@/types';
import { SEED_STATE } from '@/data/seed';

// ---------------------------------------------------------------------------
// Helpers to build minimal AppState fixtures
// ---------------------------------------------------------------------------

const BASE_ENTRY = {
  personId: 'carlos',
  createdAt: new Date().toISOString(),
  source: 'conversation' as const,
  confirmed: true as const,
  isOfflineCapture: false as const,
};

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...SEED_STATE,
    // Clear seed logs by default so rules are fully controlled by test fixtures
    logs: [],
    medications: [],
    syncQueue: [],
    ...overrides,
  };
}

function glucoseLog(value: number, timestamp: string): GlucoseLog {
  return {
    ...BASE_ENTRY,
    id: `test-glu-${value}-${Date.now()}`,
    type: 'glucose',
    timestamp,
    payload: { value, moment: 'ayunas' },
  };
}

function sleepLog(hours: number, timestamp: string): SleepLog {
  return {
    ...BASE_ENTRY,
    id: `test-slp-${hours}-${Date.now()}`,
    type: 'sleep',
    timestamp,
    payload: { hours },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateOfflineRules — glucose_high (> 250)', () => {
  it('latest glucose 300 → rule glucose_high, showEmergencyContact true', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(300, '2026-06-12T09:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_high');
    expect(result!.showEmergencyContact).toBe(true);
    expect(result!.severity).toBe('urgent');
  });

  it('latest glucose 260 → rule glucose_high', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(260, '2026-06-12T09:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_high');
  });
});

describe('evaluateOfflineRules — glucose_low (< 70)', () => {
  it('latest glucose 60 → rule glucose_low, severity emergency', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(60, '2026-06-12T09:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_low');
    expect(result!.severity).toBe('emergency');
    expect(result!.showEmergencyContact).toBe(true);
  });

  it('latest glucose 50 → rule glucose_low', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(50, '2026-06-12T09:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_low');
  });
});

describe('evaluateOfflineRules — sleep_short priority (< 5h, no glucose)', () => {
  it('recent sleep of 4h with normal glucose → rule sleep_short', () => {
    const now = new Date('2026-06-12T10:00:00');
    // Normal glucose (doesn't trigger glucose rules) + short sleep
    const state = makeState({
      logs: [
        glucoseLog(120, '2026-06-12T07:00:00'),  // normal, won't trigger glucose rules
        sleepLog(4, '2026-06-11T23:00:00'),
      ],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('sleep_short');
    expect(result!.severity).toBe('warning');
    expect(result!.showEmergencyContact).toBe(false);
  });

  it('sleep of exactly 4.5h → triggers sleep_short', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [sleepLog(4.5, '2026-06-11T23:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('sleep_short');
  });
});

describe('evaluateOfflineRules — no trigger → null', () => {
  it('normal glucose + adequate sleep + no medications → null', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [
        glucoseLog(120, '2026-06-12T07:00:00'),
        sleepLog(7, '2026-06-11T23:00:00'),
      ],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).toBeNull();
  });

  it('empty logs → null', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({ logs: [] });
    const result = evaluateOfflineRules(state, now);
    expect(result).toBeNull();
  });
});

describe('evaluateOfflineRules — priority: glucose_low takes over sleep_short', () => {
  it('glucose_low fires even when sleep is also short (glucose_low = priority 1)', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [
        glucoseLog(60, '2026-06-12T07:00:00'),
        sleepLog(4, '2026-06-11T23:00:00'),
      ],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    // Priority 1 — glucose_low should win
    expect(result!.rule).toBe('glucose_low');
  });
});

describe('evaluateOfflineRules — message contains the glucose value', () => {
  it('glucose_high message references value 300', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(300, '2026-06-12T09:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result!.message).toContain('300');
  });
});

// ---------------------------------------------------------------------------
// Fix F: stale glucose (> 12 hours old) must NOT fire glucose rules
// ---------------------------------------------------------------------------

describe('evaluateOfflineRules — recency window for glucose rules (Fix F)', () => {
  it('recent low glucose (within 12h) still fires glucose_low', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(60, '2026-06-12T07:00:00')], // 3h ago — recent
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_low');
  });

  it('recent high glucose (within 12h) still fires glucose_high', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(300, '2026-06-12T07:00:00')], // 3h ago — recent
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_high');
  });

  it('2-day-old low glucose does NOT fire glucose_low rule', () => {
    const now = new Date('2026-06-12T10:00:00');
    // Reading is ~2 days old — well outside the 12-hour recency window
    const state = makeState({
      logs: [glucoseLog(60, '2026-06-10T07:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    // Glucose rule should NOT fire; no other rules triggered here
    if (result !== null) {
      expect(result.rule).not.toBe('glucose_low');
      expect(result.rule).not.toBe('glucose_high');
    }
  });

  it('2-day-old high glucose does NOT fire glucose_high rule', () => {
    const now = new Date('2026-06-12T10:00:00');
    const state = makeState({
      logs: [glucoseLog(300, '2026-06-10T07:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    if (result !== null) {
      expect(result.rule).not.toBe('glucose_high');
    }
  });

  it('reading exactly at the 12h boundary fires the rule', () => {
    const now = new Date('2026-06-12T10:00:00');
    // Exactly 12 hours ago
    const state = makeState({
      logs: [glucoseLog(60, '2026-06-11T22:00:00')],
    });
    const result = evaluateOfflineRules(state, now);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('glucose_low');
  });
});
