/**
 * Explainable, no-ML correlation math for sparse health data.
 *
 * Honest about sample size: never invents a pattern if there are too few
 * matching pairs.  All functions are pure (no store access, no side effects).
 */

import type { ChartPoint, GlucoseLog, LogEntry, MealLog, StressLog } from '@/types/index';
import { dateKey, priorNightKey, morningOf } from '@/lib/dateUtils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CorrelationPair {
  /** The morning fasting glucose log. */
  glucose: GlucoseLog;
  /** Hours of sleep from the preceding night. */
  sleepHours: number;
  /** dateKey of the morning (YYYY-MM-DD). */
  morningKey: string;
  /**
   * True when this pair SUPPORTS the hypothesis
   * (sleepHours < 6 AND glucose.payload.value >= 160).
   */
  matched: boolean;
}

export interface CorrelationResult {
  pattern: 'sleep_glucose';
  /** All evaluated morning-glucose / prior-night-sleep pairs. */
  pairs: CorrelationPair[];
  /** Number of pairs where sleepHours < 6 AND glucose >= 160 mg/dL. */
  matchingCount: number;
  /**
   * Confidence level:
   *   'clear'    → matchingCount >= 3
   *   'possible' → matchingCount === 2
   *   null       → < 2 matches — NOT ENOUGH DATA; caller must say so honestly.
   */
  confidence: 'clear' | 'possible' | null;
  /** One ChartPoint per evaluated pair (x = sleepHours bucket, y = glucose value). */
  chartData: ChartPoint[];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Detect the sleep-deprivation → high morning glucose pattern.
 *
 * ## Pairing contract
 * 1. Collect all glucose logs with `payload.moment === 'ayunas'`.
 * 2. For each such log on morning date M, find the sleep log whose
 *    `timestamp` falls on calendar date M-1 (the bedtime of the preceding
 *    night).  Uses `priorNightKey(glucose.timestamp)` matched against
 *    `dateKey(sleep.timestamp)`.
 * 3. If no matching sleep log exists for a morning, that morning is skipped.
 *
 * ## Matching rule (pair "supports the hypothesis")
 *   sleepHours < 6  AND  glucose.payload.value >= 160 mg/dL
 *
 * ## Confidence thresholds
 *   matchingCount >= 3 → 'clear'
 *   matchingCount === 2 → 'possible'
 *   matchingCount < 2  → null (never invent a pattern)
 *
 * @param logs - All LogEntry records for one person.
 * @returns CorrelationResult describing the sleep↔glucose pattern.
 */
export function detectSleepGlucoseCorrelation(logs: LogEntry[]): CorrelationResult {
  // Separate by type for fast access.
  const glucoseLogs = logs.filter((l): l is GlucoseLog => l.type === 'glucose');
  const sleepLogs = logs.filter((l) => l.type === 'sleep');

  // Index sleep logs by bedtime dateKey for O(1) lookup.
  const sleepByNightKey = new Map<string, number>();
  for (const entry of sleepLogs) {
    if (entry.type !== 'sleep') continue; // TS narrowing guard
    const key = dateKey(entry.timestamp);
    // If multiple sleep logs exist for the same night, keep the last one
    // (most recently recorded overrides; callers should deduplicate upstream).
    sleepByNightKey.set(key, entry.payload.hours);
  }

  const pairs: CorrelationPair[] = [];

  for (const g of glucoseLogs) {
    // Only morning fasting readings qualify.
    if (g.payload.moment !== 'ayunas') continue;

    const nightKey = priorNightKey(g.timestamp);
    const sleepHours = sleepByNightKey.get(nightKey);

    // No sleep log for the prior night → can't form a pair.
    if (sleepHours === undefined) continue;

    const morning = morningOf(g.timestamp); // canonical date key anchor
    const morningKeyValue = dateKey(morning);

    const matched = sleepHours < 6 && g.payload.value >= 160;

    pairs.push({
      glucose: g,
      sleepHours,
      morningKey: morningKeyValue,
      matched,
    });
  }

  const matchingCount = pairs.filter((p) => p.matched).length;

  let confidence: 'clear' | 'possible' | null;
  if (matchingCount >= 3) {
    confidence = 'clear';
  } else if (matchingCount === 2) {
    confidence = 'possible';
  } else {
    confidence = null; // NOT ENOUGH DATA
  }

  const chartData: ChartPoint[] = pairs.map((p) => ({
    label: p.morningKey,
    value: p.glucose.payload.value,
    category: p.sleepHours < 6 ? 'poco sueño' : 'buen sueño',
  }));

  return {
    pattern: 'sleep_glucose',
    pairs,
    matchingCount,
    confidence,
    chartData,
  };
}

// ---------------------------------------------------------------------------
// Lightweight same-day pairing helpers
// ---------------------------------------------------------------------------

/**
 * Pairs each glucose log with all meal logs on the SAME LOCAL CALENDAR DAY.
 * Useful for the detectPattern tool's meal-glucose same-day analysis.
 *
 * @param logs - All LogEntry records for one person.
 * @returns Array of {glucose, related} where related is every meal that day.
 */
export function pairMealsSameDay(
  logs: LogEntry[],
): Array<{ glucose: GlucoseLog; related: MealLog[] }> {
  const glucoseLogs = logs.filter((l): l is GlucoseLog => l.type === 'glucose');
  const mealLogs = logs.filter((l): l is MealLog => l.type === 'meal');

  return glucoseLogs.map((g) => {
    const gKey = dateKey(g.timestamp);
    const related = mealLogs.filter((m) => dateKey(m.timestamp) === gKey);
    return { glucose: g, related };
  });
}

/**
 * Pairs each glucose log with all stress logs on the SAME LOCAL CALENDAR DAY.
 * Useful for the detectPattern tool's stress-glucose same-day analysis.
 *
 * @param logs - All LogEntry records for one person.
 * @returns Array of {glucose, related} where related is every stress log that day.
 */
export function pairStressSameDay(
  logs: LogEntry[],
): Array<{ glucose: GlucoseLog; related: StressLog[] }> {
  const glucoseLogs = logs.filter((l): l is GlucoseLog => l.type === 'glucose');
  const stressLogs = logs.filter((l): l is StressLog => l.type === 'stress');

  return glucoseLogs.map((g) => {
    const gKey = dateKey(g.timestamp);
    const related = stressLogs.filter((s) => dateKey(s.timestamp) === gKey);
    return { glucose: g, related };
  });
}
