import { describe, it, expect } from 'vitest';
import { detectSleepGlucoseCorrelation } from '@/lib/correlation';
import { SEED_STATE } from '@/data/seed';

/**
 * The central demo guarantee: Carlos's seed data MUST surface the
 * sleep↔glucose insight with 'clear' confidence (≥3 matching pairs).
 * This proves the seed data and the correlation engine — built independently —
 * actually agree on the day-pairing convention.
 */
describe('detectSleepGlucoseCorrelation over seed data', () => {
  const result = detectSleepGlucoseCorrelation(SEED_STATE.logs);

  it('finds at least 3 matching poor-sleep → high-morning-glucose pairs', () => {
    expect(result.matchingCount).toBeGreaterThanOrEqual(3);
  });

  it("reports 'clear' confidence", () => {
    expect(result.confidence).toBe('clear');
  });

  it('produces chart data for the evaluated pairs', () => {
    expect(result.chartData.length).toBeGreaterThanOrEqual(3);
  });

  it('every matching pair has sleep < 6h and glucose >= 160', () => {
    const matches = result.pairs.filter((p) => p.matched);
    expect(matches.length).toBeGreaterThanOrEqual(3);
    for (const p of matches) {
      expect(p.sleepHours).toBeLessThan(6);
      expect(p.glucose.payload.value).toBeGreaterThanOrEqual(160);
    }
  });
});

describe('detectSleepGlucoseCorrelation honesty on sparse data', () => {
  it('returns null confidence when there are fewer than 2 matching pairs', () => {
    // Only good-sleep mornings → no matching pairs → not enough data.
    const goodOnly = SEED_STATE.logs.filter((l) => {
      if (l.type === 'glucose') return l.payload.moment === 'ayunas' && l.payload.value < 160;
      if (l.type === 'sleep') return l.payload.hours >= 7;
      return false;
    });
    const result = detectSleepGlucoseCorrelation(goodOnly);
    expect(result.confidence).toBeNull();
  });
});
